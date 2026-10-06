# Frontend SGR

Interfaz React + Vite del sistema de gestión de reparaciones. El contenido se organiza por módulos funcionales en `src/features/`; esta guía permite ubicar una pantalla y seguir sus componentes, hooks y llamadas a la API.

[Guía general](../readme.md) · [Backend](../backend/Readme.md)

## Índice

- [Mapa de carpetas](#mapa-de-carpetas)
- [Inicio, navegación y sesión](#inicio-navegación-y-sesión)
- [Pantallas y módulos](#pantallas-y-módulos)
- [Secretaría](#secretaría)
- [Administración](#administración)
- [Técnico](#técnico)
- [Técnico Jefe](#técnico-jefe)
- [Funciones compartidas](#funciones-compartidas)
- [Comunicación con el backend](#comunicación-con-el-backend)
- [Configuración y despliegue](#configuración-y-despliegue)
- [Desarrollo y verificación](#desarrollo-y-verificación)
- [Cómo agregar o modificar una función](#cómo-agregar-o-modificar-una-función)

## Mapa de carpetas

```text
frontend/
  README.md
  src/
    main.jsx                 Montaje de React y estilos iniciales.
    App.jsx                  Router, proveedores, layout y carga de páginas.
    App.css                  Estilos de la aplicación y layout.
    index.css                Estilos globales.
    features/
      secretaria/            Recepción, catálogos, compras y facturación.
        pages/               Pantallas del módulo.
        components/
          Diagnostico/       Formulario, tabla, constantes y reglas de recepción.
          shared/            Fotos, historial, autocompletado y teclado del módulo.
        hooks/               Paginación y cola de fotos.
        services/            API de Secretaría.
        legacy/              Versiones previas de algunas pantallas.
        index.js             Exportaciones del módulo.
      admin/
        pages/               Pantallas administrativas y reportes.
        components/          Métricas, gráficos y acciones de exportación.
        services/            API administrativa.
        utils/               Exportación CSV y utilidades.
        index.js
      tecnico/
        pages/               Dashboard y secciones de trabajo.
        components/          Tablas, tarjetas, estadísticas y modales.
        hooks/               Datos y operaciones del dashboard.
        utils/               Mapeo de respuestas, estados y filtros.
        index.js
      tecnicoJefe/
        pages/               Dashboard y secciones de coordinación.
        components/          Columnas, estados, secciones y modales.
        hooks/               Datos y acciones de coordinación.
        services/            Diagnósticos, órdenes y repuestos.
        utils/               Constantes y helpers.
        index.js
      personalizacion/       Tema, contexto y control de apariencia.
      responsive/            Adaptación del layout.
      ordenes/               Pantalla auxiliar; revisar imports antes de reutilizar.
      tecnicos/              Pantalla auxiliar; revisar imports antes de reutilizar.
    components/              UI compartida entre módulos.
    context/                 Autenticación global.
    hooks/                   Notificaciones en tiempo real.
    services/                Axios, autenticación, sockets y flujo global.
    pages/
      Auth/                  Inicio de sesión.
      FlujoAtencion.jsx      Vista de seguimiento usada por varios módulos.
    assets/                  Imágenes, iconos y SVG de la aplicación.
  tests/
    photoQueue.test.js        Selección de fotos, fallos y reintentos.
    secretaria/              Perfil de recepción y navegación con teclado.
  dist/                      Compilación generada por Vite.
  index.html                 Documento de entrada.
  package.json               Comandos y dependencias.
  package-lock.json          Versiones resueltas.
  vite.config.js             React y proxy de desarrollo.
  tailwind.config.cjs        Configuración de Tailwind.
  postcss.config.cjs         Procesamiento de CSS.
  eslint.config.js           Configuración de análisis de código.
  Dockerfile                 Desarrollo, compilación y servidor Nginx.
  nginx.conf.template        Archivos estáticos y navegación SPA en producción.
  .env.example               Plantilla de variables públicas del frontend.
```

Usa carpetas del módulo cuando el contenido solo se utiliza allí. `src/components`, `src/hooks` y `src/services` contienen responsabilidades compartidas. Los archivos `index.js` agrupan exportaciones; no sustituyen el registro de una ruta en `App.jsx`.

## Inicio, navegación y sesión

| Archivo | Responsabilidad |
| --- | --- |
| [main.jsx](src/main.jsx) | Monta React, `StrictMode` y hojas de estilo iniciales. |
| [App.jsx](src/App.jsx) | Define rutas, `QueryClientProvider`, `AuthProvider`, personalización, layouts y páginas cargadas con `lazy`/`Suspense`. |
| [AuthContext.jsx](src/context/AuthContext.jsx) | Login, logout, usuario y sesión aislada por pestaña mediante `sessionStorage`. |
| [Login.jsx](src/pages/Auth/Login.jsx) | Formulario de acceso y navegación posterior al login. |
| [Sidebar.jsx](src/components/Sidebar.jsx), [Navbar.jsx](src/components/Navbar.jsx) | Navegación principal, identidad y controles globales. |

La sesión usa las claves `token` y `cte_user` de `sessionStorage`. `AuthContext` retira las claves antiguas de autenticación de `localStorage`, mientras preferencias de tema o sidebar sí pueden persistir allí.

Las páginas administrativas y de Secretaría comparten `MainLayout`. Los dashboards técnicos tienen organización propia. `RequireAuth` comprueba la sesión para navegar; los permisos definitivos y la propiedad de los trabajos se comprueban en el backend.

Un 401 fuera del login limpia la sesión, vacía la caché HTTP y emite `auth:unauthorized`; el contexto dirige al usuario al login. El cliente de API agrega el token a las solicitudes y debe reutilizarse en los servicios del módulo.

## Pantallas y módulos

[App.jsx](src/App.jsx) es la referencia de las rutas efectivamente navegables.

| Ruta o grupo | Módulo / pantalla |
| --- | --- |
| `/login` | `pages/Auth/Login.jsx`. |
| `/`, `/admin` | `features/admin/pages/AdminDashboard.jsx`. |
| `/admin/usuarios`, `/clientes`, `/equipos` bajo `/admin` | Usuarios, clientes y equipos avanzados. |
| `/admin/diagnosticos`, `/ordenes`, `/ordenes-estado` bajo `/admin` | Diagnósticos y órdenes administrativas. |
| `/admin/repuestos`, `/inventario`, `/compras` bajo `/admin` | Inventario y abastecimiento. |
| `/admin/facturacion`, `/visualizacion-control-facturas`, `/garantias` bajo `/admin` | Facturas y garantías. |
| `/admin/tecnicos`, `/ganancias` bajo `/admin` | Rendimiento y finanzas. |
| `/admin/historial-equipo`, `/historial-repuesto` bajo `/admin` | Trazabilidad administrativa. |
| `/secretaria` | `features/secretaria/pages/SecretariaDashboard.jsx`. |
| `/secretaria/clientes`, `/equipos` bajo `/secretaria` | Recepción y asociación cliente/equipo. |
| `/secretaria/diagnostico`, `/nueva-orden` bajo `/secretaria` | Diagnósticos de recepción y creación de órdenes. |
| `/secretaria/repuestos`, `/tipos-repuesto`, `/compras`, `/proveedores` bajo `/secretaria` | Catálogos y abastecimiento. |
| `/secretaria/facturacion` | Facturación, garantías y entrega. |
| `/admin/flujo-atencion`, `/secretaria/flujo-atencion` | [FlujoAtencion.jsx](src/pages/FlujoAtencion.jsx), compartida. |
| `/tecnico` | Dashboard de trabajo asignado. |
| `/tecnico-jefe` | Supervisión del taller, asignaciones, repuestos e intervenciones. |

Las secciones de los dashboards técnicos se distribuyen en archivos internos; no todas requieren una ruta HTTP de frontend independiente.

## Secretaría

### Pantallas y servicios

Todos los caminos de esta tabla parten de `src/features/secretaria/`.

| Función | Pantalla | Servicio HTTP |
| --- | --- | --- |
| Dashboard | [SecretariaDashboard.jsx](src/features/secretaria/pages/SecretariaDashboard.jsx) | [dashboardService.js](src/features/secretaria/services/dashboardService.js). |
| Clientes | [Clientes.jsx](src/features/secretaria/pages/Clientes.jsx) | [clientesService.js](src/features/secretaria/services/clientesService.js). |
| Equipos | [Equipos.jsx](src/features/secretaria/pages/Equipos.jsx) | [equiposService.js](src/features/secretaria/services/equiposService.js). |
| Diagnóstico | [Diagnostico.jsx](src/features/secretaria/pages/Diagnostico.jsx) | [diagnosticoService.js](src/features/secretaria/services/diagnosticoService.js). |
| Órdenes | [NuevaOrden.jsx](src/features/secretaria/pages/NuevaOrden.jsx) | [ordenesService.js](src/features/secretaria/services/ordenesService.js). |
| Repuestos | [Repuestos.jsx](src/features/secretaria/pages/Repuestos.jsx) | [repuestosService.js](src/features/secretaria/services/repuestosService.js). |
| Tipos de repuesto | [TiposRepuesto.jsx](src/features/secretaria/pages/TiposRepuesto.jsx) | [tiposRepuestoService.js](src/features/secretaria/services/tiposRepuestoService.js). |
| Proveedores | [Proveedores.jsx](src/features/secretaria/pages/Proveedores.jsx) | [proveedoresService.js](src/features/secretaria/services/proveedoresService.js). |
| Compras | [Compras.jsx](src/features/secretaria/pages/Compras.jsx) | [comprasService.js](src/features/secretaria/services/comprasService.js). |
| Facturación | [Facturacion.jsx](src/features/secretaria/pages/Facturacion.jsx) | [facturasService.js](src/features/secretaria/services/facturasService.js), [garantiasService.js](src/features/secretaria/services/garantiasService.js). |

`services/tecnicosService.js` sirve para seleccionar técnicos dentro de funciones administrativas de Secretaría. La carpeta `legacy/` conserva versiones previas de Clientes, Equipos y Facturación; las entradas actuales de `App.jsx` apuntan a `pages/`.

### Componentes y hooks importantes

| Archivo | Responsabilidad |
| --- | --- |
| [DiagnosticoForm.jsx](src/features/secretaria/components/Diagnostico/DiagnosticoForm.jsx) | Datos del diagnóstico y controles de recepción. |
| [DiagnosticosTable.jsx](src/features/secretaria/components/Diagnostico/DiagnosticosTable.jsx) | Presentación y acciones de la lista. |
| [constants.jsx](src/features/secretaria/components/Diagnostico/constants.jsx), [helpers.js](src/features/secretaria/components/Diagnostico/helpers.js), [badges.jsx](src/features/secretaria/components/Diagnostico/badges.jsx) | Estados, datos auxiliares y presentación. |
| [receptionRequirements.js](src/features/secretaria/components/Diagnostico/receptionRequirements.js) | Determina si cargador y acceso aplican al tipo de electrónico. |
| [useInfiniteSecretariaList.js](src/features/secretaria/hooks/useInfiniteSecretariaList.js) | Páginas de 20 registros, búsqueda diferida y acumulación de páginas. |
| [Autocomplete.jsx](src/features/secretaria/components/shared/Autocomplete.jsx) | Selección, filtrado local o resultados del servidor y navegación por teclado. |
| [formKeyboardNavigation.js](src/features/secretaria/components/shared/formKeyboardNavigation.js) | Movimiento entre campos de clientes, equipos y diagnóstico. |
| [HistorialEstados.jsx](src/features/secretaria/components/shared/HistorialEstados.jsx) | Historial del servicio. |
| [GuidedTour.jsx](src/features/secretaria/components/shared/GuidedTour.jsx) | Ayuda guiada del módulo. |

El perfil de recepción conserva las etiquetas de equipos existentes. Para un monitor, por ejemplo, cargador y acceso no aplican. El backend también valida esta clasificación y utiliza sus valores correspondientes; al cambiar familias, mantener los dos archivos `receptionRequirements.js` coordinados.

### Paginación y selección de clientes

`useInfiniteSecretariaList` envía `page`, `pageSize=20`, `search` y filtros; combina las filas y solicita otra página cuando `meta.hasMore` lo permite. La tabla compartida y las páginas gestionan el desplazamiento interno. Mantener filtros dentro de la clave de consulta para separar resultados.

La selección de un cliente existente en Equipos consulta al servidor con `searchMode=prefix`, espera brevemente mientras se escribe y conserva el cliente seleccionado entre los datos disponibles. Buscar `d` por nombre devuelve nombres que empiezan por esa letra. Las búsquedas numéricas y las búsquedas generales de otras tablas pueden tener coincidencias contenidas según el backend.

Nueva Orden carga los diagnósticos disponibles por páginas de 20 y permite buscar sin descargar todas las órdenes. La API devuelve `data` y `meta`; el servicio del frontend adapta `data` a la propiedad `diagnosticos` utilizada por la pantalla.

### Fotografías: selección y envío

| Archivo | Papel en el proceso |
| --- | --- |
| [FotosPendientes.jsx](src/features/secretaria/components/shared/FotosPendientes.jsx) | Selección múltiple, arrastre, miniaturas, ampliación, retiro y estado de cada foto. |
| [usePhotoQueue.js](src/features/secretaria/hooks/usePhotoQueue.js) | Prepara imágenes, administra previews y estado, libera URL temporales. |
| [photoQueue.js](src/features/secretaria/components/shared/photoQueue.js) | Valida formatos/tamaño, evita repetir el mismo archivo seleccionado y coordina reintentos. |
| [archivosServicioService.js](src/features/secretaria/services/archivosServicioService.js) | Sube bytes, comunica progreso y descarga contenido autenticado. |
| [FotosServicio.jsx](src/features/secretaria/components/shared/FotosServicio.jsx) | Muestra fotos ya guardadas del diagnóstico u orden. |

Recorrido de creación o actualización:

1. Seleccionar una o varias fotos y revisar las miniaturas antes de enviar.
2. Guardar los datos del diagnóstico y obtener o reutilizar su ID.
3. Subir cada fotografía mediante la API del servicio, con tipo de etapa y nombre original.
4. Mostrar resultado por imagen. Un fallo no impide intentar las demás.
5. Reintentar las fotos pendientes o fallidas; las confirmadas se omiten. La página conserva el ID guardado para que el reintento de fotos no cree otro diagnóstico.

Se admiten JPG, PNG y WebP de hasta 5 MB. La fecha y nombre internos de R2 los genera el backend. La interfaz nunca recibe las credenciales de Cloudflare. Los contratos, tipos y carpetas están en [la sección R2 del backend](../backend/Readme.md#fotografías-y-cloudflare-r2).

### Teclado de formularios

- `Enter`: siguiente campo; `Shift+Enter`: anterior.
- `↑` y `↓`: anterior/siguiente en inputs compatibles.
- `Alt` más una flecha: desplazamiento entre campos sin sustituir la edición nativa.
- En textarea, `Enter` conserva el salto de línea; `Ctrl+Enter` o `Cmd+Enter` permite avanzar.
- Los autocompletados conservan sus propias flechas y selección. Se omiten controles deshabilitados, ocultos y entradas de archivos.

## Administración

| Subcarpeta | Contenido |
| --- | --- |
| [pages](src/features/admin/pages) | Dashboard; usuarios; clientes/equipos; diagnósticos/órdenes; compras; repuestos/inventario; facturas/garantías; ganancias; rendimiento; historiales. |
| [services](src/features/admin/services) | Usuarios, dashboard, diagnósticos, equipos, órdenes, inventario, garantías, ganancias, técnicos y reportes. |
| [components](src/features/admin/components) | `AdminStatCard`, `MetricBarChart`, `ExportActions` y exportaciones agrupadas. |
| [utils/csvExport.js](src/features/admin/utils/csvExport.js) | Exportación CSV y utilidades asociadas. |

[AdminDashboard.jsx](src/features/admin/pages/AdminDashboard.jsx) es la entrada. [InventarioAvanzado.jsx](src/features/admin/pages/InventarioAvanzado.jsx) y las pantallas `*Avanzado.jsx` se registran explícitamente en `App.jsx`; revisar la ruta antes de modificar otra variante con nombre parecido.

Los servicios administrativos usan el prefijo avanzado o reutilizan operaciones generales según la función. Verificar en el backend tanto `onlyAdminPro` como los permisos de las rutas compartidas.

## Técnico

[pages/TecnicoDashboard.jsx](src/features/tecnico/pages/TecnicoDashboard.jsx) coordina el módulo y [hooks/useTecnicoDashboard.js](src/features/tecnico/hooks/useTecnicoDashboard.js) concentra carga de datos y acciones.

| Sección / función | Archivo |
| --- | --- |
| Mi trabajo, filtros, navegación móvil y páginas | [TecnicoDashboard.jsx](src/features/tecnico/pages/TecnicoDashboard.jsx). |
| Diagnósticos activos/completados | [DiagnosticosTable.jsx](src/features/tecnico/components/DiagnosticosTable.jsx). |
| Reparaciones activas/cerradas | [OrdenesGrid.jsx](src/features/tecnico/components/OrdenesGrid.jsx). |
| Solicitudes, aprobación y entrega física | [RepuestosTable.jsx](src/features/tecnico/components/RepuestosTable.jsx). |
| Expediente, recepción, fotos, historia y avances | [ExpedienteTecnico.jsx](src/features/tecnico/components/ExpedienteTecnico.jsx). |
| Informe, borrador, pruebas y búsqueda de piezas | [TecnicoModals.jsx](src/features/tecnico/components/TecnicoModals.jsx), [TecnicoDashboardModals.jsx](src/features/tecnico/components/sections/TecnicoDashboardModals.jsx). |

[tecnicoMappers.js](src/features/tecnico/utils/tecnicoMappers.js) transforma únicamente el contrato técnico del backend, sin nombres ni contactos de clientes. [tecnico.css](src/features/tecnico/components/tecnico.css) adapta el estilo compartido del jefe para filtros, tablas, móvil y tema oscuro. Los componentes antiguos de `pages/sections/` se conservan para compatibilidad; el dashboard actual selecciona sus tablas directamente.

El técnico registra el inicio real del diagnóstico o reparación. Puede guardar un borrador del informe y presupuesto sin finalizar, y registrar avances con autor y fecha desde el expediente. Las pruebas de salida parten vacías; [pruebasSalida.js](src/features/tecnico/utils/pruebasSalida.js) define las aplicables a cada familia de equipo y el backend también las exige. Las irreparables pendientes continúan en reparaciones activas, bloqueadas hasta la revisión del jefe.

El presupuesto estimado permite elegir **Córdobas (NIO)** o **Dólares (USD)**. La selección se conserva al guardar borrador y completar el informe; expediente, supervisión, Nueva Orden y reportes muestran C$ o US$. NIO es la opción inicial. No hay conversión automática: al aprobar un presupuesto USD, Secretaría escribe el monto autorizado en córdobas. Los totales administrativos se separan por moneda.

Los listados y el catálogo se consultan por páginas de 20 en el servidor. Los filtros de período utilizan asignación para activos, finalización para cerrados y solicitud para piezas, hora de Managua. La búsqueda se ejecuta tras 300 ms y cancela solicitudes anteriores; solo carga la sección activa. El catálogo permite buscar más allá de la primera página, comprobar la cantidad disponible y solicitar expresamente una pieza no registrada. Se presentan aprobación y entrega física como etapas distintas.

La regla de privacidad se aplica en el servidor: el frontend no recibe el objeto cliente, IDs de cliente, serie, observaciones administrativas, nombres originales de archivos ni claves R2. El expediente usa información técnica e historial sin motivos administrativos libres. Las fotos nuevas o existentes permanecen ocultas hasta su revisión por secretaría o el jefe; el técnico ve el registro de sus subidas pendientes, pero no las descarga antes de la autorización. [FotosServicio.jsx](src/features/secretaria/components/shared/FotosServicio.jsx) comparte la cola con previsualización, cámara, retiro, progreso y reintento de pendientes. La persona que autoriza abre la foto y confirma que no contiene datos identificadores.

Las consultas TanStack se identifican por cuenta, sección y filtros. Al guardar se invalidan las del técnico actual; al cerrar o cambiar sesión se cancelan consultas y se vacían las cachés HTTP y TanStack. Los avisos abren el expediente correspondiente y refrescan los datos; mientras Socket.IO está conectado se evita el polling periódico, y en desconexión solo se consulta con la pestaña visible. Los errores conservan los datos de la consulta actual y ofrecen reintento.

El contrato completo y sus reglas están documentados en [backend](../backend/Readme.md#trabajo-y-privacidad-del-técnico).

## Técnico Jefe

[pages/TecnicoJefeDashboard.jsx](src/features/tecnicoJefe/pages/TecnicoJefeDashboard.jsx) dirige al panel [JefeSupervision.jsx](src/features/tecnicoJefe/pages/JefeSupervision.jsx). [useSupervision.js](src/features/tecnicoJefe/hooks/useSupervision.js) administra consultas, diálogos, errores y avisos. [supervisionService.js](src/features/tecnicoJefe/services/supervisionService.js) consume `/api/jefe-tecnico`.

| Sección | Función |
| --- | --- |
| Resumen del taller | Indicadores, distribución de estados y carga del equipo. |
| Asignaciones | Diagnósticos y órdenes sin responsable; selección entre cuentas de técnico activas y disponibles. |
| Seguimiento | Filtros de técnico, tipo y estado; prioridad con motivo; detalle, fotos e historial. |
| Equipo técnico | Carga, especialidad, horario, contacto y disponibilidad. |
| Repuestos | Aprobación, rechazo, corrección de pieza/cantidad, retirada de aprobación, reapertura, corrección de entrega y devolución física total; historial por solicitud. |
| Irreparables | Confirmar una justificación técnica o devolver la orden a reparación. |
| Pendientes y retrasos | Trabajos activos con 72 horas o más sin avance, incluidos los asignados. |
| Correcciones y excepciones | Historial con usuario, motivo, fecha y valores anteriores/nuevos de asignaciones, repuestos y entregas. |

[SupervisionWidgets.jsx](src/features/tecnicoJefe/components/SupervisionWidgets.jsx) contiene tablas de 20 registros, tarjetas y diálogos accesibles. [supervision.css](src/features/tecnicoJefe/components/supervision.css) define el menú lateral, la vista móvil y el tema oscuro. Los filtros y la paginación de este panel operan sobre el resumen recibido; los componentes anteriores de `pages/sections/` se conservan para compatibilidad y no se montan en la ruta actual.

El jefe administra y supervisa. Los informes y solicitudes de piezas pertenecen a una cuenta independiente de rol Técnico. Reasignar o finalizar exige una intervención explícita; no hay cierre excepcional de diagnósticos. Aprobar una pieza la reserva y su entrega se registra por separado.

En Seguimiento, “Corregir asignación” permite seleccionar el nuevo responsable y justificar el cambio. En Repuestos, los botones corresponden al estado vigente: retirar aprobación antes de entregar, devolver un rechazo a revisión, corregir un registro de entrega inexistente o registrar una devolución total físicamente recibida. Las dos últimas exigen confirmación expresa. La corrección de entrega conserva la reserva; la devolución total libera la reserva y obliga a revisar nuevamente la solicitud. El historial de cada solicitud muestra el antes/después y distingue ambas acciones. Las órdenes cerradas o facturadas bloquean estas correcciones; las devoluciones parciales o de piezas dañadas necesitan un circuito adicional.

## Funciones compartidas

| Carpeta o archivo | Uso |
| --- | --- |
| [Table.jsx](src/components/Table.jsx) | Tablas compartidas, presentación y manejo de listados. |
| [PageHelp.jsx](src/components/PageHelp.jsx), [DataHelpSecretaria.jsx](src/components/DataHelpSecretaria.jsx) | Ayuda contextual. |
| [BrandLogo.jsx](src/components/BrandLogo.jsx) | Identidad visual compartida. |
| [NotificationTray.jsx](src/components/NotificationTray.jsx) | Presentación de avisos. |
| [useRealtimeNotifications.js](src/hooks/useRealtimeNotifications.js) | Recepción y estado de notificaciones en tiempo real. |
| [notificationsSocket.js](src/services/notificationsSocket.js) | Conexión Socket.IO con token. |
| [flujoAtencionService.js](src/services/flujoAtencionService.js) | Consulta del seguimiento global. |
| [features/personalizacion](src/features/personalizacion) | Contexto, hook, control y CSS de tema claro/oscuro. |
| [useResponsiveLayout.js](src/features/responsive/useResponsiveLayout.js) | Clases y comportamiento del layout por pantalla. |
| [assets](src/assets) | Iconos, logo y recursos estáticos; las fotos de equipos se leen por API. |

## Comunicación con el backend

[services/api.js](src/services/api.js) configura Axios con `VITE_API_URL`, añade JWT y gestiona errores de autenticación. Los servicios de cada módulo definen rutas y adaptan las respuestas.

Hay dos capas de caché que considerar:

- TanStack Query utiliza por defecto 30 segundos de vigencia y desactiva recarga por foco de ventana en `App.jsx`. Las mutaciones deben invalidar las claves de consulta afectadas.
- Axios conserva GET elegibles durante 10 segundos y agrupa solicitudes en curso. Las mutaciones exitosas vacían esa caché. Un GET con `cache: false`, `responseType` o `signal` no se guarda en ella.

Para fotografías y otras descargas se utiliza respuesta binaria. Las URL de preview creadas con `URL.createObjectURL` deben liberarse cuando dejan de utilizarse. No confundir ID del archivo, ID del servicio y clave interna de R2.

## Configuración y despliegue

| Variable | Función |
| --- | --- |
| `VITE_API_URL` | Base pública de Axios. Desarrollo habitual: `/api`; backend separado: `https://backend.example/api`. |
| `VITE_PROXY_TARGET` | Destino del proxy del servidor Vite. Host: `http://localhost:5000`; Compose: `http://backend:5000`. |
| `VITE_SOCKET_URL` | URL opcional de Socket.IO si necesita un destino independiente. |

El socket usa `VITE_SOCKET_URL`, o deriva el destino de `VITE_API_URL` retirando `/api`, o usa el origen de la ventana como alternativa.

[vite.config.js](vite.config.js) redirige `/api` y `/socket.io` durante desarrollo y permite WebSocket. El proxy de Vite no existe en el build de producción.

[Dockerfile](Dockerfile) ofrece etapas `dev`, `build` y `production`. Producción sirve `dist/` con Nginx. [nginx.conf.template](nginx.conf.template) permite navegación SPA y caché de assets; la plantilla actual no configura proxy de la API. Si frontend y backend están separados, compila con una URL pública correcta. `VITE_*` se incorpora al JavaScript y debe contener únicamente configuración pública; las credenciales R2 y el secreto JWT pertenecen al backend.

Archivos de configuración como `index.html`, Vite, Tailwind, PostCSS, ESLint y los package/lockfiles permanecen en `frontend/`, porque los comandos y el Dockerfile esperan esas ubicaciones.

## Desarrollo y verificación

Desde `frontend/`:

```powershell
npm run dev
npm run build
npm run preview
```

`preview` sirve una compilación existente para revisarla y requiere un destino API accesible; no sustituye el proxy de desarrollo ni el despliegue definitivo.

Desde `frontend/`, pruebas de Secretaría:

```powershell
npm run test:secretaria
```

| Archivo | Casos |
| --- | --- |
| [photoQueue.test.js](tests/photoQueue.test.js) | Selección acumulada, duplicados, formatos, tamaños, fallo parcial y reintento sin repetir fotos guardadas. |
| [recepcion.test.js](tests/secretaria/recepcion.test.js) | Perfiles de equipo y concordancia entre formulario y servidor. |
| [teclado.test.js](tests/secretaria/teclado.test.js) | Enter, Shift+Enter, flechas, textarea, autocompletado y campos ocultos o deshabilitados. |

Estas pruebas no suben imágenes a R2. Las de teclado simulan visibilidad y foco para comprobar decisiones; no renderizan las pantallas ni verifican su diseño. Desde la raíz, `npm run test:secretaria` ejecuta también las pruebas rápidas del backend; `npm run test:secretaria:integracion`, `npm run test:jefe:integracion` y `npm run test:tecnico:integracion` prueban la API con bases temporales.

La revisión opcional `npm run test:jefe:visual`, desde `frontend/`, ejecuta [visual-smoke.cjs](tests/jefeTecnico/visual-smoke.cjs). Requiere Compose activo, una cuenta local de jefe, Playwright disponible en la resolución de módulos (o `CTE_PLAYWRIGHT_PATH`/`NODE_PATH`) y Chromium/Edge; `CTE_BROWSER_EXECUTABLE` admite una ruta de navegador instalada. Comprueba las ocho secciones, filtros, paginación, diálogos, temas y ancho móvil. Solo permite consultas GET a la API del taller y guarda capturas en `tmp/jefe-tecnico/` en la raíz. La sesión de cinco minutos se mantiene en memoria y no se imprime ni se guarda.

`npm run test:jefe:correcciones:visual` ejecuta [correcciones-visual.cjs](tests/jefeTecnico/correcciones-visual.cjs) con sesión y API completamente sintéticas. Comprueba motivo obligatorio, confirmaciones de entrega inexistente/devolución total, rutas y cuerpos enviados, corrección de asignación, historial por solicitud y ancho móvil. Admite las mismas rutas de Playwright/navegador y guarda capturas en `tmp/jefe-correcciones/`; no modifica el taller.

`npm run test:tecnico:visual`, desde `frontend/`, ejecuta [visual-smoke.cjs](tests/tecnico/visual-smoke.cjs). Requiere el frontend local en el puerto 5173 y Playwright/Chromium o Edge. `CTE_PLAYWRIGHT_PATH` admite una ruta al paquete Playwright y `CTE_BROWSER_EXECUTABLE` una ruta al navegador. La prueba utiliza sesión, respuestas y escrituras sintéticas: comprueba las seis secciones, páginas de 20, borradores, expediente, bitácora, pruebas sin resultados predeterminados, búsqueda/solicitud de pieza, entrega pendiente, tema oscuro y navegación móvil. Guarda capturas en `tmp/tecnico/`; no envía escrituras a la API ni a R2 reales.

Para cambios de interfaz, revisa la pantalla afectada y compila. Para cambios de documentación, verifica rutas y enlaces; no es necesario crear registros de prueba ni reconstruir el sistema.

El recorrido de técnico también comprueba NIO por defecto, guardado/reapertura del borrador USD e informe final con US$. `node tests/secretaria/presupuesto-visual.cjs`, desde `frontend/`, usa la misma configuración de navegador y una API simulada para verificar que el presupuesto USD no precarga el monto autorizado en córdobas y exige indicarlo antes de aprobar.

La campana de Secretaría recupera avisos guardados al entrar, reconectar, volver a la ventana o abrir la bandeja. `Limpiar` marca los avisos mostrados como leídos en esa cuenta. `node tests/secretaria/avisos-visual.cjs` verifica recuperación sin conexión, recarga sin duplicados y lectura persistente con API simulada; usa las mismas variables de Playwright y no modifica datos reales. Las comprobaciones deben centrarse en el flujo afectado por cada cambio.

## Cómo agregar o modificar una función

1. Busca su entrada en `App.jsx` y el módulo bajo `features/`.
2. Crea o edita la pantalla en `pages/`; usa `pages/sections/` para secciones internas cuando corresponda.
3. Separa presentación en `components/`, estado reutilizable en `hooks/`, transformación en `utils/` y llamadas HTTP en `services/`.
4. Reutiliza `services/api.js` para autenticación, caché y errores. Consulta [las rutas y reglas del backend](../backend/Readme.md#mapa-de-la-api).
5. Si agregas una página navegable, registra ruta, menú y acceso de sesión; el permiso se implementa también en la API.
6. Para listados grandes, conservar paginación, búsqueda en servidor y metadatos. No cargar todas las filas para filtrar en el navegador.
7. Para mutaciones, actualizar o invalidar las consultas que muestran los datos afectados.
8. Antes de eliminar, buscar imports, exportaciones, rutas, menús, estilos y referencias del módulo; actualizar esta guía.

```powershell
rg "NombreComponente" frontend/src
rg "ruta/del/archivo" frontend/src
```

Comenta las reglas y decisiones que necesitan contexto, como una restricción por tipo de electrónico o el reintento de fotos sobre un servicio ya guardado. Mantén el mapa general en los README para evitar copiar la misma explicación en cada componente.

## Administración

El administrador cuenta con Mi cuenta, Usuarios y acceso, Negocio, Reglas del negocio, Respaldos y Auditoría. El Centro de reportes agrupa 35 opciones por categoría, con filtros, páginas de veinte filas, Excel `.xlsx` generado en el servidor y PDF del resultado completo. Los accesos están agrupados en Sidebar y se protegen por rol en rutas y API. Consulte [Administración del taller](../docs/administracion.md) para las rutas, requisitos y validación.
