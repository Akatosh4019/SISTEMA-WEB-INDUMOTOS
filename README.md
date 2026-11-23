# Sistema web Indumotos

Repositorio de Angular y Spring Cloud Gateway para los incrementos implementados de Sprint 1 y Sprint 2 en la rama `sprint-2`.

- [Guía vigente del sistema web](docs/SISTEMA_WEB_IMPLEMENTADO.md): arquitectura, pantallas por rol, flujos, Docker, pruebas y pendientes.
- `frontendIndumotos/`: Angular 21, Nginx y `compose.yaml` para web y gateway.
- `gatewayIndumotos/`: encaminamiento de `/api/**` a la API compartida.

El backend, la base PostgreSQL y Flyway están en el repositorio `BACK-END-INDUMOTOS`. Inicia primero su `docker compose`, luego ejecuta `docker compose up -d --build` en `frontendIndumotos` y abre `http://127.0.0.1:4200`.

El alcance documentado es el **implementado hasta ahora**. Las pruebas visuales por rol y las historias restantes siguen abiertas.
