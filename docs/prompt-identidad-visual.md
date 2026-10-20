# Prompt para cambiar la identidad visual completa de SGR

Fecha: 14 de octubre de 2026. Rutas relativas a `SGR/`.

Alcance aclarado: cambiar la identidad del proyecto en código y recursos, incluyendo todas sus superficies. No convertir Admin → Negocio en un editor de nombre, teléfono, logos ni colores. Los datos comerciales de texto no son el objetivo de este trabajo.

## Qué existe hoy

No hay un editor de logos en **Admin → Negocio**. Esa pantalla guarda nombre y datos de contacto, y también valores operativos que sí se utilizan: meses y condiciones de nuevas garantías y margen inicial de repuestos. Guardar un nombre no sustituye automáticamente las marcas de la interfaz, los PDF, Excel o correos.

La marca está repartida entre textos, iconos de Lucide, imágenes, generadores de documentos y variables del servidor. El logo del inicio de sesión es actualmente el icono `ShieldCheck`; el de la barra lateral es `Boxes`. No basta con reemplazar un archivo PNG.

## Lugares que hay que revisar

| Superficie | Archivo | Qué cambiar o comprobar |
| --- | --- | --- |
| Pestaña del navegador | `frontend/index.html` | Título SGR y favicon que apunta a `src/assets/icons/Flavicon-100.png`. |
| Iconos existentes | `frontend/src/assets/icons/Flavicon-100.png`, `Flavicon-16.png` | Crear variantes legibles a tamaño pequeño. El icono de 16 px no está enlazado en el HTML actual. |
| Recursos públicos | `frontend/public/favicon.svg`, `icons.svg` | Comprobar referencias antes de sustituirlos; su existencia no demuestra que sean el favicon activo. |
| Inicio de sesión | `frontend/src/pages/Auth/Login.jsx` | Icono ShieldCheck, título, subtítulo y pie «SISTEMA DE GESTION». |
| Transición después de entrar | `frontend/src/assets/images/svg/LoadingLogin.svg` y `Login.jsx` | Ilustración de carga; conservar su funcionamiento y revisar si necesita la nueva marca. |
| Recuperación | `frontend/src/pages/Auth/RecuperarPassword.jsx` | Incorporar identidad coherente con Login sin modificar el flujo de códigos. |
| Navegación común a los roles | `frontend/src/components/Sidebar.jsx` | Icono Boxes, «Sistema», «Gestion operativa» y variantes de barra colapsada/móvil. |
| Barra superior | `frontend/src/components/Navbar.jsx` | Revisar composición y espacio si se incorpora marca; conserva acciones, avisos y perfil. Actualmente no contiene un logo de imagen. |
| Colores generales | `frontend/src/index.css`, `frontend/tailwind.config.cjs` | Revisar variables y configuración, además de colores fijos dentro de componentes. No cambiar colores semánticos de error, alerta o éxito por colores de marca. |
| Ajustes operativos existentes | `frontend/src/features/admin/components/ConfigurationEditor.jsx`, `backend/src/utils/adminPolicy.js`, `backend/src/services/adminSettingsService.js`, `backend/scripts/modules/admin_pro/02_administracion.sql` | Referencia para conservar garantías y márgenes; no añadir controles de identidad ni modificar datos comerciales como solución al cambio de marca. |
| PDF de diagnóstico | `backend/src/services/recepcion/diagnosticoPdf.js` | Nombre y autor desde `PDF_NOMBRE_NEGOCIO`, con alternativa «Servicio técnico»; cabeceras y colores propios. Unificarlo con Negocio si se implementa marca dinámica. |
| PDF de reportes del servidor | `backend/src/utils/reportExport.js` | Autor SGR, pie SGR y colores. |
| Excel de reportes del servidor | `backend/src/utils/reportWorkbook.js` | Autor predeterminado SGR y pie de impresión SGR. |
| PDF y Excel administrativos del navegador | `frontend/src/features/admin/utils/csvExport.js` | Cabecera «Sistema de gestión - Administración», pies, autor del Excel y estilos. |
| Expediente técnico PDF | `frontend/src/features/tecnicoJefe/utils/exportarExpedientePdf.js` | Línea «SGR · Jefatura técnica» y presentación. |
| Expediente técnico Excel | `frontend/src/features/tecnicoJefe/utils/exportarExpedienteExcel.js` | Autor y títulos del libro. |
| Resumen contable | `frontend/src/features/contabilidad/utils/accountingExport.js` | Comprobar documentos que reutilizan el exportador administrativo y sus gráficos. |
| Factura, ticket y voucher de garantía | `frontend/src/features/contabilidad/pages/Facturacion.jsx` | Cabecera «SISTEMA DE GESTION», ubicación impresa, HTML de impresión y vista de ticket; ambas salidas deben coincidir. |
| Correo de recuperación | `backend/src/services/mailTemplates.js` | Nombre SGR en asunto/contenido, bloque de marca, pie y colores. |
| Nombre visible del remitente | `backend/src/services/mailService.js` | `RESEND_FROM_NAME`; el correo de contacto de Negocio no configura el remitente. Revisar `.env.example` al documentar cambios. |

