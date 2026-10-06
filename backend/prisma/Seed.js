import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const passwordHash = '$2b$10$/7IaHp89gi.hRq5HyXQFfu90wgJtVAqjCG.c45nBctOBT6YFZmf9K';

const usuariosSeed = [
  { nombre_usuario: 'admin_pro', correo_electronico: 'admin@sgr.example', rol: 'Administrador' },
  { nombre_usuario: 'secretaria_ana', correo_electronico: 'secretaria@sgr.example', rol: 'Secretaria' },
  { nombre_usuario: 'jefe_tecnico', correo_electronico: 'jefe@sgr.example', rol: 'TecnicoJefe' },
  { nombre_usuario: 'tecnico_juan', correo_electronico: 'juan.perez@sgr.example', rol: 'Tecnico' },
  { nombre_usuario: 'marcos_fix', correo_electronico: 'marcos.fix@sgr.example', rol: 'Tecnico' },
  { nombre_usuario: 'elena_tech', correo_electronico: 'elena.tech@sgr.example', rol: 'Tecnico' },
  { nombre_usuario: 'roberto_vga', correo_electronico: 'roberto.vga@sgr.example', rol: 'Tecnico' },
];

const tecnicosSeed = [
  { usuario: 'marcos_fix', nombre: 'Marcos Galindo', especialidad: 'Microelectrónica y Reballing', horario: 'L-V 09:00-18:00', contacto: '+505 8888-1111' },
  { usuario: 'elena_tech', nombre: 'Elena Rodríguez', especialidad: 'Reparación de Laptops High-End', horario: 'L-V 08:00-17:00', contacto: 'elena.rodriguez@email.com' },
  { usuario: 'roberto_vga', nombre: 'Roberto Sosa', especialidad: 'Consolas y Periféricos', horario: 'Sábados 08:00-14:00', contacto: 'Ext. 104' },
  { usuario: 'tecnico_juan', nombre: 'Juan Pérez', especialidad: 'Reparación General y Móviles', horario: 'L-V 08:00-17:00', contacto: 'tecnico@sgr.example' },
  { usuario: 'jefe_tecnico', nombre: 'Ing. Ricardo Méndez', especialidad: 'Jefe de Taller y Diagnóstico', horario: 'L-S 08:00-17:00', contacto: 'jefe@sgr.example' },
];

const clientesSeed = [
  { nombre: 'Maria Fernanda Rivas', telefono: '88812010', direccion: 'Villa Fontana, Managua', correo: 'maria.rivas@example.com', contacto_secundario: '+505 86662010' },
  { nombre: 'Carlos Mejia Lopez', telefono: '77804512', direccion: 'Reparto San Juan, Managua', correo: 'carlos.mejia@example.com', contacto_secundario: '+1 627337' },
  { nombre: 'Pulperia La Bendicion', telefono: '82223344', direccion: 'Barrio Monimbo, Masaya', correo: 'labendicion@example.com', contacto_secundario: 'Dona Marta' },
  { nombre: 'Universidad Central - Laboratorio 3', telefono: '22789910', direccion: 'Carretera a Masaya km 8, Managua', correo: 'soporte.lab3@example.com', contacto_secundario: 'Ing. Pamela' },
  { nombre: 'Rosa Elena Gutierrez', telefono: '89991425', direccion: 'Residencial Las Mercedes, Leon', correo: 'rosa.gutierrez@example.com', contacto_secundario: '+505 85881425' },
  { nombre: 'Jose Antonio Salinas', telefono: '76543210', direccion: 'Ciudad Sandino, zona 6', correo: 'jose.salinas@example.com', contacto_secundario: '+505 86543210' },
  { nombre: 'Clinica San Rafael', telefono: '22984567', direccion: 'Altamira, Managua', correo: 'clinica.sanrafael@example.com', contacto_secundario: 'Recepcion principal' },
  { nombre: 'Luis Alberto Chavarria', telefono: '81234567', direccion: 'Diriamba, Carazo', correo: 'luis.chavarria@example.com', contacto_secundario: '+505 57234567' },
];

const equiposSeed = [
  { telefono: '88812010', marca: 'HP', tipo: 'Laptop', modelo: 'ProBook 450 G8', numero_serie: 'HP-PB450G8-MGA-001' },
  { telefono: '77804512', marca: 'Dell', tipo: 'Laptop', modelo: 'Inspiron 15 3511', numero_serie: 'DLL-IN3511-CML-002' },
  { telefono: '82223344', marca: 'Epson', tipo: 'Impresora multifuncional', modelo: 'EcoTank L3150', numero_serie: 'EPS-L3150-PLB-003' },
  { telefono: '22789910', marca: 'Lenovo', tipo: 'Laptop', modelo: 'ThinkPad E14 Gen 2', numero_serie: 'LNV-E14-UCL-004' },
  { telefono: '89991425', marca: 'Samsung', tipo: 'Celular', modelo: 'Galaxy A32', numero_serie: 'SM-A325M-REG-005' },
  { telefono: '76543210', marca: 'Sony', tipo: 'Consola', modelo: 'PlayStation 4 Slim', numero_serie: 'SNY-PS4SLIM-JAS-006' },
  { telefono: '22984567', marca: 'Apple', tipo: 'Celular', modelo: 'iPhone 11', numero_serie: 'APL-IP11-CSR-007' },
  { telefono: '81234567', marca: 'Dell', tipo: 'Computadora de escritorio', modelo: 'OptiPlex 3080 Micro', numero_serie: 'DLL-OP3080-LAC-008' },
];

