# Revisión de Negocio y escenarios de prueba

Fecha: 14 de octubre de 2026. Alcance: configuración de Admin, sus efectos operativos y pruebas existentes relacionadas. Rutas relativas a `SGR/`.

## Seguimiento: bloqueo real en el recorrido de Reclamos

La aclaración del usuario prioriza escenarios y formularios del proyecto completo, no ampliar la edición de nombre/teléfono en Negocio. El prompt de identidad visual se corrigió para cambiar código y recursos de todas las superficies, sin añadir un editor de marca a Negocio.

Caso comprobado con la sesión de **ServicioCliente**: la orden **21** tiene la factura **4**, pero permanece en `FINALIZADO`, sin fecha de entrega ni inicio de garantía. El formulario de Reclamos exige una orden entregada y facturada. El bloqueo previo era real: Facturación ocultaba **Registrar entrega** a ServicioCliente porque `canDeliver` solo admitía Secretaría, aunque el servidor permite gestionar órdenes a ambos perfiles.

Se corrigieron los permisos de acciones visibles en `frontend/src/features/contabilidad/utils/facturacionAccess.js`, consumidos por `Facturacion.jsx`. ServicioCliente, Secretaría y los alias administrativos pueden abrir entrega/facturación; Contabilidad conserva consulta y otros roles no reciben acciones que el servidor rechaza.

Verificación: tres pruebas nuevas de permisos aprobadas, compilación aprobada y comprobación en navegador con la sesión del usuario. **Registrar entrega** aparece y abre **Entrega de la orden #21**, con campos de receptor, observación y fotografía. Falta una foto de entrega en esa orden. No se confirmó entrega, no se cargaron fotografías y no se abrió un reclamo; la orden y su garantía se conservaron.

Evidencia: [Formulario de entrega disponible](orden-21-formulario-entrega.png). El usuario completa el formulario y confirma la entrega real antes de volver a Reclamos. La apertura final del reclamo y el resto de condiciones de entrega quedan pendientes de esa acción del usuario; no se declaran verificados mediante un envío real.

Actualización solicitada: **la foto de entrega ahora es opcional**. Se retiró esa condición del servidor y la sección de fotos queda plegada en ambos formularios de entrega. Se conserva quién recibe el equipo, factura, saldo y control de calidad. La ayuda también indica que la foto es opcional. Pasaron el escenario temporal de ServicioCliente (entregar sin foto, iniciar garantía y abrir reclamo), el grupo de facturación/garantía/entrega de Secretaría y la compilación. La foto se puede agregar voluntariamente incluso después de entregar. Estas comprobaciones no cambiaron la orden 21.

## Hallazgo principal

**Negocio no está conectado a la identidad visual global.** Guardar nombre, correo, teléfono y dirección no cambia automáticamente Login, Sidebar, favicon, correo ni los generadores de PDF/Excel. Los consumidores operativos encontrados sí utilizan meses/condiciones de nuevas garantías y margen inicial de repuestos.

| Campo | Uso comprobado en código |
| --- | --- |
| Nombre, correo, teléfono y dirección | Se validan, persisten y vuelven a mostrarse en el editor administrativo; no se encontraron consumidores directos que los apliquen a la marca global. |
| Meses de garantía | Garantías automáticas en SQL y emisión manual en `backend/src/controllers/garantias/garantiasController.js`. |
| Condiciones de garantía | Nuevas garantías automáticas/manuales; las ya emitidas conservan sus valores. |
| Margen de repuestos | Alta de repuestos en `backend/src/controllers/bodega/repuestoController.js` cuando se omite ganancia explícita. |
| Logo y colores | No hay campos de marca soportados en Negocio; hoy se modifican en recursos/componentes/generadores. |

El PDF de diagnóstico usa `PDF_NOMBRE_NEGOCIO` o «Servicio técnico». Los correos usan `RESEND_FROM_NAME` y también textos SGR propios de la plantilla. Son fuentes separadas que pueden mostrar nombres contradictorios.

## Cambios realizados en las pruebas

- Nuevo `backend/tests/administracion/negocio.test.js`: 44 casos de normalización, aislamiento de secciones, límites y rechazo de entradas inválidas.
- Dos escenarios nuevos en `backend/tests/administracion/api.test.js`: escrituras no autorizadas/invalidación sin cambios y guardados realmente simultáneos con recarga/reintento.
- La prueba de descarga de repuestos ahora espera `repuestos-orden.xlsx`, de acuerdo con el exportador actual y la política de omitir identificadores en el nombre del archivo. Conserva las comprobaciones de contenido, importes, texto y formato XLSX.
- Se corrigió la importación de `reportIdentity.js` en `frontend/src/features/admin/utils/csvExport.js`. La referencia sin extensión impedía iniciar la prueba con Node; la compilación de Vite ya la resolvía.
- `npm run test:admin` desde la raíz ahora incluye las pruebas administrativas del servidor, la comprobación del punto de entrada de la API y la prueba Excel del frontend.

No se implementó todavía el cambio de marca. El prompt y el mapa de archivos para hacerlo están en [prompt-identidad-visual.md](prompt-identidad-visual.md).

