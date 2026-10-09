# Parámetros y elementos genéricos de SGR

Este documento indica qué puede cambiarse para adaptar SGR a otro taller, dónde se cambia y qué parte del sistema afecta. Describe la versión actual del repositorio. El código y el esquema de la base de datos son la referencia final si una versión futura agrega campos.

## Cómo aplicar un cambio

| Forma de cambio | Cuándo usarla | Publicación necesaria |
| --- | --- | --- |
| **Administración** | Datos del negocio, reglas y programa de respaldos. El administrador entra a las pantallas indicadas y guarda con un motivo. | No; el valor se guarda en PostgreSQL con revisión y auditoría. |
| **Variable del backend** | Claves, URL de base de datos, remitente, rutas de almacenamiento y otras opciones del servidor. | Reiniciar o volver a desplegar la API. |
| **Variable del frontend** (`VITE_`) | URL pública de la API y opciones del navegador. | Compilar y publicar de nuevo la interfaz. Nunca poner secretos aquí. |
| **Código y, a veces, migración** | Catálogos, estados, permisos, reglas que no tienen un editor o estructura de datos nueva. | Probar, migrar datos cuando corresponda y desplegar los componentes afectados. |

Las opciones editables por Administración se definen y validan en [`backend/src/utils/adminPolicy.js`](../backend/src/utils/adminPolicy.js), se guardan mediante [`adminSettingsService.js`](../backend/src/services/adminSettingsService.js) y se presentan en [`ConfigurationEditor.jsx`](../frontend/src/features/admin/components/ConfigurationEditor.jsx). Un cambio de valor nuevo aplica a operaciones futuras; no reescribe automáticamente documentos, garantías ni movimientos existentes.

## 1. Identidad y reglas del negocio

Ruta principal: **Administración → Negocio** (`/admin/configuracion`). Los valores iniciales solo se usan al crear la configuración de una instalación nueva.

| Campo (`negocio`) | Valor inicial | Qué modifica |
| --- | --- | --- |
| `nombre` | Centro Técnico Electrónico | Nombre del taller en los datos de negocio. Es obligatorio. |
| `correo` | Vacío | Correo de contacto del negocio. Puede quedar vacío; no se usa automáticamente como remitente Resend. |
| `telefono` | Vacío | Teléfono de contacto mostrado por las vistas que leen la configuración. |
| `direccion` | Vacío | Dirección del taller. |
| `garantia_meses` | 3 | Duración predeterminada de nuevas garantías; admite de 1 a 36 meses. |
| `garantia_condiciones` | Texto de cobertura y exclusiones de reparación | Condiciones precargadas para nuevas garantías. Es obligatorio y admite hasta 2 000 caracteres. |
| `margen_repuesto_porcentaje` | 0 | Margen inicial de un repuesto cuando no se proporciona ganancia explícita. |

La cabecera de ciertos PDF de diagnóstico tiene además `PDF_NOMBRE_NEGOCIO` en el backend (`Servicio técnico` por defecto), en [`diagnosticoPdf.js`](../backend/src/services/recepcion/diagnosticoPdf.js). Al cambiar la marca, revise tanto `negocio.nombre` como ese valor para evitar nombres distintos. Logos, colores, textos de navegación y estilos de impresión son recursos y componentes de [`frontend/src`](../frontend/src) y de los generadores PDF; actualmente no hay un editor de marca completo.

## 2. Plazos, tarifas, inventario y seguridad

Ruta: **Administración → Reglas del negocio** (`/admin/reglas`).

| Campo (`reglas`) | Valor inicial | Qué modifica |
| --- | --- | --- |
| `garantia_aviso_dias` | 30 | Anticipación con la que resumen y reportes avisan de garantías próximas a vencer; 1–365 días. |
| `orden_atrasada_dias` | 7 | Plazo para marcar una orden activa como atrasada en reportes; 1–365 días. |
| `correccion_cierre_horas` | 24 | Tiempo ordinario para corregir un cierre técnico; 1–168 horas. |
| `correccion_excepcional_habilitada` | Sí | Permite o impide correcciones excepcionales posteriores, sujetas a las demás reglas de integridad. |
| `tarifas_diagnostico` | Lista vacía | Opciones de nombre y monto para diagnósticos. Hasta 30 tarifas, monto positivo con dos decimales. |
| `tarifas_mano_obra` | Lista vacía | Opciones de nombre y monto para mano de obra, con el mismo límite. |
| `stock_minimo_predeterminado` | 1 | Stock mínimo inicial para repuestos nuevos; 0–100 000. |
| `rentabilidad_alerta_porcentaje` | 30 | Umbral de alerta de rentabilidad en indicadores; 0–100. |
| `margen_orden_alerta_porcentaje` | 20 | Umbral de alerta de margen por orden; 0–100. |
| `password_minimo` | 8 | Longitud mínima de contraseñas nuevas; 8–64 caracteres. Bcrypt limita además la entrada a 72 bytes UTF-8. |

