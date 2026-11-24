# Tracker-CVs

Herramientas para los CVs del equipo GRC de KPMG España.

- **CV Maker** (`entregable-final/cv-maker.html`): sirve para editar el CV de una persona.
  1. Se abre en Edge o Chrome.
  2. Se rellena el CV o se importa con Copilot.
  3. Se guarda como `CV_Nombre_Apellidos.html` en la carpeta compartida.
- **CV Hub** (`entregable-final/maqueta-cv-hub/`): es el visor de las secretarias. Por ahora es solo una maqueta: `cv-hub-demo.html` trae 25 CVs de ejemplo.

Cada CV es un HTML autocontenido. Lleva el JSON del CV en `<script type="application/json" id="cv-data">`, en el mismo formato que HTML Maker. El contrato está en [contexto/contrato-datos.md](contexto/contrato-datos.md).

## Carpetas

- `entregable-final/`: los HTML que se reparten.
- `codigo-fuente/`: código (`src/`), build, pruebas y configuración de npm.
- `assets/`: fuente, logo y datos de prueba.
- `contexto/`: documentación.

## Desarrollo

```
cd codigo-fuente
npm install      # solo para los tests (Playwright)
npm run build    # genera entregable-final/cv-maker.html
npm test         # build + tests en Chrome
```

El build también se puede lanzar desde cualquier carpeta con `node codigo-fuente/build.js`. La estructura y las reglas están en [CLAUDE.md](CLAUDE.md).

Los nombres «CV Maker» y «CV Hub» son provisionales.
