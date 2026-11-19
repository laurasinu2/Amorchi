# Arquitectura por etapas

## Fase 1: PWA local (esta rama)

- React + Vite + TypeScript; interfaz diferente para móvil y escritorio.
- IndexedDB almacena metadatos, fotos originales, previsualizaciones y miniaturas **en este dispositivo**.
- Las operaciones de edición se colocan en una cola local. **La subida al servidor aún no está implementada**.
- El service worker almacena la interfaz compilada para su apertura offline después de una primera visita online.
- No existe autenticación real todavía. No se debe exponer como servicio público.

## Fase 2: servidor doméstico

- API HTTPS en Docker accesible desde la Wi-Fi (no exponer PostgreSQL a otros dispositivos).
- Sesiones seguras persistentes con correo y contraseña; sesión local solo después de autenticación previa.
- Copia inicial y descargas reanudables de toda la biblioteca para uso offline.
- Cola idempotente por operation_id; cambios remotos por cursor y control optimista de versiones.
- Imágenes originales en almacenamiento de ficheros, variantes WebP/AVIF y backups independientes.
- Un servicio en el servidor procesará EXIF y generará miniaturas; la extracción en cliente es provisional.

## Reglas importantes

- El repositorio nunca almacena fotografías privadas, contraseñas o volúmenes de datos.
- La cola pendiente de IndexedDB **no constituye una copia de seguridad**: el navegador puede borrar datos y aplicar cuotas.
- En esta primera fase se conservará el original en IndexedDB junto con la previsualización. Exportar datos antes de borrar el navegador.
- Cuando se conecte la API, la primera sincronización debe ser explícita, verificable e idempotente.
- Acceso Wi-Fi móvil a una PWA instalable: HTTPS fiable o configuración HTTPS local (localhost solo funciona en el propio equipo).
- pgAdmin es un cliente administrativo; no almacena la base de datos.

## Ejecutar

1. Instala Node.js 20.19+.
2. En `web`, ejecuta `npm install` y `npm run dev`.
3. Para PostgreSQL, copia `.env.example` a `.env`, cambia las contraseñas y ejecuta `docker compose up -d db`.
4. pgAdmin opcional: `docker compose --profile tools up -d` y abre http://localhost:5050 en el ordenador servidor.
5. La app de esta fase todavía no está conectada al servidor. El puerto 5432 está enlazado solo a 127.0.0.1 por seguridad.
