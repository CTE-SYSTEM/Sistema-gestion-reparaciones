# Cronograma retrospectivo para Taskade — CTE-ADM-BD

> Corte: 3 de octubre de 2026. Fuente: 67 commits de [main](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commits/main). Este es un **cronograma reconstruido**, no un registro original de planificación Scrum. Véase [contexto-scrum-cte.md](contexto-scrum-cte.md) para el criterio y los límites de la evidencia.

## Estructura de trabajo

Usar la jerarquía **Épica → Sprint → Historia de usuario → tareas**. En cada historia registrar:

- **Inicio y fin del sprint:** la ventana retrospectiva de la tabla siguiente. Es una fecha de organización, no una fecha demostrada de ejecución de cada tarea.
- **Fecha de evidencia:** día local America/Managua del commit o rango entre commits relacionados. Sirve como hito verificable; no equivale al comienzo real del trabajo.
- **Responsable provisional:** el autor visible de los commits enlazados. Confirmar con el equipo antes de asignarlo como responsable histórico; autoría Git y propiedad de una historia pueden diferir.
- **Evidencia GitHub:** enlaces directos a commits. Un commit puede respaldar varias tareas si incluye cambios de más de un módulo.
- **Estado:** “código registrado” cuando haya commit; aceptación, pruebas y despliegue quedan “sin verificar” salvo que exista evidencia adicional.

No convertir los 67 commits en 67 tareas. Las tareas de abajo describen cambios visibles en mensajes y archivos. Si se quieren agregar reuniones, pruebas de usuario o estimaciones, requieren evidencia externa o deben etiquetarse como actividades propuestas, no históricas.

## Tabla de sprints para el calendario

| Épica | Sprint | Inicio | Fin | Commits | Hito de evidencia |
|---|---|---|---|---:|---|
| E1 Base técnica | S1 Prototipo | 2026-03-17 | 2026-03-30 | 3 | [821048e](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/821048e1f61fc16b3387d6d1585b3c4efef1dc0a) |
| E1 Base técnica | S2 Infraestructura y BD | 2026-04-14 | 2026-04-28 | 12 | [dae5fe2](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/dae5fe230c3cde9aeeb45cdf682a60f33a8f1d75) |
| E2 Operación del taller | S3 Secretaría y Técnico | 2026-04-29 | 2026-05-12 | 16 | [fcc3dcf](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/fcc3dcfec1d6ede4dc4140df42b8e2206de4f57a), [af0579e](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/af0579e5c0bdaa6d95c30d72cdd940a461de0140) |
| E3 Administración y control | S4 Garantías y auditoría | 2026-05-13 | 2026-05-26 | 16 | [47a771e](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/47a771e8e4067f0503e4ec873692d3c9c0161213), [4e7d145](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/4e7d1459df410c7b0048b2f6bf4ee2d8f74ae713) |
| E3 Administración y control | S5 Ganancias y despliegue | 2026-05-27 | 2026-06-09 | 16 | [2deddfb](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/2deddfbb5ff65c5c89e1f0a5b44e7bd9ef7de56b), [96fe5e3](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/96fe5e3fcb55bc5232c6825596a06b0666df7753) |
| E4 Calidad y evolución | S6 Respaldo y estabilidad | 2026-06-10 | 2026-06-23 | 2 | [ba5abb8](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/ba5abb8796bd607702f77d34809788fc07f241b6), [30a5201](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/30a5201cfd08a56a12c0524e71f0e304fc7089d9) |
| E4 Calidad y evolución | S7 Refactorización | 2026-07-30 | 2026-08-12 | 1 | [22e4c67](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/22e4c67ea99f133749793c8806c981a88843fc34) |
| E4 Calidad y evolución | S8 Secretaría y ORM | 2026-09-20 | 2026-10-03 | 1 | [8618d88](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/8618d88626a9e21991963c5fe4045d1b20351d3f) |

**Pausas visibles en main:** 22 mar–13 abr, 11 jun–29 jul y 31 jul–24 sep. La pausa de junio/julio comienza dentro de la ventana S6. Marcar estos periodos como **“sin commits registrados”**, no como sprints ejecutados ni como ausencia probada de trabajo. La S8 termina en la fecha de corte; solo tiene evidencia del 25 de septiembre.

## Backlog para crear en Taskade

Cada entrada incluye las tareas que pueden rastrearse a los commits citados. Las fechas de historia son **fechas de evidencia Git**, mientras el inicio y fin de planificación son los de su sprint en la tabla.

### Épica E1 — Base técnica

#### S1 — Prototipo y arquitectura inicial (17–30 mar)

