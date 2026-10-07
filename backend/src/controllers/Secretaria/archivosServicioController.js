import { randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';
import prisma from '../../app/prismaClient.js';
import { parsePositiveId } from '../../utils/domainValidation.js';
import { buildPaginationMeta, parsePagination } from '../../utils/pagination.js';
import { hasPermission, PERMISSIONS } from '../../utils/permissions.js';
import { normalizeRole } from '../../utils/roles.js';
import { withAuditUser } from '../../utils/auditContext.js';
import { cierreCorregible, validarCorreccionCierre } from '../../utils/correccionCierre.js';
import { assertTrabajoPropio, auditMotivo, fail, lockTrabajo, motivoObligatorio } from '../../utils/tecnicoWorkflow.js';
import { getBusinessSettings } from '../../services/adminSettingsService.js';
import { maxPhotoBytes, photoLimitLabel } from '../../utils/photoLimit.js';
import { borrarFoto, guardarFoto, isR2Key, leerFoto, r2Configured, r2ServiceKey } from '../../services/Secretaria/fotoStorage.js';

const uploadRoot = path.resolve(process.env.SERVICE_UPLOAD_DIR || 'uploads/servicios');
const types = {
  diagnostico: ['FOTO_RECEPCION', 'FOTO_DIAGNOSTICO', 'FOTO_SALIDA_SIN_REPARAR'],
  orden: ['FOTO_REPARACION', 'FOTO_ENTREGA'],
};

const mimeInfo = {
  'image/jpeg': { ext: '.jpg', valid: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: '.png', valid: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  'image/webp': { ext: '.webp', valid: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
};

export const galeriaServicio = async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const search = String(req.query.search || '').trim();
    const fecha = String(req.query.fecha || '').trim();
    if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return res.status(400).json({ error: 'Fecha inválida' });
    const inicio = fecha ? new Date(`${fecha}T00:00:00-06:00`) : null;
    if (inicio && Number.isNaN(inicio.getTime())) return res.status(400).json({ error: 'Fecha inválida' });
    const fin = inicio ? new Date(inicio.getTime() + 24 * 60 * 60 * 1000) : null;
    const equipoMatch = { OR: [
      { cliente: { nombre: { contains: search, mode: 'insensitive' } } },
      { marca: { contains: search, mode: 'insensitive' } },
      { modelo: { contains: search, mode: 'insensitive' } },
    ] };
    const numericId = parsePositiveId(search);
    const where = {
      ...(inicio ? { fecha_subida: { gte: inicio, lt: fin } } : {}),
      ...(search ? { OR: [
        ...(numericId ? [{ diagnostico_id: numericId }, { orden_id: numericId }] : []),
        { diagnostico: { is: { equipo: { is: equipoMatch } } } },
        { orden: { is: { diagnostico: { is: { equipo: { is: equipoMatch } } } } } },
      ] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.archivosServicio.findMany({ where, orderBy: { fecha_subida: 'desc' }, skip: offset, take: pageSize,
        select: { id_archivo: true, diagnostico_id: true, orden_id: true, tipo_archivo: true, nombre_original: true, fecha_subida: true,
          diagnostico: { select: { equipo: { select: { marca: true, modelo: true, cliente: { select: { nombre: true } } } } } },
          orden: { select: { diagnostico: { select: { equipo: { select: { marca: true, modelo: true, cliente: { select: { nombre: true } } } } } } } },
        } }),
      prisma.archivosServicio.count({ where }),
    ]);
    res.set('Cache-Control', 'private, no-store');
    return res.json({ data: rows.map((row) => ({ ...row,
      equipo: row.diagnostico?.equipo || row.orden?.diagnostico?.equipo,
      diagnostico: undefined, orden: undefined,
    })), meta: buildPaginationMeta({ page, pageSize, total }) });
  } catch { return res.status(500).json({ error: 'No se pudo cargar el archivo fotográfico' }); }
};

const technicianOwns = async (userId, kind, id) => {
  const tecnico = await prisma.tecnicos.findFirst({ where: { usuario_id: userId, activo: true }, select: { id_tecnico: true } });
  if (!tecnico) return false;
  if (kind === 'diagnostico') {
    const diagnostico = await prisma.diagnosticos.findUnique({ where: { id_diagnostico: id }, select: { tecnico_id: true, ordenes: { select: { tecnico_id: true } } } });
    return diagnostico?.tecnico_id === tecnico.id_tecnico || diagnostico?.ordenes.some((orden) => orden.tecnico_id === tecnico.id_tecnico);
  }
  const orden = await prisma.ordenes.findUnique({ where: { id_orden: id }, select: { tecnico_id: true, diagnostico: { select: { tecnico_id: true } } } });
  return orden?.tecnico_id === tecnico.id_tecnico || (!orden?.tecnico_id && orden?.diagnostico?.tecnico_id === tecnico.id_tecnico);
};

export const autorizarArchivos = (kind) => async (req, res, next) => {
  if (req.method === 'GET' && hasPermission(req.user?.rol, PERMISSIONS.JEFE_TECNICO_VER)) return next();
  const permiso = kind === 'diagnostico' ? PERMISSIONS.DIAGNOSTICOS_GESTIONAR : PERMISSIONS.ORDENES_GESTIONAR;
  if (hasPermission(req.user?.rol, permiso)) return next();
  const id = parsePositiveId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identificador inválido' });
  if (hasPermission(req.user?.rol, PERMISSIONS.TECNICO_TRABAJO) && await technicianOwns(req.user.id, kind, id)) {
    req.photoTechnician = true;
    return next();
  }
  return res.status(403).json({ error: 'No autorizado para este servicio' });
};

export const autorizarContenido = async (req, res, next) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identificador inválido' });
  const archivo = await prisma.archivosServicio.findUnique({ where: { id_archivo: id }, select: { diagnostico_id: true, orden_id: true, visible_tecnico: true } });
  if (!archivo) return res.status(404).json({ error: 'Fotografía no encontrada' });
  if (hasPermission(req.user?.rol, PERMISSIONS.JEFE_TECNICO_VER)) return next();
  const kind = archivo.diagnostico_id ? 'diagnostico' : 'orden';
  const permiso = kind === 'diagnostico' ? PERMISSIONS.DIAGNOSTICOS_GESTIONAR : PERMISSIONS.ORDENES_GESTIONAR;
  if (hasPermission(req.user?.rol, permiso)) return next();
  if (normalizeRole(req.user?.rol) === 'tecnico' && archivo.visible_tecnico && await technicianOwns(req.user.id, kind, archivo.diagnostico_id || archivo.orden_id)) {
    req.photoTechnician = true;
    return next();
  }
  return res.status(403).json({ error: 'No autorizado para este servicio' });
};

export const listarArchivos = (kind) => async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identificador inválido' });
  const where = { ...(kind === 'diagnostico' ? { diagnostico_id: id } : { orden_id: id }),
    ...(req.photoTechnician ? { OR: [{ visible_tecnico: true }, { usuario_id: req.user.id }] } : {}) };
  const data = await prisma.archivosServicio.findMany({ where, orderBy: { id_archivo: 'desc' },
    select: { id_archivo: true, tipo_archivo: true, nombre_original: true, fecha_subida: true, visible_tecnico: true,
      usuario: { select: { nombre_usuario: true } } } });
  const correcciones = kind === 'orden' ? await prisma.intervencionesTecnicas.findMany({
    where: { orden_id: id, tipo: 'CORRECCION_FOTO_CIERRE' }, select: { datos_nuevos: true },
  }) : [];
  const excepciones = new Map(correcciones.map((c) => [c.datos_nuevos?.id_archivo, c.datos_nuevos?.es_excepcion === true]));
  res.set('Cache-Control', 'private, no-store');
  return res.json({ data: req.photoTechnician ? data.map((r) => ({
    id_archivo: r.id_archivo, tipo_archivo: r.tipo_archivo, fecha_subida: r.fecha_subida,
    visible_tecnico: r.visible_tecnico, nombre_original: `Fotografía técnica ${r.id_archivo}.webp`,
    correccion_cierre: excepciones.has(r.id_archivo), es_excepcion: excepciones.get(r.id_archivo) || false,
  })) : data.map((r) => ({ ...r, correccion_cierre: excepciones.has(r.id_archivo), es_excepcion: excepciones.get(r.id_archivo) || false })) });
};