Las tarifas existentes y los importes guardados no se recalculan al cambiar estas listas. La validación de contraseña está en [`adminPolicy.js`](../backend/src/utils/adminPolicy.js); la usan altas, cambios y recuperación.

## 3. Respaldos

Ruta: **Administración → Respaldos** (`/admin/respaldos`). Las reglas de validación están en `adminPolicy.js` y la ejecución en [`backupService.js`](../backend/src/services/backupService.js).

| Campo (`respaldos`) | Valor inicial | Qué modifica |
| --- | --- | --- |
| `habilitado` | Sí | Activa o detiene la programación. |
| `frecuencia` | `mensual` | `diaria`, `semanal` o `mensual`. |
| `hora` | `02:00` | Hora local de la ejecución, formato de 24 horas. |
| `dia_semana` | 1 | Día semanal, de 0 a 6, cuando la frecuencia es semanal. |
| `dia_mes` | 1 | Día del mes, de 1 a 28, cuando la frecuencia es mensual. |
| `zona_horaria` | `America/Managua` | Hora de programación. No aparece como campo editable: el servidor acepta únicamente este valor; otra zona requiere código y pruebas. |
| `conservacion_dias` | 0 | Días de retención; cero conserva todas las copias. Se mantiene la última copia completa. |

Una copia completa local depende de `pg_dump`; en Vercel depende de instantáneas Neon y R2. Las fotos y los archivos locales requieren un respaldo propio. Consulte [`administracion.md`](administracion.md#respaldos-y-recuperación) y [`despliegue-vercel-neon.md`](despliegue-vercel-neon.md).

## 4. Usuarios, perfiles y correos

- **Usuarios y roles:** Administración → Usuarios (`/admin/usuarios`) crea o administra personal. Cada usuario edita su correo y contraseña en **Mi cuenta** (`/mi-cuenta`, con accesos desde cada perfil). Los roles asignables desde el formulario y los roles administrativos permitidos están en [`adminPolicy.js`](../backend/src/utils/adminPolicy.js).
- **Permisos:** las autorizaciones del servidor están en [`permissions.js`](../backend/src/utils/permissions.js). Para agregar un rol o una facultad hay que revisar también rutas, menús, nombres de rol y datos existentes en [`roles.js`](../backend/src/utils/roles.js), [`backend/src/routes`](../backend/src/routes) y [`frontend/src`](../frontend/src). Cambiar solo un botón no cambia la autorización del servidor.
- **Recuperación de contraseña:** la pantalla de inicio lleva a `/recuperar-password`. Un código de seis dígitos vence en 10 minutos; se permite una solicitud por minuto y hasta cinco intentos por código. El servidor guarda un hash del código y cierra las sesiones al restablecer la contraseña. Estos valores están en [`passwordRecovery.js`](../backend/src/services/passwordRecovery.js); si se cambia la cantidad de dígitos, actualizar también [`RecuperarPassword.jsx`](../frontend/src/pages/Auth/RecuperarPassword.jsx). No hay recuperación por SMS.
- **Envío genérico de correos:** [`mailService.js`](../backend/src/services/mailService.js) envía por la API de Resend a uno o varios destinatarios; admite texto, HTML o el identificador y variables de una plantilla publicada en Resend. Las plantillas propias del sistema se agrupan en [`mailTemplates.js`](../backend/src/services/mailTemplates.js). Para agregar otra notificación por correo, crear su contenido ahí y llamar `sendTransactionalEmail` desde el servicio del backend que realiza la operación; no enviar desde el navegador.
- **Remitente y respuestas:** `RESEND_FROM_EMAIL` debe pertenecer a un dominio verificado en Resend; `RESEND_FROM_NAME` cambia el nombre visible y `RESEND_REPLY_TO_EMAIL` dirige las respuestas. `negocio.correo` es el contacto del taller y se configura aparte. La clave `RESEND_API_KEY` pertenece exclusivamente al backend.

Para activar el envío real, verificar un dominio en Resend, configurar `RESEND_API_KEY` y `RESEND_FROM_EMAIL` en el entorno de la API, desplegarla y solicitar un código desde una cuenta activa cuyo correo sea accesible. Verificar recepción, caducidad, cambio de contraseña y nuevo inicio de sesión. Si el proveedor rechaza el envío, el código recién generado se borra y la pantalla informa un error. Consulte [API de envío de Resend](https://resend.com/docs/api-reference/emails/send-email) y [dominios](https://resend.com/docs/dashboard/domains/introduction).

**Estado de esta instalación:** el backend local tiene `RESEND_API_KEY` y `RESEND_FROM_EMAIL=onboarding@resend.dev` para probar la recuperación de la cuenta `admin_pruebas_gmail`. Resend aceptó un envío de prueba a su correo, pero la recepción en Gmail debe confirmarse en la bandeja. Sin un dominio propio verificado, el remitente de pruebas solo entrega mensajes al correo de la cuenta Resend; no sirve para recuperaciones de otros usuarios ni avisos a clientes. La dirección `*.vercel.app` de la interfaz no permite administrar los registros DNS necesarios para verificar un remitente. La configuración del despliegue público se gestiona por separado.

## 5. Variables del backend

Use [`backend/.env.example`](../backend/.env.example) como plantilla local. En producción agregue los valores en la configuración privada del proyecto de la API. No guarde claves reales en Git.

| Variable | Uso o valor inicial | Dónde afecta |
| --- | --- | --- |
| `DATABASE_URL` | Conexión PostgreSQL de Prisma; en Neon puede ser la URL agrupada. | Usuarios, órdenes y todos los datos de SGR. |
| `SQL_DATABASE_URL` | Conexión directa para SQL y tareas de mantenimiento; puede usar `DATABASE_URL` como alternativa en ciertas rutas. | Inicialización, SQL y respaldos. |
| `JWT_SECRET` | Secreto para tokens; obligatorio y propio en producción. | Inicio de sesión y hash de códigos de recuperación. Rotarlo invalida sesiones y códigos vigentes. |
| `NODE_ENV` | `development` o `production`. | Reglas de arranque y seguridad. |
| `PORT` | 5000 local por defecto. | Puerto HTTP fuera de entornos administrados. |
| `CORS_ORIGIN`, `FRONTEND_URL` | Orígenes públicos permitidos del frontend. | Acceso del navegador a la API. |
| `REQUEST_BODY_LIMIT` | `1mb` por defecto. | Límite general de peticiones JSON; las rutas de fotos tienen límites propios. |
| `PDF_NOMBRE_NEGOCIO` | `Servicio técnico` si falta. | Cabecera del PDF de diagnóstico. |
| `RESEND_API_KEY` | Clave privada de Resend. | Envío transaccional. |
| `RESEND_FROM_EMAIL` | Correo de un dominio verificado en Resend. | Envío transaccional. |
| `RESEND_FROM_NAME` | `SGR Taller` por defecto. | Nombre visible y asunto de recuperación. |
| `RESEND_REPLY_TO_EMAIL` | Correo opcional para respuestas. | Respuestas a mensajes transaccionales. |
| `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Datos de bucket privado. | Fotos y, si se activa, respaldos remotos. Las cuatro deben estar completas. |
| `R2_ENDPOINT` | Endpoint S3 opcional de jurisdicción. | Conexión a Cloudflare R2. |
| `SERVICE_UPLOAD_DIR` | `uploads/servicios` local por defecto. | Lectura y almacenamiento local de fotos de servicios. |
| `PURCHASE_UPLOAD_DIR` | `uploads/compras` local por defecto. | Archivos locales de compras. |
| `BACKUP_STORAGE` | `r2` para respaldo remoto; Vercel lo usa de forma remota. | Destino de respaldos. |
| `BACKUP_ROOT` | `/backup/CTE-Backup` en contenedor local si falta. | Carpeta de respaldos locales. |
| `BACKUP_DISPLAY_ROOT` | Nombre visible opcional del destino. | Pantalla de respaldos. |
| `PG_DUMP_PATH`, `PG_RESTORE_PATH` | Rutas opcionales a herramientas PostgreSQL. | Copia y verificación local. |
| `NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_BRANCH_ID` | Acceso e identidad para instantáneas de Neon. | Respaldo completo remoto. |
| `CRON_SECRET` | Secreto de la tarea programada. | Ruta interna que ejecuta los respaldos programados. |

`ADMIN_USER` y `ADMIN_PASS` aparecen como referencia de desarrollo en `.env.example`; no son una forma de crear usuarios en la API publicada. La gestión normal de usuarios se hace en Administración y PostgreSQL. `VERCEL` lo establece la plataforma y activa las rutas y límites específicos de ese entorno.

## 6. Variables del frontend

Use [`frontend/.env.example`](../frontend/.env.example). Todos los valores `VITE_` se incorporan a la compilación y pueden ser vistos por quien usa el navegador.

| Variable | Uso |
| --- | --- |
| `VITE_API_URL` | Dirección de la API; `/api` en desarrollo local o URL pública que termine en `/api`. |
| `VITE_PROXY_TARGET` | Destino del proxy de Vite durante desarrollo local. |
| `VITE_SOCKET_URL` | Dirección del servidor de avisos en vivo, si se usa Socket.IO. |
| `VITE_NOTIFICATIONS_MODE` | `poll` para actualización periódica sin socket; el modo normal usa conexión en vivo. |
| `VITE_MAX_PHOTO_BYTES` | Límite del navegador para una foto. Coordinar con [`photoLimit.js`](../backend/src/utils/photoLimit.js): 4 MB en Vercel y 5 MB fuera de Vercel. |

Las sesiones temporales de transferencia admiten hasta 12 fotos por lote en las rutas locales y remotas (`photoTransfer.js` y `photoTransferRemote.js`). Una variación debe sincronizar ambas rutas y las indicaciones de la interfaz.

## 7. Elementos de negocio que requieren código

| Elemento | Referencia para modificarlo | Precaución |
| --- | --- | --- |
| Estados de diagnósticos, órdenes, contacto, equipos, repuestos y entregas | [`domainValidation.js`](../backend/src/utils/domainValidation.js) y el esquema [`schema.prisma`](../backend/prisma/schema.prisma) | Revisar transiciones, consultas, filtros, reportes y registros anteriores; una nueva opción puede requerir migración. |
| Prioridades y métodos de pago | `domainValidation.js`, formularios y reportes | Mantener los valores aceptados por API y los que muestra la interfaz. |
| Requisitos por tipo de equipo en recepción | [`receptionRequirements.js`](../backend/src/utils/receptionRequirements.js) y formularios de Secretaría | Actualmente se reconocen familias por nombre; los tipos de equipo se pueden escribir libremente. |
| Tipos de equipo, marcas, proveedores, clientes y repuestos | Registros de las pantallas correspondientes y tablas de PostgreSQL | Son datos operativos que se gestionan desde la aplicación; una nueva *regla* de validación requiere código. |
| Monedas de presupuesto | [`monedaPresupuesto.js`](../backend/src/utils/monedaPresupuesto.js) y [`frontend/src/utils/monedaPresupuesto.js`](../frontend/src/utils/monedaPresupuesto.js) | Solo NIO y USD. No hay conversión ni suma entre monedas. Añadir otra implica revisar informes y documentos. |
| Categorías, filtros y columnas de reportes | [`adminReportsService.js`](../backend/src/services/adminReportsService.js) y pantallas de reportes | Comprobar consulta, exportación Excel/PDF y permisos. |
| Facturas, garantías, cierres y entrega | Controladores y servicios de cada módulo bajo [`backend/src`](../backend/src) | Sus restricciones no se cambian mediante los campos de Administración; revisar datos históricos antes de modificar el flujo. |
| Zona horaria y formato de fechas | `adminPolicy.js`, `backupSchedule.js`, generadores de documentos y componentes que usan `es-NI` / `America/Managua` | Cambiar ambos lados y revisar las fechas persistidas y los trabajos programados. |
| Logos, textos, colores y navegación | [`frontend/src`](../frontend/src) y generadores PDF | Requieren compilación del frontend y, si afectan PDF del servidor, despliegue de la API. |

## 8. Procedimiento recomendado para una futura modificación

1. Identificar en las tablas anteriores si el ajuste se guarda en Administración, es una variable o requiere código.
2. Para valores de Administración, guardar el cambio con un motivo y comprobar un caso nuevo y uno existente. La revisión evita sobrescribir una edición simultánea.
3. Para variables, establecerlas en el entorno correcto. Los secretos van únicamente al backend; volver a desplegar el componente afectado. No copiar el `.env` local a Git.
4. Para catálogos o reglas de código, actualizar servidor, interfaz, esquema/migración si corresponde y documentos. Conservar el significado de datos existentes o migrarlos explícitamente.
5. Probar el recorrido real que consume el valor: creación, consulta, documento, reporte, correo o respaldo según el caso. Comprobar que la versión publicada ejecuta la configuración nueva.

Guías complementarias: [`administracion.md`](administracion.md), [`despliegue-vercel-neon.md`](despliegue-vercel-neon.md), [`backend/Readme.md`](../backend/Readme.md) y [`frontend/README.md`](../frontend/README.md).
