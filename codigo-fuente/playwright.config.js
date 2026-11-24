// Tests del CV Maker. Por defecto prueban entregable-final/cv-maker.html (npm test lo construye antes).
// CV_MAKER_HTML permite probar otro archivo (p. ej. una versión anterior para comparar).
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'pruebas',
  timeout: 30000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    channel: 'chrome', // Chrome instalado en el equipo (Edge usa el mismo motor, Chromium)
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  },
});