export const subirArchivo = (kind) => async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identificador inválido' });
  const tipo_archivo = String(req.headers['x-tipo-archivo'] || '');
  const tipo_mime = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
  if (!types[kind].includes(tipo_archivo)) return res.status(400).json({ error: 'Tipo de fotografía inválido' });
  if (req.photoTechnician && !['FOTO_DIAGNOSTICO', 'FOTO_REPARACION'].includes(tipo_archivo)) {
    return res.status(403).json({ error: 'El técnico solo puede agregar fotos del diagnóstico o reparación asignados' });
  }
  const bytes = req.body;
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > maxPhotoBytes || !mimeInfo[tipo_mime]?.valid(bytes)) {
    return res.status(400).json({ error: `Adjunte una imagen JPG, PNG o WebP de hasta ${photoLimitLabel}` });
  }
  const servicio = kind === 'diagnostico'
    ? await prisma.diagnosticos.findUnique({
      where: { id_diagnostico: id },
      select: {
        estado_equipo: true,
        equipo: { select: { id_equipo: true, tipo: true, marca: true, modelo: true } },
      },
    })
    : await prisma.ordenes.findUnique({
      where: { id_orden: id },
      select: {
        estado: true,
        tecnico_id: true, irreparable_estado: true, fecha_finalizacion: true, fecha_cierre: true, fecha_entrega: true,
        facturas: { select: { id_factura: true } },
        diagnostico: {
          select: {
            equipo: { select: { id_equipo: true, tipo: true, marca: true, modelo: true } },
          },
        },
      },
    });
  if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' });
  const isCorrection = req.photoTechnician && kind === 'orden' && tipo_archivo === 'FOTO_REPARACION' && cierreCorregible(servicio);
  const settings = isCorrection ? (await getBusinessSettings()).reglas : null;
  let correctionReason = '';
  try { correctionReason = decodeURIComponent(String(req.headers['x-motivo-correccion'] || '')); }
  catch { return res.status(400).json({ error: 'Motivo de corrección inválido' }); }
  const correctionPayload = { motivo: correctionReason, excepcion: req.headers['x-correccion-excepcion'] === 'true' };
  if (isCorrection) {
    try { validarCorreccionCierre(servicio, correctionPayload, settings); }
    catch (error) { return res.status(error.statusCode || 400).json({ error: error.message }); }
  }
  if (tipo_archivo === 'FOTO_SALIDA_SIN_REPARAR' && !['ESPERANDO_RETIRO', 'RETIRADO_SIN_REPARAR'].includes(servicio.estado_equipo)) {
    return res.status(409).json({ error: 'La foto de salida corresponde a un equipo pendiente de retiro' });
  }
  if (tipo_archivo === 'FOTO_ENTREGA' && (!['FINALIZADO', 'IRREPARABLE', 'ENTREGADO'].includes(servicio.estado) || !servicio.facturas?.length)) {
    return res.status(409).json({ error: 'La foto de entrega requiere una orden finalizada y facturada' });
  }
  if (tipo_archivo === 'FOTO_REPARACION' && (servicio.estado === 'CANCELADO' || (servicio.estado === 'ENTREGADO' && !isCorrection))) {
    return res.status(409).json({ error: 'La orden ya no admite fotos de reparación' });
  }
  let safeName;
  try { safeName = path.basename(decodeURIComponent(String(req.headers['x-file-name'] || 'foto'))).slice(0, 180); }
  catch { return res.status(400).json({ error: 'Nombre de archivo inválido' }); }
  let useR2;
  try { useR2 = r2Configured(); }
  catch (error) { return res.status(error.statusCode || 500).json({ error: error.message }); }
  const fileName = `${randomUUID()}${mimeInfo[tipo_mime].ext}`;
  const equipo = kind === 'diagnostico' ? servicio.equipo : servicio.diagnostico.equipo;
  // Todas las etapas y visitas reutilizan la carpeta descriptiva de la primera foto.
  const previousPhoto = useR2 ? await prisma.archivosServicio.findFirst({
    where: {
      ruta_archivo: { contains: `-equipo-${equipo.id_equipo}/` },
      OR: [
        { diagnostico: { is: { equipo_id: equipo.id_equipo } } },
        { orden: { is: { diagnostico: { is: { equipo_id: equipo.id_equipo } } } } },
      ],
    },
    orderBy: { id_archivo: 'asc' },
    select: { ruta_archivo: true },
  }) : null;
  const uploadedAt = new Date();
  const ruta_archivo = useR2 ? r2ServiceKey({
    kind, serviceId: id, equipo, tipoArchivo: tipo_archivo, ext: mimeInfo[tipo_mime].ext,
    existingKey: previousPhoto?.ruta_archivo, uploadedAt,
  }) : fileName;
  const fullPath = path.join(uploadRoot, fileName);
  let uploaded = false;
  try {
    if (useR2) {
      await guardarFoto(ruta_archivo, bytes, tipo_mime);
    } else {
      await mkdir(uploadRoot, { recursive: true });
      await writeFile(fullPath, bytes, { flag: 'wx' });
    }
    uploaded = true;
    const data = await withAuditUser(req.user, async (tx) => {
      let correction;
      if (req.photoTechnician && kind === 'orden' && tipo_archivo === 'FOTO_REPARACION') {
        await lockTrabajo(tx, 'orden', id);
        const current = await tx.ordenes.findUnique({ where: { id_orden: id }, select: {
          estado: true, tecnico_id: true, irreparable_estado: true, fecha_finalizacion: true, fecha_cierre: true, fecha_entrega: true,
          facturas: { select: { id_factura: true } },
        } });
        if (!current) fail(404, 'Orden no encontrada');
        if (current?.estado === 'CANCELADO') fail(409, 'La orden cancelada no admite fotografías técnicas');
        if (cierreCorregible(current)) {
          await assertTrabajoPropio(tx, req.user, current.tecnico_id);
          correction = validarCorreccionCierre(current, correctionPayload, settings || (await getBusinessSettings()).reglas);
          await auditMotivo(tx, correction.motivo, correction.es_excepcion);
        }
      }
      const saved = await tx.archivosServicio.create({ data: {
        diagnostico_id: kind === 'diagnostico' ? id : null,
        orden_id: kind === 'orden' ? id : null,
        tipo_archivo, ruta_archivo, nombre_original: safeName,
        tipo_mime, usuario_id: req.user.id, fecha_subida: uploadedAt,
      } });
      if (correction) await tx.intervencionesTecnicas.create({ data: { orden_id: id, tipo: 'CORRECCION_FOTO_CIERRE',
        motivo: correction.motivo, usuario_id: req.user.id,
        datos_anteriores: { estado: servicio.estado, fecha_finalizacion: servicio.fecha_finalizacion },
        datos_nuevos: { id_archivo: saved.id_archivo, tipo_archivo, es_excepcion: correction.es_excepcion } } });
      return saved;
    });
    return res.status(201).json({ data: { id_archivo: data.id_archivo, tipo_archivo,
      nombre_original: req.photoTechnician ? `Fotografía técnica ${data.id_archivo}.webp` : safeName,
      visible_tecnico: false, fecha_subida: data.fecha_subida } });
  } catch (error) {
    if (uploaded) {
      if (useR2) await borrarFoto(ruta_archivo).catch(() => {});
      else await unlink(fullPath).catch(() => {});
    }
    if (error.statusCode === 503) return res.status(503).json({ error: error.message });
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    throw error;
  }
};

