# Arquitectura por etapas

## Fase 1: PWA local (esta rama)

- React + Vite + TypeScript; interfaz diferente para móvil y escritorio.
- IndexedDB almacena metadatos, fotos originales, previsualizaciones y miniaturas **en este dispositivo**.
- Las operaciones de edición, elecciones de portada y fechas especiales se colocan en una cola local. **La subida al servidor aún no está implementada**.
- Los cumpleaños/aniversarios se calculan dinámicamente por año: no se crean filas duplicadas por repetición. El 29 de febrero se marca el 28 de febrero en años no bisiestos.
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

## Fechas especiales y portadas (versión 0.1.2)

- En IndexedDB existe una única configuración local `settings/main` que conserva la portada de Inicio, las portadas por año, la fecha de inicio de la relación y cumpleaños propios, de pareja y de otras personas importantes.
- `server/db/002_preferences.sql` prepara `album_preferences`, `album_year_covers`, `important_birthdays` y `memories.cover_media_id` para la futura API. **No se transfieren datos al PostgreSQL en esta fase**.
- El inicializador de Docker aplica esta migración únicamente si el volumen PostgreSQL se crea vacío. Para una base ya inicializada, haz copia de seguridad y ejecuta en la raíz del proyecto:

```bash
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' < server/db/002_preferences.sql
```

- No uses `docker compose down -v` para actualizar: eliminaría la base de datos. Las fotos del navegador tampoco son un respaldo.

## Mapa mundial georreferenciado (GeoTIFF del usuario)

El GeoTIFF original tiene tamaño **28740 × 27559** y unos **480 MB**, con **EPSG:3857** y estos límites en metros (x_min, y_min, x_max, y_max):
`-20075000, -19250000, 20074860.299720608, 19250000`.

Se ha convertido en una imagen WebP a resolución 4096 × 3928 (aprox. 1 MB), sin recortar. El WebP no contiene GeoTIFF tags: la georreferenciación se aplica en `web/src/components/WorldMap.tsx` con los límites indicados y Leaflet (CRS EPSG:3857). No se consulta ningún proveedor externo de teselas.

Para instalar el mapa: desde **Lugares / Mapa de recuerdos** selecciona **Cargar mapa optimizado** y elige el WebP entregado con este chat; el navegador lo almacenará en IndexedDB y lo mostrará con zoom, desplazamiento y marcadores por recuerdo. Es una operación **por dispositivo** mientras no haya sincronización de archivos. Puedes sustituirlo desde el mismo botón.

Alternativamente, genera el WebP a partir del GeoTIFF (fuera de Git, no subas el original de 480 MB):
```bash
pip install rasterio pillow
python scripts/prepare_map.py /ruta/recurso_georref.tif /ruta/amorchi-mapa-mundial.webp
```

Importa ese archivo desde la PWA. Las coordenadas de los marcadores son latitud/longitud WGS84, transformadas correctamente al CRS Web Mercator por Leaflet.

**Nota**: las imágenes WebP, JPEG o PNG ajenas a este GeoTIFF no son cartografía válida para el mapa, aunque tengan dimensiones similares. Importa únicamente una versión reducida creada a partir del archivo original.

La eliminación de una fotografía se realiza en una única transacción local IndexedDB: se borran original, miniaturas, metadatos y referencias de portada. Se conserva una operación `delete` pendiente, pero **aún no se propaga a otros dispositivos ni servidores**. Asegúrate de tener copia del archivo fuera del navegador antes de confirmar el borrado.

## Borrado de recuerdos: integridad referencial local

`deleteMemory(memoryId)` en `web/src/db.ts` utiliza una sola transacción sobre `memories`, `photos` y `operations`. Desvincula ese ID de todas las fotos, mantiene sus blobs, fechas y demás asociaciones intactas, elimina los `upsert` locales obsoletos y crea operaciones de actualización para las fotos afectadas y una operación `delete` para el recuerdo. El borrado exige una confirmación específica en la interfaz. Si falla la transacción no se considera borrado.

El **28 de diciembre** se incluye como **Día de los Santos Inocentes (bromas)** con borde rosa en el calendario. Se calcula anualmente sin generar eventos de usuario ni filas persistentes adicionales; puede desactivarse junto con las demás celebraciones tradicionales en Ajustes.

## Rediseño Memrly y posición de portadas

Se añaden `web/src/OverviewPages.tsx`, `web/src/CalendarRedesign.tsx` y `web/src/memrly-redesign.css`. El CSS se importa **después** de los estilos anteriores para mantener la compatibilidad de las demás fichas y actualizar el tema a blanco/azul marino. El diseño del Calendario utiliza en escritorio una cuadrícula 5:3 dentro del área principal (aproximadamente 50 % de ancho de pantalla para el calendario cuando la barra lateral ocupa 20 %).

