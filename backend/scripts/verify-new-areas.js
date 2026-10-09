import jwt from 'jsonwebtoken';
import prisma from '../src/app/prismaClient.js';
import { env } from '../src/config/env.js';

try {
  const user = await prisma.usuarios.findFirst({ where: { activo: true, rol: { in: ['Administrador', 'admin_pro', 'Admin'] } }, select: { id_usuario: true, nombre_usuario: true, rol: true, sesion_version: true } });
  if (!user) throw new Error('Falta una cuenta administradora activa para la prueba');
  const token = jwt.sign({ id: user.id_usuario, username: user.nombre_usuario, rol: user.rol, sesion_version: user.sesion_version }, env.jwtSecret, { expiresIn: '5m' });
  const endpoints = [
    '/api/bodega/resumen', '/api/bodega/trazabilidad/solicitudes?estado=TODOS&search=monitor&pageSize=20',
    '/api/bodega/reporte.xlsx', '/api/calidad/diagnosticos', '/api/calidad/ordenes',
    '/api/contabilidad/resumen', '/api/contabilidad/resumen/excel', '/api/garantias/politica',
    '/api/garantias?estado=VIGENTES', '/api/reclamos/resumen', '/api/admin_pro/auditoria?modulo=Bodega&limit=1',
  ];
  const results = [];
  for (const endpoint of endpoints) {
    const response = await fetch(`http://127.0.0.1:5000${endpoint}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`${endpoint}: ${response.status} ${(await response.text()).slice(0, 300)}`);
    results.push({ endpoint, status: response.status, type: response.headers.get('content-type') });
    await response.arrayBuffer();
  }
  console.log(JSON.stringify(results));
} finally { await prisma.$disconnect(); }
