# Implementaciones y comprobaciones del 8 de octubre de 2026

## Cambios

- Perfil `Secretaria` presentado como **Operación integral**: reúne recepción, atención al cliente, bodega, calidad, reclamos, garantías, movimientos y reportes operativos. Se puede asignar desde Usuarios; Técnico y Jefe Técnico conservan sus cuentas especializadas.
- Mi cuenta admite nombre de la persona separado del usuario. El nombre y el rol aparecen en la navegación; Mi cuenta y Salir quedan visibles en el pie mientras el menú de páginas se desplaza.
- Servicio al Cliente tiene inicio propio. La entrega del equipo se registra desde facturación; las entregas de Bodega corresponden a piezas.
- Los diagnósticos terminados esperan la aprobación de Calidad antes de aparecer en el flujo de Servicio al Cliente, contactar al cliente, descargar el informe comercial, crear una orden o facturar solo el diagnóstico. Los rechazos quedan visibles en el historial y vuelven al técnico.
- Bodega tiene inventario directo con existencias físicas, reservas, piezas ya entregadas sin facturar, cuarentena y disponibilidad. Las piezas defectuosas se vinculan a compra y, si proceden de un reclamo, a la orden original; se registra su devolución al proveedor.
- Reclamos se abren por cliente, equipo y orden entregada; el historial permite reconocer visitas anteriores y reclamos abiertos. Garantías conserva la orden de reingreso y genera factura sin cobro tras Calidad.
- Contabilidad separa facturación, cobros, saldo por cobrar, egresos y compras sin pago confirmado. Ofrece reportes PDF y Excel. Administración agrega informes de movimientos, Calidad, reclamos y piezas defectuosas; los cambios de auditoría se muestran por campo.
- Los expedientes cerrados de Técnico y Jefe Técnico se descargan en PDF; Jefe Técnico conserva Excel.
- Inicio de bodega con existencias, piezas por entregar, stock mínimo y un informe Excel de entradas y salidas. Las salidas muestran orden, equipo, cliente y compra de origen.
- Compras admite comprobantes JPG, PNG, WebP y PDF; conserva captura con cámara. Los comprobantes nuevos se guardan en `documentos/compras` de R2.
- Entregas de piezas muestra el equipo de destino, el proveedor y la compra seleccionada. Conserva el costo de esa compra para calcular el precio facturado.
- Inicio de calidad con órdenes y diagnósticos terminados, búsqueda, páginas de 20 y contadores generales. Las revisiones guardan resultado, parte afectada, observación y técnico relacionado. Los errores se notifican al técnico y al jefe.
- Inicio de contabilidad con flujo mensual y Excel; incluye cobros, devoluciones, compras, costos de reclamos, gastos operativos y otros ingresos. Conserva los cobros históricos anteriores al registro de movimientos.
- Garantías usa la política central del negocio, permite consultar vigentes, vencidas y pendientes de entrega, y revalidar con motivo auditado. La garantía se genera al facturar una reparación elegible y comienza al entregar el equipo.
- La aprobación de una reparación cubierta exige decidir en el reclamo quién asume el costo.
- Ayudas específicas de calidad, garantías, entregas de piezas y contabilidad. La carga incremental compartida utiliza 20 registros.
- Mi cuenta conserva la navegación del rol. Bodega y Contabilidad regresan a sus nuevos inicios.
- Auditoría organizada por módulo, submódulo y persona. Umbral de alertas técnicas configurable, inicialmente 72 horas.
- Fotos nuevas bajo `fotos/equipos`, con etapas y referencia al servicio. Las seis fotos anteriores del R2 configurado fueron trasladadas y sus referencias actualizadas; se retiraron cuatro objetos temporales vencidos.
- Copia de base PostgreSQL, inventario Excel/PDF e informe en `documentos/respaldos`. Programación local guardada: lunes a las 02:00 de Nicaragua, conservación de 28 días. Próxima ejecución: 12 de octubre de 2026.

## Comprobaciones realizadas

- 9 pruebas de integración de áreas: reclamos, cobertura, calidad, facturación, movimientos, inventario, reportes y perfil integral; incluye bloqueo de diagnósticos no aprobados y prevención de devoluciones duplicadas.
- 20 pruebas de integración de administración: permisos, configuración, auditoría, informes, respaldos, integridad, conservación y restauración en una base temporal.
- 46 pruebas de integración de Secretaría, 32 de Jefe Técnico y 19 de Técnico, todas en bases temporales locales.
- 17 pruebas de reglas administrativas y organización de fotos.
- Compilación de la interfaz completada.
- Once consultas/descargas de los nuevos módulos respondieron correctamente en el servidor local.
- Prueba transaccional de repuestos del mismo modelo y distintos proveedores: costos 100/180, margen fijo 25, precios 125/205 y total 330. Los datos de esta prueba se revirtieron.
- Respaldo real en R2 completo y con integridad comprobada. Incluye un archivo PostgreSQL recuperable; la restauración fue comprobada separadamente en la prueba de administración.
- Navegación y presentación revisadas en navegador local: calidad, Mi cuenta y bodega. Corregido el contraste del título del inicio de bodega.

## Límites de la comprobación

- Las instantáneas de Neon necesitan configurar las credenciales del proyecto y la rama. La copia comprobada corresponde a la base local y está en R2.
- El respaldo de base e inventario no duplica los archivos originales de fotografías; sus referencias sí están en la base.
- La captura con cámara requiere una prueba con el dispositivo físico y sus permisos.
- Los cambios se verificaron localmente; no se publicó una nueva versión.
- La migración aditiva `backend/scripts/migrations/20261008_calidad_inventario_cuentas.sql` se aplicó a la base local. La base Neon configurada en el `.env` del host no se modificó.