- **HU-01 — Base del sistema.** Como equipo de desarrollo, queremos una estructura inicial de backend, frontend y datos para continuar por módulos. **Evidencia:** 17 mar. **Responsable provisional:** @rcxx06. **Commits:** [821048e](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/821048e1f61fc16b3387d6d1585b3c4efef1dc0a).
  - Crear estructura de backend y frontend.
  - Incorporar esquema Prisma y controladores iniciales de autenticación, clientes, equipos, órdenes, facturas, garantías, proveedores, repuestos y técnicos.
- **HU-02 — Configuración y primeros ajustes.** Como equipo, queremos corregir la configuración visual y optimizar la base inicial. **Evidencia:** 17–21 mar. **Responsable provisional:** @rcxx06. **Commits:** [e9896f9](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/e9896f90b5b19c5efcae3a529ba577b92444c1de), [4e8989e](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/4e8989e52815c123849c20593947bd048fec1b2d).
  - Ajustar Tailwind y PostCSS.
  - Optimizar recursos y reorganizar componentes/servicios iniciales.

#### S2 — Infraestructura y base de datos (14–28 abr)

- **HU-03 — Instalación reproducible.** Como integrante del equipo, quiero instrucciones de dependencias y servicios en contenedores para preparar el proyecto. **Evidencia:** 14–21 abr. **Responsable provisional:** @rcxx06 / @Sadiel (validar reparto). **Commits:** [8474219](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/84742196e21b49d036cf071be03a291ade8cb843), [240c93c](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/240c93c61acbd14df6c05eb3d97d65e8c9b5b983).
  - Documentar comandos y dependencias.
  - Agregar Dockerfiles, Compose y migración inicial de la BD.
- **HU-04 — Migración a PostgreSQL.** Como equipo, queremos usar PostgreSQL en la configuración del proyecto para facilitar el despliegue previsto. **Evidencia:** 22–26 abr. **Responsable provisional:** @Sadiel. **Commits:** [b559dfb](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/b559dfb16a99516006b27c8422064282f52b82cd), [dae5fe2](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/dae5fe230c3cde9aeeb45cdf682a60f33a8f1d75).
  - Corregir sincronización de Prisma y SQL.
  - Cambiar esquema, migraciones y configuración desde SQL Server a PostgreSQL.
- **HU-05 — Perfiles y acceso en preparación.** Como usuario del sistema, quiero acceder a la pantalla y rutas según el perfil. **Evidencia:** 28 abr. **Responsable provisional:** @Sadiel. **Commits:** [3f946ea](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/3f946ea864a6d3f9bf3efbdfc429b23bc1d32066), [7d0a303](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/7d0a3031a794c8370575a27a9c2225deffa4ff44).
  - Agregar perfiles y datos de prueba.
  - Construir pantallas/rutas de login. **Límite:** el commit [7d0a303](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/7d0a3031a794c8370575a27a9c2225deffa4ff44) indica que aún no funcionaban; registrar la historia como parcial en este sprint.

### Épica E2 — Operación del taller

#### S3 — Secretaría y Técnico (29 abr–12 may)

- **HU-06 — Registros de Secretaría.** Como secretaria, quiero gestionar datos operativos del taller desde el módulo de Secretaría. **Evidencia:** 30 abr–3 may. **Responsable provisional:** @rcxx06 / @Sadiel (validar reparto). **Commits:** [23dfe1a](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/23dfe1a215829cbbba94aa390cc6c37ede836948), [fcc3dcf](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/fcc3dcfec1d6ede4dc4140df42b8e2206de4f57a), [8e3c66d](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/8e3c66d60cb48f3e26ee794760350d77d041cdea).
  - Añadir panel e interfaces de clientes, equipos, compras, proveedores, repuestos y órdenes.
  - Conectar controladores/rutas de Secretaría con la BD y los CRUD registrados. **Límite:** [fcc3dcf](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/fcc3dcfec1d6ede4dc4140df42b8e2206de4f57a) menciona 3 de 7 módulos con CRUD, no siete completos.
- **HU-07 — Diagnóstico y vistas técnicas.** Como técnico o jefe técnico, quiero consultar y trabajar con diagnósticos y órdenes. **Evidencia:** 4–10 may. **Responsable provisional:** @Sadiel. **Commits:** [bdd3ef8](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/bdd3ef81445e8310a7c5d244e55c838600e5a6fd), [af0579e](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/af0579e5c0bdaa6d95c30d72cdd940a461de0140), [f41034a](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/f41034a96934b0f1be40d0b3d781a4111f3a4dde), [c27934c](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/c27934cedb5ed29d5b498b4a33ba48d2caa5f4c8).
  - Relacionar usuarios con técnicos y preparar la vista de Jefe Técnico.
  - Añadir controlador/servicio de diagnóstico e interfaz técnica; refinar vistas posteriores.
