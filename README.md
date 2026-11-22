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

## Celebraciones recurrentes, vínculos múltiples y filtros (2026-11-22)

- Las **celebraciones** se definen en `web/src/celebrations.ts`: reglas anuales fijas (Navidad, Sant Esteve, Fin de Año, Reyes, Santos Inocentes, Halloween, Sant Jordi, Sant Joan, Diada) y móviles (Carnaval, Semana Santa y Pascua, mediante Domingo de Pascua). La temporada **Navidades** cubre el 24 de diciembre al 6 de enero del año siguiente.
- Las fechas personalizadas de cumpleaños y aniversario proceden de Ajustes, sin crear eventos duplicados cada año. Los nombres y las fechas se actualizan automáticamente cuando cambian los Ajustes.
- La asociación automática se calcula desde `Photo.takenOn`, normalmente obtenida de EXIF. **No se duplica la imagen**: una misma foto puede estar asociada a Navidades, Navidad, un viaje y un momento al mismo tiempo.
- En la ficha de foto se puede **incluir manualmente** una celebración, o **excluir** una asignación automática, o devolverla al comportamiento «Según fecha». Estas dos listas (`celebrationIncludeIds` y `celebrationExcludeIds`) son opcionales en cada `Photo` y se guardan en IndexedDB mediante `savePhoto`.
- **Álbum y Favoritos** ahora tienen filtros combinables de celebración, temporada/año, viaje/recuerdo/evento y búsqueda textual. Por ejemplo, «Navidades 2025–2026» más «Viaje a Andorra». No cambia las asociaciones originales ni el contenido de `memoryIds`.
- Se consideran **temporadas** los rangos que agrupan varias fechas; «Navidad» es específicamente el 25 de diciembre. «Puente de diciembre» se utiliza como categoría de archivo personal, **no implica que cada fecha sea festivo laboral**.
- Al editar la fecha de una foto, la asociación automática se recalcula desde la nueva fecha civil; las inclusiones/exclusiones manuales se conservan. Las celebraciones de fotografías antiguas aparecen automáticamente sin migración ni procesado masivo.
- Las nuevas relaciones viven en el navegador, todavía **no se sincronizan con servidor**. No elimines los datos del navegador ni presupongas que existe copia de seguridad remota.
- El calendario muestra las celebraciones del día seleccionado y los contornos de viaje/evento y día seleccionado usan ahora **3 px** en la vista mensual (2 px en minimapas).


## Colores de los días especiales y bordes (22/11/2026)

