# Publicación de SGR en Vercel con Neon y R2

## Estado de los datos

La base local se copió a la base nueva `sgr_produccion_2026` de Neon. Se comprobaron 25 tablas, 4 245 filas y 22 funciones SQL. La base anterior `neondb` no se modificó. `backend/.env` apunta a la base nueva al ejecutar el backend directamente; Docker Compose mantiene la base local por sus variables de servicio.

No ejecute la semilla inicial sobre la base publicada. Antes de cambios de esquema, haga un respaldo y revise la migración. No publique `backend/.env` en Git ni copie credenciales a `frontend`.

## Dos proyectos de Vercel

Importe **este mismo repositorio dos veces** en Vercel:

| Proyecto | Root Directory | Configuración |
| --- | --- | --- |
| Interfaz | `frontend` | Vite; build `npm run build`; output `dist`. |
| API | `backend` | Express; build `npm run vercel-build`; entrada `index.js`. No configure output estático. |

`frontend/vercel.json` reescribe las rutas de la aplicación para que `/admin/usuarios` abra directamente. `backend/vercel.json` ejecuta una tarea diaria de respaldo a las 12:00 UTC (06:00 en Nicaragua). La frecuencia/hora elegida en Administración se comprueba en cada ejecución: en el plan Hobby la ejecución programada puede retrasarse hasta el siguiente día. La copia manual permanece disponible en Administración.

La API en Vercel usa consultas periódicas para los avisos; el navegador sigue recuperando y marcando las notificaciones guardadas. El servidor local o Docker conserva Socket.IO. La aplicación Vercel usa R2 para fotografías, sesiones temporales de transferencia de fotos y archivos de respaldo, y Neon para la base. El disco temporal de la función solo sirve para crear/verificar archivos durante una petición.

## Variables del proyecto **Interfaz**

Configure en **Production** y vuelva a desplegar después de cambiarlas:

| Variable | Valor |
| --- | --- |
| `VITE_API_URL` | `https://TU-API.vercel.app/api` (URL real del segundo proyecto). |
| `VITE_NOTIFICATIONS_MODE` | `poll` |
| `VITE_MAX_PHOTO_BYTES` | `4194304` (4 MB, dentro del límite de peticiones de Vercel). |

No configure `VITE_SOCKET_URL` para esta modalidad. Ninguna contraseña, URL de Neon, token de R2 ni `JWT_SECRET` debe llevar el prefijo `VITE_`.

## Variables del proyecto **API**

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | URL **agrupada** de Neon (`-pooler`), base `sgr_produccion_2026`, con TLS. |
| `SQL_DATABASE_URL` | URL **directa** de la misma base Neon, con TLS. |
| `JWT_SECRET` | Secreto largo y aleatorio, diferente del ejemplo local. |
| `RESEND_API_KEY` | Clave de la API de Resend para correos transaccionales; solo en el proyecto API. |
| `RESEND_FROM_EMAIL` | Dirección de un dominio verificado en Resend. |
| `RESEND_FROM_NAME` | Nombre visible del remitente; predeterminado: `SGR Taller`. |
| `RESEND_REPLY_TO_EMAIL` | Opcional: dirección para respuestas. |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | Origen exacto del proyecto Interfaz, por ejemplo `https://TU-INTERFAZ.vercel.app`. Varios orígenes separados por comas. |
| `BACKUP_STORAGE` | `r2` |
| `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Credenciales de un bucket privado con lectura, escritura y borrado de objetos. Se usa para fotos y respaldos bajo `backups/`. |
| `R2_ENDPOINT` | Solo si el bucket usa una jurisdicción específica. |
| `NEON_API_KEY` | Token de administración de Neon autorizado para instantáneas. |
| `NEON_PROJECT_ID`, `NEON_BRANCH_ID` | Identificadores del proyecto y rama de la base publicada. La instantánea abarca la **rama**, incluida cualquier otra base de esa rama. |
| `CRON_SECRET` | Secreto aleatorio de al menos 16 caracteres; Vercel lo envía a la ruta interna de programación. |

Para habilitar **¿Olvidaste tu contraseña?**, configure `RESEND_API_KEY` y `RESEND_FROM_EMAIL` en la API y vuelva a desplegarla. El correo de cada usuario debe estar registrado en **Mi cuenta**. La tabla `RecuperacionPassword` se crea con el esquema Prisma; para una base ya publicada también puede aplicarse [la migración puntual](../backend/scripts/modules/auth/01_password_recovery.sql) antes de publicar la nueva API. Los códigos vencen en diez minutos, admiten cinco intentos y cambian la contraseña cerrando todas las sesiones. El inventario de elementos modificables está en [Parámetros genéricos de SGR](parametros-genericos-sgr.md).

`PORT`, `BACKUP_ROOT` y `VITE_SOCKET_URL` no hacen falta en los proyectos de Vercel. Cree `NEON_API_KEY` e identifique la rama en la consola de Neon; esos tres valores **no están** en `backend/.env`. Su plan de Neon debe permitir crear instantáneas mediante la API. Si faltan, Administración generará solo una exportación parcial y la señalará como tal. Un archivo `neon_snapshot_*.json` es una referencia a la instantánea **dentro de Neon**, no un `.dump` independiente; la restauración se hace desde Neon y debe probarse en una rama nueva antes de afectar producción.

La conservación configurada en Administración elimina respaldos antiguos de R2 y sus instantáneas Neon, pero siempre guarda la última copia completa. Conserve una política aparte para las fotografías del bucket. Los archivos históricos que la base referencie solo por ruta local deben trasladarse a R2 antes de esperar que estén disponibles en Vercel.

## Comprobación de publicación

1. Publique primero la API, configure sus secretos y abra `https://TU-API.vercel.app/health`.
2. Publique la Interfaz con la URL de la API y compruebe acceso directo a `/admin/usuarios`.
3. Entre como administrador, cambie la contraseña de una cuenta de prueba y descargue PDF/Excel de inventario.
4. Cree un respaldo manual: debe aparecer como **Base completa**, con referencia a la instantánea de Neon, PDF, Excel e informe. Ejecute **Verificar archivos** y compruebe que R2 mantiene los objetos.
5. Compruebe en Vercel que la tarea `backup-schedule` se invoca, y en Neon que la instantánea existe. Haga una prueba de restauración en una rama separada.

Vercel limita el cuerpo de cada petición/respuesta de función a 4,5 MB; las fotografías de más de ese tamaño necesitan compresión o una subida directa a R2. Los PDF/Excel grandes también pueden alcanzar límites de tiempo o tamaño de función. Ajuste el plan según el volumen real.

Referencias: [Express en Vercel](https://vercel.com/docs/frameworks/backend/express), [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite), [límites de funciones](https://vercel.com/docs/functions/limitations), [límites de tareas programadas](https://vercel.com/docs/cron-jobs/usage-and-pricing), [API de instantáneas Neon](https://api-docs.neon.tech/reference/createsnapshot).
