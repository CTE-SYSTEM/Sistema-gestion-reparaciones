-- Este script carga todas las funciones necesarias para el funcionamiento del sistema.
-- Se ejecuta despues de sincronizar la estructura de la base de datos.

\i scripts/modules/Seguridad.sql
\i scripts/modules/Auditoria.sql
\i scripts/modules/Secretaria/Facturacion.sql
\i scripts/modules/Secretaria/FacturaDiagnostico.sql
\i scripts/modules/Secretaria/Dashboard.sql
\i scripts/modules/Secretaria/Garantias.sql
\i scripts/modules/Secretaria/InventarioStock.sql
\i scripts/modules/Secretaria/FlujoEstados.sql
\i scripts/modules/Secretaria/PaginacionIndices.sql
\i scripts/modules/JefeTecnico/Indices.sql
\i scripts/modules/JefeTecnico/Supervision.sql
\i scripts/modules/JefeTecnico/Correcciones.sql
\i scripts/modules/Tecnico/Trabajo.sql
\i scripts/modules/admin_pro/AdminPro.sql
\i scripts/modules/admin_pro/02_administracion.sql
\i scripts/modules/LegacyCleanup.sql
