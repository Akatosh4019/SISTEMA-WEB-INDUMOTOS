# Indumotos web: guía vigente de `sprint-2`

Este documento describe la aplicación web y el gateway implementados para Sprint 1 a Sprint 3 en la rama `sprint-2`. La aceptación visual y las historias sin sprint siguen pendientes. La autoridad para datos y permisos es la API del repositorio `BACK-END-INDUMOTOS`.

## Componentes y acceso

| Componente | Carpeta | Función |
| --- | --- | --- |
| Angular 21 | `frontendIndumotos` | Pantallas, formularios, rutas protegidas, interceptor JWT y pruebas. |
| Nginx | imagen Docker de `frontendIndumotos` | Sirve Angular en `127.0.0.1:4200` y envía `/api/**` al gateway. |
| Spring Cloud Gateway | `gatewayIndumotos` | Encaminamiento de `/api/**` al backend; no decide permisos. |
| Backend y PostgreSQL | repositorio `BACK-END-INDUMOTOS` | Casos de uso, JWT, permisos, validación y persistencia. |

En **Docker**: navegador → Nginx `:4200` → gateway `:8030` por red Docker → API `:8080` → PostgreSQL. En **desarrollo con `npm start`**, el `proxy.conf.json` actual envía `/api/**` **directamente** a `127.0.0.1:8080`; el gateway es opcional para ese modo. No confundir ambos recorridos.

## Pantallas y uso por rol

- **Todos los roles:** login, inicio con accesos según permisos, perfil y cierre de sesión. La web guarda el JWT en `sessionStorage`; el backend valida cada petición y revoca el token al salir.
- **Administración:** Crear cuenta; Roles y permisos; Catálogo de motocicletas; Cuentas para asignar la tienda al crear o editar personal. Solo `ADMIN` puede agregar marcas, modelos y colores. Inventarios y Comercial seleccionan las combinaciones existentes, sin alterarlas.
- **Almacén:** Llegadas. «Nueva llegada» abre un formulario superpuesto para registrar número de guía, cantidades, observación y entre 1 y 3 fotos. Una guía nueva aparece en **Nuevas guías** como `PENDIENTE`. Puede consultar sus fotos y fichas vinculadas. También atiende solicitudes según permisos.
- **Inventarios:** Inventario para buscar por chasis completo o últimos cuatro dígitos y filtrar marca/modelo/color, con paginación y ficha en ventana superpuesta. «Agregar motocicleta» permite elegir una guía pendiente y registrar cada unidad. La foto queda al lado del formulario con zoom, arrastre y cambio de página. Los bloques se muestran de cinco en cinco.
- **Comercial:** Solicitudes para elegir combinaciones del catálogo, cantidades y sede de destino; Seguimiento e Inventario para consultar avance y existencias.
- **Facturación:** Inventario → Disponibilidad y diferencias para consultar, bloquear/habilitar una unidad y reportar diferencias.
- **Roles operativos autorizados:** Ubicaciones e historial, asignación de chasis a solicitudes, preparación y traslados según permisos efectivos.

El menú y las rutas muestran opciones conforme al perfil obtenido de `/api/v1/auth/me`. La ocultación en Angular mejora la experiencia; no sustituye el 403 del backend. La lista exacta de rutas está en `frontendIndumotos/src/app/app.routes.ts`.

**Aporte de Luciana Gutiérrez integrado en `sprint-2`:** el login y el formulario de cuentas permiten mostrar u ocultar la contraseña. Administración consulta detalle, permisos e historial de cada cuenta y puede desactivarla o reactivarla con motivo. En Inventario → Disponibilidad y diferencias se muestra el responsable, el motivo y si la moto se puede ofrecer; una diferencia pendiente aparece como `EN_REVISION`.

## Llegadas y registro de motos