## Resultado de las ejecuciones

| Grupo | Resultado final | Alcance |
| --- | --- | --- |
| Servidor: reglas, Negocio y entrada de API | 53 aprobadas | Incluye los 44 casos nuevos de Negocio. |
| Integración administrativa | 23 aprobadas | API y PostgreSQL local con datos, copias y restauración en una base temporal. |
| Otras pruebas de servidor (`tests/unit`) | 36 aprobadas, 1 omitida | Cuenta, permisos, contabilidad, filtros, fotos, correo simulado, restauración y Excel. |
| Frontend | 27 aprobadas | Excel, estados de flujo, fotos, aprobación, teclado y avisos. |
| Compilación de producción | Aprobada | Avisos de paquetes grandes y datos Browserslist antiguos; no impidieron compilar. |

Total sin contar dos veces la prueba Excel: **139 pruebas aprobadas y 1 omitida**. La omitida es `accountingSql.test.js`, que exige activar explícitamente `ACCOUNTING_SQL_TEST=1`; no se cuenta como aprobación de integración contable.

Las dos ejecuciones administrativas crearon y eliminaron sus respectivas bases temporales. Las pruebas de respaldo/restauración se ejecutaron dentro de esas bases. Las pruebas de correo simulan el envío; no demuestran entrega real a una bandeja.

## Escenarios comprobados

«Aprobado» significa que pasó la prueba automatizada correspondiente en esta revisión; no implica revisión visual de la pantalla.

| ID | Escenario | Resultado esperado y comprobado |
| --- | --- | --- |
| N01 | Nombre y contacto con espacios/tildes | Recorta extremos y conserva caracteres de texto. Aprobado. |
| N02 | Contacto opcional vacío | Permite correo, teléfono y dirección vacíos. Aprobado. |
| N03 | Nombre o condiciones vacíos | Rechaza con 400. Aprobado. |
| N04 | Textos de 300 y condiciones de 2 000 caracteres | Acepta límite exacto y rechaza exceso. Aprobado para nombre, teléfono, dirección y condiciones; correo inválido/excesivo también se rechaza. |
| N05 | Correo sin arroba, dominio incompleto o con espacios internos | Rechaza. Aprobado. |
| N06 | Garantía de 1 o 36 meses | Acepta ambos extremos. Aprobado. |
| N07 | Garantía cero, negativa implícita por límite inferior, mayor de 36, decimal o texto | Rechaza valores fuera de contrato; se probaron 0, 37, 1.5, texto, nulo, booleano y números no finitos. Aprobado. |
| N08 | Margen 0, 0.01, 20.5 o 1 000 % | Acepta valores admitidos por la regla actual. Aprobado. |
| N09 | Margen negativo, superior a 1 000, texto o no finito | Rechaza. Aprobado. |
| N10 | Sección mal formada, campo desconocido o intento de enviar logo | Rechaza, incluido `logo_url`. Aprobado. |
| N11 | Actualización parcial de Negocio | Conserva Reglas y Respaldos y no muta objetos originales. Aprobado. |
| N12 | Guardado sin sesión o con Secretaría | Devuelve 401/403 sin modificar configuración. Aprobado. |
| N13 | Motivo vacío, solo espacios, excesivo o revisión inválida | Devuelve 400 sin modificar revisión/valores. Aprobado. |
| N14 | Formulario con revisión antigua | Devuelve 409. Aprobado. |
| N15 | Dos solicitudes simultáneas con la misma revisión | Una recibe 200 y otra 409; avanza una sola revisión y conserva el resto de secciones. Aprobado. |
| N16 | Recargar y reintentar después del conflicto | Usa revisión nueva y guarda contacto normalizado. Aprobado. |
| N17 | Guardado válido | Registra motivo y autor y permite volver a consultar. Aprobado por integración existente. |
| N18 | Nueva garantía automática y manual | Usa configuración; rechaza garantía duplicada. Aprobado. |
| N19 | Cambiar meses tras emitir una garantía | La nueva usa el plazo actualizado y la anterior conserva su duración. Aprobado. |
| N20 | Repuesto sin ganancia explícita y con ganancia cero | Aplica el margen predeterminado al primero y respeta cero en el segundo. Aprobado. |

## Otros escenarios del proyecto comprobados con pruebas existentes

| Área | Situación cubierta |
| --- | --- |
| Cuentas | Contraseña actual obligatoria, cierre de sesiones, mínimo configurado y límite de bytes; respuestas sin hashes. |
| Acceso administrativo | La cuenta propia no puede desactivarse/cambiar su rol; dos desactivaciones simultáneas conservan un administrador activo. |
| Reportes | Catálogo consultable, moneda NIO/USD diferenciada, filtros de fecha/identificador inválidos rechazados y auditoría sin secretos. |
| Excel | Archivo real XLSX, referencias y teléfonos con ceros iniciales como texto, importes numéricos y texto `=2+3` sin convertirse en fórmula. |
| Inventario | Existencia física, reservas y disponible; salidas por entregas reales. |
| Respaldos | Copia completa, corrupción detectada, copia parcial al fallar herramienta, bloqueo concurrente, retención, reintentos y restauración con copia previa. |
| Cierres técnicos | Plazo exacto, excepciones y conservación del informe cuando existe factura/entrega. Comprobado en pruebas unitarias. |
| Recepción y fotos | Permisos por etapa, nombres/rutas, tandas, fallos parciales y reintentos; subir 100 % no equivale a confirmación de guardado. |
| Flujo de atención | Aprobar piezas no equivale a entregarlas; finalizar no equivale a aprobar calidad; documento enviado se guarda antes de aprobar orden. |
| Avisos | Reconexión sin duplicados, respuestas atrasadas y máximo de filas; destino por área. Comprobado en utilidades del frontend. |

