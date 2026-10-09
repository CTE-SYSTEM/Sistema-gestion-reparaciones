# Áreas y perfiles del taller (uso local)

La aplicación separa las tareas por área. `Secretaria` sigue disponible para cuentas antiguas, pero no se ofrece al crear usuarios nuevos. Los permisos se comprueban en el servidor, además de mostrar solo el menú correspondiente a cada perfil.

| Perfil | Página inicial | Trabajo propio |
| --- | --- | --- |
| Recepcion | `/recepcion` | Consultar ingresos de la semana, mes, año y total; registrar clientes, equipos y cada nueva visita. |
| ServicioCliente | `/servicio-cliente/nueva-orden` | Contactar al cliente, registrar su respuesta y autorización, crear la orden, emitir la factura en `/servicio-cliente/facturacion`, entregar el equipo y abrir reclamos. |
| Taller técnico | `/tecnico` | Diagnosticar, reparar, solicitar piezas y dejar pruebas de salida. |
| Jefatura técnica | `/tecnico-jefe` | Asignar trabajos, aprobar piezas y resolver excepciones técnicas. |
| Bodega | `/bodega/repuestos` | Registrar proveedores, compras y existencias; entregar piezas aprobadas indicando la compra de origen en `/bodega/entregas`. |
| Calidad | `/calidad` | Hacer pruebas independientes y aprobar o devolver la orden al taller. |
| Reclamos | `/reclamos` | Analizar fallas posteriores a la entrega, documentar responsable y evidencia, estimar costo y cerrar el expediente. |
| Garantias | `/garantias` | Registrar condiciones y vigencia de garantía; decidir cobertura de reclamos en `/garantias/reclamos`. |
| Contabilidad | `/contabilidad/movimientos` | Consultar facturas y registrar cobros pendientes, devoluciones y costos de reclamos. |
| Administración | `/admin` | Crear usuarios, supervisar indicadores y consultar las áreas. |

## Secuencia entre áreas

1. Recepción registra al cliente, el equipo y su estado de ingreso. Jefatura asigna el diagnóstico al técnico. Al completar el informe, Servicio al Cliente contacta al cliente, registra su autorización y crea la orden.
2. Si se necesita una pieza, jefatura aprueba la solicitud y Bodega la entrega con su compra de origen. El registro conserva proveedor y documento de compra.
3. El técnico finaliza y Calidad registra sus pruebas. Si falla, la orden vuelve a reparación y se avisa al técnico y a jefatura. Si pasa, se avisa a Contabilidad y Servicio al Cliente.
4. Servicio al Cliente emite la factura cuando termina la orden y Calidad la aprueba, o cuando solo corresponde cobrar un diagnóstico. Si se paga al emitir, el cobro queda registrado automáticamente. Contabilidad consulta las facturas y registra pagos pendientes, devoluciones y otros movimientos. Servicio al Cliente entrega cuando la factura está saldada y la calidad está aprobada. Las órdenes anteriores a esta división conservan su tratamiento histórico.
5. Si el cliente reclama, Servicio al Cliente abre el expediente sobre la orden entregada. Reclamos analiza si la causa fue técnica, del cliente, del proveedor o de la empresa y puede vincular la compra de la pieza. Garantías decide la cobertura.
6. Una cobertura aprobada crea una nueva orden vinculada a la original. La nueva orden pasa por taller y Calidad; al aprobarse se emite automáticamente una factura de garantía por cero. Reclamos cierra el expediente después de la entrega del reingreso. Si se rechaza la cobertura, queda registrada la decisión y su motivo.

Los avisos quedan guardados para los perfiles que necesitan actuar y aparecen en su bandeja. Recepción registra y envía información; no muestra bandeja ni abre una conexión de notificaciones. Se generan avisos, entre otros, por solicitudes y entregas de piezas, finalización y rechazo de calidad, apertura y análisis de reclamos, decisión de cobertura, facturación y movimientos contables.

Cuando el mismo equipo regresa meses después por otra falla, Recepción selecciona el cliente y equipo existentes y registra **un diagnóstico nuevo**. Cada visita conserva su propio diagnóstico, orden, factura y garantía. Flujo de atención muestra una tarjeta por atención u orden, ordenadas de la más reciente a la más antigua, con 20 al inicio y más al desplazarse. El panel de Recepción cuenta ingresos por diagnóstico, por lo que el reingreso suma una nueva visita sin duplicar al cliente ni al equipo.

## Cuentas locales de demostración

El archivo [perfiles-locales.md](../backend/tmp/perfiles-locales.md) contiene los accesos y sus páginas iniciales. Está excluido de Git. Los perfiles de prueba usan la clave `1234`, incluida la cuenta `servicio_cliente_demo`. Para recrearlos en la base Docker local:

```powershell
docker compose exec -T -e LOCAL_DEMO_PROFILES=1 backend node scripts/create-local-profiles.js
```

El comando rechaza producción y conexiones que no sean locales. Solo modifica sus cuentas de prueba. La clave `1234` es exclusivamente para desarrollo local.

## Organización del código

Las páginas están en `frontend/src/features/{recepcion,servicioCliente,bodega,calidad,reclamos,garantias,contabilidad}` y los controladores y rutas correspondientes en `backend/src/controllers` y `backend/src/routes/modules`. Los componentes compartidos están en `frontend/src/features/shared`. Las URLs `/secretaria/` continúan para las cuentas y pruebas heredadas.

Los datos nuevos se guardan en `Reclamos`, `RevisionesCalidad` y `MovimientosContables`; `Ordenes` conserva el vínculo de garantía y estado de calidad, y `Ordenes_Repuestos.compra_id` vincula la pieza entregada con su compra. Las entregas anteriores a esta trazabilidad no tienen compra de origen registrada. La ruta heredada de entrega por jefatura sigue operativa para conservar su flujo anterior; las entregas hechas desde Bodega exigen elegir una compra.

Para comprobar los recorridos nuevos con una base PostgreSQL temporal local:

```powershell
docker compose exec -T backend npm run test:areas:integracion
```
