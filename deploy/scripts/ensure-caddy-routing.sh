#!/usr/bin/env bash
# Memrly-owned recovery of an ADDITIONAL Caddy domain after GeoCauce deployment.
# Never edits /opt/geocauce, never restarts containers or accesses PostgreSQL.
set -Eeuo pipefail
umask 077

MODE=${1:---check}
if [[ "$MODE" != "--check" && "$MODE" != "--apply" ]]; then
  printf 'Usage: %s [--check|--apply]\n' "$0" >&2
  exit 2
fi

GEO_CONTAINER=geocauce-web-1
MEMRLY_CONTAINER=memrly-web-1
EDGE_NETWORK=memrly-edge
SITE_FILE=/opt/memrly/deploy/caddy/memrly.site
GEO_URL=https://geocauce.duckdns.org/
MEMRLY_URL=https://memrly.duckdns.org/api/v1/health

log() { printf '[memrly-caddy] %s\n' "$*"; }
fail() { log "ABORTADO: $*" >&2; exit 1; }
status_code() {
  curl -4 -sS -o /dev/null --connect-timeout 3 --max-time 10 \
    -w '%{http_code}' "$1" 2>/dev/null || true
}
has_edge() {
  [[ "$(docker inspect "$1" --format \
    '{{if index .NetworkSettings.Networks "memrly-edge"}}yes{{else}}no{{end}}' 2>/dev/null)" == yes ]]
}

for tool in docker curl mktemp grep cp cat; do
  command -v "$tool" >/dev/null || fail "Falta $tool"
done
[[ -r "$SITE_FILE" ]] || fail "No se encuentra $SITE_FILE"
[[ "$(docker network inspect "$EDGE_NETWORK" --format '{{.Name}}' 2>/dev/null)" == "$EDGE_NETWORK" ]] ||
  fail "La red de Memrly no existe"
[[ "$(docker inspect "$GEO_CONTAINER" --format '{{index .Config.Labels "com.docker.compose.project"}}' 2>/dev/null)" == geocauce ]] ||
  fail "El contenedor no pertenece al proyecto GeoCauce"
[[ "$(docker inspect "$GEO_CONTAINER" --format '{{index .Config.Labels "com.docker.compose.service"}}' 2>/dev/null)" == web ]] ||
  fail "No es el servicio web de GeoCauce"
[[ "$(docker inspect "$GEO_CONTAINER" --format '{{.State.Running}}' 2>/dev/null)" == true ]] ||
  fail "Caddy está detenido. No intervenimos"
[[ "$(docker inspect "$MEMRLY_CONTAINER" --format '{{index .Config.Labels "com.docker.compose.project"}}' 2>/dev/null)" == memrly ]] ||
  fail "El contenedor no pertenece a Memrly"
[[ "$(docker inspect "$MEMRLY_CONTAINER" --format '{{.State.Running}}' 2>/dev/null)" == true ]] ||
  fail "La web de Memrly no está arrancada"
has_edge "$MEMRLY_CONTAINER" || fail "La web de Memrly no está en memrly-edge"

# Preserve GeoCauce: refuse to modify the shared proxy if the original site
# cannot be reached. This prevents repairs during a GeoCauce deployment.
[[ "$(status_code "$GEO_URL")" == 200 ]] ||
  fail "GeoCauce no responde HTTP 200; no tocamos su proxy"

WEB_ID=$(docker inspect "$GEO_CONTAINER" --format '{{.Id}}') || fail "Sin ID de Caddy"
ORIGINAL_MOUNT=$(docker inspect "$GEO_CONTAINER" --format \
  '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}')
