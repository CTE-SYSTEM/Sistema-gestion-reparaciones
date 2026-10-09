# Administración del taller

La barra lateral del administrador muestra Resumen y Centro de reportes como accesos directos. Gestión y Administración se despliegan al pulsar sus encabezados; al entrar directamente a una página, se abre su grupo. Todas las páginas y rutas anteriores siguen disponibles. El resumen ofrece accesos al centro de reportes, a la administración y a los respaldos.

| Apartado | Función | Ruta |
| --- | --- | --- |
| Administración | Accesos a todos los ajustes administrativos | `/admin/administracion` |
| Mi cuenta | Usuario, correo, contraseña y cierre de sesiones | `/admin/mi-cuenta` |
| Usuarios y acceso | Crear personal, editar rol, activar, desactivar y cambiar contraseñas | `/admin/usuarios` |
| Negocio | Datos del taller, condiciones y duración de nuevas garantías, margen inicial | `/admin/configuracion` |
| Reglas del negocio | Plazos, avisos, política de contraseñas, requisitos por página y permisos por rol | `/admin/reglas` |
| Respaldos | Historial, descargas, verificación, recuperación y programación | `/admin/respaldos` |
| Auditoría | Fecha, autor, módulo, motivo y datos anteriores/nuevos | `/admin/auditoria` |
| Centro de reportes | Categoría, reporte, filtros, resultados, Excel y PDF | `/admin/reportes` |

## Cuenta y acceso

Mi cuenta exige la contraseña actual para guardar el perfil, cambiar contraseña o cerrar todas las sesiones. Un cambio de contraseña invalida los tokens anteriores; después hay que iniciar sesión otra vez. La creación y el restablecimiento administrativo usan el mínimo configurado, inicialmente ocho caracteres, con un máximo de 72 bytes compatible con bcrypt. Las contraseñas existentes se conservan.

No se puede desactivar la cuenta propia ni cambiar su rol. Los cambios de acceso se serializan para conservar al menos un administrador activo incluso con solicitudes simultáneas. Usuarios permite crear Secretaría, Técnico y Jefe técnico; conserva los administradores existentes y no permite elevar nuevas cuentas a administrador desde ese formulario. Crear un técnico genera su perfil vinculado. La acción **Contraseña** de cada usuario pide la nueva contraseña, su confirmación y la contraseña del administrador; al guardarla invalida las sesiones anteriores de ese usuario.

