# Memrly REST + mismo HTTPS/443 que GeoCauce, por dominio

**Estado: código y configuración preparados, NO desplegados.** Todo este proyecto vive en
`laurasinu2/Amorchi`, rama `feat/memrly-backend-rest-20261122`.
No se ha editado el repositorio GeoCauce, su Caddyfile ni ningún contenedor del VPS.

## Qué conserva cada aplicación

| Aspecto | GeoCauce (sin cambios) | Memrly (nuevo) |
| --- | --- | --- |
| Dominio | El existente, en el Caddy actual | `https://memrly.duckdns.org` |
| HTTPS | Puertos 80 y 443 existentes | **Los mismos** mediante el Caddy ya operativo |
| Backend | GeoCauce API | Memrly FastAPI independiente |
| PostgreSQL | Base y volumen de GeoCauce | DB `memrly` y volumen `memrly_postgres_data` |
| Fotografías | Volumen de GeoCauce | `memrly_photo_files` |
| Redes | Redes existentes | DB y API en redes privadas nuevas |
| Exposición pública | GeoCauce Caddy | Solo Memrly web visible desde ese Caddy |

Se han preparado **dos niveles de proxy**:

1. Caddy de entrada (ya existente) selecciona el dominio `memrly.duckdns.org`
   y envía tráfico a `memrly-web:8080` mediante la red Docker `memrly-edge`.
2. El Nginx privado de Memrly entrega el frontend y redirige `/api/*` a
   `memrly-api:8000` dentro de `app_private`.

Ni PostgreSQL ni FastAPI de Memrly publican puertos en el VPS.
Memrly **no utiliza ni consulta la base de datos de GeoCauce**.

## Paso 1: probar en tu ordenador (NO en Contabo)

No ejecutes estas instrucciones desde `/opt/geocauce`.
En una copia de Amorchi:

```bash
git fetch origin
git switch feat/memrly-backend-rest-20261122
cd deploy
cp .env.example .env
```

Edita `deploy/.env` con **dos claves distintas** (no las compartas por chat):

```bash
openssl rand -hex 32
openssl rand -hex 32
nano .env
chmod 600 .env
```

Pon la primera en `MEMRLY_DB_PASSWORD`, la otra en `MEMRLY_JWT_SECRET`.
En desarrollo local puedes fijar `MEMRLY_ALLOW_SIGNUP=true`; en producción
déjalo en `false` hasta verificar HTTPS, límites y copias de seguridad.

La red `memrly-edge` se crea únicamente en el **Docker local** para esta prueba:

```bash
docker network inspect memrly-edge >/dev/null 2>&1 || docker network create memrly-edge
docker compose --env-file .env -f compose.yaml -f compose.local.yaml config --quiet
docker compose --env-file .env -f compose.yaml -f compose.local.yaml up -d --build
docker compose --env-file .env -f compose.yaml -f compose.local.yaml ps
curl -fsS http://127.0.0.1:18080/api/v1/health
```

Se espera `{"service":"memrly","status":"ok"}`.
El frontend de prueba se abre en `http://127.0.0.1:18080`.
**No publiques ese puerto en Internet**. Esto no configura Caddy de producción.

Comprueba también que el registro, acceso, subida y descarga funcionan con
imágenes de prueba. Los tests automatizados usan un PostgreSQL real en GitHub Actions.

## API REST v1

| Operación | Método y ruta | Autenticación |
| --- | --- | --- |
| Salud | GET `/api/v1/health` | No |
| Registro (si está habilitado) | POST `/api/v1/auth/register` | No |
| Login | POST `/api/v1/auth/login` | No |
| Usuario actual | GET `/api/v1/auth/me` | Bearer JWT |
| Subir foto | POST `/api/v1/photos` | Bearer JWT |
| Listar fotos | GET `/api/v1/photos` | Bearer JWT |
| Detalles | GET `/api/v1/photos/{uuid}` | Bearer JWT |
| Original | GET `/api/v1/photos/{uuid}/file` | Bearer JWT |

El registro crea una cuenta y un álbum privado; el login devuelve un JWT de
12 horas. Una subida multipart admite `file`, `latitude`, `longitude` y
`captured_local_date` (últimos tres opcionales, pero coordenadas en pareja).
PostgreSQL guarda UUID, nombre, fecha de subida, fecha de captura, coordenadas,
MIME y tamaño. El archivo binario se guarda como original en un volumen privado.

JPEG, PNG, WebP y HEIC tienen comprobación básica de firma y un límite de
25 MiB por defecto. La API no ofrece enlaces anónimos a fotos.
Los usuarios no pueden obtener metadatos ni descargar fotos de otro álbum.
El registro está **desactivado por defecto** hasta aprobar la publicación.