- **HU-08 — Funciones de base de datos.** Como equipo, queremos centralizar operaciones de datos que se pasaron a funciones/procedimientos. **Evidencia:** 6–7 may. **Responsable provisional:** @Sadiel. **Commits:** [8fa330b](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/8fa330b96cfaa8c346494b05cd952172bbbebd9f), [c5a6254](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/c5a6254ce4a966cab9d057cabf3b308739ba1b1e).
  - Añadir funciones SQL para módulos operativos.
  - Ajustar controladores y documentación de ejecución.
- **HU-09 — Administración de usuarios.** Como administrador, quiero usar Admin Pro para crear y gestionar usuarios. **Evidencia:** 9 may. **Responsable provisional:** @rcxx06. **Commits:** [fb0ec5d](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/fb0ec5d5dccc2c0b403a78a7cd636d5c1d3b8526).
  - Agregar controladores/rutas de Admin Pro.
  - Incorporar interfaz de usuarios y navegación administrativa.
- **HU-10 — Tipos de repuesto y ayuda.** Como usuario de Secretaría, quiero ver tipos de repuesto y guías en el módulo. **Evidencia:** 10 may. **Responsable provisional:** @Sadiel. **Commits:** [1d4d638](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/1d4d6386f6baeaf8067a847000bda8d92ad14586), [c27934c](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/c27934cedb5ed29d5b498b4a33ba48d2caa5f4c8).
  - Incorporar tipos de repuesto.
  - Agregar tutoriales y ajustes de seguridad/refinamiento descritos en los commits.
- **HU-11 — Primera facturación.** Como secretaria, quiero registrar facturación en el flujo del taller. **Evidencia:** 12 may. **Responsable provisional:** @Sadiel. **Commits:** [e9b354d](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/e9b354d0e07dec76c6aa44a02dd1332ec6a17df7).
  - Añadir controlador, rutas, servicio e interfaz de facturación.
  - **Límite:** el mensaje del commit dice que faltaba seguridad; marcar como trabajo iniciado, no terminado.

### Épica E3 — Administración y control

#### S4 — Garantías y auditoría (13–26 may)

- **HU-12 — Garantías y notificaciones iniciales.** Como personal del taller, quiero registrar garantías y avisos asociados. **Evidencia:** 14 may. **Responsable provisional:** @Sadiel. **Commits:** [47a771e](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/47a771e8e4067f0503e4ec873692d3c9c0161213).
  - Crear trigger de garantía de tres meses.
  - Iniciar servicio de notificaciones; no asumir entrega final de avisos.
- **HU-13 — Corrección de datos por Jefe Técnico.** Como jefe técnico, quiero editar información para corregir errores de registro. **Evidencia:** 16 may. **Responsable provisional:** @LpzCesar1604. **Commits:** [3cd365f](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/3cd365f9657adbb9f8c6d64e8015cb2dafe3f6b6).
  - Incorporar la acción de modificación en el módulo.
  - Ajustar su flujo de interfaz/controlador.
- **HU-14 — Panel administrativo y exportaciones.** Como administrador, quiero consultar paneles y generar salidas de información. **Evidencia:** 17–21 may. **Responsable provisional:** @rcxx06. **Commits:** [e3dd34a](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/e3dd34ae31c437b583164f51a881cf7f4c756603), [1bd24a5](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/1bd24a58e4aba04fb038da2a94c0a665c54a651b), [9277e1c](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/9277e1cc743f4343a070878cede66a426b489ea6).
  - Extender paneles, consultas y procedimientos de Admin Pro.
  - Agregar exportaciones registradas por los commits; la exportación de ganancias se ve en [9277e1c](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/9277e1cc743f4343a070878cede66a426b489ea6).
- **HU-15 — Auditoría técnica.** Como administrador, quiero contar con registros y controles de auditoría del sistema. **Evidencia:** 22 may. **Responsable provisional:** @Sadiel. **Commits:** [4e7d145](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/4e7d1459df410c7b0048b2f6bf4ee2d8f74ae713).
  - Agregar scripts de auditoría y lógica relacionada.
  - Incorporar middleware de seguridad y comprobaciones de salud incluidas en el cambio.

#### S5 — Ganancias, inventario y despliegue (27 may–9 jun)

- **HU-16 — Control y reporte de ganancias.** Como administrador, quiero consultar ganancias y pérdidas y exportar un reporte. **Evidencia:** 29 may. **Responsable provisional:** @rcxx06. **Commits:** [2deddfb](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/2deddfbb5ff65c5c89e1f0a5b44e7bd9ef7de56b), [7780957](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/7780957892aa9aee25e7b3a7d654a173af3da757).
  - Mejorar cálculo/presentación de ganancias y pérdidas.
  - Incorporar reporte del módulo.
