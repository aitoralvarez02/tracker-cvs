// Comportamiento del CV Maker (HTML entregable). Ver docs/contrato-datos.md.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const RAIZ = path.join(__dirname, '..');
const HTML = path.resolve(RAIZ, process.env.CV_MAKER_HTML || 'dist/cv-maker.html');
const URL_HTML = pathToFileURL(HTML).href;
const FIX = n => path.join(__dirname, 'fixtures', n);
const hoy = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

/* Sin File System Access API: fuerza las rutas de respaldo (input de archivo y descarga), que sí se pueden automatizar. */
async function abrirEditor(page, url = URL_HTML) {
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  await page.addInitScript(() => { delete window.showSaveFilePicker; delete window.showOpenFilePicker; });
  await page.goto(url);
  await expect(page.locator('header.top')).toBeVisible();
  return errores;
}
async function abrirCV(page, archivo) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('header [data-acc="abrir"]').click()]);
  await fc.setFiles(archivo);
  await expect(page.locator('#app')).toHaveAttribute('data-modo', 'ver');
}
async function guardar(page) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('header [data-acc="guardar"]').click()]);
  const destino = test.info().outputPath(dl.suggestedFilename());
  await dl.saveAs(destino);
  return { nombre: dl.suggestedFilename(), ruta: destino, texto: fs.readFileSync(destino, 'utf8') };
}
const datosDe = html => JSON.parse(/<script type="application\/json" id="cv-data">([\s\S]*?)<\/script>/.exec(html)[1]);

