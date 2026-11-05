# HU-01 — búsqueda de motocicletas por chasis

Aporte: Grease Duran, Developer. Fecha: 05/11/2026 (Lima). Cambios locales en feature/hu-01-busqueda-chasis. No publicados automáticamente.

## Alcance y fuentes

Se implementaron HU-01-T02 (chasis completo), T03 (terminación), T04 (resultados y ficha) y pruebas de T05. Fuentes: guías T02–T05 y capturas T01 de Git Info 0369a6e; backend base 20ee3ca; web base cde58e3 y Android 0.3.0. No se cambió T01 ni se asignaron estados Scrum. T02 estaba asignada a Roberto y T05 a Jade: este aporte se entrega para coordinar su integración, sin atribuirnos pruebas realizadas por ellos.

La guía T03 dice cuatro caracteres y el tablero cuatro dígitos. Ante esa diferencia, el usuario autorizó elegir la alternativa adecuada. Se conserva la terminación como texto de exactamente cuatro caracteres, con ceros iniciales y sin restringirla a números. No se impone formato VIN de 17 caracteres. Esta decisión debe mantenerse coherente en las guías del equipo.

## Contrato único para web y Android

GET /api/v1/motocicletas/busqueda

Enviar solo uno de estos parámetros:

- chasisCompleto: coincidencia completa, hasta 120 caracteres. Reutiliza buscarIdPorChasis y la normalización existente de unicidad (sin diferencias por mayúsculas y espacios exteriores).
- ultimosCuatro: exactamente cuatro caracteres finales, conservados como texto. La consulta usa igualdad del sufijo, no LIKE ni coincidencia interna.

Paginación: pagina comienza en 0; tamano predeterminado 20, permitido 1–100. Orden por ID ascendente. Todas las coincidencias son accesibles mediante páginas; nunca se selecciona automáticamente la primera. Ambos clientes conservan el criterio aplicado al paginar.

Ejemplos ficticios:

GET /api/v1/motocicletas/busqueda?chasisCompleto=DEMO-A-0042
GET /api/v1/motocicletas/busqueda?ultimosCuatro=0042&pagina=0&tamano=20

Respuesta 200: items (id, marca, modelo, color, chasisCompleto), pagina, tamano, totalElementos, totalPaginas. Sin coincidencias: items vacío y totalElementos 0. No devuelve motor, DUA, comprador ni información de ventas en el listado. No inventa estado o ubicación.

400: sin criterio, dos criterios, consulta vacía, longitud inválida o paginación inválida. 401: sin sesión válida. 403: sesión sin INVENTARIO_CONSULTAR. Se reutilizan las reglas existentes de SecurityConfig; no hay permisos, tablas ni migraciones nuevos.

## Archivos y responsabilidades

Backend: BuscarMotocicletasPorChasis, ResultadoBusquedaChasis, PaginaBusquedaChasis y BusquedaChasisController nuevos; extensión de MotocicletaRepository y JdbcMotocicletaRepository. Se reutiliza la búsqueda exacta que ya detectaba duplicados. Pruebas en BuscarMotocicletasPorChasisTest.

Web: BusquedaPage, enlace en inicio y navegación, ruta /app/buscar protegida por inventoryGuard. Cada resultado abre /app/fichas?id=ID. FichasPage ahora oculta el formulario de registro si falta FICHAS_REGISTRAR y la consulta si falta INVENTARIO_CONSULTAR. Pruebas en busqueda.page.spec.ts y fichas.page.spec.ts. No se alteró HU-14-T04.

Android 0.4.0: Buscar motocicleta en el menú autorizado; selector de modo, resultados, ficha por ID, cero coincidencias y páginas. ApiPaths codifica los parámetros. ChassisQueryTest verifica texto, ceros, longitudes, modo explícito y codificación. Se conservan las funciones de 0.3.0.

## Integración para compañeros

Los clientes deben usar el backend que incluya este cambio. No basta actualizar solo Android o la web: el backend compartido anterior 20ee3ca no tenía /busqueda. Se conservan las cuentas, contraseñas y permisos de cada servidor; Git no importa los usuarios de otra computadora. No hay credenciales oficiales dentro del proyecto.

No aplicar el parche antiguo de auth/me; la rama base ya tiene ese endpoint. Esta implementación no cambia el flujo de recepción, disponibilidad, almacenamiento o ensamblaje. No importa datos reales. El despliegue local conserva respaldo y datos anteriores; las nuevas pruebas crean una cuenta, una llegada y cuatro fichas ficticias.

## Pruebas y evidencia

El expediente de entrega contiene resultados HTTP, casos de navegador y emulador, capturas, XML unitarios y datos ficticios sin credenciales. Incluye exacto, inexistente, rechazo de coincidencia parcial, una y varias terminaciones, ceros iniciales, cuatro caracteres alfanuméricos, paginación, selección correcta por ID, parámetros inválidos y 401/403. Los fallos del comprobador se distinguen de defectos del producto: el primer intento Android terminó al buscar el texto del botón sin su flecha; se corrigió esa comprobación y se ejecutó solo el cierre pendiente, conservando el intento original como trazabilidad.

Las evidencias de paginación real se ejecutaron por API con tamaño 1 y por pruebas de componente web. No se afirma un recorrido visual de más de veinte resultados en teléfono. No se modifica la tabla Scrum. El cierre formal de T02–T05 queda sujeto a revisión del equipo y sus criterios de entrega.
