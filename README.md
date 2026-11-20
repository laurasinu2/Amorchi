# Amorchi 🩷

Amorchi es un álbum digital privado para recorrer fotografías, viajes, eventos y momentos por años, fechas, personas y lugares. PWA **offline-first**.

## Estado: primera versión local

Está programada una primera interfaz móvil y de escritorio con:

- Calendario **año / mes / día**. Los días con fotos muestran una miniatura; los viajes y eventos aparecen como franjas de fechas.
- Galería y visor con edición de fecha, lugar, descripción, favoritos, personas, mascotas y asociación a varios recuerdos.
- Importación múltiple con **previsualización de fecha EXIF/GPS antes de guardar**. Si EXIF no existe, la fecha de modificación se indica expresamente como fallback. Hash SHA-256 para evitar duplicados exactos y miniaturas/visualizaciones WebP.
- Creación de viajes, eventos, momentos y fichas de personas/animales.
- Mapa mundial **georreferenciado EPSG:3857** basado en el GeoTIFF aportado por el usuario; visualización Leaflet sin teselas externas, con zoom y marcadores por recuerdos (no por fotografía). Importa una vez el WebP optimizado desde la página de Lugares de cada dispositivo.
- Barra lateral oscura compacta en ordenador (aproximadamente 1/5 del ancho, sin desplazamiento), portada de Inicio mínima con «Ver años» a la derecha y navegación inferior en móvil.
- Selección de imagen de fondo desde el menú translúcido «···» en Inicio, portadas de años y fichas de viajes, eventos y momentos.
- Ajustes de fecha de inicio de relación y cumpleaños propios, de pareja e importantes, con marcadores anuales en el calendario (corazón y número de años dorado).
- Celebraciones catalanas y tradicionales con bordes temáticos (Navidad, Sant Esteve, Reyes, Halloween/Castanyada, Carnaval y Semana Santa según el año, La Purísima, y posible puente de diciembre). Un puente no equivale a un festivo laboral.
- Borrado de fotografías con confirmación explícita; elimina originales, variantes y referencias de portada del almacenamiento local y deja una operación de borrado pendiente para el servidor.
- Logos aportados por el usuario, optimizados para la interfaz y el icono instalable. El nombre del repositorio sigue siendo Amorchi.
- IndexedDB con fotos y metadatos locales; service worker de la PWA para abrir la interfaz sin conexión después de una visita inicial por HTTPS/localhost.
- Cola persistente de cambios locales **aún sin API de sincronización**.
- Esquema SQL PostgreSQL y Docker Compose preparados como siguiente etapa.

**Esta versión es de desarrollo, no un sistema de archivo definitivo.** Todavía **NO** tiene inicio de sesión por correo, sincronización con el ordenador, copia de seguridad automática, subida a servidor ni mapa cartográfico detallado. No uses IndexedDB como única copia de fotografías valiosas: un navegador puede borrar datos o aplicar límites de almacenamiento. Mientras no exista la subida al servidor, se guardan los originales en el propio dispositivo.

## Ejecutar la interfaz

Requisitos: Node.js 20.19+ y npm.

```bash
git clone https://github.com/laurasinu2/Amorchi.git
cd Amorchi
git switch feat/amorchi-base-pwa-20261119
cd web
npm install
npm run dev
```

Abre la dirección que muestra Vite, normalmente `http://localhost:5173` en el ordenador servidor. Para acceder a la interfaz desde otro dispositivo en la misma Wi-Fi, usa `http://IP_DEL_ORDENADOR:5173` y comprueba el cortafuegos. **Este acceso HTTP por LAN sirve para probar la web, pero no ofrece todas las funciones de una PWA offline instalable.** Para instalar y cachear en móviles se requiere **HTTPS con certificado confiable**. En HTTP por Wi-Fi, la creación de recuerdos y la importación ya funcionan sin `crypto.randomUUID` ni WebCrypto Subtle obligatorios, pero **eso no convierte HTTP en una PWA offline instalable**.

Para construir la PWA:

```bash
npm run build
npm run preview
```

## Arrancar PostgreSQL (preparado, todavía no conectado a la PWA)

En la raíz del repositorio:

```bash
cp .env.example .env
# Cambia las contraseñas en .env
docker compose up -d db
```

Opcionalmente puedes iniciar pgAdmin:

```bash
docker compose --profile tools up -d
```

En ese ordenador abre `http://localhost:5050`. Desde pgAdmin, el servidor PostgreSQL se llama `db` (red interna Docker), puerto `5432` y las credenciales están en `.env`. El puerto PostgreSQL está limitado a `127.0.0.1` intencionadamente; más adelante los móviles hablarán con una API HTTPS, no con PostgreSQL.

Los SQL `server/db/001_initial.sql` y `server/db/002_preferences.sql` se aplican **solo al crear el volumen por primera vez**. En instalaciones existentes, la migración 002 se ejecuta manualmente tras una copia de seguridad, como se describe en `docs/ARQUITECTURA.md`. La API y las migraciones incrementales se implementarán en una siguiente etapa.

## Diseño y seguridad

No subas fotografías privadas, contraseñas, `.env`, volúmenes de Docker ni exportaciones de PostgreSQL al repositorio. `public/` solo incluye el icono de la app.

Revisa [ARQUITECTURA.md](docs/ARQUITECTURA.md) para el plan de autenticación, copias de seguridad, sincronización por cursor y almacenamiento definitivo de originales y variantes.
