# Memrly: biblioteca 100 % online (primera versión)

## Qué cambia

La fuente de verdad es **Contabo**, por cuenta y álbum. Ya no hay un paso de sincronización para las nuevas fotografías ni se guardan originales nuevos en IndexedDB.

- Al importar se calculan fecha/GPS/hash y se envía directamente el **original sin modificación**.
- El archivo se guarda en el volumen privado `memrly_photo_files` de Memrly. Su ficha se escribe en PostgreSQL.
- Al iniciar sesión o volver a la pestaña, Memrly consulta al servidor y muestra las fotografías de tu cuenta; los bytes de las imágenes se sirven **solo con autenticación**.
- Recuerdos, eventos, viajes, personas, colecciones y ajustes también se guardan y consultan mediante API con datos en PostgreSQL.
- Las miniaturas se generan **en RAM al solicitarlas**, con menor resolución solo para la vista en pantalla. El original conserva sus bytes y resolución sin conversión ni pérdida.
- Las miniaturas vistas recientemente pueden permanecer unos instantes en memoria RAM del navegador (máximo ~32 MiB); no se guardan nuevas fotografías en el almacenamiento persistente del navegador.
- Fotos idénticas en un mismo álbum están sujetas al índice único de hash SHA-256 de la base de datos. No se guardan variantes de foto adicionales en el volumen.
- El borrado confirmado de una fotografía también elimina el original del servidor; las copias de seguridad siguen siendo necesarias.

La aplicación **requiere conexión a Internet** para acceder a fotos y recuerdos. Los recursos estáticos de la PWA pueden estar en caché, pero la biblioteca nueva ya no dispone de modo offline.

## Fotografías de antes de esta actualización

Las fotos importadas con versiones anteriores permanecen en **el navegador donde se importaron**, aunque se despliegue el código nuevo. No se borran ni se migran de forma silenciosa.

Desde ESE navegador, inicia sesión con la cuenta correcta, ve a **Ajustes → Recuperar fotografías antiguas**. Acepta la importación única, comprueba el resultado y vuelve a abrir Memrly en el otro dispositivo. Las fotos nuevas ya no requieren este paso.

La importación de rescate también copia recuerdos, personas, colecciones y ajustes locales que aún no existan en el servidor. No borra los originales locales antiguos.

## Desplegar en el VPS existente (sin tocar GeoCauce)

**Primero** verificar Git limpio y espacio suficiente, respaldar tanto PostgreSQL como el volumen de originales. No utilizar nunca `docker compose down -v`.

```bash
cd /opt/memrly
git status --short
df -h /
BACKUP="$HOME/memrly-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -m 700 "$BACKUP"
docker compose -p memrly --env-file deploy/.env -f deploy/compose.yaml exec -T db \
 sh -c 'exec pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$BACKUP/database.sql"
test -s "$BACKUP/database.sql" || exit 1
docker volume inspect memrly_photo_files >/dev/null || exit 1
docker run --rm --mount type=volume,src=memrly_photo_files,dst=/photos,readonly \
 --mount type=bind,src="$BACKUP",dst=/backup alpine:3.21 \
 tar -czf /backup/photos.tar.gz -C /photos .
ls -lh "$BACKUP"
```

Descarga la rama de GitHub de forma explícita (el repositorio en Contabo tiene refspec limitado):

```bash
git fetch origin refs/heads/feat/memrly-server-first-20261123:refs/remotes/origin/feat/memrly-server-first-20261123
git switch --no-track -c feat/memrly-server-first-20261123 origin/feat/memrly-server-first-20261123
```

**Migraciones 004 y 005, ambas idempotentes:** si 004 ya se aplicó en la fase anterior, se puede volver a ejecutar de forma segura. Los scripts en `docker-entrypoint-initdb.d` solo se aplican automáticamente a un volumen PostgreSQL completamente nuevo.

```bash
docker compose -p memrly --env-file deploy/.env -f deploy/compose.yaml exec -T db \
 sh -c 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' < server/db/004_photo_sync.sql
docker compose -p memrly --env-file deploy/.env -f deploy/compose.yaml exec -T db \
 sh -c 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' < server/db/005_online_library.sql
docker compose -p memrly --env-file deploy/.env -f deploy/compose.yaml config --quiet
docker compose -p memrly --env-file deploy/.env -f deploy/compose.yaml up -d --no-deps --build api web
curl -fsS https://memrly.duckdns.org/api/v1/health
```

No cambia Caddy ni los servicios GeoCauce, no borra los volúmenes, no cambia puertos y no requiere credenciales nuevas.

## Validaciones en navegador

1. Abrir Memrly con sesión iniciada. Ajustes debe indicar **Biblioteca online**, sin botón manual de sincronización.
2. Importar una fotografía JPEG/PNG/HEIC (hasta 25 MiB por defecto). Tras importarla, debe aparecer en el álbum.
3. Abrir otro dispositivo o perfil limpio, iniciar sesión con **la misma cuenta** y observar que la fotografía aparece directamente, sin importar ni sincronizar.
4. Crear un momento y comprobar en el segundo dispositivo, refrescando la pestaña.
5. Abrir la foto; se debe cargar una miniatura. Descargar original y comprobar que el fichero original no cambió de tamaño ni contenido.
6. Comprobar que al cerrar sesión desaparece el acceso a las imágenes.
7. Si hay fotos antiguas solo en el primer navegador, usar **una única vez** el botón de recuperación del apartado anterior.

## Límites y seguridad

- **Sin Internet no se puede ver la biblioteca** en esta nueva versión.
- Los originales nuevos se guardan solamente en Contabo. Mantener copias externas de la base de datos y el volumen de fotos es indispensable.
- El límite actual es de 25 MiB por fichero por defecto, configurable mediante `MEMRLY_MAX_UPLOAD_BYTES` y el límite del proxy Nginx (26 MiB). Si se amplía, actualizar ambos.
- La compresión sin pérdida de un JPEG o HEIC ya comprimido suele ahorrar poco. No recodificamos originales ni alteramos píxeles, calidad ni metadatos para ahorrar espacio.
- El registro público, si sigue habilitado sin verificación por email, expone el servidor a cuentas abusivas y consumo de disco. Antes de abrir el servicio a terceros, añadir verificación, cuotas y límites de uso.
