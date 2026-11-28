# Pantallas de Indumotos

Cada carpeta reúne el componente de una función con su plantilla, estilos y pruebas.
Los nombres de archivo se conservaron para que sea fácil reconocerlos en IntelliJ.

| Carpeta | Contenido |
| --- | --- |
| `acceso` | Inicio de sesión. |
| `inicio` | Panel principal. |
| `estructura` | Menú, navegación y perfil del trabajador. |
| `inventario` | Consulta de motos, registro por guía, ficha y disponibilidad. |
| `llegadas` | Registro y consulta de guías recibidas. |
| `solicitudes` | Solicitudes comerciales. |
| `seguimiento` | Preparación y seguimiento de solicitudes. |
| `ubicaciones` | Sedes y movimientos de motocicletas. |
| `trabajadores` | Cuentas y datos del personal. |
| `roles` | Roles y permisos. |
| `catalogo` | Marcas, modelos y colores ofrecidos. |

Las rutas que abren estas pantallas están en `src/app/app.routes.ts`.
La lógica común de sesión, permisos y errores está en `src/app/core`.
