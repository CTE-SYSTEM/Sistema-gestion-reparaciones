# Ergonomía con teclado — grupo 1

Fecha de cierre: 15 de octubre de 2026.

## Alcance

Recepción, Servicio al Cliente, Bodega y Técnico. Las pantallas compartidas utilizan el mismo recorrido; no requieren una implementación por cada rol. Los módulos de los grupos siguientes quedan fuera de esta entrega.

| Área | Pantallas y acciones cubiertas |
| --- | --- |
| Recepción | Clientes, equipos, ingreso y edición de diagnósticos, orden directa y consulta del flujo de atención. |
| Servicio al Cliente | Seguimiento del presupuesto, aprobación y creación de orden, orden directa, facturación y entrega desde facturación, consulta del flujo. Reclamos corresponde a otro grupo. |
| Bodega | Proveedores, compras, repuestos, tipos de repuesto y paneles de trazabilidad. |
| Técnico | Informe de diagnóstico, borrador, solicitud de piezas, cierre de reparación y pruebas. |

## Uso

Un clic en Crear o Editar abre el formulario y sitúa el foco en el primer campo editable. El indicador de foco permite ver dónde se está trabajando.

| Tecla | Acción |
| --- | --- |
| Tab / Shift+Tab | Recorrer todos los controles hacia delante o atrás. |
| Enter / Shift+Enter en texto o números | Avanzar o retroceder un campo. Llegar a Guardar no lo activa. |
| Alt+↓ / Alt+↑ | Avanzar o retroceder incluyendo selectores y botones. También funcionan Alt+→ / Alt+←. |
| Alt+Inicio / Alt+Fin | Ir al primer campo o a la acción principal de guardado, sin ejecutarla. |
| Enter en un área de texto | Escribir una nueva línea. Ctrl+Enter avanza al siguiente campo. |
| Flechas y Enter en autocompletado | Elegir una sugerencia y continuar al siguiente campo. Escape cierra las sugerencias. |
| Enter o Espacio sobre un botón | Ejecutar su acción. Las confirmaciones siguen requiriendo su aceptación. |
| Escape en las ventanas técnicas | Cerrar la ventana; con sugerencias abiertas, primero se cierran las sugerencias. |

Selectores, fechas, archivos, casillas y números conservan sus teclas nativas. Los campos ocultos o deshabilitados no detienen los saltos entre campos. Los campos de solo lectura se omiten al avanzar con Enter.

Al cerrar o guardar se recupera el botón de origen cuando sigue disponible, incluso si la lista se vuelve a cargar. Si el registro deja de estar en la lista, se ofrece el foco de búsqueda. Las respuestas tardías no interrumpen a quien está escribiendo en otro campo. Los errores de guardado y la primera entrada inválida reciben atención mediante el foco.

## Verificación

Se ejecutaron 23 pruebas específicas de navegación y 47 pruebas automatizadas del frontend en total, todas aprobadas. La compilación de producción terminó correctamente y los cuatro componentes compartidos modificados pasaron ESLint.

Recorridos comprobados en navegador, con usuarios ficticios y base local desechable:

| Perfil | Recorrido comprobado |
| --- | --- |
| Recepción | Crear y editar cliente; crear equipo con autocompletado y abrir edición; iniciar diagnóstico, cambiar prioridad y cancelar. |
| Bodega | Crear y editar proveedor; registrar compra con selectores y campos numéricos; abrir edición de repuesto; editar tipo de repuesto con sugerencias nativas. |
| Técnico | Informe con varias líneas, guardar borrador, recuperar foco tras la espera, solicitar una pieza y validar los campos obligatorios del cierre. |
| Servicio al Cliente | Facturar y entregar una orden ficticia; guardar seguimiento; abrir la confirmación con el teclado y crear la orden de prueba #3; elegir cliente y equipo en orden directa y cancelar. |

Los recorridos no modificaron clientes, órdenes, inventario ni facturas de la base del taller. Se detuvieron los servidores temporales y se eliminaron las dos bases temporales de esta sesión y de la sesión anterior. No se realizó una auditoría exhaustiva con lectores de pantalla ni dispositivos móviles.

## Repetir las pruebas

Desde la raíz de SGR: `npm run test:ergonomia:grupo1`.

Para una comprobación manual aislada, `backend/tests/ergonomia/run-ui.js` crea una base local temporal con cuatro usuarios ficticios y abre servicios en los puertos 5007 y 5174. Requiere `CTE_TEST_DATABASE_ADMIN_URL` apuntando a PostgreSQL local. Ejecutarlo en una terminal interactiva y escribir `stop` al terminar para limpiar el entorno. No usar credenciales ni datos reales como datos de prueba.

Evidencia: [creación de orden con teclado](ergonomia-grupo1-orden.png) y [formulario técnico](ergonomia-grupo1-tecnico.png).
