import bcrypt from 'bcryptjs';

export async function seedGroupTwo(prisma, tech) {
  const users = {};
  for (const [name, rol] of Object.entries({ jefe: 'TecnicoJefe', calidad: 'Calidad', reclamos: 'Reclamos', garantias: 'Garantias' })) {
    users[name] = await prisma.usuarios.create({ data: { nombre_usuario: `ui_${name}`, rol, contrasena_hash: await bcrypt.hash('TecladoPrueba2026!', 10) } });
  }
  const cliente = await prisma.clientes.create({ data: { nombre: 'Cliente Posventa', telefono: '88882222' } });
  for (const kind of ['entregado', 'sin-entregar', 'cobertura', 'calidad', 'asignacion']) {
    const equipo = await prisma.equipos.create({ data: { cliente_id: cliente.id_cliente, tipo: 'Laptop', marca: 'Temporal', modelo: kind, numero_serie: `POSVENTA-${kind}` } });
    const d = await prisma.diagnosticos.create({ data: { equipo_id: equipo.id_equipo, tecnico_id: kind === 'asignacion' ? null : tech.id_tecnico,
      estado_del_diagnostico: kind === 'asignacion' ? 'PENDIENTE' : 'COMPLETADO', calidad_estado: ['asignacion', 'calidad'].includes(kind) ? 'PENDIENTE' : 'APROBADO',
      falla_reportada: 'Falla intermitente de prueba', diagnostico_real: 'Fuente revisada para prueba de teclado', presupuesto_estimado: 100 } });
    if (kind === 'asignacion') continue;
    const delivered = ['entregado', 'cobertura'].includes(kind);
    const order = await prisma.ordenes.create({ data: { diagnostico_id: d.id_diagnostico, tecnico_id: tech.id_tecnico,
      estado: delivered ? 'ENTREGADO' : 'FINALIZADO', calidad_estado: kind === 'calidad' ? 'PENDIENTE' : 'APROBADO', resultado_final: 'REPARADO',
      fecha_entrega: delivered ? new Date(Date.now() - 86400000) : null, monto_autorizado: 100 } });
    if (!delivered) continue;
    const invoice = await prisma.facturas.create({ data: { orden_id: order.id_orden, diagnostico_id: d.id_diagnostico, mano_obra: 100, monto_repuestos: 0, monto_diagnostico: 0, subtotal: 100, impuestos: 15, total: 115, metodo_pago: 'Efectivo' } });
    const guarantee = await prisma.garantias.create({ data: { factura_id: invoice.id_factura, duracion_meses: 3, condiciones: 'Garantía ficticia para comprobar el teclado', fecha_inicio: new Date(Date.now() - 86400000), fecha_vencimiento: new Date(Date.now() + 90 * 86400000) } });
    if (kind === 'cobertura') await prisma.reclamos.create({ data: { orden_original_id: order.id_orden, garantia_id: guarantee.id_garantia,
      abierto_por_id: users.reclamos.id_usuario, estado: 'ANALIZADO', responsable_tipo: 'EMPRESA', analisis: 'Falla recurrente comprobada en entorno temporal', descripcion: 'Caso ficticio listo para decidir cobertura' } });
  }
  console.log('Grupo 2: ui_jefe / ui_calidad / ui_reclamos / ui_garantias (misma clave temporal).');
}
