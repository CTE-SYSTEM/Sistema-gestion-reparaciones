import 'dotenv/config';
import prisma from '../src/app/prismaClient.js';
import { withAuditUser } from '../src/utils/auditContext.js';

const database = new URL(process.env.DATABASE_URL || 'postgresql://invalid@invalid/invalid');
if (process.env.NODE_ENV === 'production' || process.env.SGR_SEED_RECLAMOS !== '1' || !['db', 'localhost', '127.0.0.1', '[::1]'].includes(database.hostname)) throw new Error('Los casos de Reclamos solo se cargan en una base local con SGR_SEED_RECLAMOS=1.');
const day = offset => new Date(Date.now() + offset * 86400000);
const prefix = '[PRUEBA RECLAMOS]';
const cases = [
  { code: '01', name: 'Orden lista para abrir reclamo', open: false },
  { code: '02', name: 'Falla repetida por analizar', state: 'ABIERTO' },
  { code: '03', name: 'Falla del taller con garantía vigente', state: 'ANALIZADO', responsible: 'TECNICO' },
  { code: '04', name: 'Daño por líquido atribuible al cliente', state: 'ANALIZADO', responsible: 'CLIENTE' },
  { code: '05', name: 'Pieza defectuosa del proveedor', state: 'ANALIZADO', responsible: 'PROVEEDOR', supplier: true },
  { code: '06', name: 'Garantía vencida por decidir', state: 'ANALIZADO', responsible: 'EMPRESA', expired: true },
  { code: '07', name: 'Reparación cubierta en reingreso', state: 'EN_REINGRESO', responsible: 'TECNICO', reentry: true },
  { code: '08', name: 'Cobertura rechazada pendiente de cierre', state: 'RESUELTO', responsible: 'CLIENTE', rejected: true },
  { code: '09', name: 'Reclamo cerrado con resolución', state: 'CERRADO', responsible: 'CLIENTE', rejected: true },
];
try {
  const actor = await prisma.usuarios.findFirst({ where: { activo: true, rol: { in: ['Administrador', 'admin_pro', 'Admin'] } } });
  if (!actor) throw new Error('Se necesita un administrador activo para registrar la auditoría de los datos de prueba.');
  const users = await prisma.usuarios.findMany({ where: { activo: true, nombre_usuario: { in: ['servicio_cliente_demo', 'reclamos_demo', 'garantias_demo'] } } });
  const userId = name => users.find(user => user.nombre_usuario === name)?.id_usuario || actor.id_usuario;
  const tech = await prisma.tecnicos.findFirst({ where: { activo: true, usuario: { activo: true, rol: 'Tecnico' } } });
  const result = [];
  for (const item of cases) {
    const name = `${prefix} ${item.code} ${item.name}`;
    const saved = await withAuditUser({ id: actor.id_usuario, username: actor.nombre_usuario }, async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(734829)::text`;
      const existing = await tx.clientes.findFirst({
        where: { nombre: name },
        include: { equipos: { include: { diagnosticos: { include: { ordenes: { include: { reclamos_originales: true } } } } } } },
      });
      if (existing) {
        const order = existing.equipos[0]?.diagnosticos[0]?.ordenes[0];
        return { caso: item.code, cliente: name, orden: order?.id_orden, reclamo: order?.reclamos_originales[0]?.id_reclamo || null, estado: 'Ya existe; conserva sus cambios' };
      }
      const deliveredAt = day(item.expired ? -150 : -10);
      const cliente = await tx.clientes.create({ data: { nombre: name, direccion: 'Registro ficticio para probar el módulo de Reclamos' } });
      const equipo = await tx.equipos.create({ data: { cliente_id: cliente.id_cliente, tipo: 'Laptop', marca: 'PRUEBA', modelo: `Reclamos ${item.code}`, numero_serie: `DEMO-RECLAMOS-${item.code}` } });
      const diagnosis = await tx.diagnosticos.create({ data: { equipo_id: equipo.id_equipo, tecnico_id: tech?.id_tecnico,
        falla_reportada: 'El equipo no enciende de forma estable', diagnostico_real: 'Revisión de alimentación y sustitución del componente indicado',
        solucion_propuesta: 'Reparación y pruebas de funcionamiento', presupuesto_estimado: 1500,
        estado_del_diagnostico: 'COMPLETADO', Estado_aprobacion: 'Aprobado', estado_contacto: 'APROBADO', calidad_estado: 'APROBADO',
        fecha_hora: new Date(deliveredAt.getTime() - 4 * 86400000), fecha_completado: new Date(deliveredAt.getTime() - 3 * 86400000),
        observaciones_recepcion: `${prefix} Caso ${item.code}. Datos ficticios para pruebas.` } });
      const orden = await tx.ordenes.create({ data: { diagnostico_id: diagnosis.id_diagnostico, tecnico_id: tech?.id_tecnico, estado: 'FINALIZADO', prioridad: 'Normal', resultado_final: 'REPARADO', monto_autorizado: 1500, fecha_aprobacion_cliente: deliveredAt,
        calidad_estado: 'APROBADO', enciende_salida: true, usa_corriente_ac_salida: true, fecha_finalizacion: deliveredAt, fecha_cierre: deliveredAt,
        observacion_final: `${prefix} Reparación inicial completada.`, pruebas_salida: { encendido: 'CORRECTO', funcion_general: 'CORRECTO' } } });
      let compra = null;
      if (item.supplier) {
        const categoria = await tx.categorias_Repuestos.create({ data: { nombre_tipo: `${prefix} Componentes` } });
        const proveedor = await tx.proveedores.create({ data: { nombre: `${prefix} Proveedor ficticio`, descontinuada: false } });
        const part = await tx.repuestos.create({ data: { tipo_repuesto_id: categoria.id_tipo_repuesto, proveedor_id: proveedor.id_proveedor, nombre: `${prefix} Módulo de alimentación`, costo_individual: 500, ganancia_cordobas: 100 } });
        compra = await tx.compras.create({ data: { repuesto_id: part.id_repuesto, proveedor_id: proveedor.id_proveedor, documento: 'DEMO-RECLAMOS-COMPRA-05', cantidad: 3, costo_unitario: 500, metodo_pago: 'Efectivo', fecha_obtencion: deliveredAt } });
        await tx.ordenes_Repuestos.create({ data: { orden_id: orden.id_orden, repuesto_id: part.id_repuesto, compra_id: compra.id_compra, pieza_solicitada: part.nombre, cantidad_usada: 1, estado_aprobacion: 'APROBADO', estado_entrega: 'ENTREGADO', usuario_aprobador_id: actor.id_usuario, usuario_entregador_id: actor.id_usuario, fecha_entrega: deliveredAt } });
      }
      const factura = await tx.facturas.create({ data: { orden_id: orden.id_orden, diagnostico_id: diagnosis.id_diagnostico, mano_obra: item.supplier ? 900 : 1500, monto_repuestos: item.supplier ? 600 : 0, monto_diagnostico: 0, subtotal: 1500, impuestos: 0, total: 1500, metodo_pago: 'Efectivo', fecha_emision: deliveredAt } });
      await tx.ordenes.update({ where: { id_orden: orden.id_orden }, data: { estado: 'ENTREGADO', fecha_entrega: deliveredAt, entregado_por_id: actor.id_usuario, persona_recibe: name } });
      const garantia = await tx.garantias.upsert({ where: { factura_id: factura.id_factura }, create: { factura_id: factura.id_factura, duracion_meses: 3, fecha_inicio: deliveredAt, fecha_vencimiento: day(item.expired ? -60 : 70), condiciones: `${prefix} Cubre la reparación original; excluye daños nuevos por líquido o golpes.` }, update: { fecha_inicio: deliveredAt, fecha_vencimiento: day(item.expired ? -60 : 70), duracion_meses: 3 } });
      if (item.open === false) return { caso: item.code, cliente: name, orden: orden.id_orden, reclamo: null, estado: 'Disponible para abrir reclamo' };
      let reentry = null;
      if (item.reentry) {
        const d = await tx.diagnosticos.create({ data: { equipo_id: equipo.id_equipo, origen_directo: true, falla_reportada: `${prefix} Reingreso por falla repetida`, diagnostico_real: 'Pendiente de revisión técnica por garantía', estado_del_diagnostico: 'COMPLETADO', Estado_aprobacion: 'Aprobado', estado_contacto: 'APROBADO', presupuesto_estimado: 0, fecha_completado: new Date() } });
        reentry = await tx.ordenes.create({ data: { diagnostico_id: d.id_diagnostico, estado: 'PENDIENTE', prioridad: 'Alta', monto_autorizado: 0, fecha_aprobacion_cliente: new Date(), es_garantia: true } });
      }
      const claim = await tx.reclamos.create({ data: { orden_original_id: orden.id_orden, garantia_id: garantia.id_garantia,
        descripcion: `${prefix} ${item.name}. El cliente vuelve con el equipo para revisar lo ocurrido.`, estado: item.state,
        responsable_tipo: item.responsible || null, compra_id: compra?.id_compra,
        abierto_por_id: userId('servicio_cliente_demo'), fecha_apertura: day(-1),
        ...(item.responsible ? { analizado_por_id: userId('reclamos_demo'), fecha_analisis: new Date(), costo_estimado: item.supplier ? 500 : 350,
          analisis: item.responsible === 'CLIENTE' ? 'Se documentó corrosión reciente y residuos de líquido ajenos a la reparación inicial.' : item.supplier ? 'La pieza de la compra vinculada volvió a fallar durante las pruebas; se requiere revisión del proveedor.' : 'La falla coincide con la intervención inicial; se revisó la responsabilidad y la vigencia de la garantía.' } : {}),
        ...(item.reentry || item.rejected ? { cobertura: item.reentry ? 'APROBADA' : 'RECHAZADA', motivo_cobertura: item.reentry ? 'Garantía vigente y falla atribuible a la reparación original.' : 'Daño nuevo por líquido, documentado y excluido de la cobertura.', decidido_por_id: userId('garantias_demo'), fecha_decision: new Date() } : {}),
        orden_reingreso_id: reentry?.id_orden,
        ...(item.state === 'CERRADO' ? { resolucion: 'Se explicó al cliente la evidencia del daño por líquido y el motivo del rechazo; caso de prueba cerrado.', fecha_cierre: new Date() } : {}),
      } });
      return { caso: item.code, cliente: name, orden: orden.id_orden, factura: factura.id_factura, reclamo: claim.id_reclamo, reingreso: reentry?.id_orden || null, estado: item.state };
    });
    result.push(saved);
  }
  console.log(JSON.stringify({ etiqueta: prefix, casos: result }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