1. Almacén carga la guía. La lista «Nuevas guías» muestra las `PENDIENTE`; «Guías confirmadas» muestra las `CONFIRMADA`. Cada lista se filtra por número de guía y se pagina de 10 en 10 en el backend.
2. Inventarios entra en «Agregar motocicleta», elige una guía pendiente y ve cantidad declarada, recibida, fichas existentes y pendientes. El número de bloques procede de `cantidadRecibida - cantidadFichas`.
3. «Autocompletar desde fotos» lee **todas** las fotos con Tesseract local. Solo propone datos. Si reconoce 10 de 19 motos, las otras 9 se completan manualmente mirando la foto fija. Puede confundir chasis, motor o DUA; cada campo se comprueba con el documento.
4. «Guardar borrador» persiste el bloque en PostgreSQL, separado del inventario. La etiqueta indica guardado o cambios sin guardar. Al cerrar y volver, la web recupera los borradores de la guía; no depende de `localStorage`.
5. «Finalizar registro» se habilita cuando todos los bloques están guardados y se elige el almacén que recibió la guía. El backend incorpora las fichas pendientes, registra su primera ubicación en ese almacén y cambia la guía a `CONFIRMADA` en una transacción. La pantalla de registro queda en consulta para esa guía. No se registra una moto que no llegó físicamente solo para cuadrar la cantidad.

La edición de una ficha existente usa `FICHAS_EDITAR`. El catálogo facilita elegir opciones válidas; no extrae ni corrige automáticamente un dato dudoso de OCR.

Administración puede registrar almacenes y tiendas reales desde Ubicaciones. V25 precarga Almacén Puruchuco y Tienda Puruchuco como dos ubicaciones de una misma sede física. La base local anterior puede contener otras sedes identificadas como datos de prueba.

## Solicitudes y trazabilidad

Comercial solicita por marca/modelo/color, cantidad y tienda. Almacén prepara y asigna unidades específicas; las transiciones se registran como eventos. El seguimiento muestra estados `PENDIENTE`, `EN_PREPARACION`, `ATENDIDA`, `RECHAZADA` y `ANULADA`. `ATENDIDA` significa preparación completa, sin traslado físico. Luego almacén registra la salida de las motos asignadas; se muestran `EN_TRANSITO` y conservan su última ubicación confirmada en almacén. El comercial que solicitó las motos, o Administración, confirma la recepción de cada moto en la tienda: recién entonces se agrega el traslado al historial y cambia la ubicación confirmada. Ubicaciones muestra la última sede confirmada y el destino del envío activo. La anulación actual exige motivo y solo está disponible para solicitudes pendientes; su regla límite sigue pendiente de confirmación académica.

## Levantar en Docker

En el repositorio backend, configurar `.env` a partir de `.env.example` sin versionarlo y ejecutar:

```powershell
cd 'C:\UPEU\SOFTWARE\PROYECTO DE DAM\BACK-END-INDUMOTOS'
docker compose up -d --build api
```

Después, en el frontend (su `compose.yaml` requiere la red compartida creada por el backend):

```powershell
cd 'C:\UPEU\SOFTWARE\PROYECTO DE DAM\SISTEMA-WEB-INDUMOTOS\frontendIndumotos'
docker compose up -d --build
```

Abrir `http://127.0.0.1:4200`. Para revisar contenedores usar `docker compose ps` desde cada carpeta y `docker compose logs --tail=100 api` en backend o `docker compose logs --tail=100 web gateway` en frontend. La API ofrece `http://127.0.0.1:8080/api/health`.

## Desarrollo y pruebas

Con backend local activo, en `frontendIndumotos`: `npm ci`, `npm start` y abrir `http://127.0.0.1:4200`. Para comprobar cambios: `npm run build` y `npm test -- --watch=false`. El gateway puede levantarse aparte con Maven, pero el proxy de desarrollo actual no lo atraviesa. Para probar el recorrido por gateway se usa Docker o se cambia explícitamente el destino del proxy.

En la última ejecución observada de `sprint-2`, la compilación Angular terminó y pasaron **21 pruebas**, incluida la apertura del detalle de cuentas en una ventana superpuesta; el backend pasó **101 pruebas** y Flyway V30 se aplicó en PostgreSQL local. Faltan pruebas visuales por cada rol y una finalización de guía real autorizada. No se han inventado capturas ni datos de llegada para esta documentación.

