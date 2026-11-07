# Invitación de boda · Juan & Ruth

Invitación web en formato de libro pop-up en 3D. Un libro cerrado sobre un escritorio se abre como un libro de dos páginas; en cada vista doble se levantan un respaldo y una figura de papel, y sobre la página izquierda una tarjeta con la información. Al pasar la página, la hoja se curva sobre el lomo. Está pensada para teléfonos y se ve en español.

**Probar en local:** `python3 -m http.server 8000` y abrir `http://localhost:8000`.
**Publicar:** GitHub → Settings → Pages → Deploy from a branch → `main` / root.

## Páginas
1. Bienvenida y cuenta regresiva
2. Nuestra historia
3. Ceremonia
4. Recepción
5. Programa
6. Detalles (vestimenta y hospedaje)
7. Regalos (QR para depósitos)
8. Confirmar asistencia

## Cambiar el contenido
Todo está en `data/book.json`: nombres, fecha, enlaces de mapas, textos de cada tarjeta, itinerario y la lista de invitados de prueba del RSVP. No hace falta tocar el código.

## Imágenes
Cada vista doble usa tres imágenes en `img/`:
- `1A`: lámina que cubre las dos páginas (1776×1000; la mitad izquierda es la página izquierda y la derecha, la derecha).
- `1B`: respaldo de papel que se levanta al fondo (recorte con fondo transparente, ancho, aprox. 1500×820).
- `1C`: figura de pie sobre la página derecha (recorte con fondo transparente, aprox. 560×820).
Para la vista 2 son `2A`, `2B`, `2C`, y así hasta la 8. Para reemplazarlas basta con guardar la nueva imagen con el mismo nombre (WebP o PNG; si cambia la extensión, actualizar `data/book.json`). Las posiciones y tamaños de `B` y `C` están en `data/book.json` (`anchor`, `maxWidth`, `maxHeight`). El QR de regalos es `img/qr.png`.
Las imágenes actuales son provisionales y se generan con `tools/make-placeholders.py`.

## Controles
Deslizar a los lados, flechas o teclado para pasar la página; arrastrar hacia arriba o abajo para inclinar la vista. En la primera vista, "Portada" (o deslizar hacia atrás) cierra el libro; los puntos de abajo permiten saltar a cualquier página (las hojas giran en cadena); en la última, "Portada" regresa hasta la portada y cierra el libro. Las figuras C hacen un vaivén suave (unos 2°, de atrás hacia adelante) en reposo (se desactiva con la preferencia de reducir movimiento). La hoja sigue al dedo al arrastrar: si se suelta antes de la mitad vuelve a su sitio y si se pasa de la mitad (o se lanza rápido) termina de girar. En teléfonos, tras levantarse cada escena la cámara se acerca sola a la tarjeta para leer, y vuelve a la vista general al pasar la hoja; el botón "Leer" / "Ver libro" permite forzar una u otra.

## Música
`audio/fairytale.mp3`. Empieza al tocar "Abrir invitación" y se puede silenciar con el botón de arriba a la derecha.

## Versión simplificada
Si el dispositivo no soporta WebGL, o se abre con `?simple` en la dirección, se muestra la misma información como una página normal con desplazamiento.

## Estructura
- `js/book.js`: motor del libro (three.js)
- `js/cards.js`: tarjetas de papel y cuenta regresiva
- `js/rsvp.js`: confirmación de asistencia (vista previa, aún no guarda respuestas)
- `js/fallback.js`: versión simplificada
- `vendor/`: three.js r180 (licencia MIT) · `fonts/`: Cormorant Garamond y Great Vibes (licencia OFL)
