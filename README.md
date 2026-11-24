# Tracker-CVs

Herramientas para los CVs del equipo GRC de KPMG España.

- **CV Maker** (`dist/cv-maker.html`): sirve para editar el CV de una persona.
  1. Se abre en Edge o Chrome.
  2. Se rellena el CV o se importa con Copilot.
  3. Se guarda como `CV_Nombre_Apellidos.html` en la carpeta compartida.
- **CV Hub** (`maquetas/`): es el visor de las secretarias. Por ahora es solo una maqueta: `cv-hub-demo.html` trae 25 CVs de ejemplo.

Cada CV es un HTML autocontenido. Lleva el JSON del CV en `<script type="application/json" id="cv-data">`, en el mismo formato que HTML Maker. El contrato está en [docs/contrato-datos.md](docs/contrato-datos.md).

## Desarrollo

```
npm install      # solo para los tests (Playwright)
npm run build    # genera dist/cv-maker.html
npm test         # build + tests en Chrome
```

El código está en `src/` y los recursos en `assets/`. La estructura y las reglas están en [CLAUDE.md](CLAUDE.md).

Los nombres «CV Maker» y «CV Hub» son provisionales.