## Pendiente

### Modos laborales y registro de venta

Administración asigna la sede al crear o editar una cuenta de Comercial o Facturación en **Cuentas**. Comercial consulta Inventario y solicita reposición desde Solicitudes. A pedido del usuario se retiró **Modo tienda** de la web; no hay pantalla de ventas en esta entrega. El backend conserva sus tablas y API de ventas para no perder datos ni romper migraciones. La web no procesa pagos ni emite comprobantes.

La relación de roles procede del resumen de entrevista 4; el momento de pérdida de disponibilidad está descrito en una transcripción automática de entrevista 5 aún no validada por el entrevistado. Sigue pendiente probar el recorrido visual con cuentas reales de cada rol y una venta autorizada. El perfil demo del backend incluye ocho ventas ficticias solo para mostrar Reportes.

### Mejoras de la revisión del 23/11 (aporte de Luciana Gutiérrez)

Las pantallas de gestión siguen un mismo patrón: **tabla** con buscador que filtra mientras se escribe, filtros, **pie de tabla** con paginación y acciones por fila (ver, editar, activar/desactivar o anular) en **ventanas modales**. Los estilos compartidos están en `styles.css` (clases `im-*`).

- **Catálogo:** tabla de marca, modelo y color con estado Activo/Inactivo. Un modelo desactivado ya no aparece en nuevas solicitudes.
- **Ubicaciones:** tabla de sedes; Administración agrega, edita y activa/desactiva en modales. El movimiento de motos se pasó a Seguimiento.
- **Seguimiento:** pestaña **Recorrido de motocicletas** con una línea de tiempo por moto (llegada, ubicación, asignación, en camino, recepción, venta), con origen, destino, fecha y responsable, y botón para registrar un movimiento. La pestaña **Preparación de solicitudes** conserva el flujo anterior, y los motivos de rechazo, anulación o retiro se piden en una ventana propia en lugar de `window.prompt`.
- **Solicitudes:** tabla con búsqueda, filtro por estado y total; "+ Nueva solicitud" y **Editar** (solo pendientes propias o de Administración) en modal; **Ver** muestra las líneas, el historial de estados y las ediciones; **Anular** pide motivo.
- **Inventario:** cada fila muestra si la moto está Disponible, Asignada, En camino, Vendida, Bloqueada o En revisión. La pestaña de control se llama **Bloqueos y diferencias de datos** para distinguirla del listado.
- **Reportes:** nueva pantalla para Administración con motos vendidas, importe, precio promedio, gráfico por día o mes, modelos más y menos vendidos, ventas por tienda y stock por modelo (7 días, 30 días o 12 meses).
- **Roles:** un único archivo (`core/roles.ts`) con los nombres de la base de datos. Se corrigió que Facturación no apareciera en el menú lateral ni en Roles y permisos.
- **Sesión:** dura una hora (el backend la define).

### Sprint 3: disponibilidad y diferencias

`Inventario → Bloqueos y diferencias de datos` permite buscar una moto por chasis, ver su ubicación y estado, y consultar el historial de cambios manuales. Facturación puede bloquear o habilitar con motivo y reportar una diferencia de ficha. Inventarios recibe los casos pendientes, consigna fuente y valor correcto, y cierra el caso; el backend actualiza ficha y caso en una transacción. Comercial solo consulta. Las tablas son de diez por página y los permisos se comprueban en la API. No se creó un caso ficticio para la demo; la prueba visual con usuarios reales sigue pendiente.


- Completar evidencia visual real y revisar la experiencia con trabajadores de cada rol.
- Medir la precisión de OCR con más guías; mantener revisión manual antes de guardar.
- Acordar con Product Owner el límite de anulación de HU-27 y cerrar tareas de modelado o documentación académica pendientes.
- Priorizar por separado las historias sin sprint y validar las reglas comerciales abiertas. Android está fuera de este trabajo.
