# Frontend Indumotos

Angular 21 para los flujos implementados de Sprint 1 y Sprint 2. Consulta la [guía vigente](../docs/SISTEMA_WEB_IMPLEMENTADO.md) para pantallas por rol, recorrido de guías, inventario, solicitudes, seguridad y trabajo pendiente.

## Docker

Inicia primero el backend con `docker compose up -d --build api` desde `BACK-END-INDUMOTOS`; después, desde esta carpeta:

```powershell
docker compose up -d --build
```

Abre `http://127.0.0.1:4200`. Nginx envía `/api/**` al gateway de Docker, que lo dirige al backend. El backend conserva la autorización. Los datos PostgreSQL viven en el volumen del repositorio backend.

## Desarrollo local

```powershell
npm ci
npm start
```

El proxy actual de `npm start` envía `/api/**` directamente a `127.0.0.1:8080`. Para verificar: `npm run build` y `npm test -- --watch=false`. Usa Node.js compatible con Angular 21. No guardes secretos ni tokens en el repositorio.
