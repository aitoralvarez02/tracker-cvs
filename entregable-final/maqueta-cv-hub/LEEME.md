# Maquetas (congeladas)

El CV Hub está parado hasta nueva orden. Esta carpeta guarda la primera propuesta tal cual estaba:

- `cv-hub.html`: visor en modo Gestión y Consulta.
- `cv-hub-demo.html`: visor ya publicado, con los 25 CVs de `ejemplos/`.
- `ejemplos/`: CVs de prueba generados con el CV Maker.

La fuente del visor está en `codigo-fuente/maqueta-cv-hub/`: `visor.html`, `visor.js`, `visor.css` y `build-original.py`, el build en Python que generaba las dos herramientas.

El visor también usa `codigo-fuente/src/shared/` (`core.js`, `cv.css`, `app.css`). `build-original.py` todavía apunta a las rutas antiguas (`codigo-fuente/src`) y no se ha adaptado. Cuando se retome el Hub, su código irá a `codigo-fuente/src/cv-hub/` y se añadirá a `codigo-fuente/build.js`.
