# Amorchi 🩷

Amorchi es un álbum digital privado para recorrer fotografías, viajes, eventos y momentos por años, fechas, personas y lugares. PWA **offline-first**.

## Estado: primera versión local

Está programada una primera interfaz móvil y de escritorio con:

- Calendario **Año / Mes / Lista**, con selector de mes y año, intervalos de viajes/eventos enmarcados sobre varios días, resumen del periodo, día seleccionado y acciones rápidas. Se mantienen fechas especiales y festivos recurrentes.
- Galería y visor con edición de fecha, lugar, descripción, favoritos, personas, mascotas y asociación a varios recuerdos.
- Importación múltiple con **previsualización de fecha EXIF/GPS antes de guardar**. Si EXIF no existe, la fecha de modificación se indica expresamente como fallback. Hash SHA-256 para evitar duplicados exactos y miniaturas/visualizaciones WebP.
- Creación de viajes, eventos, momentos y fichas de personas/animales.
- Mapa mundial **georreferenciado EPSG:3857** basado en el GeoTIFF aportado por el usuario; visualización Leaflet sin teselas externas, con zoom y marcadores por recuerdos (no por fotografía). Importa una vez el WebP optimizado desde la página de Lugares de cada dispositivo.
- Interfaz rediseñada en **blanco y azul marino**: logo largo y ruta de la sección en la cabecera; barra lateral oscura de ~1/5 del ancho en escritorio y navegación inferior en móvil. Inicio contiene cuatro estadísticas, dos acciones, fotos recientes y dos destacados. Años muestra dos tarjetas recientes, resumen y línea temporal.
- Selección de fondo desde «···» en Inicio, portadas de años y recuerdos. Incluye **encuadre horizontal/vertical** con previsualización; se guarda el punto focal, nunca se recorta ni duplica el archivo original.
- Ajustes de inicio de relación y cumpleaños con marcadores anuales en el calendario (corazón y número de años), respetando el tema azul marino.
- Celebraciones catalanas y tradicionales con bordes e indicadores en el azul de la interfaz (Navidad, Sant Esteve, Reyes, Halloween/Castanyada, Santos Inocentes y día de las bromas cada 28 de diciembre, Carnaval y Semana Santa según el año, La Purísima, y posible puente de diciembre). Un puente no equivale a un festivo laboral.
- Borrado de fotografías con confirmación explícita; elimina originales, variantes y referencias de portada del almacenamiento local y deja una operación de borrado pendiente para el servidor.
- Logos aportados por el usuario, optimizados para la interfaz y el icono instalable. El nombre del repositorio sigue siendo Amorchi.
- **Colecciones locales de fotografías**: puedes añadir las fotos de un día a una colección existente o crear una nueva desde el Calendario, sin duplicar los archivos. Se conservan en IndexedDB, versión 5.
- IndexedDB con fotos y metadatos locales; service worker de la PWA para abrir la interfaz sin conexión después de una visita inicial por HTTPS/localhost.
- Cola persistente de cambios locales **aún sin API de sincronización**.
- Esquema SQL PostgreSQL y Docker Compose preparados como siguiente etapa.

**Esta versión es de desarrollo, no un sistema de archivo definitivo.** Todavía **NO** tiene inicio de sesión por correo, sincronización con el ordenador, copia de seguridad automática, subida a servidor ni sincronización remota de colecciones y encuadres. No uses IndexedDB como única copia de fotografías valiosas: un navegador puede borrar datos o aplicar límites de almacenamiento. Mientras no exista la subida al servidor, se guardan los originales en el propio dispositivo.

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

## Eliminar recuerdos, viajes y eventos

Abre la ficha del recuerdo y pulsa **Eliminar viaje**, **Eliminar evento** o **Eliminar momento** en el panel «Gestionar». La aplicación pide confirmación mostrando cuántas fotografías se desvincularán. **Las fotos no se borran**, permanecen en el álbum y conservan asociaciones con otros recuerdos. Se elimina únicamente la ficha, su intervalo en el calendario y su marcador del mapa.

