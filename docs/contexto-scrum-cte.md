# Contexto Scrum retrospectivo de CTE-ADM-BD

> Corte de evidencia: 3 de octubre de 2026. Repositorio: [CTE-SYSTEM/CTE-ADM-BD](https://github.com/CTE-SYSTEM/CTE-ADM-BD), rama main. Este documento reconstruye iteraciones para explicar el desarrollo; no afirma que el equipo haya celebrado formalmente eventos Scrum en esas fechas.

## Base y criterio de reconstrucción

El historial de main contiene **67 commits**, desde [821048e](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/821048e1f61fc16b3387d6d1585b3c4efef1dc0a) (17 de marzo) hasta [8618d88](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/8618d88626a9e21991963c5fe4045d1b20351d3f) (25 de septiembre), en fechas locales de **America/Managua**. La comparación entre el primer y el último commit confirma 66 commits posteriores al inicial. Las fechas que muestra la API de GitHub en UTC pueden caer al día siguiente; por ejemplo, [fcc3dcf](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/fcc3dcfec1d6ede4dc4140df42b8e2206de4f57a) figura el 2 de mayo en UTC y el 1 de mayo en Managua.

Se agruparon los commits por fecha y por cambio observable en archivos y mensajes. Cada sprint es una **ventana analítica de unas dos semanas**: el objetivo y las historias se redactaron después del hecho para organizar evidencia, no para atribuir una planificación histórica que el repositorio no registra. Un commit prueba que se incorporó código, configuración o documentación; por sí solo no demuestra pruebas satisfactorias, despliegue, aceptación del usuario ni una Definition of Done acordada.

La secuencia observable es: prototipo y base técnica → Docker y PostgreSQL → Secretaría y flujo técnico → administración, facturación, garantías y auditoría → ganancias, inventario y despliegue → estabilidad y copias de seguridad → refactorización → ajustes de Secretaría y acceso a datos.

## Línea de tiempo propuesta

| Sprint | Ventana retrospectiva | Commits | Objetivo reconstruido | Incremento observable |
|---|---|---:|---|---|
| 1 | 17–30 mar 2026 | 3 | Establecer el prototipo y la estructura técnica | Backend, frontend, esquema y controladores iniciales |
| 2 | 14–28 abr 2026 | 12 | Preparar instalación, contenedores, PostgreSQL y perfiles | Entorno y base de datos reorganizados; acceso aún en evolución |
| 3 | 29 abr–12 may 2026 | 16 | Construir el flujo operativo de Secretaría y Técnico | Interfaces, controladores y primeros CRUD; diagnóstico técnico |
| 4 | 13–26 may 2026 | 16 | Ampliar administración y trazabilidad | Garantías, notificaciones iniciales, Admin Pro y auditoría |
| 5 | 27 may–9 jun 2026 | 16 | Mejorar control financiero, inventario y despliegue | Ganancias/reportes, validación de piezas y correcciones de despliegue |
| 6 | 10–23 jun 2026 | 2 | Reducir fallos y mejorar continuidad de uso | Copias de seguridad, diseño adaptable y correcciones |
| 7 | 30 jul–12 ago 2026 | 1 | Reorganizar módulos para facilitar mantenimiento | Estructura por funcionalidades y controladores |
| 8 | 20 sep–3 oct 2026 | 1 | Ajustar Secretaría y acceso a datos | Cambios de edición/interfaz y retorno parcial al ORM |

La ventana del sprint 2 abarca 15 días naturales; las demás abarcan 14. Los límites son convenciones para el cronograma, **no fechas comprobadas de planificación o cierre**.

## Evidencia por sprint

### Sprint 1 — Prototipo y arquitectura inicial

- **Módulos:** autenticación, clientes, equipos, órdenes, facturas, garantías, proveedores, repuestos y técnicos en el prototipo; estructura de frontend y backend. La presencia de controladores iniciales no significa que todos los flujos estuvieran listos.
- **Commits representativos:** [821048e](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/821048e1f61fc16b3387d6d1585b3c4efef1dc0a) (prototipo), [e9896f9](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/e9896f90b5b19c5efcae3a529ba577b92444c1de) (Tailwind/PostCSS) y [4e8989e](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/4e8989e52815c123849c20593947bd048fec1b2d) (optimización y ajustes de estructura).
- **Incremento verificable en Git:** primera base de código del sistema y ajustes de configuración.

### Sprint 2 — Infraestructura, base de datos y acceso

- **Módulos:** dependencias, Docker, Prisma, migraciones, PostgreSQL, perfiles y pantallas de acceso.
- **Commits representativos:** [8474219](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/84742196e21b49d036cf071be03a291ade8cb843) (instrucciones de dependencias), [240c93c](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/240c93c61acbd14df6c05eb3d97d65e8c9b5b983) (Docker y base de datos), [b559dfb](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/b559dfb16a99516006b27c8422064282f52b82cd) (sincronización con SQL/Prisma), [dae5fe2](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/dae5fe230c3cde9aeeb45cdf682a60f33a8f1d75) (cambio de SQL Server a PostgreSQL), [3f946ea](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/3f946ea864a6d3f9bf3efbdfc429b23bc1d32066) (perfiles) y [7d0a303](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/7d0a3031a794c8370575a27a9c2225deffa4ff44) (avance del login).
- **Incremento verificable en Git:** configuración para ejecutar servicios y cambio del motor de datos. El mensaje de [7d0a303](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/7d0a3031a794c8370575a27a9c2225deffa4ff44) indica explícitamente que el login aún no funcionaba; no se presenta como autenticación terminada.

### Sprint 3 — Operación de Secretaría y Técnico

- **Módulos:** Secretaría (clientes, equipos, compras, proveedores, repuestos, órdenes y diagnósticos), Técnico/Jefe Técnico, usuarios de Admin Pro y primera facturación.
- **Commits representativos:** [23dfe1a](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/23dfe1a215829cbbba94aa390cc6c37ede836948) (Secretaría), [fcc3dcf](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/fcc3dcfec1d6ede4dc4140df42b8e2206de4f57a) (frontend y CRUD de **3 de 7** módulos indicados en el propio commit), [bdd3ef8](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/bdd3ef81445e8310a7c5d244e55c838600e5a6fd) (relación usuarios/técnicos y preparación de Jefe Técnico), [af0579e](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/af0579e5c0bdaa6d95c30d72cdd940a461de0140) y [f41034a](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/f41034a96934b0f1be40d0b3d781a4111f3a4dde) (diagnóstico e interfaz técnica), [8fa330b](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/8fa330b96cfaa8c346494b05cd952172bbbebd9f) (cambio hacia funciones/procedimientos de BD), [fb0ec5d](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/fb0ec5d5dccc2c0b403a78a7cd636d5c1d3b8526) (Admin Pro y usuarios), [1d4d638](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/1d4d6386f6baeaf8067a847000bda8d92ad14586) y [c27934c](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/c27934cedb5ed29d5b498b4a33ba48d2caa5f4c8) (tipos de repuesto, tutoriales y refinamiento), [866ddd5](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/866ddd55609f66c3dc632be3b4dc795a987a7946) (entornos Railway/Docker) y [e9b354d](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/e9b354d0e07dec76c6aa44a02dd1332ec6a17df7) (inicio de facturación, todavía con seguridad pendiente según su mensaje).
- **Incremento verificable en Git:** flujos operativos conectados progresivamente a la BD. La cobertura funcional era parcial y continuó corrigiéndose en sprints posteriores.

### Sprint 4 — Administración, garantías y auditoría

- **Módulos:** garantía de tres meses, notificaciones iniciales, corrección de datos en Jefe Técnico, panel Admin Pro, exportaciones y auditoría.
- **Commits representativos:** [47a771e](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/47a771e8e4067f0503e4ec873692d3c9c0161213) (trigger de garantías y comienzo de notificaciones), [3cd365f](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/3cd365f9657adbb9f8c6d64e8015cb2dafe3f6b6) (edición por Jefe Técnico), [e3dd34a](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/e3dd34ae31c437b583164f51a881cf7f4c756603) y [1bd24a5](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/1bd24a58e4aba04fb038da2a94c0a665c54a651b) (evolución del panel y procedimientos de Admin Pro), [9277e1c](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/9277e1cc743f4343a070878cede66a426b489ea6) (exportación en ganancias), [4e7d145](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/4e7d1459df410c7b0048b2f6bf4ee2d8f74ae713) (auditoría, seguridad y health checks) y [a8504e0](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/a8504e07a48e0aecd3ed9cf9f6616933a89e1e98) (ajustes de funciones y estructura).
- **Incremento verificable en Git:** más funciones de control administrativo y registros de auditoría. Los commits muestran implementación, no certifican una auditoría completa del sistema.

### Sprint 5 — Ganancias, inventario y preparación de despliegue

- **Módulos:** ganancias y pérdidas, reporte de ganancias, disponibilidad de repuestos para órdenes, rendimiento de Secretaría, asignación de reparaciones y compatibilidad de despliegue.
- **Commits representativos:** [96fe5e3](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/96fe5e3fcb55bc5232c6825596a06b0666df7753) (validación de existencia de piezas), [2deddfb](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/2deddfbb5ff65c5c89e1f0a5b44e7bd9ef7de56b) (ganancias/pérdidas), [7780957](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/7780957892aa9aee25e7b3a7d654a173af3da757) (reporte), [9c0656f](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/9c0656fe345deaf01adb79394c7f4271876f6d57) y [23c9e68](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/23c9e682fe7ffeb0b0549c159460fd56dc13e0e9) (rutas y mayúsculas/minúsculas en Linux), [242839c](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/242839cb18c31b24169831c9334f2a28eef5a9e8) (funciones en Neon), [893c930](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/893c93046f8dc067e7ae9f3e7080dc67c6a25397) (prueba de autodespliegue), [607c7ad](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/607c7ad63fdb360f83b957b88021fdd34f81e26c) (rendimiento de Secretaría) y [8cb2e7e](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/8cb2e7ef9bce94d68921a525177df8095ef16a70) (asignación de órdenes).
- **Incremento verificable en Git:** controles de inventario, análisis financiero y correcciones para despliegue. Las pruebas de autodespliegue no se interpretan como prueba de publicación estable.

### Sprint 6 — Respaldo y estabilización

- **Módulos:** ganancias, copias de seguridad, diseño adaptable y corrección de errores en Secretaría, Técnico/Jefe Técnico y Admin Pro.
- **Commits representativos:** [ba5abb8](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/ba5abb8796bd607702f77d34809788fc07f241b6) (backupController, backupService, cambios responsive y ganancias) y [30a5201](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/30a5201cfd08a56a12c0524e71f0e304fc7089d9) (correcciones en varios módulos).
- **Incremento verificable en Git:** soporte de respaldo y correcciones. Ambos commits se registraron el **10 de junio**; no hay evidencia Git de entregas adicionales durante el resto de la ventana.

### Sprint 7 — Refactorización

- **Módulos:** estructura de frontend y controladores de backend.
- **Commit representativo:** [22e4c67](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/22e4c67ea99f133749793c8806c981a88843fc34) (30 de julio), que reorganiza archivos por funcionalidades y controladores.
- **Incremento verificable en Git:** nueva organización del código. Su efecto en mantenibilidad es una intención razonable, no una métrica demostrada por el commit.

### Sprint 8 — Secretaría y acceso a datos

- **Módulos:** edición e interfaz de Secretaría, consultas y scripts de base de datos.
- **Commit representativo:** [8618d88](https://github.com/CTE-SYSTEM/CTE-ADM-BD/commit/8618d88626a9e21991963c5fe4045d1b20351d3f) (25 de septiembre), cuyo mensaje describe correcciones gráficas y de edición y traslado de consultas directas hacia ORM; modifica código, Prisma y scripts relacionados.
- **Incremento verificable en Git:** cambios de código para esos ajustes. Es el único commit de la ventana al corte del documento.

## Periodos sin commits y límites de la evidencia

- **22 mar–13 abr (23 días):** sin commits entre el ajuste de marzo y la preparación de dependencias de abril.
- **11 jun–29 jul (49 días):** sin commits después de las correcciones del 10 de junio y antes de la refactorización del 30 de julio. Incluye el resto de la ventana del sprint 6 y el intervalo entre sprints.
- **31 jul–24 sep (56 días):** sin commits entre la refactorización y el cambio de septiembre.
- **26 sep–3 oct (al corte):** sin nuevos commits después del cambio de Secretaría.

Estos huecos significan **ausencia de evidencia de integración en main**, no prueba de que nadie trabajó. En Taskade conviene mostrarlos como “sin actividad Git registrada” y no rellenarlos con sprints, tareas o responsables inventados.

## Cómo encaja esto con Scrum

Scrum organiza trabajo alrededor de un Product Backlog, objetivos de sprint e incrementos. Su marco no exige ramas por funcionalidad, pull requests ni una rama distinta por sprint. Por ello, integrar directamente en **main** no impide usar los commits como evidencia de una evolución incremental.

La formulación defendible es: **“reconstrucción retrospectiva con estructura Scrum basada en el historial Git”**. El repositorio no acredita por sí mismo que hubiera Product Owner, Scrum Master, Daily Scrum, Sprint Review, retrospectivas, estimaciones o aceptación formal. Esos elementos solo deben añadirse como históricos si existen actas u otra evidencia. Los “incrementos” de esta tabla son cambios observables en Git, no certificaciones de producto listo para producción.

El documento complementario [cronograma-taskade-cte.md](cronograma-taskade-cte.md) convierte esta línea de tiempo en épicas, historias y tareas para Taskade.
