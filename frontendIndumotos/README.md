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

## Primer incremento

- Login real con `POST /api/v1/auth/login`.
- Interceptor que envía `Authorization: Bearer ...` a la API.
- Rutas protegidas y redirección al login al vencer el token o recibir 401.
- Registro y consulta por ID de llegadas; muestra 403 si la cuenta no tiene permiso.
- Detalle de llegada con fichas vinculadas, conteo y enlaces por ID a cada ficha; el formulario de ficha recibe el ID de llegada precargado.
- Salida conectada a POST /api/v1/auth/logout, con eliminación del token local al confirmarse.

El token se guarda en `sessionStorage` y expira en el cliente según `expiresIn`. El botón de salida solicita revocación mediante POST /api/v1/auth/logout. Después del login se consulta GET /api/v1/auth/me para obtener los permisos efectivos; no se deducen privilegios del nombre de usuario. La autorización efectiva siempre la decide el backend.

También se incorporaron pantallas de cuentas, fichas y permisos contra las rutas existentes de la API. HU-01 ya incorpora búsqueda por chasis completo o terminación en /app/buscar; requiere el backend de feature/hu-01-busqueda-chasis. El listado filtrado de HU-03 aún no tiene pantalla web en esta versión.

## Verificar

`npm run build` compila la aplicación. Para una prueba funcional, iniciar sesión con una cuenta de prueba, registrar una llegada con rol ALMACEN y comprobar que una cuenta sin `LLEGADAS_REGISTRAR` recibe 403.

## HU-01: búsqueda y resultados

Contrato, archivos, pruebas y coordinación: [documentación HU-01](docs/HU-01-busqueda-chasis.md). No hay tablas nuevas ni cuentas fijadas en el cliente.
