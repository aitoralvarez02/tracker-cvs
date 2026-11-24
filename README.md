# Tracker-CVs

Herramientas para los CVs del equipo GRC de KPMG España.

- **CV Maker** (`entregable-final/cv-maker.html`): sirve para editar el CV de una persona.
  1. Se abre en Edge o Chrome.
  2. Se rellena el CV o se importa con Copilot.
  3. Se guarda como `CV_Nombre_Apellidos.html` en la carpeta compartida.
- **CV Hub** (`entregable-final/maqueta-cv-hub/`): es el visor de las secretarias. Por ahora es solo una maqueta: `cv-hub-demo.html` trae 25 CVs de ejemplo.

Cada CV es un HTML autocontenido. Lleva el JSON del CV en `<script type="application/json" id="cv-data">`, en el mismo formato que HTML Maker. El contrato está en [contexto/contrato-datos.md](contexto/contrato-datos.md).

## Guardar el CV

- **Edge o Chrome de escritorio.** El CV Maker usa la API File System Access (`showSaveFilePicker`). La primera vez se elige dónde guardar. Después, «Guardar» (o Ctrl+S) sobrescribe ese mismo archivo, aunque se haya abierto con «Abrir CV».
- **Cambios en disco.** Antes de sobrescribir, el CV Maker comprueba si el archivo ha cambiado desde que se abrió o se guardó (su fecha de modificación). Si ha cambiado, pregunta: Cancelar, Guardar como… o Sobrescribir. Puede haberlo cambiado otra persona, otra pestaña o la sincronización de OneDrive.
- **SharePoint.** Funciona a través de la carpeta de SharePoint **sincronizada con OneDrive** en el Explorador de archivos (botón «Sincronizar» de la biblioteca). No funciona desde la web de SharePoint: el navegador no puede escribir en una biblioteca abierta en la web, y el CV acabaría en Descargas.
- **Si el navegador no puede escribir el archivo, el CV se descarga.** Pasa en Firefox, en Safari y cuando una política corporativa de Edge o Chrome bloquea la escritura: `DefaultFileSystemWriteGuardSetting` = 2, o `FileSystemWriteBlockedForUrls`. Con la descarga, el navegador puede llamar al archivo `CV_Nombre_Apellidos (1).html` si ya había otro con ese nombre en Descargas. Hay que moverlo a la carpeta compartida, sustituir el anterior y quitarle el « (1)». El CV Maker lo recuerda en un aviso.

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