const proveedoresSeed = [
  { nombre: 'TecnoPartes Managua', telefono: '22558801', direccion: 'Bolonia, Managua', correo: 'ventas@tecnopartes.example.com', web: 'https://tecnopartes.example.com', notas: 'Repuestos de laptops y desktops.', descontinuada: false },
  { nombre: 'Zona Digital Nicaragua', telefono: '22773390', direccion: 'Centro Comercial Managua', correo: 'cotizaciones@zonadigital.example.com', web: 'https://zonadigital.example.com', notas: 'Almacenamiento, memorias y cargadores.', descontinuada: false },
  { nombre: 'CompuServ Repuestos', telefono: '22661130', direccion: 'Carretera Norte, Managua', correo: 'compras@compuserv.example.com', web: null, notas: 'Baterías, teclados y pantallas bajo pedido.', descontinuada: false },
];

const categoriasSeed = [
  { nombre_tipo: 'Almacenamiento', electronico: 'Laptop/Desktop' },
  { nombre_tipo: 'Pantallas laptop', electronico: 'Laptop' },
  { nombre_tipo: 'Cargadores', electronico: 'Laptop' },
  { nombre_tipo: 'Repuestos celulares', electronico: 'Celular' },
  { nombre_tipo: 'Consolas', electronico: 'Consola' },
];

const repuestosSeed = [
  { categoria: 'Almacenamiento', proveedor: 'Zona Digital Nicaragua', nombre: 'SSD Kingston A400 480GB SATA', descripcion: 'Unidad SSD 2.5 pulgadas para laptop o desktop', costo_individual: 1650, ganancia_cordobas: 450 },
  { categoria: 'Pantallas laptop', proveedor: 'CompuServ Repuestos', nombre: 'Pantalla laptop 15.6 slim 30 pines FHD', descripcion: 'Panel compatible con HP, Dell, Acer y Lenovo 15.6 FHD', costo_individual: 3250, ganancia_cordobas: 850 },
  { categoria: 'Cargadores', proveedor: 'TecnoPartes Managua', nombre: 'Cargador HP 19.5V 3.33A punta azul', descripcion: 'Adaptador compatible 65W para HP ProBook y Pavilion', costo_individual: 850, ganancia_cordobas: 300 },
  { categoria: 'Repuestos celulares', proveedor: 'TecnoPartes Managua', nombre: 'Bateria iPhone 11 premium', descripcion: 'Bateria de reemplazo alta capacidad para iPhone 11', costo_individual: 1450, ganancia_cordobas: 550 },
];

