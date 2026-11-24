# HU-18: historial de motocicletas en la web

Rama feature/greysi-hu18-historial, desde main. Aporte centrado en HU-18, sin recuperar los cambios locales descartados ni modificar usuarios o los flujos del equipo.

Desde Inventario, cada resultado tiene Ver historial, con su ID propio y etiqueta de marca/modelo/color/chasis. La página /app/inventario/:id/historial utiliza la consulta real GET /api/v1/motocicletas/{id}/historial-integral de la rama backend HU-18. La guarda exige INVENTARIO_CONSULTAR; el servidor comprueba el permiso nuevamente.

La página muestra identificación actual, eventos cronológicos, responsable y fecha/hora de Perú. Incluye Desde/Hasta, Ver todo, paginación, carga, error con reintento y ausencia de eventos. El filtro se conserva al paginar. Una respuesta antigua no reemplaza los datos de otra motocicleta recién seleccionada. Los estados técnicos se presentan con palabras entendibles.

Validación: 20 pruebas web aprobadas y build de producción correcto; se mantienen avisos de tamaño CSS de componentes existentes. Se verificó en navegador el ingreso, Inventario > Ver historial, siete eventos reales en la base de demostración, filtro del 23/11/2026 (un traslado) y Ver todo.

## Entorno de demostración local

Web http://127.0.0.1:4202 y API http://127.0.0.1:8091, conectadas mediante un proxy externo al repositorio. La base indumotos_hu18_demo es independiente de indumotos y se creó con las migraciones oficiales V1–V23. Contiene tres motos ficticias y una cuenta de demostración; no se alteraron las cuentas ni los datos del proyecto. Dos motos comparten sufijo 0042 para demostrar que se elige una unidad concreta.

La API se ejecuta desde el JAR compilado de la rama HU-18; la web desde Angular en desarrollo. El proxy y los archivos de ejecución están en el espacio temporal de trabajo, no se incorporan al PR. No se versionan contraseñas, tokens o claves JWT. La demostración local requiere mantener ambos procesos y PostgreSQL ejecutándose.

Esta entrega añade la vista sobre los hechos que existen. No inventa movimientos, ventas ni cambios históricos ausentes y no declara aceptada la HU sin la revisión del equipo.
