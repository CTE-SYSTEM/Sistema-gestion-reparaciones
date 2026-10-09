import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import prisma from '../../app/prismaClient.js';
import { buildPaginationMeta, parsePagination } from '../../utils/pagination.js';
import { parsePositiveId } from '../../utils/domainValidation.js';
import { withAuditUser } from '../../utils/auditContext.js';
import { borrarFoto, guardarFoto, leerFoto, r2Configured } from '../../services/archivos/fotoStorage.js';
import { maxPhotoBytes, photoLimitLabel } from '../../utils/photoLimit.js';

const uploadRoot = path.resolve(process.env.PURCHASE_UPLOAD_DIR || 'uploads/compras');
const mimeInfo = {
  'image/jpeg': { ext: '.jpg', valid: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: '.png', valid: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  'image/webp': { ext: '.webp', valid: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  'application/pdf': { ext: '.pdf', valid: (b) => b.length > 8 && b.toString('ascii', 0, 5) === '%PDF-' && b.subarray(-1024).includes(Buffer.from('%%EOF')) },
};
const photoSelect = { id_archivo: true, compra_id: true, nombre_original: true, fecha_subida: true, tipo_mime: true,
  compra: { select: { documento: true, fecha_obtencion: true, proveedor: { select: { nombre: true } }, repuesto: { select: { nombre: true } } } } };

export const listarFotosCompra = async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const rawCompraId = req.params.id || req.query.compra_id;
    const compraId = rawCompraId ? parsePositiveId(rawCompraId) : null;
    if (rawCompraId && !compraId) return res.status(400).json({ error: 'Compra inválida' });
    const search = String(req.query.search || '').trim();
    const fecha = String(req.query.fecha || '').trim();
    if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return res.status(400).json({ error: 'Fecha inválida' });
    const inicio = fecha ? new Date(`${fecha}T00:00:00-06:00`) : null;
    if (inicio && Number.isNaN(inicio.getTime())) return res.status(400).json({ error: 'Fecha inválida' });
    const fin = inicio ? new Date(inicio.getTime() + 24 * 60 * 60 * 1000) : null;
    const compraWhere = {
      ...(compraId ? { id_compra: compraId } : {}),
      ...(inicio ? { fecha_obtencion: { gte: inicio, lt: fin } } : {}),
      ...(search ? { OR: [
        { documento: { contains: search, mode: 'insensitive' } },
        { proveedor: { nombre: { contains: search, mode: 'insensitive' } } },
        { repuesto: { nombre: { contains: search, mode: 'insensitive' } } },
      ] } : {}),
    };
    const where = { compra: { is: compraWhere } };
    const [rows, total] = await Promise.all([
      prisma.archivosCompra.findMany({ where, select: photoSelect, orderBy: { fecha_subida: 'desc' }, skip: offset, take: pageSize }),
      prisma.archivosCompra.count({ where }),
    ]);
    res.set('Cache-Control', 'private, no-store');
    res.json({ data: rows, meta: buildPaginationMeta({ page, pageSize, total }) });
  } catch { res.status(500).json({ error: 'No se pudieron cargar los comprobantes' }); }
};

export const subirFotoCompra = async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Compra inválida' });
  const mime = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
  const bytes = req.body;
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > maxPhotoBytes || !mimeInfo[mime]?.valid(bytes)) {
    return res.status(400).json({ error: `Adjunte un comprobante JPG, PNG, WebP o PDF de hasta ${photoLimitLabel}` });
  }
  const compra = await prisma.compras.findUnique({ where: { id_compra: id }, select: { id_compra: true, fecha_obtencion: true } });
  if (!compra) return res.status(404).json({ error: 'Compra no encontrada' });
  let name;
  try { name = path.basename(decodeURIComponent(String(req.headers['x-file-name'] || 'ticket'))).slice(0, 180); }
  catch { return res.status(400).json({ error: 'Nombre de archivo inválido' }); }
  let useR2;
  try { useR2 = r2Configured(); } catch (error) { return res.status(error.statusCode || 503).json({ error: error.message }); }
  const date = compra.fecha_obtencion || new Date();
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const fileName = `${randomUUID()}${mimeInfo[mime].ext}`;
  const key = useR2 ? `documentos/compras/${year}/${month}/compra-${id}/${fileName}` : fileName;
  const fullPath = path.join(uploadRoot, fileName);
  let stored = false;
  try {
    if (useR2) await guardarFoto(key, bytes, mime);
    else { await mkdir(uploadRoot, { recursive: true }); await writeFile(fullPath, bytes, { flag: 'wx' }); }
    stored = true;
    const row = await withAuditUser(req.user, (tx) => tx.archivosCompra.create({ data: {
      compra_id: id, ruta_archivo: key, nombre_original: name, tipo_mime: mime, usuario_id: req.user.id,
    }, select: photoSelect }));
    res.status(201).json({ data: row });
  } catch (error) {
    if (stored) {
      if (useR2) await borrarFoto(key).catch(() => {});
      else await unlink(fullPath).catch(() => {});
    }
    res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'No se pudo guardar el comprobante' });
  }
};

export const descargarFotoCompra = async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Fotografía inválida' });
  const row = await prisma.archivosCompra.findUnique({ where: { id_archivo: id } });
  if (!row) return res.status(404).json({ error: 'Fotografía no encontrada' });
  try {
    const bytes = row.ruta_archivo.startsWith('compras/') || row.ruta_archivo.startsWith('documentos/compras/') ? await leerFoto(row.ruta_archivo)
      : await readFile(path.join(uploadRoot, path.basename(row.ruta_archivo)));
    res.type(row.tipo_mime);
    res.set('Cache-Control', 'private, no-store');
    res.set('Content-Disposition', 'inline');
    return res.send(bytes);
  } catch (error) { return res.status(error.statusCode || 404).json({ error: 'No se pudo abrir la fotografía' }); }
};
