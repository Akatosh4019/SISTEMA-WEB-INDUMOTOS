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
- Botón de salida que borra el token del navegador.

El token se guarda en `sessionStorage` y expira en el cliente según `expiresIn`. El botón de salida todavía **no revoca** un JWT en el servidor; HU-26-T05 requiere soporte de backend. La API de login aún no devuelve el rol o los permisos del usuario, por lo que la navegación no debe asumirlos. La autorización efectiva siempre la decide el backend.

También se incorporaron pantallas de cuentas, fichas y permisos contra las rutas existentes de la API. La búsqueda y los filtros se incorporarán después de crear sus endpoints en el backend.

## Verificar

`npm run build` compila la aplicación. Para una prueba funcional, iniciar sesión con una cuenta de prueba, registrar una llegada con rol ALMACEN y comprobar que una cuenta sin `LLEGADAS_REGISTRAR` recibe 403.