**Importante:** aún no existe una migración automática desde IndexedDB, una UI de
registro/login en la PWA ni un mecanismo de sincronización. La PWA sigue
funcionando con su contenido local sin cambios. Esta API no es todavía un
servicio de producción definitivo: faltan recuperación de contraseña,
limitación robusta de intentos, control de cuotas, backups remotos y
supervisión de errores.

## Paso 2: inspección del VPS sin modificar nada

**No ejecutar despliegue todavía.** Cuando autorices la etapa Contabo,
conéctate por SSH y comparte únicamente salidas **sin secretos** de:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker network ls --format 'table {{.Name}}\t{{.Driver}}'
sudo ss -ltnp | grep -E ':(80|443|5432|8081)\b' || true
df -h
free -h
```

Estas órdenes solo inspeccionan. No ejecutes `docker compose down`, ni
renombres redes/volúmenes, ni muevas GeoCauce.

## Paso 3: mismo 443, dos dominios

El Caddy de GeoCauce **ya** ocupa 80/443. Dos instancias independientes no pueden
escuchar simultáneamente el mismo puerto/IP. Caddy soporta dos bloques de
dominio en el mismo servidor; automáticamente selecciona el host y gestiona
certificados HTTPS. El bloque nuevo está en:

`deploy/caddy/memrly.site`

Conceptualmente, el Caddy de entrada tendrá **ambos bloques**, sin modificar el
contenido del bloque existente:

```caddy
# Bloque de GeoCauce: CONSERVAR ÍNTEGRO.
{$SITE_ADDRESS} {
    # ... rutas actuales GeoCauce intactas ...
}

# Bloque ADICIONAL para el nuevo dominio:
memrly.duckdns.org {
    encode zstd gzip
    reverse_proxy memrly-web:8080
}
```

**Necesidad técnica que requiere permiso específico antes de tocar producción:**
el Caddyfile que está montado en GeoCauce debe incorporar el nuevo bloque, y
el contenedor Caddy debe conectarse a `memrly-edge`. No requiere alterar la
API, BD, fotos o volúmenes de GeoCauce, pero **sí afecta a su proxy de entrada**.
No podemos declarar que ambas webs funcionarán en HTTPS/443 sin aplicar
estos dos cambios mínimos.

Hay dos opciones para la conexión de red del Caddy existente:

- **Temporal durante una prueba autorizada:** unir el contenedor web actual a
  `memrly-edge` mediante `docker network connect`. Es reversible, pero se
  pierde al recrear el contenedor en un despliegue de GeoCauce.
- **Duradera para producción:** añadir la red externa `memrly-edge` al servicio
  `web` del Compose que gestiona GeoCauce, conservando su red `private`
  original. Requiere una modificación pequeña y explícitamente aprobada en la
  configuración de **infraestructura**, no en la aplicación ni la BD.

La red `memrly-edge` solo compartiría **GeoCauce Caddy ↔ Memrly Nginx**.
Memrly FastAPI y PostgreSQL no se conectan a ella. No se debe enganchar
Memrly a la red privada de la base de datos de GeoCauce.

**No se ha ejecutado ninguna de las opciones.** Antes de aplicar Caddy:
guardar copia del Caddyfile, comprobar el nombre real del contenedor en el
VPS, validar con `caddy validate`, hacer un reload (sin reiniciar GeoCauce),
probar ambos dominios, y tener preparado el rollback de solo el bloque nuevo.
No prometer cero riesgo: todo cambio al proxy compartido debe tratarse como
un cambio de producción controlado.

El DNS A `memrly.duckdns.org` debe apuntar a la IP pública actual del VPS.
Después de activar el sitio, Caddy puede emitir un certificado HTTPS mediante
los puertos 80/443 ya existentes. No se abre 8443.

## Paso 4: copias y puesta en marcha, **solo con nueva autorización**

- Elegir ruta separada `/opt/memrly`, con credenciales y permisos exclusivos.
- Crear `memrly-edge` sin tocar las redes privadas de GeoCauce.
- Levantar **solo** `docker compose -p memrly -f deploy/compose.yaml up -d --build`
  desde la copia Memrly. Nunca mezclar con el `compose.yaml` de GeoCauce.
- Revisar memoria, disco y capacidad del VPS antes de almacenar originales.
- Respaldar **dos elementos de Memrly**: dump PostgreSQL y directorio/volumen
  de fotografías; copiar fuera de Contabo y ensayar restauración.
- Verificar TLS real, login, permisos cruzados, subida, listado y descarga.
- Habilitar registros únicamente cuando exista protección de intentos y medidas
  contra abuso. No iniciar subidas masivas sin copias.

La propia configuración de despliegue de Memrly no publica 80/443 ni 5432.
Ninguna de estas instrucciones implica la ejecución de comandos en Contabo
desde ChatGPT.
