# Demostración en vivo de Indumotos

Abrir `http://127.0.0.1:4200/login`. Usar cuentas autorizadas de cada rol. Preparar una guía de prueba permitida, sus fotos legibles y las motocicletas físicas o datos de prueba identificados como tales. No registrar datos inventados como si fueran una recepción real.

## Recorrido principal

1. **Administración:** iniciar sesión. En **Catálogo de motocicletas**, mostrar marcas, modelos y colores que luego aparecen en los desplegables. En **Ubicaciones**, mostrar el almacén y la tienda de destino. En **Cuentas**, elegir la tienda al crear una cuenta de Comercial o Facturación, o cambiarla desde su detalle. Mostrar **Roles y permisos**.
2. **Almacén:** abrir **Llegadas → Nueva llegada**. Transcribir número de guía, cantidades y observación; adjuntar fotos de todas las páginas. Guardar y mostrar la guía en **Nuevas guías**, con estado pendiente y su detalle. Si no hay una guía autorizada para crear, usar una pendiente existente y explicar su procedencia.
3. **Inventarios:** abrir **Agregar motocicleta**, elegir la guía pendiente y señalar el contador de motos declaradas, registradas y faltantes. Pulsar **Autocompletar desde fotos** para mostrar propuestas de OCR; verificar chasis, motor y demás datos contra la foto. Corregir lo que haga falta y usar **Guardar borrador** en cada bloque. Al completar todos, elegir el almacén y pulsar **Finalizar registro**. La guía pasa a confirmada y las fichas quedan en Inventario. No finalizar una guía incompleta solo para la demostración.
4. **Consulta:** abrir **Inventario**, buscar una moto por chasis o filtros, abrir su ficha y señalar la guía asociada, la ubicación y el historial. En **Llegadas → Guías confirmadas**, mostrar que la guía ya está cerrada.
5. **Comercial:** abrir **Solicitudes → Nueva solicitud**. Elegir marca, modelo, color, cantidad y tienda de destino. Guardar y seguir su estado en **Seguimiento**.
6. **Almacén:** en **Seguimiento**, preparar la solicitud y asignar chasis disponibles. Registrar la salida de almacén. Explicar que el envío queda en tránsito y la ubicación confirmada sigue siendo el almacén hasta la recepción.
7. **Comercial:** confirmar la recepción de cada moto en **Seguimiento**. Volver a **Ubicaciones** o a la ficha para comprobar que ahora figura la tienda como ubicación confirmada.
8. **Facturación e Inventarios:** en **Inventario → Disponibilidad y diferencias**, buscar una moto, mostrar su estado e historial. Facturación puede reportar una diferencia con fuente; Inventarios la investiga y resuelve. Crear un caso solo si se dispone de un dato de prueba verificable.

## Cierre de la explicación

El proceso demostrado va de guía recibida a ficha de inventario, solicitud, preparación, traslado y recepción. Cada acción se restringe por rol y se valida en la API. **Modo tienda** y el registro de ventas se retiraron de la interfaz de esta entrega. Las tablas y la API internas de ventas permanecen por compatibilidad; la demo no incluye cobro en línea.