`frontend/src/assets/react.svg` y `vite.svg` son recursos de herramientas. Revisar si tienen consumidores antes de cambiarlos o eliminarlos. No renombrar tablas, roles, rutas, identificadores de respaldo ni variables de conexión para sustituir una marca visible.

## Prompt listo para copiar

```text
Trabaja en el proyecto SGR, un sistema de gestión de talleres de reparación.
Quiero cambiar su identidad visual completa en código y recursos. No quiero
resolverlo editando nombre, teléfono o dirección en Admin → Negocio, ni añadir
un editor de marca a esa pantalla. Revisa todos los lugares donde aparece
la identidad del proyecto, incluidos tickets e impresión.

Datos de entrada:
- Nombre comercial: [NOMBRE DEL TALLER]
- Nombre corto: [NOMBRE CORTO]
- Logo principal: [RUTA DEL ARCHIVO PROPORCIONADO]
- Logo para fondo oscuro: [RUTA O VARIANTE QUE SE DEBE PREPARAR]
- Icono/favicon: [RUTA O SÍMBOLO DEL LOGO]
- Color principal: [HEX]
- Color secundario: [HEX]

Si faltan estos datos, identifica lo que falta y prepara la estructura usando
la identidad actual como alternativa. No inventes datos comerciales ni un logo
definitivo. Lee las instrucciones del repositorio y el documento
docs/prompt-identidad-visual.md antes de editar.

1. Audita los consumidores reales de marca. Usa la tabla del documento como
   punto de partida y confirma las rutas que existan en esta versión.
2. Centraliza nombre visible, logo, variantes y colores en módulos/recursos de
   identidad reutilizables. Evita duplicarlos por rol. Documenta cómo se consumen
   desde el frontend, generadores del servidor y plantillas de correo.
3. Conserva los datos comerciales guardados y los ajustes operativos de Negocio.
   No añadas campos de marca, endpoints públicos ni cambios de esquema para
   reemplazar textos e imágenes del proyecto.
4. Prepara logos principal, para fondo oscuro y favicon con proporciones y
   tamaños adecuados. Revisa SVG y utiliza recursos locales controlados;
   no introduzcas descargas del servidor desde URLs arbitrarias.
5. Actualiza favicon/título, Login, carga, recuperación, Sidebar y composición
   de Navbar cuando corresponda. Usa un componente compartido de marca, con
   texto alternativo adecuado, proporción conservada y una alternativa si falla
   la imagen. Revisa móvil, escritorio y menú colapsado.
6. Unifica la identidad en diagnósticos PDF, reportes PDF/Excel, expedientes
   técnicos, resumen contable, factura/ticket, voucher de garantía y correo de
   recuperación. Actualiza tanto el HTML imprimible como su vista en pantalla.
   Resuelve explícitamente
   la precedencia de PDF_NOMBRE_NEGOCIO y RESEND_FROM_NAME para que no haya
   nombres contradictorios. Mantén los requisitos del remitente verificado.
7. Conserva duración/condiciones de garantías y margen de repuestos.
   Los cambios de marca no deben recalcular facturas, costos, garantías emitidas
   ni otros datos históricos. No reescribas archivos ya emitidos.
8. Amplía las pruebas de ausencia de logo, archivo inválido, nombre largo,
   tildes, permisos y consistencia de marca entre superficies. Conserva las
   pruebas de garantías y margen. Verifica manualmente las pantallas y genera
   tickets, vouchers y PDF/Excel de ejemplo
   para revisar texto, imágenes, cortes y contraste.
9. Ejecuta npm run test:admin, la integración administrativa en una base temporal
   local y npm run build desde SGR. No uses la base real para escenarios de prueba.
   Informa los resultados reales y las comprobaciones que queden pendientes.

Criterio de aceptación: la identidad elegida es coherente en todas las
superficies acordadas; los datos de Negocio se conservan; y los flujos
de acceso, operación, exportación, garantías y respaldos conservan su comportamiento.

Entrega los archivos editados, un mapa de consumidores actualizado, resultados
de pruebas y capturas/documentos de muestra. No publiques ni despliegues salvo
que se haya solicitado.
```

## Escenarios para aceptar el cambio de marca

- Logo horizontal, cuadrado y transparente: sin deformación ni pérdida de legibilidad.
- Imagen ausente o que falla: se muestra el nombre y una alternativa coherente.
- Nombre de 300 caracteres y con tildes: no tapa acciones ni se sale de las cabeceras.
- Pantalla móvil y Sidebar colapsada: marca reconocible sin bloquear navegación.
- La misma identidad aparece al iniciar sesión con cada perfil y al recargar.
- Los datos y ajustes anteriores de Negocio se conservan y todas las áreas siguen cargando.
- PDF con varias páginas y Excel impreso: marca consistente, cabeceras repetidas y contenido sin recortes.
- Correo HTML y texto plano: nombre consistente y código/plazo intactos.
- Documento antiguo: conserva el archivo que ya se había emitido; uno nuevo usa la identidad acordada.

Este documento prepara un cambio futuro. En esta revisión no se reemplazaron logos ni se añadieron nuevos campos de marca.
