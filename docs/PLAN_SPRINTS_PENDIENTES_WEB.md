# Indumotos web: plan después de Sprint 2

El backlog local solo planifica **Sprint 3**. Su objetivo es disponibilidad e inconsistencias (HU-10 a HU-13). Otras 11 HU están sin sprint; Android queda fuera del trabajo solicitado. El análisis de datos, reglas, API, dependencias y cierre está en el repositorio backend: `BACK-END-INDUMOTOS/docs/PLAN_SPRINTS_PENDIENTES.md`.

## Pantallas previstas, sujetas a reglas de negocio

| HU | Interfaz web y conexión con lo actual |
| --- | --- |
| HU-10 | Mostrar disponibilidad, fecha y fuente en inventario y ficha superpuesta; buscar por chasis o filtros actuales. Si el estado no es confiable, indicarlo. |
| HU-11 | Acción restringida de cambiar disponibilidad con motivo/fuente; mostrar historial sin permitir borrar eventos. No derivar venta de un traslado. |
| HU-12 | Facturación abre un reporte desde la ficha, detalla la discrepancia y consulta sus casos; Inventarios recibe una bandeja paginada de pendientes. |
| HU-13 | Inventarios revisa el caso, contrasta la fuente, edita la ficha con autorización y registra la resolución; Facturación ve el resultado. |

Reutilizar el patrón de tabla paginada (10), búsqueda en tiempo real y panel superpuesto que ya usan Inventario, Llegadas, Cuentas y Permisos. El backend decide permisos y valida transiciones. La web muestra las acciones de cada rol y recupera datos desde `/api/**` por gateway en Docker; no guarda estados comerciales solo en el navegador.

## Antes de construir estas pantallas

Confirmar con el Product Owner qué significa «disponible», quién acredita venta/pago y quién autoriza corregir datos. También cerrar la revisión visual y evidencias del Sprint 2. Las historias sin sprint se priorizan aparte; varias tienen implementación parcial, pero no deben figurar como `Done` sin validar su DoD. No se han implementado pantallas nuevas mediante este plan.