Las integraciones completas de Secretaría, Técnico, Jefe Técnico, Áreas y Notificaciones no se ejecutaron en esta revisión. Las comprobaciones anteriores de esas áreas proceden de sus utilidades y pruebas unitarias, salvo los flujos ejercidos desde Administración.

## Riesgos detectados y escenarios pendientes

Estos puntos requieren implementación futura, una prueba adicional o revisión en navegador. No se presentan como errores reproducidos salvo donde se indica evidencia de código.

| Prioridad | Escenario posible | Evidencia o riesgo | Qué revisar |
| --- | --- | --- | --- |
| Alta | Cambiar nombre/contacto esperando actualizar toda la marca | Limitación confirmada: los consumidores visuales no usan esos campos globalmente. | Conectar consumidores y explicar el alcance en Negocio; usar el prompt adjunto. |
| Alta | Guardado confirmado en base pero error al actualizar calendario | `updateConfiguration` guarda primero y luego sincroniza respaldos. Un fallo posterior podría devolver error aunque la configuración ya esté guardada. | Inyectar fallo de calendario, recargar y verificar revisión, auditoría y próxima ejecución. No reproducido. |
| Media | Cortar conexión después de enviar Guardar | El usuario puede desconocer si se confirmó la transacción. | Simular pérdida de respuesta; recargar antes de reintentar. La revisión protege de sobrescribir un guardado ya confirmado. |
| Media | Pulsar Guardar repetidamente o sin cambios | El servidor valida revisión; no rechaza una actualización vacía/sin diferencias por sí misma. | Decidir si se permite auditar guardados sin cambios y probar doble envío desde la pantalla. |
| Media | Recargar valores con cambios locales sin guardar | El editor sustituye los valores al recargar; no se ve una confirmación de descarte en el componente. | Revisar si hace falta aviso antes de perder edición local. |
| Media | Cambiar rápido entre secciones mientras hay cargas | El editor no cancela ni descarta explícitamente respuestas de cargas antiguas. | Simular respuestas fuera de orden y comprobar qué componente permanece montado. No reproducido. |
| Media | Teléfono o dirección sin significado comercial | Son texto libre con límite; no validan existencia/formato real. | Acordar formato de teléfono, múltiples contactos y reglas antes de endurecer validación. |
| Media | Margen de 1 000 % o decimales más precisos que el formulario | El servidor acepta porcentaje finito hasta 1 000 y no limita decimales como el paso 0.01 del formulario. | Decidir límite comercial y precisión; probar redondeo monetario al crear repuesto. |
| Media | Textos que contienen HTML o instrucciones | Son texto libre. Aceptarlos no demuestra ejecución de HTML. | Al conectar marca con correo/PDF, probar escape de contenido y no usar HTML sin sanitizar. |
| Media | Logo enorme, enlace caído o SVG con contenido activo | El editor aún no soporta logos; riesgo futuro. | Validar formato/tamaño, alternativa visual y tratamiento seguro de SVG; no descargar URLs arbitrarias desde servidor. |
| Media | Reiniciar servicio/restaurar una copia con marca distinta | Persistencia y restauración administrativas pasan, pero no hay consumidores de marca dinámica. | Verificar configuración tras reinicio y, cuando exista, refresco de marca/caché en sesiones abiertas. |
| Media | Nombres largos en móvil, Sidebar o documentos | Aceptar texto de 300 caracteres no garantiza que quepa visualmente. | Revisar móvil, zoom, barra colapsada y PDF de varias páginas. Pendiente visual. |
| Baja | Marca distinta en correos y documentos | Fuentes separadas confirmadas: Negocio, variables de entorno y textos fijos. | Unificar nombre y precedencia; mantener intactos datos y archivos emitidos. |

## Cómo repetir

Desde `SGR/`:

```powershell
npm run test:admin
npm run test:admin:integracion
node --test backend/tests/unit/*.test.js
node --test frontend/tests/*.test.js frontend/tests/admin/*.test.mjs frontend/tests/secretaria/*.test.js frontend/tests/notificaciones/*.test.js
npm run build
```

La integración usa el ejecutor existente con Docker y PostgreSQL local: crea una base con nombre generado y la elimina al terminar. No sustituir ese ejecutor por una conexión a la base del taller. La prueba HTTP de la entrada de API necesita permiso para conexiones locales si el entorno restringe la red.
