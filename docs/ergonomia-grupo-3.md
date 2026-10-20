# Ergonomía con teclado — grupo 3

Fecha: 15 de octubre de 2026. Contabilidad, Administración y Secretaría.

## Alcance aplicado

Se habilitó el gestor de teclado en las rutas de estos tres módulos, el resumen administrativo y Mi cuenta compartida. Las pantallas compartidas de Recepción, Bodega, Servicio al Cliente, Calidad y posventa conservan la implementación de los grupos anteriores.

| Área | Adaptación |
| --- | --- |
| Contabilidad | Inicio y período, movimientos, reportes financieros y facturación compartida. Los formularios existentes usan el mismo recorrido y los filtros y acciones conservan Tab y Alt+flechas. |
| Administración | Consultas y filtros de clientes, equipos, diagnósticos, órdenes, facturas, inventario y garantías; reportes, auditoría, negocio, reglas y programación de respaldos. Se delimitaron los paneles de edición de órdenes y garantías que no usaban un formulario. |
| Ventanas administrativas | Edición de equipos, usuarios e historial: foco inicial, Tab dentro de la ventana, Escape para cancelar y regreso al botón de origen. Las filas de equipos y usuarios tienen una identidad estable para recuperar el foco tras recargar la tabla. |
| Tarifas | Agregar coloca el foco en el nombre de la fila nueva. Quitar devuelve el foco al bloque de tarifas. Se corrigió el destino que cambiaba antes de completarse el enfoque. |
| Secretaría | Inicio integral y pantallas compartidas con sus permisos. Guardar y Continuar conserva las rutas de Secretaría al pasar de cliente a equipo y de equipo a diagnóstico. Antes dirigía a rutas de Recepción. |
| Cuenta y restauración | Los formularios comparten el recorrido. La confirmación de restauración conserva su texto requerido y su botón bloqueado hasta completarlo. Avanzar con Enter sólo enfoca la acción; no la ejecuta. |

También se corrigió la recuperación del foco después de una carga que deshabilita temporalmente los campos. Los autocompletados cierran las sugerencias cuando se avanza o se sale del control, incluidos los valores escritos manualmente. La creación de usuarios incorpora las restricciones nativas de los campos ya obligatorios y marca la contraseña como nueva para evitar el autocompletado de credenciales existentes.

## Uso

| Tecla | Acción |
| --- | --- |
| Tab / Shift+Tab | Avanzar y retroceder por campos y acciones. |
| Enter / Shift+Enter en texto y números | Pasar al campo siguiente o anterior. Llegar a Guardar no lo activa. |
| Alt+↓ / Alt+↑ | Recorrer campos y botones, incluidos selectores. Alt+→ / Alt+← también funcionan. |
| Alt+Inicio / Alt+Fin | Primer campo o primera acción principal habilitada. |
| Enter en texto largo | Nueva línea; Ctrl+Enter avanza. |
| Flechas y Enter en sugerencias | Elegir y continuar. En las búsquedas por prefijo, escribir desde el comienzo del nombre. |
| Escape en ventanas administrativas | Cancelar/cerrar y regresar al origen. En sugerencias abiertas, primero se cierra la lista. |

Fechas, horas, listas, números y casillas conservan sus teclas nativas. Guardar, confirmar, restaurar o cambiar credenciales exige activar su acción correspondiente y cumplir sus validaciones.

## Recorridos comprobados en navegador

Las escrituras se realizaron en una base local desechable, con datos y usuarios ficticios.

Al terminar se cerraron los servicios y la pestaña de pruebas y se eliminó la base temporal. Se reinició la interfaz habitual para cargar los cambios.

| Recorrido | Resultado |
| --- | --- |
| Contabilidad: registrar gasto operativo | Tipo, monto, método, referencia y motivo recorridos con teclado. Enter conservó una segunda línea del motivo. Guardado correcto y vuelta a Registrar movimiento. |
| Contabilidad: reportes con período y cartera sin fechas | Consultas correctas. Se omiten fechas deshabilitadas y Alt+Fin permite llegar a Consultar. |
| Administración: editar equipo | Se modificó un modelo ficticio. Tab quedó dentro de la ventana; después de guardar se recuperó Editar en la fila correcta aunque cambiara su posición. |
| Administración: usuarios | Se abrió el alta y se comprobó el rechazo de datos incompletos, sin crear una cuenta desde el navegador. Se editó el nombre de persona de una cuenta ficticia conservando rol y estado. |
| Administración: órdenes | Se llegó a Aplicar Cambios con teclado y se cambió a otra orden en el mismo panel, recuperando el primer selector. No se modificó su estado en esta comprobación. |
| Administración: tarifas | Agregar enfocó la fila nueva; se escribió nombre e importe y se guardó una tarifa ficticia con motivo. Quitar devolvió el foco a Agregar. |
| Administración: programación de respaldos | Se recorrió el cambio de frecuencia a mensual, la hora y el día del mes hasta Guardar. Se recargaron los valores sin guardar la programación. No se crearon ni restauraron copias. |
| Administración: centro de reportes | Consulta Resumen del taller completada con resultado visible. |
| Administración: historial editable | Cliente → filtro de equipo → equipo → Editar. Se recorrió la edición de una orden y se canceló con Escape; volvió al botón del mismo registro. |
| Secretaría: cliente → equipo → diagnóstico | Se guardó un cliente ficticio y equipos de prueba usando las acciones de continuación. El diagnóstico recibió cliente y equipo precargados y se mantuvo bajo `/secretaria`. Se canceló sin registrar diagnóstico. |
| Secretaría: modelo manual y Alt+Fin | Las sugerencias se cerraron al continuar y al saltar directamente a Actualizar Equipo. |
| Secretaría: inicio integral y Mi cuenta | Cambio de período con Tab y Espacio; apertura del perfil y avance hasta Usuario con Enter. No se cambiaron contraseñas. |

La lectura del historial de respaldos no ejecutó creación, verificación ni restauración. El entorno reproducible se fuerza ahora a almacenamiento local temporal para que futuras pruebas no lean el historial remoto.

## Verificación automática

- 41 pruebas de ergonomía aprobadas, incluidas 10 específicas del grupo 3.
- 65 pruebas del frontend aprobadas en total.
- Compilación de producción correcta.
- ESLint sin errores en los cinco componentes/utilidades compartidos de teclado y autocompletado revisados.
- La revisión ampliada de páginas administrativas mantiene 10 errores y 5 advertencias de código anterior, principalmente estado en efectos, dependencias y variables sin uso. Esa revisión ampliada no se presenta como aprobada.

Para repetir: `npm run test:ergonomia:grupo3` desde la raíz de SGR. Para la comprobación manual aislada, iniciar `backend/tests/ergonomia/run-ui.js` con `CTE_UI_GROUP3=1` y `CTE_TEST_DATABASE_ADMIN_URL` local; escribir `stop` en su terminal interactiva al terminar.

## Límites y evidencia

Se adaptaron las rutas y formularios indicados, pero no se ejecutó en navegador cada reporte, emisión manual de garantía ni cada transición administrativa de estado. La restauración y el cambio de contraseñas se comprobaron en cuanto a navegación y protección de la acción, sin ejecutar esas operaciones. No se realizó una auditoría exhaustiva móvil o con lectores de pantalla.

- [Edición del historial con foco en Guardar](ergonomia-grupo3-historial.png).
- [Diagnóstico precargado desde Secretaría](ergonomia-grupo3-secretaria.png).

Informes anteriores: [grupo 1](ergonomia-grupo-1.md) y [grupo 2](ergonomia-grupo-2.md).