Las posiciones elegidas de portada (`CoverPosition {x,y}`, porcentajes 0-100) quedan en `settings.homeCoverPosition`, `settings.yearCoverPositions` y `memories.coverPosition`. Se aplican mediante `object-position`, sin alterar los blobs originales. Cuando una foto se elimina, también se eliminan sus referencias y puntos focales de las portadas afectadas. Las nuevas preferencias se sincronizarán cuando exista una API, no antes.

## Colecciones (IndexedDB v5)

La tienda `collections` conserva `PhotoCollection {id,title,photoIds,createdAt}`. `AddToCollectionDialog` permite crear una colección o añadir las fotografías de una fecha a una existente. Se evita la duplicación de IDs y de los blobs. Al eliminar una fotografía se eliminan sus referencias de colecciones en la misma transacción. Las modificaciones generan operaciones de entidad `collection` en la cola offline; la API y el esquema de servidor para colecciones quedan pendientes.

**Resumen anual** es una tarjeta de diseño marcada «Próximamente», sin lógica ni generación de resúmenes. No confundir el resumen básico de estadísticas por año con una futura función de selección de destacados.

## Modelo de celebraciones recurrentes y excepciones

El catálogo es una **entidad lógica independiente** de `Memory` y `Photo`: `celebrationCatalog(settings)` presenta las categorías por ID estable, `automaticCelebrationIds(date,settings)` calcula las coincidencias por fecha, y `photoCelebrations(photo,settings)` combina las reglas con las excepciones manuales. No se almacena una fila por foto/fecha/año para celebraciones automáticas; eso evita duplicaciones y permite que una foto antigua aparezca en el filtro por Navidades inmediatamente.

Los IDs de las celebraciones están en `web/src/celebrations.ts`, sin depender del texto que se ve en pantalla. La temporada de Navidades se indexa por el año de inicio (por ejemplo `2025` = **Navidades 2025–2026**). Para cumpleaños se usan identificadores `birthday:me`, `birthday:partner` y `birthday:<id>`. Los eventos y viajes siguen asociándose mediante `Photo.memoryIds[]`. No existe límite de un único vínculo.

Las asociaciones manuales son dos atributos opcionales de `Photo`: `celebrationIncludeIds?:string[]` y `celebrationExcludeIds?:string[]`. Se actualizan de forma inmutable desde el editor de foto y se persisten mediante la operación habitual `savePhoto`, que mantiene la cola local. `photoCelebrations` resuelve las exclusiones con prioridad sobre la coincidencia automática. Un cambio de fecha recalcula automáticamente las celebraciones pero no borra las decisiones manuales.

**Pendiente para el futuro servidor:** exponer el catálogo/versionado de reglas y sincronizar esas listas de excepciones junto con fotos, preferencias de fechas y colecciones. No se ha ejecutado migración PostgreSQL ni traslado de fotografías en esta iteración.

## Navegación y representación de fotografías (noviembre 2026)

- `Page` incorpora `'foto'` además de las secciones anteriores. `App.tsx` conserva en `photoReturnPage` el destino de retorno; la selección de miniaturas solo cambia `selectedPhotoId`, evitando perder la sección de origen. `photoEditOpen` controla el antiguo `PhotoDialog` exclusivamente en la acción «Editar».
- `PhotoDetailPage.tsx` consume `getPhotoAsset(id,'preview')` para la vista normal y `getPhotoAsset(id,'original')` en el visor ampliado. Los `objectURL` se liberan al desmontar o al cambiar de foto. No se generan ni se suben duplicados.
- `photoRelations.ts` define `relatedPhotos` (mismo día o cualquier `memoryId` compartido, sin duplicados y en orden cronológico) y `relatedMemories` (enlaces directos o intervalo que cubra la fecha). Pruebas: `photoRelations.test.mjs`.
- `web/src/photo-detail.css` gestiona distribución 5:3, zoom/encuadre, fullscreen y responsive. En escritorio a partir de 1025×620 px se desactiva el scroll externo; listas y menús extensos se desplazan internamente.
- `Subject.avatarPhotoId?`, `AppSettings.profilePhotoId?` y `AppSettings.profileSubjectId?` referencian fotos existentes sin crear nuevas copias. Se editan en el diálogo de personas/mascotas y en Ajustes. Borrar una foto limpia los IDs de avatar y perfil mediante la misma transacción IndexedDB, sin borrar las fichas ni los demás vínculos.
- `navigator.share({files})` utiliza el archivo original cuando el navegador lo permite. El fallback descarga el archivo. No existen URLs públicas de fotografías.
- La API remota y la autenticación siguen pendientes; avatares, favoritos, foto de perfil y asociaciones nuevas se guardan localmente y se registran en la cola de operaciones.