- **HU-17 — Validación de piezas para reparación.** Como jefe técnico, quiero comprobar existencia de la pieza antes de generar una orden. **Evidencia:** 29 may. **Responsable provisional:** @rcxx06. **Commits:** [96fe5e3](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/96fe5e3fcb55bc5232c6825596a06b0666df7753).
  - Agregar validación de disponibilidad de pieza.
  - Ajustar controladores y vista de la orden afectada.
- **HU-18 — Compatibilidad de despliegue.** Como equipo, queremos corregir rutas, funciones y configuración para el entorno Linux/Neon/Railway. **Evidencia:** 31 may–1 jun. **Responsable provisional:** @Sadiel. **Commits:** [9c0656f](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/9c0656fe345deaf01adb79394c7f4271876f6d57), [23c9e68](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/23c9e682fe7ffeb0b0549c159460fd56dc13e0e9), [242839c](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/242839cb18c31b24169831c9334f2a28eef5a9e8), [893c930](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/893c93046f8dc067e7ae9f3e7080dc67c6a25397).
  - Corregir mayúsculas/minúsculas de rutas y carpeta Secretaría.
  - Ajustar funciones en Neon y registrar prueba de autodespliegue. **Límite:** una prueba no demuestra operación estable.
- **HU-19 — Rendimiento y asignación de órdenes.** Como personal operativo, quiero consultas de Secretaría más ágiles y asignación de reparaciones corregida. **Evidencia:** 4–9 jun. **Responsable provisional:** @Sadiel. **Commits:** [607c7ad](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/607c7ad63fdb360f83b957b88021fdd34f81e26c), [8cb2e7e](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/8cb2e7ef9bce94d68921a525177df8095ef16a70).
  - Modificar consultas/controladores de Secretaría vinculados con rendimiento.
  - Corregir la asignación de órdenes de reparación del Jefe Técnico.

### Épica E4 — Calidad y evolución

#### S6 — Respaldo y estabilidad (10–23 jun)

- **HU-20 — Copias de seguridad y diseño adaptable.** Como administrador, quiero respaldo de datos y una interfaz adaptable. **Evidencia:** 10 jun. **Responsable provisional:** @rcxx06. **Commits:** [ba5abb8](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/ba5abb8796bd607702f77d34809788fc07f241b6).
  - Agregar controlador y servicio de backup.
  - Incorporar ajustes responsive y mejoras del módulo ganancias.
- **HU-21 — Corrección transversal de errores.** Como equipo, queremos corregir fallos observados en varios módulos. **Evidencia:** 10 jun. **Responsable provisional:** @rcxx06. **Commits:** [30a5201](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/30a5201cfd08a56a12c0524e71f0e304fc7089d9).
  - Ajustar controladores de Secretaría, Admin Pro y Jefe Técnico.
  - Ajustar componentes/vistas de Técnico y administración. **Límite:** no existe evidencia de nuevas entregas Git del 11 al 23 de junio.

#### S7 — Refactorización (30 jul–12 ago)

- **HU-22 — Organización por funcionalidades.** Como equipo, queremos una estructura de carpetas más clara para mantener el proyecto. **Evidencia:** 30 jul. **Responsable provisional:** @Sadiel. **Commits:** [22e4c67](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/22e4c67ea99f133749793c8806c981a88843fc34).
  - Reorganizar frontend por funcionalidades.
  - Reubicar/normalizar controladores de backend. **Límite:** solo hay un commit en la ventana.

#### S8 — Secretaría y ORM (20 sep–3 oct)

- **HU-23 — Edición de Secretaría y acceso a datos.** Como secretaria, quiero corregir edición y presentación de datos en el módulo. **Evidencia:** 25 sep. **Responsable provisional:** @Sadiel. **Commits:** [8618d88](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/8618d88626a9e21991963c5fe4045d1b20351d3f).
  - Ajustar interfaces y edición de Secretaría.
  - Modificar acceso a datos hacia ORM y revisar scripts relacionados, según el mensaje y archivos del commit. **Límite:** solo hay un commit en la ventana.

## Reglas para mantener el cronograma honesto

1. Crear los ocho sprints con las ventanas de la tabla; usar las fechas de evidencia como hitos dentro de cada sprint. Una historia iniciada en un sprint puede seguir parcial en el siguiente.
2. Conservar “responsable provisional” hasta que el equipo confirme asignaciones. No convertir automáticamente al autor Git en Product Owner o Scrum Master.
3. Usar “código registrado” como estado respaldado por Git. Añadir “probado”, “aceptado” o “desplegado” solo con pruebas, actas o registros adicionales.
4. Dejar visibles los huecos sin commits. No asignarles tareas retrospectivas.
5. Si Taskade requiere una única fecha por tarea, usar la **fecha del commit citado** y guardar la ventana del sprint en su contenedor; así se evita fingir el día exacto en que comenzó el trabajo.