export const descargarArchivo = async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identificador inválido' });
  const archivo = await prisma.archivosServicio.findUnique({ where: { id_archivo: id } });
  if (!archivo) return res.status(404).json({ error: 'Fotografía no encontrada' });
  if (req.photoTechnician) {
    // Re-encode every technical download: never expose EXIF, comments or original filenames.
    try {
      const source = isR2Key(archivo.ruta_archivo) ? await leerFoto(archivo.ruta_archivo)
        : await readFile(path.join(uploadRoot, path.basename(archivo.ruta_archivo)));
      const { default: sharp } = await import('sharp');
      const clean = await sharp(source, { limitInputPixels: 40000000 }).rotate().webp({ quality: 92, effort: 3 }).toBuffer();
      res.type('image/webp');
      res.set('Cache-Control', 'private, no-store');
      res.set('Content-Disposition', `inline; filename="foto-tecnica-${id}.webp"`);
      return res.send(clean);
    } catch { return res.status(422).json({ error: 'No se pudo preparar la fotografía para el expediente técnico' }); }
  }
  if (isR2Key(archivo.ruta_archivo)) {
    try {
      const bytes = await leerFoto(archivo.ruta_archivo);
      res.type(archivo.tipo_mime);
      res.set('Cache-Control', 'private, no-store');
      return res.send(bytes);
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        return res.status(404).json({ error: 'Fotografía no encontrada en R2' });
      }
      if (error.statusCode === 503) return res.status(503).json({ error: error.message });
      throw error;
    }
  }
  res.type(archivo.tipo_mime);
  res.set('Cache-Control', 'private, no-store');
  return res.sendFile(path.join(uploadRoot, path.basename(archivo.ruta_archivo)));
};

