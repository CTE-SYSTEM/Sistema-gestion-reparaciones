# Backend SGR

API Express del sistema de gestión de reparaciones. Esta guía describe dónde localizar cada responsabilidad y cómo mantener sus conexiones con PostgreSQL, fotografías, historial y frontend.

[Guía general](../readme.md) · [Frontend](../frontend/README.md)

## Índice

- [Mapa de carpetas](#mapa-de-carpetas)
- [Recorrido de una solicitud](#recorrido-de-una-solicitud)
- [Módulos y archivos principales](#módulos-y-archivos-principales)
- [Mapa de la API](#mapa-de-la-api)
- [Configuración](#configuración)
- [Base de datos y SQL](#base-de-datos-y-sql)
- [Actualizar una base existente](#actualizar-una-base-existente)
- [Estados, recepción y entrega](#estados-recepción-y-entrega)
- [Trabajo y privacidad del técnico](#trabajo-y-privacidad-del-técnico)
- [Paginación y búsqueda](#paginación-y-búsqueda)
- [Fotografías y Cloudflare R2](#fotografías-y-cloudflare-r2)
- [Auditoría y notificaciones](#auditoría-y-notificaciones)
- [Respaldos](#respaldos)
- [Pruebas y comprobaciones](#pruebas-y-comprobaciones)
- [Cómo mantener una función](#cómo-mantener-una-función)

## Mapa de carpetas

```text
backend/
  Readme.md
  src/
    server.js               HTTP, notificaciones y programación de respaldos.
    app/
      app.js                Express, middleware general y montaje de rutas.
      prismaClient.js       Cliente Prisma compartido.
    config/                 Configuración del entorno y compatibilidad antigua.
    middlewares/            JWT, permisos, errores y cabeceras HTTP.
    routes/
      auth/                 Inicio de sesión.
      health.js             Comprobación de conexión con PostgreSQL.
      modules/
        secretaria/         Dashboard y compatibilidad del perfil heredado.
        recepcion/          Clientes, equipos, diagnósticos, órdenes y flujo de atención.
        bodega/             Repuestos, tipos, compras y proveedores.
        contabilidad/       Facturación.
        calidad/            Pruebas de salida.
        garantias/          Registro y consulta de garantías.
        servicios/          Archivos de servicio.
        Tecnico/            Trabajo asignado y solicitudes de repuestos.
        JefeTecnico/        Coordinación, aprobaciones y correcciones.
        admin_pro/          Gestión avanzada, reportes y respaldos.
    controllers/
      auth/                 Validación de acceso y emisión del token.
      Secretaria/           Dashboard del perfil heredado.
      recepcion/            Recepción y seguimiento del servicio.
      bodega/               Inventario y compras.
      contabilidad/         Facturación.
      garantias/            Gestión de garantías.
      servicios/            Archivos de servicio.
      Tecnico/              Trabajo propio del técnico.
      JefeTecnico/          Coordinación técnica.
      admin_pro/            Operación administrativa avanzada.
    services/
      recepcion/            Reglas de equipos, diagnósticos, órdenes y flujo de atención.
      archivos/             Almacenamiento de fotos.
      Tecnico/              Consultas y operaciones del técnico.
      backupService.js      Copias y exportaciones de inventario.
      healthService.js
      notifications.js      Socket.IO.
    utils/                  Validación, roles, permisos, paginación y auditoría.
  prisma/
    schema.prisma           Modelos, relaciones, índices y nombres de tablas.
    Seed.js                 Cuentas y datos iniciales de demostración.
  scripts/
    setup.sh                Inicialización del contenedor db-setup.
    load_functions.sql      Carga SQL mediante psql.
    load_functions.ps1      Ejecuta el cargador SQL del contenedor desde PowerShell.
    run_sql_file.cjs         Ejecución de un archivo SQL mediante pg.
    auditoria_consultas.sql  Consultas de auditoría.
    modules/
      Secretaria/           Inventario, facturas, garantías, estados e índices.
      JefeTecnico/           Índices para coordinación técnica.
      admin_pro/            Esquema y reportes administrativos.
      Seguridad.sql         Restricciones y reglas de integridad.
      Auditoria.sql         Auditoría por triggers.
      LegacyCleanup.sql     Retiro de funciones SQL anteriores.
  tests/
    secretaria/             Reglas y API del módulo; ejecutor de base temporal.
    unit/                   Lógica de claves de fotografías.
    api/                    Flujo de negocio mediante solicitudes HTTP.
    sql/                    Historial y fechas dentro de una transacción reversible.
  tmp/                      Archivos temporales locales; excluidos de Git.
  uploads/servicios/         Se genera cuando se usa almacenamiento local de fotos.
  package.json              Scripts y dependencias del backend.
  package-lock.json         Versiones resueltas.
  Dockerfile                Etapas dev y production.
  .env.example              Nombres de variables y valores de ejemplo.
  .gitignore                Exclusiones específicas del backend.
```

Las rutas registradas efectivamente están en [app.js](src/app/app.js). La presencia de un archivo de ruta o controlador no significa que esté montado. Utiliza [prismaClient.js](src/app/prismaClient.js) como instancia compartida; `config/database.js` conserva una implementación anterior.

## Recorrido de una solicitud

1. [server.js](src/server.js) carga el entorno y crea el servidor HTTP.
2. [app.js](src/app/app.js) aplica CORS, seguridad, parsers y rutas.
3. [authMiddleware.js](src/middlewares/authMiddleware.js) valida JWT y comprueba que el usuario siga activo en PostgreSQL.
4. La ruta aplica permisos o propiedad del trabajo, procesa el cuerpo y llama al controlador.
5. El controlador valida la solicitud y utiliza el servicio, Prisma o funciones SQL correspondientes.
6. Las restricciones, triggers y transacciones mantienen integridad, fechas e historial.
7. El backend devuelve JSON, PDF, imagen o error HTTP; algunos cambios generan notificaciones.

La autorización de fotos verifica la relación con el diagnóstico u orden; conocer su ID no concede acceso a su contenido.

## Módulos y archivos principales

| Área | Archivo o carpeta de entrada | Responsabilidad |
| --- | --- | --- |
| Acceso | [authController.js](src/controllers/auth/authController.js), [permissions.js](src/utils/permissions.js), [roles.js](src/utils/roles.js). | Credenciales, roles normalizados y capacidades. |
| Clientes | [clientesController.js](src/controllers/recepcion/clientesController.js). | Datos de cliente, búsqueda y paginación. |
| Equipos | [equiposController.js](src/controllers/recepcion/equiposController.js), [equipoService.js](src/services/recepcion/equipoService.js). | Asociación a cliente, tipo, marca, modelo y serie. |
| Diagnóstico | [diagnosticoController.js](src/controllers/recepcion/diagnosticoController.js), [diagnosticoService.js](src/services/recepcion/diagnosticoService.js). | Recepción, edición, filtros y estado técnico. |
| Órdenes | [nuevaOrdenController.js](src/controllers/recepcion/nuevaOrdenController.js), [ordenService.js](src/services/recepcion/ordenService.js). | Diagnósticos listos, creación, monto autorizado y órdenes. |
| Contacto y salida | [flujoServicioController.js](src/controllers/recepcion/flujoServicioController.js). | PDF, contacto, historial, retiro, entrega y cancelación. |
| Fotos | [archivosServicioController.js](src/controllers/servicios/archivosServicioController.js), [fotoStorage.js](src/services/archivos/fotoStorage.js). | Permisos, MIME, R2/local, nombres, escritura y lectura. |
| Inventario | [repuestoController.js](src/controllers/bodega/repuestoController.js), [tipoRepuestoController.js](src/controllers/bodega/tipoRepuestoController.js). | Catálogo, categorías y disponibilidad. |
| Compras | [comprasController.js](src/controllers/bodega/comprasController.js), [proveedoresController.js](src/controllers/bodega/proveedoresController.js). | Abastecimiento y proveedores. |
| Facturas y garantías | [facturacionController.js](src/controllers/contabilidad/facturacionController.js), [garantiasController.js](src/controllers/garantias/garantiasController.js). | Órdenes facturables, importes y garantía. |
| Técnico | [tecnicosController.js](src/controllers/Tecnico/tecnicosController.js), [tecnicoService.js](src/services/Tecnico/tecnicoService.js). | Trabajo asignado y solicitudes de repuestos. |
| Técnico Jefe | [supervisionController.js](src/controllers/JefeTecnico/supervisionController.js), [supervisionService.js](src/services/JefeTecnico/supervisionService.js). | Supervisión, asignación, aprobación y entrega de piezas, irreparables y excepciones justificadas. |
| Administración | [controllers/admin_pro](src/controllers/admin_pro), [adminPro.js](src/routes/modules/admin_pro/adminPro.js). | Usuarios, reportes, indicadores, historiales y respaldos. |
| Flujo global | [flujoAtencionService.js](src/services/recepcion/flujoAtencionService.js). | Consulta consolidada de etapas de atención. |
| Validación | [domainValidation.js](src/utils/domainValidation.js), [receptionRequirements.js](src/utils/receptionRequirements.js). | Valores permitidos, importes, IDs y aplicabilidad por tipo de equipo. |

Dentro de `controllers/admin_pro/`, los controladores se separan por usuarios, equipos, repuestos, diagnósticos, órdenes, facturas, garantías, historial, analítica, reportes, dashboard y backups. [accessController.js](src/controllers/admin_pro/accessController.js) restringe esas rutas; comprobar su lista de roles además del mapa general de permisos.

## Mapa de la API

Los prefijos se montan en [app.js](src/app/app.js). Consulta los archivos de ruta para los métodos, parámetros y permisos exactos.

| Prefijo | Función | Ruta fuente |
| --- | --- | --- |
| `/api/auth` | Login. | [auth.js](src/routes/auth/auth.js). |
| `/api/clientes` | Consulta y gestión de clientes. | [Clientes.js](src/routes/modules/recepcion/Clientes.js). |
| `/api/equipos` | Consulta y gestión de equipos. | [Equipos.js](src/routes/modules/recepcion/Equipos.js). |
| `/api/recepcion/diagnostico` (alias `/api/secretaria/diagnostico`) | Recepción, edición, estados, contacto, PDF y retiro. | [Diagnostico.js](src/routes/modules/recepcion/Diagnostico.js). |
| `/api/ordenes` | Diagnósticos listos, órdenes, entrega, cancelación e historial. | [NuevaOrden.js](src/routes/modules/recepcion/NuevaOrden.js). |
| `/api/archivos-servicio` | Fotografías y descarga autenticada. | [ArchivosServicio.js](src/routes/modules/servicios/ArchivosServicio.js). |
| `/api/tecnicos` | Catálogo y trabajo asignado a técnicos. | [tecnicos.js](src/routes/modules/Tecnico/tecnicos.js). |
| `/api/jefe-tecnico` | Supervisión, asignaciones, prioridades, disponibilidad, repuestos y excepciones. | [Supervision.js](src/routes/modules/JefeTecnico/Supervision.js). |
| `/api/diagnosticos` | Compatibilidad con las rutas anteriores del jefe; comparte las nuevas reglas. | [Diagnostico.js](src/routes/modules/JefeTecnico/Diagnostico.js). |
| `/api/repuestos` | Repuestos. | [Repuesto.js](src/routes/modules/bodega/Repuesto.js). |
| `/api/tipos-repuesto` | Categorías de repuestos. | [TipoRepuesto.js](src/routes/modules/bodega/TipoRepuesto.js). |
| `/api/proveedores` | Proveedores. | [Proveedores.js](src/routes/modules/bodega/Proveedores.js). |
| `/api/compras` | Compras. | [Compras.js](src/routes/modules/bodega/Compras.js). |
| `/api/facturas` | Facturación y órdenes disponibles. | [facturas.js](src/routes/modules/contabilidad/facturas.js). |
| `/api/garantias` | Garantías. | [garantias.js](src/routes/modules/garantias/garantias.js). |
| `/api/secretaria/dashboard` | Indicadores de recepción. | [Dashboard.js](src/routes/modules/secretaria/Dashboard.js). |
| `/api/flujo-atencion` | Seguimiento filtrado de equipos. | [FlujoAtencion.js](src/routes/modules/recepcion/FlujoAtencion.js). |
| `/api/admin_pro` | Administración, reportes, historiales y backups. | [adminPro.js](src/routes/modules/admin_pro/adminPro.js). |
| `/health`, `/api/health` | Conexión PostgreSQL mediante `SELECT 1`. | [health.js](src/routes/health.js). |

### Operaciones del flujo de servicio

| Método y ruta | Acción |
| --- | --- |
| `POST /api/recepcion/diagnostico/create` | Crear recepción. |
| `PUT /api/recepcion/diagnostico/:id` | Editar diagnóstico. |
| `PATCH /api/recepcion/diagnostico/:id/estado` | Cambiar estado técnico. |
| `GET /api/recepcion/diagnostico/:id/documento` | Generar informe PDF. |
| `GET /api/recepcion/diagnostico/:id/historial` | Leer historial de diagnóstico. |
| `PATCH /api/recepcion/diagnostico/:id/contacto` | Registrar contacto o rechazo. |
| `PATCH /api/recepcion/diagnostico/:id/retiro` | Registrar retiro sin reparar. |
| `GET /api/ordenes/diagnosticos-listos` | Buscar diagnósticos disponibles, por páginas. |
| `POST /api/ordenes` o `/api/ordenes/create` | Crear orden y registrar autorización. |
| `GET /api/ordenes/:id/historial` | Leer historial de orden. |
| `PATCH /api/ordenes/:id/entrega` | Confirmar entrega facturada con evidencia. |
| `PATCH /api/ordenes/:id/cancelar` | Cancelar con motivo, según restricciones. |

El trabajo técnico usa `/api/tecnicos/mis-diagnosticos/:username`, `/mis-ordenes/:username`, `PATCH /diagnosticos/:id/iniciar`, `PUT /diagnosticos/:id`, `PATCH /ordenes/:id/estado` y `POST /ordenes/:id/repuestos`. El username debe coincidir con la sesión y las mutaciones requieren ser el técnico asignado. La coordinación utiliza `/api/jefe-tecnico`; las rutas antiguas bajo `/api/diagnosticos` delegan en las mismas reglas.

Administración avanzada incluye `/usuarios`, `/dashboard`, `/monitoreo`, `/reportes/:tipo`, `/analitica/productividad`, `/analitica/ganancias`, historiales de equipos/repuestos, renovaciones de garantías y `/backups`. Son subrutas de `/api/admin_pro`.

## Configuración

Usa [.env.example](.env.example) como plantilla. Los secretos y conexiones reales van en `backend/.env` o en las variables del servicio publicado.

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Conexión utilizada por Prisma y algunos servicios. |
| `SQL_DATABASE_URL` | Conexión para herramientas SQL; `run_sql_file.cjs` acepta `DATABASE_URL` como alternativa. |
| `PORT` | Puerto HTTP; predeterminado 5000. |
| `NODE_ENV` | Desarrollo o producción. |
| `JWT_SECRET` | Firma de tokens. Producción rechaza el secreto de ejemplo. |
| `CORS_ORIGIN`, `FRONTEND_URL` | Orígenes permitidos; se admiten listas separadas por comas. |
| `REQUEST_BODY_LIMIT` | Límite de JSON/formularios; predeterminado `1mb`. Las fotos tienen su propio límite. |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` | Clave privada y remitente verificado para correos transaccionales, incluida la recuperación de contraseña. |
| `BREVO_SENDER_NAME`, `BREVO_REPLY_TO_EMAIL` | Nombre visible del remitente y dirección opcional para respuestas. |
| `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Configuración completa de almacenamiento R2. |
| `R2_ENDPOINT` | Endpoint S3 opcional de la cuenta, sin ruta de bucket ni parámetros. |
| `SERVICE_UPLOAD_DIR` | Destino local de fotografías; predeterminado `uploads/servicios`. |
| `BACKUP_ROOT` | Directorio donde el backend escribe respaldos. |
| `BACKUP_DISPLAY_ROOT` | Ruta mostrada al usuario, útil cuando Docker y Windows usan nombres distintos. |

[env.js](src/config/env.js) centraliza HTTP, CORS y JWT. Prisma, SQL, R2 y respaldos leen sus variables correspondientes. `server.js` carga el archivo `.env`; para scripts independientes desde Node puede usarse `node --env-file=.env ...`. Las variables de Compose prevalecen sobre las del archivo para claves definidas en ambos lugares.

El envío reutilizable de correos está en [mailService.js](src/services/mailService.js); los contenidos del sistema, en [mailTemplates.js](src/services/mailTemplates.js). La recuperación por código se implementa en [passwordRecovery.js](src/services/passwordRecovery.js). El inventario completo de elementos adaptables está en [Parámetros genéricos de SGR](../docs/parametros-genericos-sgr.md).

## Base de datos y SQL

### Modelos y relaciones

La definición se mantiene en [schema.prisma](prisma/schema.prisma). Las tablas están mapeadas con nombres como `Clientes`, `Equipos` y `Ordenes`; al escribir SQL, conserva comillas y mayúsculas donde correspondan.

| Grupo | Modelos | Relación o propósito |
| --- | --- | --- |
| Usuarios | `Usuarios`, `Tecnicos`. | Credenciales, rol, actividad y perfil técnico. |
| Recepción | `Clientes`, `Equipos`, `Diagnosticos`. | Cliente → equipos → diagnósticos y visitas. |
| Reparación | `Ordenes`, `Ordenes_Repuestos`. | Diagnóstico → órdenes; solicitudes, aprobación y entrega de piezas. |
| Inventario | `Categorias_Repuestos`, `Repuestos`, `Proveedores`, `Compras`. | Catálogo, cantidades y abastecimiento. |
| Cobro | `Facturas`, `Garantias`. | Una factura por orden y una garantía por factura según las restricciones del esquema. |
| Evidencia | `ArchivosServicio`. | Clave de foto asociada a diagnóstico u orden, tipo, usuario y fecha. |
| Trazabilidad | `HistorialDiagnosticos`, `HistorialOrdenes`, `Auditoria_Movimientos`. | Cambios de estado y auditoría general. |

Los triggers, vistas y funciones complementan Prisma. Sincronizar modelos no sustituye cargar los archivos SQL.

### Qué contiene cada script

| Archivo | Responsabilidad |
| --- | --- |
| [Seguridad.sql](scripts/modules/Seguridad.sql) | Restricciones e integridad del dominio. |
| [Auditoria.sql](scripts/modules/Auditoria.sql) | Tabla, funciones y triggers de auditoría. |
| [Facturacion.sql](scripts/modules/Secretaria/Facturacion.sql) | Reglas y consultas de facturación. |
| [Dashboard.sql](scripts/modules/Secretaria/Dashboard.sql) | Indicadores de Secretaría. |
| [Garantias.sql](scripts/modules/Secretaria/Garantias.sql) | Garantías y fechas asociadas. |
| [InventarioStock.sql](scripts/modules/Secretaria/InventarioStock.sql) | Stock, movimientos y solicitudes de repuestos. |
| [FlujoEstados.sql](scripts/modules/Secretaria/FlujoEstados.sql) | Fechas, estados, historial y condiciones del flujo. |
| [PaginacionIndices.sql](scripts/modules/Secretaria/PaginacionIndices.sql) | Índices de relaciones, filtros y listados. |
| [JefeTecnico/Indices.sql](scripts/modules/JefeTecnico/Indices.sql) | Índices para coordinación. |
| [JefeTecnico/Supervision.sql](scripts/modules/JefeTecnico/Supervision.sql) | Estado asignado, disponibilidad, integridad de intervenciones e historial de responsables. |
| [JefeTecnico/Correcciones.sql](scripts/modules/JefeTecnico/Correcciones.sql) | Tipos y motivos de correcciones de asignaciones, decisiones de repuestos y entregas. |
| [Tecnico/Trabajo.sql](scripts/modules/Tecnico/Trabajo.sql) | Origen único de cada avance y auditoría de bitácora y fotografías. |
| [admin_pro/AdminPro.sql](scripts/modules/admin_pro/AdminPro.sql), [00_schema.sql](scripts/modules/admin_pro/00_schema.sql), [01_reportes.sql](scripts/modules/admin_pro/01_reportes.sql) | Funciones y reportes administrativos; revisar ambos cargadores al modificar este módulo. |
| [LegacyCleanup.sql](scripts/modules/LegacyCleanup.sql) | Elimina funciones SQL antiguas reemplazadas. |

[load_functions.sql](scripts/load_functions.sql) usa instrucciones `\i` de `psql`, incluso dentro de `AdminPro.sql`. [load_functions.ps1](scripts/load_functions.ps1) llama al mismo cargador del contenedor para evitar que falten archivos incluidos. [run_sql_file.cjs](scripts/run_sql_file.cjs) ejecuta un archivo SQL con `pg`; no interpreta los comandos `\i` de `psql`.

## Actualizar una base existente

Los scripts `db:sync`, `db:deploy` y `setup.sh` ya no aceptan automáticamente una pérdida de datos. Si Prisma detiene la sincronización por un cambio destructivo, conserva un respaldo recuperable y revisa una migración de datos antes de continuar.

Desde el backend, con conexión de entorno configurada:

```powershell
npx prisma generate
npx prisma db push
```

Si Prisma advierte pérdida de datos, revisa la modificación antes de aceptar. Después carga las funciones, vistas y triggers requeridos. En el entorno Docker, desde la raíz:

```powershell
docker compose exec backend npx prisma generate
docker compose exec backend npx prisma db push
docker compose exec backend npm run db:functions:container
```

Alternativa desde PowerShell, estando en `backend/` y con `postgres_cte` activo:

```powershell
./scripts/load_functions.ps1
```

En una actualización del flujo, comprueba especialmente `Seguridad.sql`, `Garantias.sql` y `FlujoEstados.sql`. La instalación del historial registra cambios futuros y no inventa transiciones anteriores. Ejecutar `Seed.js` manualmente puede incorporar datos de demostración; `setup.sh` solo lo hace cuando no existen usuarios.

## Estados, recepción y entrega

### Estados separados

[domainValidation.js](src/utils/domainValidation.js) es la referencia de valores aceptados:

| Campo o proceso | Valores |
| --- | --- |
| Estado técnico del diagnóstico | `PENDIENTE`, `INGRESADO`, `ASIGNADO`, `EN_REVISION`, `DIAGNOSTICADO`, `COMPLETADO`, `APROBADO`, `RECHAZADO`. |
| Contacto | `PENDIENTE_CONTACTAR`, `DOCUMENTO_ENVIADO`, `ESPERANDO_RESPUESTA`, `APROBADO`, `RECHAZADO`, `SIN_RESPUESTA`. |
| Ubicación del equipo durante diagnóstico | `EN_TALLER`, `ESPERANDO_RETIRO`, `RETIRADO_SIN_REPARAR`. |
| Orden | `PENDIENTE`, `ASIGNADO`, `APROBADO`, `EN_REPARACION`, `ESPERANDO_PIEZA`, `FINALIZADO`, `IRREPARABLE`, `ENTREGADO`, `CANCELADO`. |
| Solicitud de repuesto | `PENDIENTE`, `APROBADO`, `DENEGADO`; entrega de pieza: `PENDIENTE` o `ENTREGADO`. |

`Estado_aprobacion` del diagnóstico conserva valores como `Pendiente`, `Aprobado` y `Rechazado`. No intercambiar este campo con `estado_contacto` o el estado técnico.

### Recepción según tipo de electrónico

[receptionRequirements.js](src/utils/receptionRequirements.js) reconoce familias en las etiquetas libres de `Equipos.tipo`, normalizando tildes y signos para compararlas. Conserva el texto original del equipo.

| Familia | Cargador | Acceso o desbloqueo |
| --- | --- | --- |
| Laptop, celular, tablet, consola portátil | Aplica. | Aplica. |
| Monitor, pantalla, TV, proyector | No aplica. | No aplica. |
| Impresora, escáner, multifuncional, UPS | No aplica. | No aplica. |
| Router, consola de sobremesa, PC de escritorio | No aplica como cargador. | Aplica. |
| Tipo desconocido | Aplica como comportamiento inicial. | Aplica como comportamiento inicial. |

Los controles de alimentación y accesorios permiten registrar cable, adaptador u otros elementos cuando correspondan. El perfil actual distingue cargador y acceso; cambiar esta clasificación requiere revisar también el perfil del frontend.

Cuando no aplica cargador, el backend guarda `deja_cargador = false` y `estado_cargador = NO_INCLUIDO`. Cuando no aplica acceso, utiliza `estado_acceso = NO_REQUIERE`. Los datos pendientes de comprobar utilizan los valores del esquema como `NO_VERIFICADO`, `NO_VERIFICADOS`, `NO_PROBADO` o `NO_PROBADA`. Los textos opcionales vacíos se normalizan a `null` en los servicios correspondientes. Una condición que no aplica y una condición no comprobada tienen significados distintos.

### Reglas del circuito

- El informe PDF exige diagnóstico finalizado e informe técnico; se genera en el momento y no se envía automáticamente por WhatsApp.
- Crear orden exige diagnóstico `COMPLETADO` o `DIAGNOSTICADO`, informe, presupuesto positivo y monto autorizado positivo. Se evita una segunda orden para el mismo diagnóstico.
- La aprobación del contacto se registra en el circuito de creación de orden; el endpoint general de contacto no acepta directamente `APROBADO`.
- Rechazo coloca el equipo en espera de retiro. Retirar sin reparar exige foto `FOTO_SALIDA_SIN_REPARAR` y persona que retira.
- Entrega exige orden `FINALIZADO` o `IRREPARABLE`, factura, foto `FOTO_ENTREGA` y persona que recibe. Ajusta las fechas de garantía según la entrega.
- Cancelar requiere motivo y está restringido por factura o estado de la orden.
- La facturación y el stock también dependen de las reglas SQL sobre piezas aprobadas, pendientes y entregadas.

## Trabajo y privacidad del técnico

**Regla general:** toda información presentada al rol Técnico debe limitarse al equipo y al trabajo asignado. La identidad, contacto y acuerdos del cliente pertenecen al circuito administrativo. Esta regla abarca respuestas HTTP, escrituras, búsquedas, notificaciones, nombres de archivos, metadatos e imágenes; ocultar campos en React no sustituye filtrar la respuesta en el servidor.

[expedienteTecnico.js](src/services/Tecnico/expedienteTecnico.js) define listas explícitas de campos permitidos. No serializar entidades Prisma completas ni incorporar relaciones de clientes a una respuesta técnica. Se excluyen cliente/IDs de cliente, teléfono, correo, dirección, contactos secundarios, número de serie, observaciones administrativas de recepción, contacto, entrega y retiro, facturas y snapshots de intervenciones. El backend puede consultar al cliente internamente para retirar sus valores conocidos de los textos técnicos, además de teléfonos, correos y enlaces. La recepción debe registrar solo información técnica en falla y accesorios: el filtro automático no sustituye revisar cualquier identificador escrito de forma libre.

| Método y ruta bajo `/api/tecnicos` | Función |
| --- | --- |
| `GET /resumen` | Indicadores de la cuenta y del período seleccionado. |
| `GET /mis-diagnosticos/:username`, `/mis-ordenes/:username` | Trabajos propios, por prioridad y antigüedad, paginados en el servidor. |
| `GET /diagnosticos/:id`, `/ordenes/:id` | Expediente técnico, recepción, informe, historia de estados, responsables y bitácora. |
| `PATCH /diagnosticos/:id/iniciar` | Inicio real antes de informar o guardar borradores. |
| `PUT /diagnosticos/:id/borrador` | Guarda `{ diagnostico, solucion, presupuesto, moneda_presupuesto }` sin cerrar el diagnóstico. |
| `PUT /diagnosticos/:id` | Finaliza el informe; admite `solucion_propuesta` separada y retira el borrador. |
| `POST /diagnosticos/:id/avances`, `/ordenes/:id/avances` | Avance técnico de hasta 2000 caracteres, con autor y fecha. |
| `PATCH /ordenes/:id/estado` | Inicio/reanudación, finalización con pruebas o solicitud justificada de irreparable. |
| `PATCH /ordenes/:id/correccion-cierre` | Corrección motivada del informe final, reapertura sin factura ni entrega o aclaración posterior; después del plazo configurado exige `excepcion: true`. |
| `POST /ordenes/:id/repuestos` | Solicita una pieza y cantidad, o expresamente una pieza no registrada. |
| `GET /solicitudes` | Solicitudes propias, decisión, motivo técnico, aprobación y entrega física. |
| `GET /catalogo` | Búsqueda paginada de piezas por `search`, `tipo` y `cantidad`; disponibilidad descontando reservas. |

Los listados admiten `page`, `pageSize` (20 por defecto), `periodo=todos|hoy|mes|anio`, `estado`, `prioridad` y `grupo=activos|completados|por_iniciar|esperando_piezas|revision_jefe`. La búsqueda de trabajo usa número de referencia, tipo, marca y modelo; no consulta los informes ni las notas originales para evitar revelar coincidencias con información reservada. Las fechas usan el inicio del período en Managua (UTC−6): asignación para activos, finalización para cerrados y solicitud para piezas, con fechas antiguas de ingreso como respaldo cuando falta la fecha de la etapa.

El resumen y los listados aplican el mismo criterio de período. Los trabajos urgentes se ordenan antes de paginar. Una irreparable `PENDIENTE` permanece activa en revisión; únicamente pasa a cerradas al confirmarse por el jefe. Rechazarla devuelve la reparación al técnico con el motivo técnico filtrado.

La finalización exige `enciende_salida` y `usa_corriente_ac_salida` booleanos explícitos, observación final y `pruebas_salida`. La función principal siempre se registra; carga, pantalla y conectividad se solicitan según [pruebasSalida.js](src/utils/pruebasSalida.js). Cada resultado admite `CORRECTO`, `FALLA` o `NO_APLICA`; la API rechaza un checklist incompleto. Las piezas pendientes de decisión o las aprobadas sin entrega bloquean la reanudación y el cierre. El catálogo devuelve disponibilidad para la cantidad, sin proveedores, márgenes ni stock administrativo.

Al reportar irreparabilidad, una prueba de encendido o alimentación que no se realizó se conserva en `null`; no se convierte automáticamente en `false`. Los resultados opcionales enviados deben ser booleanos. Si cambia la cantidad de una solicitud, la interfaz retira la selección anterior y comprueba nuevamente la disponibilidad antes de elegir la pieza.

`BitacoraTecnica` relaciona cada avance con exactamente un diagnóstico u orden; el SQL aplica esta restricción y su auditoría. Los borradores usan `Diagnosticos.borrador_tecnico` y `fecha_borrador`, y la solución final `solucion_propuesta`. `Ordenes.pruebas_salida` conserva los resultados. La actividad más reciente incluye borradores y bitácora para las alertas de 72 horas del jefe.

`Diagnosticos.moneda_presupuesto` admite `NIO` y `USD`, con `NIO` por defecto para registros anteriores. El borrador conserva su moneda y el informe final/PDF muestran C$ o US$. No se aplica conversión automática: `monto_autorizado` y facturas siguen en NIO; Secretaría debe introducir el monto acordado en córdobas cuando el presupuesto está en USD. El reporte administrativo separa totales por moneda. Después de sincronizar Prisma, [apply-presupuesto.js](scripts/apply-presupuesto.js) instala en PostgreSQL local la restricción y el reporte sin modificar importes existentes; el cargador completo también incluye [Presupuesto.sql](scripts/modules/Tecnico/Presupuesto.sql).

Las notificaciones al técnico usan mensajes controlados y referencias numéricas; no transmiten motivos administrativos libres. Las respuestas técnicas y descargas usan `Cache-Control: private, no-store`. Al cambiar de sesión, el frontend cancela consultas y vacía cachés para evitar mostrar datos de una cuenta anterior.

Para actualizar estos campos en una base local existente, desde la raíz del proyecto:

```powershell
docker compose exec -T backend npm install
docker compose exec -T backend npx prisma generate
docker compose exec -T backend npx prisma db push --skip-generate
docker compose exec -T backend node scripts/apply-tecnico.js
```

El último script actualiza `Auditoria.sql` y carga `Tecnico/Trabajo.sql` dentro de una transacción con conexión local; vincula cada movimiento con el identificador del avance o la fotografía y su actor. Los cargadores generales también incluyen esos archivos. Las fotos existentes reciben `visible_tecnico=false` y deben revisarse antes de publicarse. Reinicia el backend después de actualizar dependencias o generar Prisma si el proceso no se recarga automáticamente.

## Supervisión del jefe técnico

El rol Jefe Técnico utiliza capacidades específicas de supervisión. No recibe permisos generales de edición de diagnósticos, órdenes o inventario. Completar informes, iniciar reparaciones y solicitar piezas exige una cuenta de rol Técnico vinculada al perfil que tiene la asignación. Una persona que ejerce ambos trabajos utiliza cuentas independientes.

| Método y ruta bajo `/api/jefe-tecnico` | Función |
| --- | --- |
| `GET /resumen` | Trabajos, técnicos, solicitudes, catálogo con reservas, intervenciones e indicadores. |
| `GET /diagnosticos/:id`, `GET /ordenes/:id` | Registro, estados, asignaciones e intervenciones. |
| `POST /diagnosticos/:id/asignacion`, `POST /ordenes/:id/asignacion` | Asignación inicial a un técnico disponible; impide reasignación normal. |
| `PATCH /diagnosticos/:id/prioridad`, `PATCH /ordenes/:id/prioridad` | Prioridad con motivo obligatorio y auditoría. |
| `PATCH /tecnicos/:id/disponibilidad` | Disponible, ausente o no disponible; las dos últimas requieren observación. |
| `PATCH /repuestos/:id/aprobar`, `/rechazar`, `/corregir`, `/entregar` | Revisar, reservar, corregir antes de entregar y registrar entrega física. |
| `PATCH /repuestos/:id/retirar-aprobacion`, `/reabrir` | Retirar una aprobación sin entrega o devolver un rechazo a revisión, con motivo. |
| `PATCH /repuestos/:id/corregir-entrega`, `/devolver` | Rectificar una entrega inexistente o confirmar una devolución física total al almacén. |
| `PATCH /ordenes/:id/irreparable` | Confirmar o devolver a reparación una solicitud justificada pendiente. |
| `POST /diagnosticos/:id/intervencion`, `POST /ordenes/:id/intervencion` | Reasignación excepcional; finalización excepcional solo de órdenes. |

La asignación guarda `fecha_asignacion` y estado `ASIGNADO`, conservando vacío el inicio real hasta que el técnico comience. Las alertas usan la actividad más reciente registrada entre ingreso, asignación, inicio, historial de estados, borradores y bitácora técnica. Los tiempos promedio utilizan trabajos con inicio y finalización conocidos; sin registros suficientes se devuelve `null`.

Las intervenciones exigen motivo, usuario y cambios anteriores/nuevos. Solo se admiten trabajos activos sin factura y fuera de revisión de irreparable. Finalizar exige técnico, inicio de reparación, resultado comprobado y piezas resueltas: las pendientes deben revisarse y las aprobadas entregarse. Reasignar conserva el estado y la fecha de inicio.

La aprobación de repuestos reserva stock de órdenes no canceladas y todavía sin factura; la entrega registra fecha y usuario por separado. El descuento físico continúa al facturar. Los bloqueos por orden y repuesto impiden que dos aprobaciones concurrentes reserven la misma última unidad. Una solicitud entregada o rechazada exige la acción específica correspondiente antes de editar pieza o cantidad. [stockDisponible.js](src/services/Tecnico/stockDisponible.js) centraliza las reservas.

Las correcciones guardan motivo, usuario, fecha y snapshots de la solicitud en `IntervencionesTecnicas`, dentro de la misma transacción que su actualización. El historial conserva las fechas y actores originales aunque el estado actual vuelva a pendiente. Corregir pieza/cantidad recalcula reservas y evita registrar cambios vacíos. Retirar una aprobación libera la reserva; reabrir un rechazo borra la decisión vigente y permite revisarla de nuevo.

`corregir-entrega` requiere `entrega_no_realizada: true`: conserva aprobación y reserva, y devuelve la pieza a pendiente de entrega. `devolver` requiere `devolucion_total_confirmada: true`: confirma que se recibieron todas las unidades reutilizables, libera la reserva y devuelve la solicitud a revisión; debe aprobarse de nuevo o rechazarse antes de cerrar. Solo admite devoluciones totales de órdenes activas sin factura, fuera de revisión de irreparable. No se suma stock al devolver: todavía no se había descontado mediante facturación. Una devolución parcial, una pieza dañada o una orden facturada requieren otro circuito de inventario/facturación.

Para habilitar los nuevos tipos en una base local ya actualizada, desde la raíz: `docker compose exec -T backend node scripts/apply-jefe-correcciones.js`, seguido de `docker compose restart backend`. El ajuste SQL se ejecuta en una transacción y no modifica datos del taller. Los cargadores generales incluyen `Correcciones.sql` después de `Supervision.sql`.

Cambios del esquema: `Tecnicos.disponibilidad` y observación; `HistorialAsignaciones` con responsables y nombres históricos; `IntervencionesTecnicas` con motivo y snapshots; actor de entrega de piezas; actor, fecha y motivo de revisión de irreparable. El valor inicial de revisión es `NO_SOLICITADO`. SQL corrige los antiguos valores `PENDIENTE` que no corresponden a órdenes irreparables ni tienen justificación, y conserva asignaciones anteriores como registros heredados sin inventar su usuario.

El resumen devuelve todas las colecciones para filtrarlas en el cliente; sus tablas muestran 20 registros por página. Para grandes volúmenes, la evolución pendiente es paginar este resumen en el servidor.

## Paginación y búsqueda

[utils/pagination.js](src/utils/pagination.js) utiliza `page=1` y `pageSize=20` por defecto, admite `limit` como alternativa y limita el tamaño máximo a 100. Devuelve metadatos con `page`, `pageSize`, `total` y `hasMore`.

```json
{
  "data": [],
  "meta": { "page": 1, "pageSize": 20, "total": 0, "hasMore": false }
}
```

Los listados habituales de Secretaría buscan en el servidor y ordenan por ID descendente. El servicio interno de diagnósticos disponibles devuelve `diagnosticos` y `meta`; su controlador responde por HTTP con `data` y `meta`. El frontend adapta esa colección para la pantalla Nueva Orden.

La selección de cliente existente solicita `searchMode=prefix`: los nombres coinciden desde el comienzo, sin distinguir mayúsculas. Búsquedas numéricas pueden coincidir con ID o partes de teléfonos. La búsqueda general de la tabla usa coincidencias contenidas en los campos correspondientes.

`PaginacionIndices.sql` contiene índices sobre actividad, relaciones, orden y filtros de técnico/stock. Las coincidencias `%texto%` tienen otras necesidades que igualdad o prefijo; si el volumen justifica optimización, medir las consultas antes de añadir índices trigram/GIN. El proyecto no instala esos índices de texto indiscriminadamente.

## Fotografías y Cloudflare R2

### Configuración y destinos

1. Crea un bucket privado y un token **R2 Object Read & Write** para ese bucket.
2. Copia la pareja de credenciales S3 del mismo token en `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY`; un token general de la API de Cloudflare no sustituye esa pareja.
3. Configura también `R2_ACCOUNT_ID` y `R2_BUCKET`.
4. Si utilizas `R2_ENDPOINT`, debe ser el endpoint S3 de esa cuenta sin `/nombre-del-bucket`. Se admite el endpoint general y las jurisdicciones `eu`, `us` y `fedramp`; la región del cliente S3 es `auto`.
5. Aplica el entorno nuevo al backend. Con Compose:

```powershell
docker compose up -d --force-recreate backend
```

Si las cuatro variables obligatorias están vacías, las subidas utilizan almacenamiento local en `SERVICE_UPLOAD_DIR`. Si falta solo parte de la configuración, responden 503 para evitar un destino accidental. La descarga reconoce referencias R2 anteriores y fotos locales.

### Organización y nombres

```text
<tipo>/
  <marca>-<modelo>-equipo-<id>/
    recepcion/
    diagnostico/
    reparacion/
    entrega/
    retiro-sin-reparar/
```

| `tipo_archivo` | Relación en `ArchivosServicio` | Carpeta |
| --- | --- | --- |
| `FOTO_RECEPCION` | `diagnostico_id` | `recepcion` |
| `FOTO_DIAGNOSTICO` | `diagnostico_id` | `diagnostico` |
| `FOTO_REPARACION` | `orden_id` | `reparacion` |
| `FOTO_ENTREGA` | `orden_id` | `entrega` |
| `FOTO_SALIDA_SIN_REPARAR` | `diagnostico_id` | `retiro-sin-reparar` |

Ejemplo de clave:

```text
celular/samsung-galaxy-a32-equipo-21/recepcion/diagnostico-27-27-09-26_18-09-b759ee2a.png
```

- `equipo-21` distingue equipos con la misma marca y modelo; `diagnostico-27` identifica el servicio.
- La fecha y hora de subida utilizan `DD-MM-AA_HH-mm`, hora de 24 horas de `America/Managua`. Los guiones conservan un nombre compatible con Windows y evitan crear carpetas con `/`.
- El sufijo de ocho caracteres aleatorios evita sobrescribir fotos subidas en el mismo minuto.
- `fecha_subida` conserva el instante completo en la base de datos; no se obtiene de la fecha de captura de la cámara.
- Los nombres se normalizan sin tildes ni signos de ruta; los datos faltantes utilizan `sin-tipo`, `sin-marca` o `sin-modelo`.
- Las etapas y visitas reutilizan la carpeta descriptiva de la primera foto del equipo, aunque posteriormente se corrijan tipo, marca o modelo.
- Las carpetas son prefijos virtuales y aparecen al guardar una foto; no se crean objetos vacíos.
- El lector mantiene compatibilidad con UUID, fechas anteriores largas, claves `r2/servicios/...` y la estructura anterior que comenzaba por etapa.

### Contrato de subida y lectura

| Método y ruta | Acción |
| --- | --- |
| `GET /api/archivos-servicio/diagnosticos/:id` | Lista metadatos de fotos del diagnóstico. |
| `POST /api/archivos-servicio/diagnosticos/:id` | Agrega recepción, diagnóstico o salida sin reparar. |
| `GET /api/archivos-servicio/ordenes/:id` | Lista metadatos de fotos de la orden. |
| `POST /api/archivos-servicio/ordenes/:id` | Agrega reparación o entrega. |
| `GET /api/archivos-servicio/:id/contenido` | Devuelve la imagen con autorización. |
| `PATCH /api/archivos-servicio/:id/visibilidad-tecnica` | Secretaría/supervisión autoriza o retira una foto del expediente técnico. |

La subida envía bytes de imagen, no JSON ni multipart. Cabeceras: `Authorization: Bearer ...`, `Content-Type`, `X-Tipo-Archivo` y `X-File-Name` codificado como componente URI. Se permiten JPG, PNG y WebP de hasta 5 MB por imagen. El backend comprueba la firma binaria, guarda el nombre original por separado y crea la referencia después de escribir el objeto. Si falla la creación de esa referencia, intenta retirar la foto recién subida.

Un técnico asignado puede agregar fotos de diagnóstico o reparación. Todas las fotos se guardan con `visible_tecnico=false`: secretaría o el jefe abre la imagen y confirma que no contiene nombres, teléfonos, direcciones, documentos ni otros identificadores antes de autorizarla. La aprobación requiere `{ visible_tecnico: true, sin_datos_cliente: true }`; retirarla requiere `visible_tecnico: false`. Entrega y retiro son evidencias administrativas y no se pueden publicar al técnico.

El técnico solo descarga fotos aprobadas de su trabajo. Puede ver el registro neutro de sus propias subidas pendientes, sin acceder a sus bytes originales desde la API. Las respuestas omiten rutas R2 y nombres originales; cada descarga técnica se reencodifica en WebP de calidad 92 con `sharp`, sin EXIF, XMP ni comentarios. Se conservan las dimensiones, aplicando la orientación de captura; la compresión evita expandir una fotografía JPEG a un PNG de gran tamaño. El original administrativo se conserva. La revisión de lo visible dentro de la imagen sigue siendo responsabilidad de quien la autoriza. La revisión y subida quedan auditadas. Las descargas utilizan caché privada desactivada.

Secretaría gestiona recepción y salida. La foto de entrega requiere orden finalizada/irreparable/entregada y factura; la de retiro corresponde a equipo pendiente de retiro.

Al mover o eliminar objetos ya referenciados, sincroniza `ArchivosServicio.ruta_archivo` con R2. Borrar solo el objeto deja galerías y controles de evidencia contando referencias inexistentes.

### Problemas frecuentes

| Respuesta | Revisar |
| --- | --- |
| `AccessDenied` | Permiso Object Read & Write, cuenta y bucket del token. |
| `SignatureDoesNotMatch` | Pareja Access Key/Secret del mismo token R2 y endpoint de esa cuenta. |
| `NoSuchBucket` | Nombre de bucket y cuenta configurada. |
| 404 al descargar | Existencia del objeto asociado a `ruta_archivo`. |
| 400 al subir | Tipo, formato real, cabeceras y límite de 5 MB. |
| 409 de entrega/retiro | Estado, factura y reglas del servicio. |

## Auditoría y notificaciones

[withAuditUser](src/utils/auditContext.js) configura `app.usuario_id` y `app.usuario_nombre` dentro de la transacción. Los triggers usan ese contexto para registrar al actor; no se propaga a otras conexiones del pool. Revisar su uso cuando una nueva operación deba dejar trazabilidad.

`HistorialDiagnosticos` separa proceso técnico, contacto y ubicación. `HistorialOrdenes` conserva transiciones de reparación. `Auditoria_Movimientos` almacena tabla, operación, claves, datos anteriores/nuevos, actor y fecha. La auditoría no tiene una pantalla o endpoint dedicado; se consulta mediante [auditoria_consultas.sql](scripts/auditoria_consultas.sql) y los scripts `db:auditoria*` de `package.json`.

[notifications.js](src/services/notifications.js) inicializa Socket.IO con JWT y salas de usuarios/roles. Los controladores de técnico y jefe emiten avisos cuando cambian asignaciones, solicitudes o revisiones. El frontend los recibe con su hook de notificaciones.

Socket.IO consulta la cuenta activa y su rol vigente, igual que la API. Los avisos dirigidos a Secretaría se guardan en `Notificaciones` por cuenta, incluso sin conexiones abiertas. `GET /api/notificaciones` recupera los últimos 25 pendientes; `PATCH /api/notificaciones/leidas` marca los identificadores mostrados como leídos únicamente para la cuenta autenticada. Ambos requieren rol Secretaría y desactivan la caché. Finalizar una reparación también genera el aviso para facturación.

El informe administrativo usa [diagnosticoPdf.js](src/services/recepcion/diagnosticoPdf.js), con encabezado, datos de recepción, hallazgos, solución, presupuesto en su moneda, condiciones y páginas numeradas. El técnico sigue sin acceso al PDF que contiene datos del cliente. La modalidad sin repuestos corresponde al informe y autorización del cliente; no puede desactivarse con solicitudes de piezas vigentes ni cambiarse sobre una orden cerrada.

## Respaldos

[backupService.js](src/services/backupService.js) genera:

- `db_dump_<fecha>.dump` mediante `pg_dump` en formato custom, o `sistema_<fecha>.json` identificado como copia parcial si ese procedimiento falla.
- Inventario `productos_<fecha>.xlsx` y `.pdf`.
- Un informe de resultado o error en texto.

Se organizan por mes. Compose monta `C:/backup` en `/backup` y configura `/backup/CTE-Backup` como destino. `BACKUP_DISPLAY_ROOT` permite mostrar la ruta equivalente de Windows. Con ejecución desde el host, configura un destino persistente adecuado.

La programación se configura en Administración → Respaldos: diaria, semanal o mensual, siempre en hora de Nicaragua. La próxima ejecución y los reintentos persisten en PostgreSQL; las ejecuciones pendientes se retoman al iniciar el backend. Las copias registran estado, archivos y SHA-256. La verificación comprueba integridad y estructura, sin restaurar sobre el taller.

El administrador consulta `GET /api/admin_pro/backups` y solicita `POST /api/admin_pro/backups/manual`. El respaldo de base de datos conserva las referencias de las fotos, pero el servicio no copia los objetos de R2 ni el directorio de fotos locales. Una recuperación completa necesita también esos archivos u objetos.

La cuenta, configuración, reglas, auditoría y los 35 reportes agrupados están descritos en [Administración del taller](../docs/administracion.md), con rutas, reglas aplicadas, migración aditiva y pruebas. El cliente PostgreSQL del Dockerfile corresponde a la versión 16 del servidor para permitir restaurar las copias en la misma versión.

## Pruebas y comprobaciones

### Suite actual de Secretaría

Esta suite cubre el circuito de Secretaría; los estados técnicos y piezas aprobadas necesarios se preparan como fixtures. Las asignaciones, aprobaciones y excepciones se comprueban en la suite independiente del jefe técnico.

Desde la raíz:

```powershell
npm run test:secretaria
npm run test:secretaria:integracion
```

| Archivo | Alcance |
| --- | --- |
| [reglas.test.js](tests/secretaria/reglas.test.js) | Tipos de equipo, condiciones de recepción, páginas de 20, IDs, textos vacíos e importes. |
| [api.test.js](tests/secretaria/api.test.js) | Sesión y acceso de Secretaría, clientes/equipos, búsqueda por prefijo, diagnósticos, PDF, fotos, órdenes, contacto, retiro, cancelación, proveedores, categorías, compras, facturas, garantía, entrega y dashboard. |
| [run-integration.js](tests/secretaria/run-integration.js) | Crea una base temporal local, sincroniza el esquema, carga SQL con inclusiones anidadas, ejecuta el smoke de historial y la API y retira la base en `finally`. |

El comando rápido también incluye las pruebas existentes de nombres R2 y las del frontend. El de integración requiere Docker con `db` y `backend` activos, y usa un servidor HTTP de pruebas en un puerto libre; no utiliza la API del taller en el puerto 5000.

La base temporal se llama `cte_secretaria_test_<UUID>` y su nombre se genera en el ejecutor. Se admiten únicamente los hosts locales `db`, `localhost`, `127.0.0.1` y `::1`. Desde el backend sin Docker puede ejecutarse `npm run test:secretaria:integracion` con `CTE_TEST_DATABASE_ADMIN_URL` apuntando a PostgreSQL local y permisos de crear bases. Las otras conexiones se obtienen del ejecutor, no de una base existente para pruebas.

El ejecutor no aplica `Seed.js`: crea fixtures independientes. El smoke SQL termina con `ROLLBACK` dentro de la base temporal. La limpieza retira exclusivamente la base cuyo nombre generó la ejecución; un cierre forzado del proceso o del servicio puede impedir que se ejecute `finally`.

El transporte S3 está simulado en memoria y sus variables son ficticias. Se prueba que la actualización conserve fotografías, que los bytes puedan descargarse con autorización, que los fallos no dejen referencias u objetos huérfanos y que se respeten etapas y límites. Esto no verifica conectividad, permisos ni credenciales del bucket real. La prueba de facturación usa PostgreSQL real y comprueba stock, rollback por falta de piezas, importes, factura única y fecha de garantía al entregar.

Las respuestas 400/401/403/409/413 y fallos simulados 500/503 forman parte de casos negativos. Los controladores pueden escribir esos errores previstos en consola; el resultado de `node:test` y el código de salida determinan si la prueba pasó.

### Suite del jefe técnico

Desde la raíz: `npm run test:jefe:integracion`; desde `backend/`: el mismo comando con una conexión local de administración configurada. [api.test.js](tests/jefeTecnico/api.test.js) verifica permisos por rol y responsable, inicio real, disponibilidad, asignación inicial, compatibilidad de rutas, prioridades, historial, reasignación y cierre excepcional, revisión de irreparables, reservas concurrentes, correcciones y entrega de piezas, además de alertas para trabajos asignados. Las correcciones de repuestos comprueban retirada de aprobación, reapertura, distinción entre entrega errónea y devolución total, confirmaciones explícitas, reservas sin duplicar stock, snapshots/actor/motivo, bloqueos de órdenes cerradas/facturadas y exclusión mutua de dos correcciones simultáneas.

El ejecutor compartido acepta `jefeTecnico`, crea `cte_jefetecnico_test_<UUID>`, carga el esquema y SQL, usa un puerto HTTP libre y elimina exclusivamente su base temporal en `finally`. Los datos del taller y el bucket R2 no se modifican. La comprobación visual de escritorio y móvil está descrita en [el README del frontend](../frontend/README.md#desarrollo-y-verificación).

### Suite del técnico

Desde la raíz o `backend/`: `npm run test:tecnico:integracion`. [api.test.js](tests/tecnico/api.test.js) comprueba el contrato sin datos del cliente en consultas y escrituras, denegación de atajos y trabajos ajenos, borradores, bitácora, cierre con pruebas obligatorias, irreparables en revisión, fotos privadas y metadatos retirados, catálogo y reservas, prioridad/páginas, fechas e indicadores, búsqueda sin notas privadas y avisos reales de Socket.IO.

El ejecutor crea `cte_tecnico_test_<UUID>` en PostgreSQL local, prepara esquema y SQL, simula S3 en memoria y elimina la base temporal al terminar. No toca registros del taller ni objetos reales de R2. La revisión visual con datos sintéticos está descrita en [frontend](../frontend/README.md#desarrollo-y-verificación).

Para un cambio pequeño, el ejecutor acepta un tercer argumento con el patrón de nombres y comprueba solo los casos afectados: `node tests/secretaria/run-integration.js secretaria 'Secretaría: avisos|Secretaría: modalidad|Secretaría: informe PDF'`. Una regresión amplia se justifica cuando cambian reglas compartidas o quedan dudas sobre otros flujos.

### Comprobaciones individuales y flujo anterior

Ejecutar desde la raíz del proyecto, salvo indicación contraria:

| Prueba | Comando / archivo | Alcance |
| --- | --- | --- |
| Claves de fotografías | `node --test backend/tests/unit/fotoStorage.test.js` | Tipos, etapas, nombres, hora de Nicaragua, unicidad y formatos anteriores; no accede a R2. |
| Cola de fotos frontend | `node --test frontend/tests/photoQueue.test.js` | Selección, validación, fallos y reintentos. |
| Historial SQL | [historial_estados_smoke.sql](tests/sql/historial_estados_smoke.sql) | Fechas, historial y reglas de piezas; termina con `ROLLBACK`. |
| Flujo HTTP | [flujoCompleto.test.js](tests/api/flujoCompleto.test.js) | Operaciones de negocio sobre la API indicada; optativo y con datos de prueba reales. |
| Salud | `GET /health` | Disponibilidad y conexión PostgreSQL. |

### Comandos del backend

Ejecutar desde `backend/`. Los scripts completos están en [package.json](package.json).

| Comando | Uso |
| --- | --- |
| `npm run dev`, `npm start` | Servidor con recarga o ejecución directa. |
| `npm run db:generate` | Regenerar el cliente Prisma después de cambiar el esquema. |
| `npm run db:sync` | Sincronizar el esquema; se detiene si Prisma requiere aceptar pérdida de datos. |
| `npm run db:seed` | Aplicar la semilla idempotente de cuentas y datos de demostración. |
| `npm run db:functions` | Cargar SQL con `psql` y `SQL_DATABASE_URL`; en PowerShell puede usarse `scripts/load_functions.ps1`. |
| `npm run db:check:users`, `npm run db:check:clientes`, `npm run db:check:tecnicos` | Consultar datos del contenedor `postgres_cte`; requieren Docker y esa instancia. |
| `npm run db:auditoria:ver` | Consultar auditoría con la conexión SQL configurada. |
| `npm run studio` | Iniciar Prisma Studio desde el host. Para Docker, usar el comando con hostname de la guía general. |

### SQL y flujo HTTP

Prueba SQL, en el contenedor desde la raíz:

```powershell
docker compose exec backend node scripts/run_sql_file.cjs tests/sql/historial_estados_smoke.sql
```

El flujo anterior `tests/api/flujoCompleto.test.js` está excluido de la suite nueva y desactivado salvo `CTE_RUN_API_FLOW_TESTS=1`. Necesita actualizar fixtures de contacto, monto autorizado y garantía automática antes de usarlo para validar el circuito vigente. Configura `CTE_TEST_API_BASE_URL` —su valor por defecto es puerto 4000, distinto del puerto 5000 de Compose— y `CTE_TEST_TOKEN` o `CTE_TEST_USERNAME`/`CTE_TEST_PASSWORD`. Este flujo anterior crea datos sin limpieza automática: utiliza una base de pruebas.

Comando desde `backend/`:

```powershell
npm run test:api
```

Una prueba de R2 real debe comprobar subida, lectura, referencia y nombre, y limpiar únicamente los objetos y registros creados por esa prueba. No vaciar el bucket como método de verificación.

## Cómo mantener una función

- Registrar nuevas rutas en el archivo del módulo y, si es un prefijo nuevo, en `app.js`.
- Mantener validación del cliente en el controlador y reglas reutilizables en servicios/utilidades; comprobar los controles SQL asociados.
- Aplicar autenticación y permisos en la API y propiedad del trabajo cuando corresponda.
- Para modelos nuevos, actualizar Prisma, SQL, respaldos y cualquier consulta administrativa que enumere tablas.
- Para estados nuevos, revisar `domainValidation.js`, triggers, filtros, frontend e historial.
- Para fotos, conservar la relación entre tipo, entidad, objeto y referencia de base de datos.
- Mantener los dos cargadores SQL cuando cambie la lista de scripts.
- Documentar la responsabilidad y el motivo de una regla; verificar solo los componentes afectados por el cambio.

Antes de retirar una función, busca sus referencias en frontend, backend, SQL y pruebas. Quita primero rutas e imports que dependan de ella y comprueba si mantiene restricciones o historial. Desde `backend/` puedes verificar que Express siga importando correctamente, con el entorno configurado:

```powershell
node --env-file=.env -e "import('./src/app/app.js').then(() => console.log('app import ok')).catch((err) => { console.error(err); process.exit(1); })"
```
