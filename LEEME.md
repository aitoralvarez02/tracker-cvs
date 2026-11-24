# Tracker-CVs — primera propuesta

- `cv-maker.html`: editor de CV individual (misma estructura que HTML Maker). Se abre, se edita, se guarda en la carpeta compartida.
- `cv-hub.html`: visor de las secretarias. Modo Gestión: arrastrar CVs o carpetas. Modo Consulta: filtros, búsqueda, exportación. "Publicar visor" genera la copia estática.
- `cv-hub-demo.html`: visor ya publicado con 25 CVs de ejemplo (`ejemplos/`).
- `codigo-fuente/`: `python3 build.py` regenera los HTML (necesita assets de fuentes/logo).

Contrato: cada CV es un HTML con `<script type="application/json" id="cv-data">` (JSON de HTML Maker + clave opcional `meta`).
Nombres "CV Maker"/"CV Hub" provisionales.
