# Iniciar Indumotos desde IntelliJ · Sprint 2

Abre **dos ventanas de IntelliJ**, una con `C:\UPEU\SOFTWARE\PROYECTO DE DAM\BACK-END-INDUMOTOS` y otra con `C:\UPEU\SOFTWARE\PROYECTO DE DAM\SISTEMA-WEB-INDUMOTOS\frontendIndumotos`.

## 1. PostgreSQL en Docker Desktop

Inicia Docker Desktop y espera a que indique que su motor está funcionando. En la terminal de IntelliJ del backend, ubicada en `C:\UPEU\SOFTWARE\PROYECTO DE DAM\BACK-END-INDUMOTOS`, crea `.env` copiando `.env.example` y sustituyendo los valores de ejemplo por contraseñas locales. El secreto `JWT_SECRET_BASE64` debe ser Base64 de al menos 32 bytes aleatorios. `.env` no se sube a Git.

En esa misma terminal ejecuta `docker compose up -d db`. Esto crea o actualiza el contenedor PostgreSQL y conserva sus datos en el volumen `indumotos_pgdata`. Comprueba `docker compose ps`. **No uses `docker compose down -v`** si deseas conservar la base.

## 2. Backend Spring Boot en IntelliJ

Abre `src/main/java/pe/indumotos/BackendIndumotosApplication.java` y crea una configuración **Application**. Selecciona el JDK 21 del proyecto. En **Run → Edit Configurations → Environment variables**, define `DB_URL=jdbc:postgresql://127.0.0.1:5433/indumotos`, `DB_USER`, `DB_PASSWORD`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` y `JWT_SECRET_BASE64` con los valores usados en `.env`. El backend se ejecuta en IntelliJ; **solo PostgreSQL corre en Docker**. Al iniciar, Flyway aplica las migraciones pendientes V1–V15 automáticamente.

Comprueba `http://127.0.0.1:8080/api/health`: debe devolver `{"status":"ok"}`. No inicies al mismo tiempo el servicio `api` de Compose porque ambos intentan ocupar el puerto 8080.

## 3. Web Angular en IntelliJ

Abre `C:\UPEU\SOFTWARE\PROYECTO DE DAM\SISTEMA-WEB-INDUMOTOS\frontendIndumotos` en la segunda ventana. En su terminal ejecuta `npm ci` si todavía no existe `node_modules` y luego `npm start`. Entra en `http://localhost:4200`. El proxy de desarrollo `proxy.conf.json` dirige `/api/**` directamente al backend de IntelliJ en `127.0.0.1:8080`; el backend sigue validando JWT y permisos. El gateway se conserva como proyecto independiente para la entrega distribuida, pero **esta forma de desarrollo no necesita iniciarlo**.

Si PostgreSQL, backend o Angular se detienen, la web no podrá completar las operaciones. Si el puerto 8080 está ocupado, cierra el otro backend antes de ejecutar desde IntelliJ.
