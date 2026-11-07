# Invitación de boda · Juan & Ruth

Invitación web en formato de libro pop-up en 3D. Un libro cerrado sobre un escritorio se abre y cada página levanta sus figuras de papel y una tarjeta con la información. Está pensada para teléfonos y se ve en español.

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
Cada página usa tres imágenes en `img/`: `1A` (fondo, 1280×960), `1B` (figura media, recorte con fondo transparente) y `1C` (figura frontal, recorte). Para la página 2 son `2A`, `2B`, `2C`, y así hasta la 8. Para reemplazarlas basta con guardar la nueva imagen con el mismo nombre (WebP o PNG; si cambia la extensión, actualizar `data/book.json`). El QR de regalos es `img/qr.png`.
Las imágenes actuales son provisionales y se generan con `tools/make-placeholders.py`.

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
