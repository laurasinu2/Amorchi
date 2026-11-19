# Amorchi 🩷

Álbum privado de recuerdos para dos personas, diseñado como PWA **offline-first**.

## Estado del proyecto

Desarrollo inicial. El objetivo es mantener una galería fotográfica por años y días, eventos y viajes con intervalos de fechas, fichas de personas y mascotas y un mapa de recuerdos agrupados.

- **Móvil:** navegación inferior, calendarios con fotografías en las celdas, fichas verticales.
- **Escritorio:** barra lateral oscura de aproximadamente el 20 % del ancho y contenido multipanel.
- **Offline:** los datos y las fotos descargadas deben permanecer accesibles; los cambios se guardarán en una cola de sincronización para cuando el servidor doméstico vuelva a estar disponible.
- **Servidor:** pensado para Docker, PostgreSQL y almacenamiento de archivos originales fuera de la base de datos; acceso desde la misma red Wi-Fi por HTTPS.
- **Fotos:** originales y versiones optimizadas, etiquetas manuales y fechas EXIF cuando existan.

> No almacenar fotografías personales, contraseñas ni claves en Git. Este repositorio contiene código y documentación, no datos reales.