async function main() {
  await prisma.$transaction(async (tx) => {
    const usuarios = new Map();
    for (const user of usuariosSeed) {
      const saved = await tx.usuarios.upsert({
        where: { nombre_usuario: user.nombre_usuario },
        update: { contrasena_hash: passwordHash, correo_electronico: user.correo_electronico, rol: user.rol, activo: true },
        create: { ...user, contrasena_hash: passwordHash, activo: true },
      });
      usuarios.set(user.nombre_usuario, saved);
    }

    for (const tecnico of tecnicosSeed) {
      const usuario = usuarios.get(tecnico.usuario);
      await tx.tecnicos.upsert({
        where: { usuario_id: usuario.id_usuario },
        update: { nombre: tecnico.nombre, especialidad: tecnico.especialidad, horario: tecnico.horario, contacto: tecnico.contacto, activo: true },
        create: { usuario_id: usuario.id_usuario, nombre: tecnico.nombre, especialidad: tecnico.especialidad, horario: tecnico.horario, contacto: tecnico.contacto, activo: true },
      });
    }

    const clientes = new Map();
    for (const cliente of clientesSeed) {
      // Compatibilidad con la carga histórica que guardaba el prefijo 505
      // en el teléfono principal. El valor canónico del sistema es el número
      // nicaragüense de 8 dígitos; el contacto secundario sigue siendo texto.
      const local = await tx.clientes.findUnique({ where: { telefono: cliente.telefono } });
      const legacy = local
        ? null
        : await tx.clientes.findUnique({ where: { telefono: `505${cliente.telefono}` } });
      const saved = local || legacy
        ? await tx.clientes.update({
            where: { id_cliente: (local || legacy).id_cliente },
            data: { ...cliente, activo: true },
          })
        : await tx.clientes.create({ data: { ...cliente, activo: true } });
      clientes.set(cliente.telefono, saved);
    }

    const equipos = new Map();
    for (const equipo of equiposSeed) {
      const cliente = clientes.get(equipo.telefono);
      const saved = await tx.equipos.findFirst({ where: { numero_serie: equipo.numero_serie } });
      const data = { cliente_id: cliente.id_cliente, marca: equipo.marca, tipo: equipo.tipo, modelo: equipo.modelo, numero_serie: equipo.numero_serie };
      const equipoGuardado = saved
        ? await tx.equipos.update({ where: { id_equipo: saved.id_equipo }, data })
        : await tx.equipos.create({ data });
      equipos.set(equipo.numero_serie, equipoGuardado);
    }

    const proveedores = new Map();
    for (const proveedor of proveedoresSeed) {
      const existing = await tx.proveedores.findFirst({ where: { nombre: { equals: proveedor.nombre, mode: 'insensitive' } } });
      const saved = existing
        ? await tx.proveedores.update({ where: { id_proveedor: existing.id_proveedor }, data: proveedor })
        : await tx.proveedores.create({ data: proveedor });
      proveedores.set(proveedor.nombre, saved);
    }

    const categorias = new Map();
    for (const categoria of categoriasSeed) {
      const existing = await tx.categorias_Repuestos.findFirst({ where: { nombre_tipo: { equals: categoria.nombre_tipo, mode: 'insensitive' } } });
      const saved = existing
        ? await tx.categorias_Repuestos.update({ where: { id_tipo_repuesto: existing.id_tipo_repuesto }, data: categoria })
        : await tx.categorias_Repuestos.create({ data: categoria });
      categorias.set(categoria.nombre_tipo, saved);
    }

    for (const repuesto of repuestosSeed) {
      const categoria = categorias.get(repuesto.categoria);
      const proveedor = proveedores.get(repuesto.proveedor);
      const existing = await tx.repuestos.findFirst({ where: { nombre: { equals: repuesto.nombre, mode: 'insensitive' } } });
      const data = {
        tipo_repuesto_id: categoria.id_tipo_repuesto,
        proveedor_id: proveedor.id_proveedor,
        nombre: repuesto.nombre,
        descripcion: repuesto.descripcion,
        costo_individual: repuesto.costo_individual,
        ganancia_cordobas: repuesto.ganancia_cordobas,
        activo: true,
        descontinuada: false,
      };
      if (existing) await tx.repuestos.update({ where: { id_repuesto: existing.id_repuesto }, data });
      else await tx.repuestos.create({ data });
    }

    const tecnicoJuan = await tx.tecnicos.findFirst({ where: { usuario_id: usuarios.get('tecnico_juan').id_usuario } });
    const equipoListo = equipos.get('HP-PB450G8-MGA-001');
    const equipoPendiente = equipos.get('SM-A325M-REG-005');
    const diagnosticoListo = await tx.diagnosticos.findFirst({ where: { equipo_id: equipoListo.id_equipo, falla_reportada: 'No enciende' } });
    if (!diagnosticoListo) {
      await tx.diagnosticos.create({
        data: {
          equipo_id: equipoListo.id_equipo,
          tecnico_id: tecnicoJuan.id_tecnico,
          falla_reportada: 'No enciende',
          diagnostico_real: 'Falla en circuito de alimentación; requiere reemplazo de componente.',
          presupuesto_estimado: 2850,
          prioridad: 'Alta',
          estado_del_diagnostico: 'COMPLETADO',
          Estado_aprobacion: 'Pendiente',
          deja_cargador: true,
          enciende: false,
          usa_corriente_ac: true,
          fecha_asignacion: new Date(),
          fecha_completado: new Date(),
        },
      });
    }
    const diagnosticoPendiente = await tx.diagnosticos.findFirst({ where: { equipo_id: equipoPendiente.id_equipo, falla_reportada: 'Pantalla rota' } });
    if (!diagnosticoPendiente) {
      await tx.diagnosticos.create({
        data: {
          equipo_id: equipoPendiente.id_equipo,
          falla_reportada: 'Pantalla rota',
          prioridad: 'Normal',
          estado_del_diagnostico: 'PENDIENTE',
          Estado_aprobacion: 'Pendiente',
          deja_cargador: false,
          enciende: true,
          usa_corriente_ac: false,
        },
      });
    }
  });

  console.log('Seed de Prisma completado: usuarios, técnicos, clientes, equipos, inventario y diagnósticos de prueba.');
}

main()
  .catch((error) => {
    console.error('Error en el seed de Prisma:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
