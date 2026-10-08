# Áreas y perfiles del taller (uso local)

La aplicación separa las tareas por área. `Secretaria` sigue disponible para cuentas antiguas, pero no se ofrece al crear usuarios nuevos. Los permisos se comprueban en el servidor, además de mostrar solo el menú correspondiente a cada perfil.

| Perfil | Página inicial | Trabajo propio |
| --- | --- | --- |
| Recepcion | `/recepcion/clientes` | Registrar clientes y equipos, documentar recepción, contactar al cliente, crear órdenes autorizadas, entregar equipos y abrir reclamos. |
| Taller técnico | `/tecnico` | Diagnosticar, reparar, solicitar piezas y dejar pruebas de salida. |
| Jefatura técnica | `/tecnico-jefe` | Asignar trabajos, aprobar piezas y resolver excepciones técnicas. |
| Bodega | `/bodega/repuestos` | Registrar proveedores, compras y existencias; entregar piezas aprobadas indicando la compra de origen en `/bodega/entregas`. |
| Calidad | `/calidad` | Hacer pruebas independientes y aprobar o devolver la orden al taller. |
| Reclamos | `/reclamos` | Analizar fallas posteriores a la entrega, documentar responsable y evidencia, estimar costo y cerrar el expediente. |
| Garantias | `/garantias` | Registrar condiciones y vigencia de garantía; decidir cobertura de reclamos en `/garantias/reclamos`. |
| Contabilidad | `/contabilidad/facturacion` | Emitir facturas y registrar cobros, devoluciones y costos de reclamos en `/contabilidad/movimientos`. |
| Administración | `/admin` | Crear usuarios, supervisar indicadores y consultar las áreas. |

## Secuencia entre áreas

1. Recepción registra el equipo y la autorización del cliente. Jefatura asigna el trabajo al técnico.
2. Si se necesita una pieza, jefatura aprueba la solicitud y Bodega la entrega con su compra de origen. El registro conserva proveedor y documento de compra.
3. El técnico finaliza y Calidad registra sus pruebas. Si falla, la orden vuelve a reparación y se avisa al técnico y a jefatura. Si pasa, se avisa a Contabilidad y Recepción.
4. Contabilidad factura y registra el cobro. Recepción puede entregar cuando la factura está saldada y la calidad está aprobada. Las órdenes anteriores a esta división conservan su tratamiento histórico.
5. Si el cliente reclama, Recepción abre el expediente sobre la orden entregada. Reclamos analiza si la causa fue técnica, del cliente, del proveedor o de la empresa y puede vincular la compra de la pieza. Garantías decide la cobertura.
6. Una cobertura aprobada crea una nueva orden vinculada a la original. La nueva orden pasa por taller y Calidad; al aprobarse se emite automáticamente una factura de garantía por cero. Reclamos cierra el expediente después de la entrega del reingreso. Si se rechaza la cobertura, queda registrada la decisión y su motivo.

Los avisos quedan guardados para cada perfil y aparecen en su bandeja. Se generan, entre otros, por solicitudes y entregas de piezas, finalización y rechazo de calidad, apertura y análisis de reclamos, decisión de cobertura, facturación y movimientos contables.

## Cuentas locales de demostración

El archivo [perfiles-locales.md](../backend/tmp/perfiles-locales.md) contiene los accesos y sus páginas iniciales. Está excluido de Git. Los perfiles de prueba usan la clave `1234`, incluida la cuenta `reclamos_demo`. Para recrearlos en la base Docker local:

```powershell
docker compose exec -T -e LOCAL_DEMO_PROFILES=1 backend node scripts/create-local-profiles.js
```

El comando rechaza producción y conexiones que no sean locales. Solo modifica sus cuentas de prueba. La clave `1234` es exclusivamente para desarrollo local.

## Organización del código

Las páginas están en `frontend/src/features/{recepcion,bodega,calidad,reclamos,garantias,contabilidad}` y los controladores y rutas correspondientes en `backend/src/controllers` y `backend/src/routes/modules`. Los componentes compartidos están en `frontend/src/features/shared`. Las URLs `/secretaria/` continúan para las cuentas y pruebas heredadas.

Los datos nuevos se guardan en `Reclamos`, `RevisionesCalidad` y `MovimientosContables`; `Ordenes` conserva el vínculo de garantía y estado de calidad, y `Ordenes_Repuestos.compra_id` vincula la pieza entregada con su compra. Las entregas anteriores a esta trazabilidad no tienen compra de origen registrada. La ruta heredada de entrega por jefatura sigue operativa para conservar su flujo anterior; las entregas hechas desde Bodega exigen elegir una compra.

Para comprobar los recorridos nuevos con una base PostgreSQL temporal local:

```powershell
docker compose exec -T backend npm run test:areas:integracion
```
