# Gateway Indumotos

Entrada HTTP de desarrollo para la web Angular y la futura app Android. Enruta `/api/**` hacia el backend Indumotos sin cambiar las rutas ni reemplazar su autorización. El backend sigue validando el JWT y los permisos por acción.

Requisitos: Java 21 y Maven. Con el backend en `127.0.0.1:8080`, ejecutar `mvn spring-boot:run`. El gateway escucha en `127.0.0.1:8030` para uso local. Se puede configurar el destino con `INDUMOTOS_API_URL`.

Flujo local: navegador → Angular (`localhost:4200`) → proxy de Angular → gateway (`localhost:8030`) → backend (`localhost:8080`). El proxy de Angular resuelve el origen durante desarrollo; el gateway es un servicio HTTP separado.
