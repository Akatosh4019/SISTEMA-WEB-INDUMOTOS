# Gateway Indumotos

Entrada HTTP para la web Angular. Enruta `/api/**` hacia el backend Indumotos sin cambiar las rutas ni reemplazar su autorización. El backend sigue validando el JWT y los permisos por acción.

Requisitos: Java 21 y Maven. Con el backend en `127.0.0.1:8080`, ejecutar `mvn spring-boot:run`. El gateway escucha en `127.0.0.1:8030` para uso local. Se puede configurar el destino con `INDUMOTOS_API_URL`.

Flujo **Docker**: navegador → Nginx con Angular (`localhost:4200`) → gateway (`gateway:8030`) → backend (`api:8080`). En desarrollo con `npm start`, `frontendIndumotos/proxy.conf.json` apunta directamente a `localhost:8080` y no atraviesa este gateway. Para probar el gateway usa Docker o cambia explícitamente el destino del proxy.
