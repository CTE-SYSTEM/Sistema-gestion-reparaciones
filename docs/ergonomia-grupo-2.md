# Ergonomía con teclado — grupo 2

Fecha: 15 de octubre de 2026. Módulos: Jefe técnico, Calidad, Reclamos y Garantías.

## Cambios

El recorrido del grupo 1 se extiende a estas pantallas y a las direcciones compartidas de Reclamos en Servicio al Cliente y Garantías. Las pantallas administrativas de garantías y Mi cuenta conservan su alcance anterior.

| Módulo | Adaptación |
| --- | --- |
| Jefe técnico | Las ventanas de asignación, prioridad, corrección de asignación, disponibilidad, piezas, irreparabilidad e intervención usan el mismo recorrido. Incluye ventanas renderizadas fuera del panel principal, foco en el primer campo, Tab dentro de la ventana y regreso al origen al cerrar. |
| Calidad | Los detalles de diagnóstico y orden delimitan su propio recorrido. Enter llega a las decisiones habilitadas; Alt+Fin enfoca la primera acción principal disponible. Las pruebas y los requisitos para aprobar o devolver se conservan. |
| Reclamos | Registro, análisis, cobertura y cierre. La búsqueda permite entrar a los resultados con ↓ o Enter, elegir clientes y equipos con flechas y confirmar con Enter. Al terminar de cargar los datos, el foco continúa en el equipo o en la primera orden elegible. |
| Garantías | Abrir revalidación enfoca Meses; Enter recorre el motivo y Guardar. El foco vuelve a la garantía al cerrar o guardar. Coberturas reutiliza la adaptación de Reclamos con sus permisos. |

Se corrigió también el regreso del foco cuando un caso deja de estar en Activos tras cerrarse y cuando distintas filas tienen botones con el mismo texto. Una respuesta tardía no debe interrumpir la escritura iniciada en otro control.

## Teclas

| Tecla | Uso |
| --- | --- |
| Tab / Shift+Tab | Recorrer controles y acciones. |
| Enter / Shift+Enter | Avanzar o retroceder en texto y números. Llegar a Guardar o Confirmar no ejecuta la acción. |
| Alt+↓ / Alt+↑ | Pasar entre campos, selectores y acciones; Alt+→ / Alt+← también funcionan. |
| Alt+Inicio / Alt+Fin | Ir al primer campo o a la primera acción principal habilitada. |
| Enter en texto largo | Nueva línea. Ctrl+Enter continúa el recorrido. |
| Flechas en resultados de clientes y equipos | Cambiar el elemento enfocado; Enter elige. |
| Espacio en una opción de orden | Seleccionarla. Las órdenes no elegibles siguen deshabilitadas y muestran el motivo. |
| Escape en una ventana de supervisión | Cancelar/cerrar y volver al origen. Durante un guardado se respeta el bloqueo de cierre existente. |

Los selectores, fechas, números, radios y casillas conservan sus teclas nativas. La navegación no modifica los requisitos de entrega, factura, garantía, calidad ni permisos.

## Escenarios comprobados en navegador

Todas las operaciones se realizaron en una base local temporal con usuarios y datos ficticios, separada de la base del taller.

Al terminar se cerraron los servidores y la pestaña temporales y se eliminó la base de pruebas. La interfaz habitual se reinició para cargar los cambios.

| Escenario | Resultado |
| --- | --- |
| Abrir Nuevo reclamo, buscar y elegir cliente | Foco inicial en búsqueda; flechas y Enter permiten elegir y continuar a equipos. |
| Elegir un equipo todavía sin entrega | La orden permanece bloqueada y el foco llega a la explicación. |
| Cambiar al equipo entregado y facturado | El foco pasa a su orden elegible; Espacio permite seleccionarla. |
| Crear el reclamo y guardar análisis | Recorrido completo con teclado; foco recuperado en el botón correspondiente tras guardar. |
| Rechazar cobertura y cerrar el caso | La decisión y el cierre se guardan. Se detectó y corrigió la pérdida de foco cuando la fila desaparece de Activos; la corrección tiene una prueba de regresión. |
| Aprobar cobertura desde Garantías | Su perfil ofrece la decisión y crea el reingreso ficticio; no presenta acciones de análisis reservadas a Reclamos. |
| Revalidar garantía con meses y motivo | Guardado correcto y vuelta al botón de la misma garantía. |
| Aprobar diagnóstico de Calidad | Enter conserva saltos de línea en la evidencia; Ctrl+Enter llega a Aprobar sin activarlo. |
| Revisar orden con prueba de encendido fallida | Aprobar permanece deshabilitado; el recorrido llega a Devolver. La devolución se registró correctamente. |
| Asignar sin elegir técnico | La validación evita el envío y vuelve al selector obligatorio. |
| Asignar con técnico seleccionado | Guardado correcto usando teclado. |
| Modificar prioridad y motivo multilínea | Guardado correcto; Tab permanece en la ventana y el foco vuelve al botón de origen. |
| Cambiar a finalización excepcional | Los campos condicionales son recorribles. Se canceló la intervención con Escape sin guardar. |
| Editar disponibilidad del técnico | Guardado correcto con teclado y regreso al botón Disponibilidad. |

Los formularios de piezas, irreparabilidad y correcciones comparten la ventana adaptada de supervisión. En esta tanda no se ejecutó cada decisión de negocio de esos formularios en navegador ni una auditoría exhaustiva con lectores de pantalla o móviles.

## Verificación automática

- 31 pruebas de ergonomía aprobadas, incluidas 8 específicas del grupo 2.
- 55 pruebas del frontend aprobadas en total.
- Compilación de producción correcta.
- ESLint sin errores en el gestor de teclado, el contenedor compartido, la navegación de opciones y Garantías.
- La revisión ampliada de Calidad, Reclamos y SupervisionWidgets mantiene 7 incidencias de lint anteriores al cambio de ergonomía: actualizaciones de estado en efectos y exportaciones auxiliares junto a componentes. No se presenta esa revisión ampliada como aprobada.

Para repetir: `npm run test:ergonomia:grupo2` desde la raíz de SGR. El entorno manual aislado se inicia con `CTE_UI_GROUP2=1` y `CTE_TEST_DATABASE_ADMIN_URL` local mediante `backend/tests/ergonomia/run-ui.js`; escribir `stop` en su terminal interactiva elimina la base temporal.

## Evidencia

- [Intervención recorrida con teclado antes de cancelarla](ergonomia-grupo2-jefe.png).
- [Revisión de Calidad](ergonomia-grupo2-calidad.png).
- [Cierre del reclamo ficticio](ergonomia-grupo2-reclamos.png).