export const revisarVisibilidadTecnica = async (req, res) => {
  const allowed = hasPermission(req.user?.rol, PERMISSIONS.DIAGNOSTICOS_GESTIONAR)
    || hasPermission(req.user?.rol, PERMISSIONS.JEFE_TECNICO_APROBAR);
  if (!allowed) return res.status(403).json({ error: 'Solo recepción, jefatura técnica o administración pueden revisar fotografías' });
  const id = parsePositiveId(req.params.id);
  if (!id || typeof req.body.visible_tecnico !== 'boolean') return res.status(400).json({ error: 'Revisión de fotografía no válida' });
  if (req.body.visible_tecnico && req.body.sin_datos_cliente !== true) return res.status(400).json({ error: 'Confirme que la imagen no contiene identidad ni contacto del cliente' });
  try {
    const motivo = motivoObligatorio(req.body.motivo);
    const result = await withAuditUser(req.user, async (tx) => {
      await tx.$queryRaw`SELECT id_archivo FROM "ArchivosServicio" WHERE id_archivo = ${id} FOR UPDATE`;
      const r = await tx.archivosServicio.findUnique({ where: { id_archivo: id } });
      if (!r) fail(404, 'Fotografía no encontrada');
      if (!['FOTO_RECEPCION', 'FOTO_DIAGNOSTICO', 'FOTO_REPARACION'].includes(r.tipo_archivo)) {
        fail(409, 'Las fotografías de entrega y retiro son documentación administrativa');
      }
      if (r.visible_tecnico === req.body.visible_tecnico) fail(409, 'La fotografía ya tiene esa visibilidad');
      await auditMotivo(tx, motivo);
      await tx.archivosServicio.update({ where: { id_archivo: id }, data: { visible_tecnico: req.body.visible_tecnico } });
      await tx.intervencionesTecnicas.create({ data: {
        diagnostico_id: r.diagnostico_id, orden_id: r.orden_id, tipo: 'REVISION_FOTO_TECNICA',
        motivo, usuario_id: req.user.id,
        datos_anteriores: { id_archivo: id, tipo_archivo: r.tipo_archivo, visible_tecnico: r.visible_tecnico },
        datos_nuevos: { id_archivo: id, tipo_archivo: r.tipo_archivo, visible_tecnico: req.body.visible_tecnico },
      } });
      return { id_archivo: id, visible_tecnico: req.body.visible_tecnico };
    });
    res.set('Cache-Control', 'private, no-store');
    return res.json({ data: result });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    throw error;
  }
};
