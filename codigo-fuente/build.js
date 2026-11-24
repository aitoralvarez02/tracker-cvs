#!/usr/bin/env node
// Genera dist/cv-maker.html: un único HTML autocontenido (CSS, JS, fuente en base64 y logo inlinados).
// Sin dependencias npm ni variables de entorno. Uso, desde cualquier carpeta: node build/build.js
//
// Plantilla: src/cv-maker/index.html, con marcadores que se sustituyen por el contenido de cada archivo:
//   /*FONT*/        @font-face de Open Sans (assets/fuentes/open-sans-latin.woff2)
//   /*APP_CSS*/     src/shared/app.css      (interfaz común: barra, botones, diálogos, tema día/noche)
//   /*CV_CSS*/      src/shared/cv.css       (lienzo del CV 1600x900)
//   /*EDITOR_CSS*/  src/cv-maker/editor.css
//   /*LOGO*/        assets/logo/Logo_KPMG.png en data:image/png;base64
//   /*CORE_JS*/     src/shared/core.js      (esquema, validación, render, archivos)
//   /*APP_JS*/      src/cv-maker/editor.js
// El orden de sustitución es el de la lista (el mismo que el build.py original, para que la salida sea idéntica).
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const r = (...p) => path.join(RAIZ, ...p);
const texto = p => fs.readFileSync(p, 'utf8');
const b64 = p => fs.readFileSync(p).toString('base64');

function construirCvMaker() {
  const marcadores = [
    ['/*FONT*/', "@font-face{font-family:'Open Sans';font-style:normal;font-weight:400 700;font-display:swap;" +
      'src:url(data:font/woff2;base64,' + b64(r('assets', 'fuentes', 'open-sans-latin.woff2')) + ") format('woff2');}"],
    ['/*APP_CSS*/', texto(r('src', 'shared', 'app.css'))],
    ['/*CV_CSS*/', texto(r('src', 'shared', 'cv.css'))],
    ['/*EDITOR_CSS*/', texto(r('src', 'cv-maker', 'editor.css'))],
    ['/*LOGO*/', 'data:image/png;base64,' + b64(r('assets', 'logo', 'Logo_KPMG.png'))],
    ['/*CORE_JS*/', texto(r('src', 'shared', 'core.js'))],
    ['/*APP_JS*/', texto(r('src', 'cv-maker', 'editor.js'))],
  ];
  let html = texto(r('src', 'cv-maker', 'index.html'));
  for (const [m, contenido] of marcadores) {
    if (!html.includes(m)) throw new Error('Falta el marcador ' + m + ' en src/cv-maker/index.html');
    html = html.split(m).join(contenido);
  }
  fs.mkdirSync(r('dist'), { recursive: true });
  const salida = r('dist', 'cv-maker.html');
  fs.writeFileSync(salida, html, 'utf8');
  return { salida, bytes: Buffer.byteLength(html) };
}

if (require.main === module) {
  const { salida, bytes } = construirCvMaker();
  console.log(path.relative(RAIZ, salida) + ' (' + Math.round(bytes / 1024) + ' KB)');
}
module.exports = { construirCvMaker };
