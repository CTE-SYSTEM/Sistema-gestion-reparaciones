# Instalación nueva para un taller

Cada taller debe usar una base de datos nueva y su propio almacenamiento de archivos. No se deben borrar los datos de una instalación existente para preparar otra.

1. Configure las conexiones de la instalación nueva y cree el esquema y las funciones con los procesos habituales del proyecto.
2. Configure `INIT_ADMIN_USERNAME` e `INIT_ADMIN_PASSWORD` (al menos 12 caracteres) en el entorno privado. No agregue la contraseña al repositorio.
3. Ejecute `npm run db:init:clean --prefix backend` desde SGR. Este proceso crea solo el administrador y rechaza una base que ya tiene datos.
4. Registre el negocio, usuarios, técnicos, clientes, categorías, proveedores y piezas desde sus módulos. Los registros operativos y catálogos se construyen conforme se usa el sistema.

`db:seed` carga ejemplos para desarrollo y se bloquea cuando `NODE_ENV=production`. No se ejecuta al entregar una instalación nueva.

La pantalla de Respaldos muestra las copias y su ubicación. Una referencia de instantánea de Neon no contiene la base en sí. Los archivos de fotografías deben copiarse por separado; una copia de la base solo conserva sus referencias. Guardar un respaldo en el mismo almacenamiento no equivale a disponer de una segunda copia externa.

Los avisos pendientes se guardan por usuario activo para permitir leerlos más tarde, incluso sin un navegador conectado. Si no hay destinatarios, no se crea el aviso. La auditoría conserva quién cambió los datos; el aviso conserva qué necesita atender el usuario. Marcar leído resuelve el pendiente sin borrar el registro de auditoría.
