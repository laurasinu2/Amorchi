# Memrly: primera sincronización de fotografías (fase segura)

## Alcance

La sincronización es **manual**, desde Ajustes → Sincronizar fotografías, con sesión iniciada y conexión HTTPS.

- Sube los **originales** (no versiones comprimidas) al volumen privado Docker `memrly_photo_files` en Contabo.
- Registra en PostgreSQL el identificador estable del navegador, hash SHA-256, fecha y coordenadas, más los metadatos de la ficha.
- Es idempotente por `(album_id,client_photo_id)`: repetir no duplica el mismo original.
- Recupera archivos de la cuenta al almacenamiento offline IndexedDB en un nuevo navegador.
- Envía las correcciones de metadatos de las fotografías y recupera metadatos remotos cuando no existen cambios locales pendientes.
- Limita la lectura al álbum autorizado; ni los listados ni las URLs de archivos son públicos.
- Conserva los originales locales tras la subida.
- Impide sincronizar una biblioteca local ya vinculada con una cuenta distinta.

**No** sincroniza todavía viajes, momentos, eventos, personas, colecciones, ajustes, ni eliminaciones. No borramos ficheros del servidor automáticamente, incluso si se elimina su copia local. Las asociaciones a recuerdos se preservan en la ficha JSON de cada foto, pero los recuerdos de referencia deben sincronizarse en una fase posterior. La UI puede mostrar operaciones no fotográficas pendientes.

La sincronización utiliza el límite de subida existente, por defecto 25 MiB por archivo (`MEMRLY_MAX_UPLOAD_BYTES=26214400`). JPEG, PNG, WebP y HEIC son los formatos actuales de la API; HEIF/AVIF u originales más grandes necesitan soporte previo. Un archivo incompatible conserva su copia local, pero la operación informa del error.

## Despliegue seguro en /opt/memrly

Antes del cambio, crea copia de seguridad real de PostgreSQL y del volumen de fotografías. Consulta el espacio disponible del servidor: `df -h`.

```sh
cd /opt/memrly
git status --short
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

Con el árbol limpio, descarga la rama `feat/memrly-photo-sync-20261123` mediante `git fetch origin refs/heads/feat/memrly-photo-sync-20261123:refs/remotes/origin/feat/memrly-photo-sync-20261123` y cambia con `git switch --no-track -c feat/memrly-photo-sync-20261123 origin/feat/memrly-photo-sync-20261123` (si la rama local ya existe, se debe usar `git switch` y `git pull --ff-only` después de verificar que sigue al mismo commit).

**Los scripts de inicialización montados en PostgreSQL solo se ejecutan en volúmenes nuevos**. Para el volumen existente aplicar UNA VEZ la migración; es idempotente:

```sh
cd /opt/memrly
docker compose -p memrly --env-file deploy/.env -f deploy/compose.yaml exec -T db \
  sh -c 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' < server/db/004_photo_sync.sql
docker compose -p memrly --env-file deploy/.env -f deploy/compose.yaml config --quiet
docker compose -p memrly --env-file deploy/.env -f deploy/compose.yaml up -d --no-deps --build api web
curl -fsS https://memrly.duckdns.org/api/v1/health
```

No usar `docker compose down -v`, no borrar datos de PostgreSQL y no modificar Caddy ni GeoCauce.

## Prueba de extremo a extremo

1. Entrar en `https://memrly.duckdns.org` con tu cuenta.
2. Importar una foto de prueba menor que el límite.
3. En Ajustes, pulsar **Sincronizar fotografías** y aceptar; comprobar "originales subidos".
4. Repetir y comprobar que no sube ni duplica el mismo archivo.
5. Desde otro navegador/perfil limpio, iniciar sesión con la misma cuenta y pulsar Sincronizar fotografías: debe recuperar el original y mostrarse en el álbum offline.
6. Editar su fecha/lugar; repetir sincronización y verificar que el otro navegador recupera los cambios tras pulsar el botón.
7. Comprobar que sin sesión no se descargan archivos de `/api/v1/sync/photos/{id}/file`.

La PWA puede mostrar una versión antigua si no se recarga por completo; utilizar Ctrl+Shift+R o cerrar y reabrir la app tras el despliegue.

## Seguridad y copias de respaldo

HTTPS y JWT son obligatorios para descargar y listar. Las fotos privadas no tienen rutas de descarga anónimas. La cuenta de cada navegador queda vinculada para no mezclar álbumes. El flujo de sincronización copia datos, pero **no sustituye una copia externa de seguridad**: el volumen Docker y PostgreSQL deben respaldarse fuera del VPS.

No intentar sincronizar dos cuentas distintas desde el mismo perfil del navegador; usar perfiles separados.

Si alguna transferencia falla, los originales locales no se eliminan. La sincronización se puede repetir, y los uploads ya recibidos no se duplican.
