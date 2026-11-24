# Sistema web Indumotos

Esta es la web Angular y el gateway del sistema Indumotos. El trabajo está en la rama `sprint-2` de Roberto Samuel Valencia Saavedra. La API y PostgreSQL están en [BACK-END-INDUMOTOS](https://github.com/Akatosh4019/BACK-END-INDUMOTOS/tree/sprint-2).

## ¿Cómo se usa?

1. **Administración** gestiona cuentas, permisos, catálogo, ubicaciones y el resumen de sedes en **Modo compañía**.
2. **Almacén** abre **Llegadas → Nueva llegada**, registra la guía y adjunta sus fotos. La guía aparece como pendiente.
3. **Inventarios** elige la guía en **Agregar motocicleta**. Puede pedir sugerencias OCR, revisar cada dato junto a la foto y guardar los borradores. Cuando todos están completos, finaliza el registro. Las motos aparecen en **Inventario** y la guía pasa a confirmada.
4. **Comercial** crea una **Solicitud** de motos para una tienda. **Almacén** asigna chasis, prepara la solicitud y registra la salida en **Seguimiento**. Comercial confirma la recepción de cada moto.
5. **Facturación** consulta estados y reporta diferencias en **Disponibilidad y datos**; **Inventarios** las revisa y resuelve.

El menú muestra las opciones permitidas a cada rol; la API valida cada acción. Las listas extensas se paginan. **Modo tienda** y la pantalla de registro de ventas se retiraron de esta entrega. No existe compra ni cobro en línea en la web actual.

**Aporte incorporado de Luciana Gutiérrez:** botón para mostrar u ocultar la contraseña; detalle, permisos e historial de cuentas con opción de desactivar o reactivar; y motivo, responsable e indicador de si una moto se puede ofrecer en **Disponibilidad y datos**.

## Abrir la web en Docker

Primero inicia la API desde la raíz del repositorio backend con `docker compose up -d --build api`. El backend carga datos de demostración al iniciar con el perfil `demo`: 20 motos de prueba, catálogo y dos guías ficticias con imágenes. Consulta su [explicación de los datos](https://github.com/Akatosh4019/BACK-END-INDUMOTOS/blob/feature/roberto-indumotos/src/main/resources/db/demo/README.md). Después, desde este repositorio:

```powershell
cd frontendIndumotos
docker compose up -d --build
docker compose ps
```

Abre [http://127.0.0.1:4200/login](http://127.0.0.1:4200/login). En Docker, Nginx sirve Angular y envía `/api/**` al gateway; este lo dirige al backend. Si falla el arranque, ejecuta `docker compose logs --tail=100 web gateway` desde `frontendIndumotos`.

## Pruebas y documentación

Desde `frontendIndumotos`, ejecuta `npm ci`, `npm run build` y `npm test -- --watch=false` con una versión de Node compatible con Angular 21. En la última ejecución observada, la web compiló y pasaron **21 pruebas**. Falta la revisión visual con cuentas de cada rol y datos autorizados.

- [Guía completa de la web](docs/SISTEMA_WEB_IMPLEMENTADO.md): pantallas, flujos, Docker y pendientes.
- [Guion de demostración en vivo](docs/GUIA_DEMO_EN_VIVO.md): recorrido por roles desde la guía hasta la recepción.
- `frontendIndumotos/`: aplicación Angular, Nginx y Docker Compose.
- `gatewayIndumotos/`: Spring Cloud Gateway.
