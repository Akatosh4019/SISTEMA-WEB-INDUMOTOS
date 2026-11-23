# Indumotos web: implementación de Sprint 3 y pendientes

El backlog local solo planifica **Sprint 3**. Su objetivo es disponibilidad e inconsistencias (HU-10 a HU-13). Otras 11 HU están sin sprint; Android queda fuera del trabajo solicitado. El análisis de datos, reglas, API, dependencias y cierre está en el repositorio backend: `BACK-END-INDUMOTOS/docs/PLAN_SPRINTS_PENDIENTES.md`.

## Pantalla implementada y validación pendiente

| HU | Interfaz web y conexión con lo actual |
| --- | --- |
| HU-10 | Búsqueda por chasis, estado, motivo y ubicación en el panel `Disponibilidad y datos`. |
| HU-11 | Facturación/Admin bloquea o habilita con motivo; el historial permanece visible. La venta se registra en `Modo tienda`. |
| HU-12 | Facturación/Admin reporta una diferencia desde la moto encontrada y consulta sus casos; Inventarios ve la bandeja paginada. |
| HU-13 | Inventarios/Admin contrasta la fuente, corrige el campo y documenta la resolución; el reportante ve el resultado. |

La pantalla `Disponibilidad y datos` reutiliza tabla paginada de diez, búsqueda por chasis con espera breve y panel superpuesto. Facturación consulta, bloquea/habilita y reporta; Inventarios ve pendientes y resuelve mediante corrección de ficha. El backend decide permisos y valida transiciones. La web recupera datos desde `/api/**` por gateway en Docker; no guarda estados comerciales solo en el navegador. Falta revisión visual y un caso real autorizado.

## Ampliación: modos laborales y registro de ventas

**Modo compañía** es un panel de Administración para ver todas las tiendas y asignar personal de Comercial o Facturación a una sede. **Modo tienda** muestra solo el stock y las ventas de la tienda asignada. Comercial consulta y pide reposición; Facturación registra la venta tras verificar pago y boleta/factura, ingresando ambas referencias e importe. Esto sigue el resumen consolidado de la entrevista 4 y la regla descrita en la transcripción automática de la entrevista 5, pendiente de validación humana. La API limita la sede y evita vender dos veces la misma moto. La pantalla no cobra ni emite comprobantes; Yape o banco requieren una integración posterior acordada con la empresa. No hay checkout público en esta etapa.

## Para aceptar estas pantallas

Confirmar con el Product Owner los estados comerciales adicionales, revisar un caso real de venta y corrección, y cerrar la evidencia visual de Sprint 2 y 3. Las historias sin sprint se priorizan aparte; varias tienen implementación parcial, pero no deben figurar como `Done` sin validar su DoD.