- El intervalo semanal de viajes, momentos y eventos **mantiene su borde azul marino original de 2 px** (1 px en calendarios pequeños). No se alteran sus segmentos ni la etiqueta del nombre.
- Los días de festivos y tradiciones ahora tienen un **contorno individual de color** según su categoría: rojo para Navidad, verde para primavera/Semana Santa, violeta para Carnaval, naranja para otoño, amarillo para verano, etc. Los cumpleaños se distinguen en violeta.
- El **aniversario de pareja** tiene prioridad y utiliza un **rosa fuerte (#ee1783)**, independientemente de otros festivos o viajes que coincidan ese día.
- El día seleccionado se resalta con 3 px azul marino (2 px en calendarios pequeños). Si también es festivo o aniversario, conserva su marco azul y añade un **segundo aro exterior** del color correspondiente, sin ocultar el estado de selección.

## Ficha de fotografía (vista dedicada)

Todas las fotografías que se abren desde Inicio, Calendario, Álbum, Favoritos, Personas y mascotas, Colecciones, Buscar y las fichas de viajes/eventos/recuerdos presentan ahora una **página de detalle**; la edición sigue utilizando el modal anterior. La navegación «Volver» regresa a la sección desde la que se abrió la foto.

La cabecera de la ficha incluye: volver, título «Fotografía», favorito (persistencia inmediata), compartir, editar y menú «···». El menú ofrece **descargar el original**, **abrir el día en Calendario** y **eliminar fotografía** con confirmación explícita.

En escritorio, la vista se divide en dos columnas en proporción **5:3 del área de contenido**. Con la barra lateral del 20 %, la imagen ocupa aproximadamente el 50 % de la anchura total de ventana. La columna izquierda muestra el archivo con ajuste `contain` (sin recortar el original), ampliar con fondo traslúcido y cierre, zoom del 100 % al 500 %, arrastre del encuadre cuando está ampliado, y hasta nueve miniaturas visibles con flechas para avanzar por **todas** las fotos del mismo día o de un recuerdo/viaje compartido.

La columna derecha contiene detalles (fecha, lugar, recuerdos/viajes/eventos vinculados y personas/mascotas con sus avatares), asociación directa de personas (+) y un segundo panel con hasta **tres relaciones** que se cruzan con la fecha, priorizando las asociaciones explícitas. «Ver todas las relaciones» solo aparece cuando existen más de tres, con desplazamiento **interno** de la lista, no de la página.

Desde **Personas y mascotas** se pueden crear y editar fichas con una foto de perfil **referenciada por ID de fotografía existente**. Al crear una persona desde una foto, se vincula automáticamente a esa foto. En **Ajustes** se puede configurar la foto de perfil local y opcionalmente relacionar el perfil con una persona existente. Estas opciones no implican inicio de sesión ni sincronización en un servidor.

La interfaz utiliza la altura disponible **sin scroll vertical en ordenadores de al menos 1025 px de ancho y 620 px de alto**. En móviles, tablets o ventanas muy bajas, las columnas se apilan y se permite desplazamiento para no ocultar acciones.

La acción Compartir usa la API nativa del dispositivo cuando admite archivos; como alternativa descarga el original para poder enviarlo manualmente. No se genera un enlace público ni se suben fotos a ningún servicio.

Los datos siguen residiendo en IndexedDB. El código de selección de relacionadas se prueba en `web/tests/photoRelations.test.mjs`, y las referencias de avatar se limpian cuando se elimina la foto correspondiente, conservando las fichas.

## Logos originales Memrly (22/11/2026)

Los PNG originales suministrados por la persona usuaria están incorporados a **GitHub sin modificar ningún byte**, reutilizando exactamente los blobs subidos a `web/src`:

- **Icono cuadrado**: `web/public/brand/memrly-app.png`. SHA Git `d8ca7e94453264e17a22404f2ed888a6c1e6ab65`, 813839 bytes.
- **Logo horizontal**: `web/public/brand/memrly-horizontal.png`. SHA Git `916a5c9c6a1b13e3562e379cd7c1f743d947c8b9`, 435511 bytes.

`App.tsx` usa los PNG originales en la barra lateral y la cabecera; `web/index.html` y `web/vite.config.ts` los priorizan para el favicon, el acceso directo y el manifiesto de la PWA. Los SVG recreados siguen presentes únicamente como alternativa de emergencia si faltara algún archivo. Los archivos originales subidos a `web/src` se han conservado para no eliminar contenido del usuario.

Si el dispositivo mantiene el icono antiguo después de actualizar la PWA, puede necesitar recargar y reinstalar el acceso directo. No se han modificado las fotografías ni el almacenamiento IndexedDB.

## Recuerdos de una sola fecha en el calendario

Si un viaje, evento o recuerdo tiene `startDate === endDate`, su casilla **no muestra la etiqueta superpuesta con el nombre** y utiliza exclusivamente un pequeño icono de categoría: avión (viaje), calendario (evento) o corazón (recuerdo). El borde del intervalo no cambia. Si el evento dura varios días, continúa mostrando la etiqueta habitual, aunque alguna semana solo contenga un día del intervalo (por ejemplo un domingo aislado). El nombre completo sigue accesible para lectores de pantalla mediante el `aria-label` de la fecha; el tooltip nativo al pasar el cursor no incluye el nombre de los recuerdos de un solo día. Esto no modifica las asociaciones ni los datos guardados.

## Ajustes responsive de la ficha de fotografía (2026-11-22)

- El panel **Detalles de la fotografía** presenta sus cuatro filas compactas, sin repartirlas artificialmente entre los extremos del panel. El segundo panel de recuerdos ocupa solo la altura necesaria y mantiene un scroll interno para listas extensas.
- La columna de imagen fija su track CSS a `minmax(0,1fr)`; antes el contenido mínimo de controles de zoom/miniaturas podía desbordar el propio recuadro y solaparse con el panel derecho.
- Se acota el ancho del slider, se reduce el texto secundario que no cabe, y la tira de miniaturas puede desplazarse horizontalmente en tamaños intermedios.
- En ventanas de **1240 px o menos de ancho**, o **menos de 700 px de alto**, los bloques pasan a una columna vertical con scroll natural; a partir de 1241 px con altura suficiente, se mantiene la página de escritorio sin scroll exterior.
- Los menús flotantes de personas se muestran por encima de las otras tarjetas y se ajustan al ancho de pantalla. El aviso de errores ya no rompe el reparto vertical de filas, gracias a la estructura flex.
- No se han modificado ni las fotos ni los datos IndexedDB. Las pruebas automatizadas verifican compilación y lógica, no sustituyen una comprobación visual manual en todas las resoluciones.