test('el HTML es autocontenido: sin recursos externos', async ({ page }) => {
  const t = fs.readFileSync(HTML, 'utf8');
  expect(t).not.toMatch(/<script[^>]+src=/i);
  expect(t).not.toMatch(/<link[^>]+rel=["']?stylesheet/i);
  expect(t).not.toMatch(/@import/i);
  expect(t).toMatch(/@font-face\{[^}]*url\(data:font\/woff2;base64,/);
  expect(t).toMatch(/window\.__LOGO__ = "data:image\/png;base64,/);
  const externas = [];
  page.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) externas.push(r.url()); });
  await abrirEditor(page);
  await page.waitForLoadState('networkidle');
  expect(externas).toEqual([]);
});

test('arranca sin errores, con bienvenida y lienzo 1600x900', async ({ page }) => {
  const errores = await abrirEditor(page);
  await expect(page).toHaveTitle('CV Maker | KPMG');
  await expect(page.locator('#bienv')).toBeVisible();
  const lienzo = page.locator('#cvbox .cv-lienzo');
  expect(await lienzo.evaluate(e => [e.offsetWidth, e.offsetHeight])).toEqual([1600, 900]);
  expect(await lienzo.evaluate(e => e.style.transform)).toMatch(/^scale\(0\.\d+\)$/);
  expect(errores).toEqual([]);
});

test('abre un JSON de HTML Maker y lo pinta', async ({ page }) => {
  await abrirEditor(page);
  await abrirCV(page, FIX('cv-completo.json'));
  const cv = page.locator('#cvbox .cv-lienzo');
  await expect(cv.locator('.cv-nombre')).toHaveText('Ana Prueba Núñez');
  await expect(cv.locator('h3')).toHaveText('Experiencia');
  await expect(cv.locator('.cv-p--azul strong strong')).toHaveText('control interno');
  await expect(cv.locator('.cv-p--punto')).toHaveCount(2);
  await expect(cv).toHaveAttribute('data-cols', '1');
  await expect(cv.locator('.cv-link')).toHaveCount(1);
});

test('guardar: nombre estable, claves desconocidas conservadas y EN vacíos eliminados', async ({ page }) => {
  await abrirEditor(page);
  await abrirCV(page, FIX('cv-completo.json'));
  const g = await guardar(page);
  expect(g.nombre).toBe('CV_Ana_Prueba_Nunez.html');
  const d = datosDe(g.texto);
  expect(d.slides).toEqual({ layout: 'manual', paginas: [1, 2] });
  expect(d.en).toEqual({ cargo: 'Governance, Risk & Compliance Manager' });
  expect(d.meta).toEqual({ extra: 'se conserva', schema: 1, categoria: 'Manager', oficina: 'Madrid', areas: ['Compliance'], actualizado: hoy() });
  expect(g.texto).not.toMatch(/<html[^>]*data-tema/);
  expect(g.texto).toMatch(/<div id="app"[^>]*><\/div>/);
  expect(g.texto).toMatch(/<title>CV · Ana Prueba Núñez \| KPMG<\/title>/);
  await expect(page.locator('#estado')).toHaveAttribute('data-e', 'ok');
});

test('el CV guardado se abre solo y muestra el CV', async ({ page }) => {
  await abrirEditor(page);
  await abrirCV(page, FIX('cv-completo.json'));
  const g = await guardar(page);
  const p2 = await page.context().newPage();
  const errores = await abrirEditor(p2, pathToFileURL(g.ruta).href);
  await expect(p2.locator('#app')).toHaveAttribute('data-modo', 'ver');
  await expect(p2.locator('#cvbox .cv-nombre')).toHaveText('Ana Prueba Núñez');
  await expect(p2.locator('.dlg')).toHaveCount(0);
  expect(errores).toEqual([]);
});

test('seguridad: no ejecuta HTML ajeno y filtra enlaces y fotos', async ({ page }) => {
  await abrirEditor(page);
  await abrirCV(page, FIX('cv-malicioso.json'));
  const cv = page.locator('#cvbox .cv-lienzo');
  await expect(cv.locator('.cv-nombre img')).toHaveCount(0);
  await expect(cv.locator('.cv-texto b')).toHaveCount(0);
  await expect(cv.locator('.cv-link')).toHaveCount(1);
  await expect(cv.locator('.cv-link')).toHaveAttribute('href', 'https://example.invalid/articulo');
  expect(await cv.locator('.cv-foto').getAttribute('src')).toMatch(/^data:image\/svg\+xml,/);
  const g = await guardar(page);
  expect(g.texto).not.toContain('</script><script>window.__pwned');
  expect(g.texto).toContain('\\u003c/script>');
  const p2 = await page.context().newPage();
  await abrirEditor(p2, pathToFileURL(g.ruta).href);
  await expect(p2.locator('#cvbox .cv-p--azul')).toContainText('</script><script>window.__pwned=2</script>');
  for (const p of [page, p2]) expect(await p.evaluate(() => window.__pwned)).toBeUndefined();
});

test('ajuste automático: texto largo pasa a 2 columnas y letra menor', async ({ page }) => {
  await abrirEditor(page);
  const largo = JSON.parse(fs.readFileSync(FIX('cv-completo.json'), 'utf8'));
  largo.cuerpo = [{ tipo: 'lista', items: Array.from({ length: 30 }, (_, i) => 'Proyecto ' + i + ' — cliente del sector financiero: revisión del modelo de control interno y pruebas de diseño y eficacia.') }];
  const ruta = test.info().outputPath('largo.json');
  fs.writeFileSync(ruta, JSON.stringify(largo));
  await abrirCV(page, ruta);
  const cv = page.locator('#cvbox .cv-lienzo');
  await expect(cv).toHaveAttribute('data-cols', '2');
  expect(await cv.locator('.cv-texto').evaluate(e => parseFloat(e.style.fontSize))).toBeLessThan(16);
  await expect(page.locator('#ajuste')).toContainText('2 columnas');
});

test('versión EN: usa los campos traducidos y cae al español en los vacíos', async ({ page }) => {
  await abrirEditor(page);
  await abrirCV(page, FIX('cv-completo.json'));
  await page.locator('header [data-lang="en"]').click();
  const cv = page.locator('#cvbox .cv-lienzo');
  await expect(cv.locator('.cv-cargo')).toHaveText('Governance, Risk & Compliance Manager');
  await expect(cv.locator('h3')).toHaveText('Experience');
  await expect(cv.locator('.cv-p--azul')).toContainText('control interno');
});

test('tema día/noche: cambia en el editor y no se guarda en el CV', async ({ page }) => {
  await abrirEditor(page);
  await abrirCV(page, FIX('cv-completo.json'));
  await page.locator('#btn-mas').click();
  await page.locator('[data-acc="tema"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'noche');
  const g = await guardar(page);
  expect(g.texto).not.toMatch(/<html[^>]*data-tema/);
});

test('Copilot: importa el JSON pegado (con vallas de código)', async ({ page }) => {
  await abrirEditor(page);
  await page.locator('#bienv [data-acc="importar-copilot"]').click();
  await expect(page.locator('#cp-prompt')).toHaveValue(/Convierte mi currículum en un JSON/);
  await page.locator('#cp-resp').fill('Aquí tienes:\n```json\n' + fs.readFileSync(FIX('cv-completo.json'), 'utf8') + '\n```');
  await page.locator('.dlg .btn--prim').click();
  await expect(page.locator('.dlg')).toHaveCount(0);
  await expect(page.locator('#panel [data-k="nombre"]')).toHaveValue('Ana Prueba Núñez');
  await expect(page.locator('#cvbox .cv-nombre')).toHaveText('Ana Prueba Núñez');
  await expect(page.locator('#estado span')).toHaveText('Sin guardar');
});

test('no guarda sin nombre', async ({ page }) => {
  await abrirEditor(page);
  let descargas = 0; page.on('download', () => descargas++);
  await page.locator('header [data-acc="guardar"]').click();
  await expect(page.locator('.toast--error')).toContainText('Escribe tu nombre');
  await expect(page.locator('#panel [data-k="nombre"]')).toBeFocused();
  expect(descargas).toBe(0);
});
