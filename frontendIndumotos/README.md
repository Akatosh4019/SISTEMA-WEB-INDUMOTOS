# Web Indumotos

Aplicación Angular 21 para el Sprint 1. La carpeta `EJEMPLO DE PAGINA WEB CON ANGULAR` se usó como referencia de separación entre frontend y API, interceptor JWT y proxy local. Los contratos y pantallas son propios de Indumotos.

## Arquitectura local

```text
Navegador → Angular :4200 → proxy de desarrollo → gateway :8030 → backend :8080 → PostgreSQL
```

El proxy de Angular y el gateway son piezas distintas. El primero evita llamadas entre orígenes durante el desarrollo; el segundo es la entrada HTTP de la API. El backend conserva la validación del JWT y los permisos por acción.

## Ejecutar en IntelliJ

1. Clonar `BACK-END-INDUMOTOS` por separado y levantarlo según su README (`docker compose up --build -d`). Comprobar `http://127.0.0.1:8080/api/health`.
2. Abrir `gatewayIndumotos` de este repositorio como proyecto Maven y ejecutar `GatewayIndumotosApplication` o `mvn spring-boot:run`. Comprobar `http://127.0.0.1:8030/api/health`.
3. Abrir esta carpeta en IntelliJ. En su terminal ejecutar `npm install` y `npm start`.
4. Abrir `http://127.0.0.1:4200`. Angular reenvía `/api/**` al gateway según `proxy.conf.json`.

Requiere Node.js compatible con Angular 21, npm, Java 21 o posterior y Maven. El backend usa una configuración `.env` local que no se incluye en el repositorio.

## Alcance web del Sprint 1

- Login real con `POST /api/v1/auth/login`.
- Interceptor que envía `Authorization: Bearer ...` a la API.
- Rutas protegidas y redirección al login al vencer el token o recibir 401.
- Registro y consulta por ID de llegadas; muestra 403 si la cuenta no tiene permiso.
- Detalle de llegada con fichas vinculadas, conteo y enlaces por ID a cada ficha; el formulario de ficha recibe el ID de llegada precargado.
- Registro de fichas y consulta por ID, con mensaje de chasis duplicado.
- Búsqueda de inventario por chasis completo o últimos cuatro dígitos; filtros combinados de marca, modelo y color, paginación y enlace a la ficha.
- Creación de cuentas y asignación de roles y excepciones de permisos.
- Botón de salida que revoca el JWT en la API y después borra la sesión local.

El token se guarda en `sessionStorage` y expira en el cliente según `expiresIn`. La navegación consulta `/api/v1/auth/me` para mostrar acciones según los permisos efectivos. La autorización final siempre la decide el backend.

La consulta de inventario requiere `INVENTARIO_CONSULTAR`; quien no tiene ese permiso no ve el acceso al módulo y la API rechaza el GET con 403. El listado muestra un resumen con chasis oculto; la ficha completa se abre por ID. La búsqueda de cuatro dígitos puede devolver varias coincidencias.

## Verificar

`npm run build` compila la aplicación y `npm test -- --watch=false` ejecuta sus pruebas. Para presentar el inventario: iniciar sesión con una cuenta que tenga `INVENTARIO_CONSULTAR`, abrir **Inventario**, buscar un chasis completo o sus últimos cuatro dígitos, combinar filtros y abrir una ficha. Ejecutar también una búsqueda sin coincidencias y probar acceso con un rol sin permiso.