Los cambios se guardan atómicamente en IndexedDB junto con un marcador de borrado en la cola offline. **La sincronización real todavía no está implementada**: borrar el recuerdo en un dispositivo no lo elimina aún de los demás. La papelera con recuperación no está disponible en esta fase.

## Diseño Memrly (Inicio, Años, Calendario)

- **Inicio:** estadísticas de años con información, fotos, viajes y momentos/eventos; «Resumen anual» queda expresamente **próximamente**, mientras que «Subir fotos» funciona. Galería de hasta 9 fotos cuadradas en escritorio y menos según el ancho de pantalla. Viaje y recuerdo destacado con foto, categoría, título, descripción recortada a dos líneas y enlace a la ficha.
- **Años:** dos años con información más recientes y estadísticas independientes, portadas configurables, recuentos generales en «Tu historia en Memrly», línea del tiempo navegable y destacados.
- **Calendario:** tres modalidades, controles previos y siguientes, selector de fecha al pulsar el mes/año, cuadro principal aproximadamente del 50 % del viewport en escritorio si la barra lateral es del 20 %, y panel lateral apilado con resumen, día y acciones. En «Lista» se muestran elementos y celebraciones del año por fecha descendente. Un viaje entre semanas se enmarca por segmentos continuos de cada semana y los números incluidos se resaltan.
- **Acciones del día:** «Añadir fotos a este día» preselecciona la fecha, «Crear un recuerdo» usa la fecha actual seleccionada y «Añadir a colección» crea/actualiza colecciones con las fotos de ese día (desactivado si aún no hay fotos).
- La nueva identidad cromática solo usa blanco, azul oscuro y transparencias derivadas para los componentes; las propias imágenes y los símbolos de las festividades pueden tener su color natural.

Los iconos/logo actuales siguen como provisionales hasta recibir los nuevos archivos del diseño.

## Ajustes del calendario y altura de Inicio/Años (noviembre de 2026)

- El bug por el que los rangos de viajes desplazaban celdas a otras filas se corrige en `CalendarGrid` mediante una capa `memrly-week-ranges` de posición absoluta. Los siete botones de cada semana permanecen siempre en la única fila de la cuadrícula; los segmentos abarcan días en una capa que no interviene en el flujo. Pruebas de intervalos semanales: `web/tests/calendarSegments.test.mjs`.
- En escritorio, Inicio y Años usan toda la altura disponible debajo de la cabecera, con filas de cuadrícula ajustables, sin desplazamiento de la página. En móvil el desplazamiento vertical sigue activo para evitar ocultar contenido.
- Cuando el ancho del escritorio es de 1350 px o menos, se oculta `Tu historia en Memrly` en Años y se da todo el ancho a las dos tarjetas.
- En Calendario el título forma parte de la columna izquierda y la columna de resumen se alinea desde arriba. El selector del periodo permite escoger **año en una lista desplegable** y mes en otra lista en vista mensual; el rango de años incluye los años presentes en los recuerdos y fotografías.
- Los ajustes CSS de esta iteración están al final de `web/src/memrly-redesign.css`. Esta modificación no migra ni elimina datos locales.


## Nueva identidad Memrly (icono y logotipo)

Los dos archivos PNG proporcionados por el usuario tienen tamaños originales de **1254×1254** (icono cuadrado) y **2048×682** (horizontal). Para instalarlos en `web/public/brand/`, conservar los siguientes nombres:

- `memrly-app.png`: icono cuadrado de la persona con cámara, fondo azul marino.
- `memrly-horizontal.png`: logotipo alargado con el icono cuadrado y «Memrly».

La interfaz prioriza esos PNG y recurre a los anteriores si aún no están presentes. **Los PNG originales de este mensaje todavía no forman parte de GitHub**: la transferencia de archivos binarios desde el adjunto de ChatGPT falló en esta sesión. Para completar la instalación, copia estos dos PNG al directorio anterior y confirma su subida a la rama de desarrollo. Después actualiza en `web/vite.config.ts` el icono PWA del manifest y en `web/index.html` el favicon, que conservan el icono antiguo por seguridad hasta disponer del nuevo archivo. No borrar los anteriores antes de comprobar la actualización.