El correo del perfil permite recibir un código de recuperación desde **¿Olvidaste tu contraseña?** en el inicio de sesión, cuando la API tiene Resend configurado con una clave y un remitente de dominio verificado. El código vence en diez minutos y su uso invalida las sesiones anteriores. La recuperación por SMS no está implementada. Consulte [Parámetros y elementos genéricos de SGR](parametros-genericos-sgr.md#4-usuarios-perfiles-y-correos) para configurar el envío.

## Configuración y reglas

La configuración se guarda en PostgreSQL con revisión, autor, fecha y motivo obligatorio. Una pantalla desactualizada recibe un conflicto y debe recargar antes de guardar. Cambiar una sección conserva las otras.

- La garantía predeterminada comienza en tres meses. Las nuevas garantías automáticas usan los meses y condiciones configurados; su vigencia comienza con la entrega. La emisión manual precarga esos valores. Las garantías anteriores conservan sus datos.
- El margen inicial se aplica al crear un repuesto cuando se omite `ganancia_cordobas`; una ganancia explícita, incluido cero, se respeta.
- El resumen y el reporte usan el aviso de garantías por vencer. El reporte de órdenes atrasadas usa el plazo configurado y excluye órdenes finalizadas, irreparables, entregadas o canceladas.
- La corrección del cierre técnico tiene un plazo inicial de 24 horas, configurable entre 1 y 168. El administrador puede habilitar o deshabilitar correcciones excepcionales posteriores. Toda corrección exige motivo; las excepciones quedan identificadas en el historial. Una orden finalizada sin factura ni entrega puede corregirse o reabrirse; una orden facturada, entregada o confirmada como irreparable solo admite aclaraciones y fotos adicionales, conservando el informe original.
- Los indicadores de ganancias usan los umbrales configurados de rentabilidad y margen por orden.
- Los requisitos de recepción, estados, facturación, entrega y permisos se muestran para consulta; conservan sus validaciones en el servidor.

La auditoría es de consulta. El API elimina contraseñas, hashes y tokens de los detalles, también cuando fueron guardados por versiones anteriores.

## Reportes

Hay 35 opciones en siete categorías: Resumen general, Operación, Finanzas, Inventario y compras, Clientes y garantías, Técnicos y Control administrativo. Cada reporte muestra sus filtros; los historiales de equipo, repuesto y orden exigen un identificador. La tabla presenta veinte filas por página.

Al cambiar el reporte o sus filtros se descarta el resultado anterior. Excel es un archivo `.xlsx` real generado en el servidor; PDF se genera a partir de una nueva consulta. Las descargas incluyen todos los registros del filtro, con un máximo de 10 000; si se excede, se exige acotar el período. Se informa la fecha de consulta y los filtros aplicados. Finanzas usa el año actual cuando no se indica un período; activos e inventario muestran existencias actuales.

Los diagnósticos conservan `moneda_presupuesto`, separando NIO y USD. No hay conversión ni suma entre monedas. Los resultados de reparaciones incluyen los costos registrados; no representan un estado contable con gastos operativos ausentes. Inventario distingue stock físico, reservado y disponible, y sus salidas corresponden a repuestos aprobados y entregados.

Las demás páginas administrativas también generan archivos Excel `.xlsx` reales, con encabezados, autofiltros de columnas y fila fija. Esto incluye las descargas de diagnósticos y repuestos de una orden; los teléfonos y referencias se conservan como texto. Los PDF incluyen el total correcto de registros, encabezados y numeración en cada página; los reportes anchos usan orientación horizontal y tamaño A3 cuando hace falta. Los totales numéricos del PDF solo se muestran en columnas marcadas explícitamente para sumar, para evitar sumar identificadores o importes de distintas monedas.

## Respaldos y recuperación

Las copias se organizan por mes y llevan un manifiesto con fecha, origen, usuario, estado, archivos, tamaño y SHA-256. Una copia completa usa `pg_dump --format=custom`, incluye todos los esquemas de la base y conserva funciones y reglas SQL. Si falla, una exportación JSON de tablas públicas se identifica como **PARCIAL**. También se genera inventario Excel/PDF e informe de resultado. El inventario usa presentación neutral: Excel con filtros y cifras numéricas, PDF con columnas alineadas, encabezados repetidos y páginas numeradas.

El Dockerfile instala clientes PostgreSQL 16 y 17 para respaldar tanto la base local de Compose como Neon. El servicio elige la versión correspondiente al servidor; una incompatibilidad produce copia parcial, nunca una declaración de copia restaurable. Para instalaciones externas pueden configurarse `PG_DUMP_PATH` y `PG_RESTORE_PATH`. La compatibilidad entre versiones sigue las restricciones de [PostgreSQL sobre pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html).

La programación puede ser diaria, semanal o mensual, con hora de Nicaragua. La próxima ejecución y los reintentos persisten en PostgreSQL: reiniciar el servidor conserva una ejecución pendiente. Un bloqueo de PostgreSQL impide dos copias simultáneas entre procesos. Ante un fallo programado hay dos reintentos, a cinco y diez minutos, antes de continuar con el calendario. El backend debe estar activo para ejecutar las copias.

En Vercel la API no mantiene un proceso permanente: una tarea diaria comprueba las copias vencidas. El respaldo de la base es una instantánea de la rama de Neon, y PDF, Excel y manifiesto se guardan en R2. La verificación consulta Neon y comprueba SHA-256 de los archivos de R2. El archivo de referencia de la instantánea no es un `.dump`; la recuperación se hace desde Neon. Consulte [despliegue-vercel-neon.md](despliegue-vercel-neon.md) para configurar las variables y conocer los límites del plan.

La conservación se expresa en días; cero conserva todo. Solo se retiran copias completas antiguas gestionadas por el servicio, siempre manteniendo la última completa. Los archivos anteriores sin manifiesto y las copias parciales no se eliminan por esta regla.

Las descargas, verificaciones y restauraciones exigen administrador. En el historial, **Cargar esta versión** aparece solo en copias completas restaurables. La pantalla muestra la fecha y exige escribir `RESTAURAR`. El servidor vuelve a comprobar los archivos y crea una copia completa del estado actual antes de recuperar los datos; esa copia se conserva aunque la política de retención hubiera vencido para la versión elegida. La restauración de un `.dump` se hace en una sola transacción de PostgreSQL. Para instantáneas de Neon se solicita la restauración finalizada sobre la rama configurada; si la solicitud falla o su respuesta se pierde, se debe revisar el estado de Neon antes de reintentar. Las fotografías y archivos externos no cambian. Las pruebas de integración restauran únicamente bases temporales, nunca la base del taller.

Compose monta `C:/backup` en `/backup`; `BACKUP_ROOT` define el destino y `BACKUP_DISPLAY_ROOT` su nombre visible. Las fotografías de R2 y archivos locales requieren una copia independiente: la base contiene sus referencias.

## Instalación y validación

Al iniciar el backend, `initializeAdministrationStorage()` aplica `02_administracion.sql` de forma aditiva: agrega `Usuarios.sesion_version`, `ConfiguracionAdministracion` y `EstadoRespaldos`, conserva datos y configura la emisión de nuevas garantías. También actualiza las funciones de auditoría para omitir hashes de contraseñas en nuevos movimientos. Los cargadores SQL y PowerShell incluyen el archivo administrativo. No hace falta ejecutar un reinicio de semillas ni una sincronización con pérdida de datos.

Desde la raíz:

```powershell
npm run test:admin
npm run test:admin:integracion
npm run build
```

La integración exige PostgreSQL local, genera bases con nombre `cte_administracion_test_<uuid>` y una carpeta temporal para respaldos, y los retira al finalizar. Comprueba acceso, perfil, contraseñas/sesiones, configuración concurrente, garantías, márgenes, monedas, inventario, todo el catálogo, Excel, auditoría, corrupción, restauración, copias parciales, bloqueos, conservación, reintentos y calendario persistente.
