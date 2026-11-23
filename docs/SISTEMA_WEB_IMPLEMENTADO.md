# Indumotos web: guía vigente de `sprint-2`

Este documento describe la aplicación web y el gateway implementados hasta ahora para Sprint 1 y Sprint 2, incluidos ajustes posteriores en la misma rama. No declara terminado todo el sistema. La autoridad para datos y permisos es la API del repositorio `BACK-END-INDUMOTOS`.

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
- **Administración:** Crear cuenta; Roles y permisos; Catálogo de motocicletas. Solo `ADMIN` puede agregar marcas, modelos y colores. Inventarios y Comercial seleccionan las combinaciones existentes, sin alterarlas.
- **Almacén:** Llegadas. «Nueva llegada» abre un formulario superpuesto para registrar número de guía, cantidades, observación y entre 1 y 3 fotos. Una guía nueva aparece en **Nuevas guías** como `PENDIENTE`. Puede consultar sus fotos y fichas vinculadas. También atiende solicitudes según permisos.
- **Inventarios:** Inventario para buscar por chasis completo o últimos cuatro dígitos y filtrar marca/modelo/color, con paginación y ficha en ventana superpuesta. «Agregar motocicleta» permite elegir una guía pendiente y registrar cada unidad. La foto queda al lado del formulario con zoom, arrastre y cambio de página. Los bloques se muestran de cinco en cinco.
- **Comercial:** Solicitudes para elegir combinaciones del catálogo, cantidades y sede de destino; Seguimiento para consultar el avance.
- **Roles operativos autorizados:** Ubicaciones e historial, asignación de chasis a solicitudes, preparación y traslados según permisos efectivos.

El menú y las rutas muestran opciones conforme al perfil obtenido de `/api/v1/auth/me`. La ocultación en Angular mejora la experiencia; no sustituye el 403 del backend. La lista exacta de rutas está en `frontendIndumotos/src/app/app.routes.ts`.

## Llegadas y registro de motos

1. Almacén carga la guía. La lista «Nuevas guías» muestra las `PENDIENTE`; «Guías confirmadas» muestra las `CONFIRMADA`. Cada lista se filtra por número de guía y se pagina de 10 en 10 en el backend.
2. Inventarios entra en «Agregar motocicleta», elige una guía pendiente y ve cantidad declarada, recibida, fichas existentes y pendientes. El número de bloques procede de `cantidadRecibida - cantidadFichas`.
3. «Autocompletar desde fotos» lee **todas** las fotos con Tesseract local. Solo propone datos. Si reconoce 10 de 19 motos, las otras 9 se completan manualmente mirando la foto fija. Puede confundir chasis, motor o DUA; cada campo se comprueba con el documento.
4. «Guardar borrador» persiste el bloque en PostgreSQL, separado del inventario. La etiqueta indica guardado o cambios sin guardar. Al cerrar y volver, la web recupera los borradores de la guía; no depende de `localStorage`.
5. «Finalizar registro» se habilita cuando todos los bloques están guardados. El backend incorpora las fichas pendientes en una transacción y cambia la guía a `CONFIRMADA`. La pantalla de registro queda en consulta para esa guía. No se registra una moto que no llegó físicamente solo para cuadrar la cantidad.

La edición de una ficha existente usa `FICHAS_EDITAR`. El catálogo facilita elegir opciones válidas; no extrae ni corrige automáticamente un dato dudoso de OCR.

## Solicitudes y trazabilidad

Comercial solicita por marca/modelo/color, cantidad y sede. Almacén prepara y asigna unidades específicas; las transiciones se registran como eventos. El seguimiento muestra estados `PENDIENTE`, `EN_PREPARACION`, `ATENDIDA`, `RECHAZADA` y `ANULADA`. Ubicaciones conserva movimientos y traslados con su historial. La anulación actual exige motivo y solo está disponible para solicitudes pendientes; su regla límite sigue pendiente de confirmación académica.

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

En la última ejecución observada de `sprint-2`, la compilación Angular terminó y pasaron **14 pruebas**. El backend registró **81 pruebas** y Flyway V23 aplicada. Esto confirma código y arranque local; faltan pruebas visuales por cada rol y una finalización de guía real autorizada. No se han inventado capturas ni datos de llegada para esta documentación.

## Pendiente

- Completar evidencia visual real y revisar la experiencia con trabajadores de cada rol.
- Medir la precisión de OCR con más guías; mantener revisión manual antes de guardar.
- Acordar con Product Owner el límite de anulación de HU-27 y cerrar tareas de modelado o documentación académica pendientes.
- Implementar las historias posteriores al alcance actual. Android está fuera de este trabajo.