case "$ORIGINAL_MOUNT" in
  /opt/geocauce/releases/*/infra/Caddyfile) ;;
  *) fail "Ubicación inesperada del Caddyfile; requiere revisión humana" ;;
esac
[[ -r "$ORIGINAL_MOUNT" ]] || fail "No se puede leer Caddyfile de la versión activa"

# Read Caddy's actual *running configuration*. A Caddyfile on disk is NOT
# proof that the extra domain is currently active.
ACTIVE_CONFIG=$(docker exec "$GEO_CONTAINER" \
  wget -qO- http://127.0.0.1:2019/config/ 2>/dev/null) ||
  fail "No se puede inspeccionar Caddy Admin API; no recargamos a ciegas"
[[ -n "$ACTIVE_CONFIG" ]] || fail "Caddy Admin API devolvió vacío"
CONNECTED=no
if has_edge "$GEO_CONTAINER"; then CONNECTED=yes; fi

if [[ "$CONNECTED" == yes && "$ACTIVE_CONFIG" == *'"memrly.duckdns.org"'* ]]; then
  log "Caddy ya anuncia Memrly y está conectado a memrly-edge; sin cambios"
  exit 0
fi

if [[ "$MODE" == --check ]]; then
  log "MODO CONSULTA: no cambia redes, archivos ni la configuración activa"
  log "Caddy GeoCauce: ${WEB_ID:0:12}"
  log "Red memrly-edge conectada a Caddy: $CONNECTED"
  if [[ "$ACTIVE_CONFIG" == *'"memrly.duckdns.org"'* ]]; then
    log "Dominio Memrly en Caddy activo: sí"
  else
    log "Dominio Memrly en Caddy activo: no"
  fi
  log "En modo --apply: conectar la red (si falta) y/o validar y recargar SOLO el proxy compartido"
  exit 0
fi

[[ "$(docker inspect "$GEO_CONTAINER" --format '{{.Id}}')" == "$WEB_ID" ]] ||
  fail "Caddy se ha recreado; dejamos la recuperación para el siguiente ciclo"

if [[ "$CONNECTED" != yes ]]; then
  log "Reconectando exclusivamente el servicio web de GeoCauce a memrly-edge"
  docker network connect "$EDGE_NETWORK" "$GEO_CONTAINER" ||
    fail "No se ha podido conectar la red"
fi

# Confirm the reverse-proxy target before changing active routes.
docker exec "$GEO_CONTAINER" wget -qO- \
  http://memrly-web:8080/api/v1/health >/dev/null ||
  fail "Caddy no puede alcanzar la API a través de la web de Memrly"

if [[ "$ACTIVE_CONFIG" == *'"memrly.duckdns.org"'* ]]; then
  log "Dominio Memrly ya activo; solo faltaba recuperar la red"
  exit 0
fi

TMPDIR=$(mktemp -d /tmp/memrly-caddy-bridge.XXXXXXXX)
REMOTE_FILE="/tmp/${TMPDIR##*/}.Caddyfile"
cleanup() {
  rm -rf -- "$TMPDIR"
  docker exec "$GEO_CONTAINER" rm -f -- "$REMOTE_FILE" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Crucial: use the *NEW* GeoCauce Caddyfile after every deployment;
# never replay a saved configuration from the preceding release.
cp -- "$ORIGINAL_MOUNT" "$TMPDIR/Caddyfile"
if ! grep -Fq 'memrly.duckdns.org {' "$TMPDIR/Caddyfile"; then
  printf '\n\n' >> "$TMPDIR/Caddyfile"
  cat "$SITE_FILE" >> "$TMPDIR/Caddyfile"
  printf '\n' >> "$TMPDIR/Caddyfile"
fi

docker cp "$TMPDIR/Caddyfile" "$GEO_CONTAINER:$REMOTE_FILE"
docker exec "$GEO_CONTAINER" caddy validate \
  --config "$REMOTE_FILE" --adapter caddyfile ||
  fail "Caddy rechazó el candidato; configuración original intacta"

[[ "$(docker inspect "$GEO_CONTAINER" --format '{{.Id}}')" == "$WEB_ID" ]] ||
  fail "Caddy cambió durante la preparación. No recargamos"
[[ "$(status_code "$GEO_URL")" == 200 ]] ||
  fail "GeoCauce dejó de responder antes del reload; no recargamos"

log "Recarga CONTROLADA del Caddy compartido sin reiniciar el contenedor"
docker exec "$GEO_CONTAINER" caddy reload \
  --config "$REMOTE_FILE" --adapter caddyfile ||
  fail "Reload fallido; inspeccionar el estado de Caddy"

# One health check; if it fails, reload *this release's* original file.
if [[ "$(status_code "$GEO_URL")" != 200 ]]; then
  log "ALERTA: GeoCauce dejó de responder 200. Restaurando Caddy original"
  docker exec "$GEO_CONTAINER" caddy reload \
    --config /etc/caddy/Caddyfile --adapter caddyfile ||
    fail "La restauración de Caddy no se pudo completar; intervención manual requerida"
  fail "Se revirtió el sitio adicional para proteger GeoCauce"
fi
log "GeoCauce conserva HTTP 200 y Caddy reconoce memrly.duckdns.org"
if [[ "$(status_code "$MEMRLY_URL")" == 200 ]]; then
  log "Memrly HTTPS/API HTTP 200"
else
  log "Memrly aún no devuelve 200 (el certificado puede tardar). No afectamos a GeoCauce"
fi
