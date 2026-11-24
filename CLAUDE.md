# Tracker-CVs (KPMG GRC España)

Dos herramientas HTML para gestionar los CVs del equipo GRC, que tiene entre 60 y 100 personas:

- **CV Maker**: es el editor del CV de una persona. Es el proyecto activo.
- **CV Hub**: es el visor de las secretarias. Está congelado como maqueta en `maquetas/`. Solo se mueve; no se modifica hasta nueva orden.

Las personas usan el entregable `dist/cv-maker.html`. Lo abren en Edge o Chrome, rellenan su CV y lo guardan en la carpeta compartida, que puede ser una carpeta de red o SharePoint.

## Estructura

```
src/shared/      core.js (esquema, render, archivos, UI común), cv.css (lienzo del CV), app.css (interfaz y temas)
src/cv-maker/    index.html (plantilla con marcadores /*...*/), editor.js, editor.css
src/cv-hub/      vacío: el futuro código del Hub irá aquí
assets/          fuentes/open-sans-latin.woff2, logo/Logo_KPMG.png (se inlinan en el build)
build/build.js   genera dist/cv-maker.html
dist/            entregable (se versiona; no editar a mano)
tests/           Playwright (tests/fixtures: CVs de prueba)
datos-prueba/    muestras-cvs.json (25 CVs en formato HTML Maker)
docs/            contrato-datos.md
maquetas/        cv-hub.html, cv-hub-demo.html, ejemplos/ y codigo-hub/ (fuente del Hub; no tocar)
```

## Comandos

- `npm install`: instala `@playwright/test`. Es solo para los tests.
- `npm run build`: equivale a `node build/build.js` y genera `dist/cv-maker.html`. No usa dependencias ni variables de entorno.
- `npm test`: hace el build y después lanza los tests en el Chrome instalado (`channel: 'chrome'`).
- `CV_MAKER_HTML=<ruta> npx playwright test`: prueba otro HTML, por ejemplo una versión anterior.

Versiones probadas: Node 26.10 y `@playwright/test` 1.65.1 (versión fijada en `package.json`). Python no hace falta.

## Reglas

- **Un único HTML entregable.** Todo va inlinado: CSS, JS, la fuente en base64 y el logo. El HTML no carga nada externo.
- **Sin red.** No se usan CDN, fuentes web, analítica ni llamadas `fetch` a servidores. Copilot se usa copiando y pegando, fuera de la herramienta.
- **El contrato de datos no se rompe.** Está en `docs/contrato-datos.md`. Los cambios solo pueden ser aditivos, las claves desconocidas se conservan y los campos EN vacíos se eliminan al guardar.
- **Seguridad.** Los CVs ajenos se leen solo con `DOMParser` y de ellos solo se extrae `#cv-data`. Todo el texto se escapa. Solo se aceptan enlaces `http(s)` y fotos `data:image`.
- **Estilo KPMG.**
  - Azul `#00338D`.
  - Tipografía Open Sans.
  - El lienzo del CV es de 1600×900 y replica la plantilla «Ver CV completo» de HTML Maker.
- **Tema día/noche** en la interfaz, con `html[data-tema]` y `localStorage`. El lienzo del CV no cambia con el tema.
- **Animaciones simples**: solo transiciones cortas de opacidad o de desplazamiento, y se respeta `prefers-reduced-motion`.
- El código fuente va separado en HTML, CSS y JS. Nunca se edita `dist/` a mano: se cambia `src/` y se vuelve a hacer el build.
- Para comprobar un cambio:
  - hacer el build y pasar `npm test`;
  - si el cambio es visible, mirarlo en el navegador;
  - si el cambio es de comportamiento, añadir o ajustar un test.
- HTML Maker (`../Editor-Propuestas`) es solo de lectura y sirve de referencia.
- Todo en español.
