// Comportamiento del CV Maker (HTML entregable). Ver contexto/contrato-datos.md.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const RAIZ = path.join(__dirname, '..', '..'); // raíz del repositorio
const HTML = path.resolve(RAIZ, process.env.CV_MAKER_HTML || 'entregable-final/cv-maker.html');
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
  expect(d.otra_clave).toEqual({ de: 'otra herramienta', n: [1, 2] });
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
  await expect(page.locator('.dlg h2')).toHaveText('Hay que subir la foto'); // su foto es una URL, no data:image
  await page.locator('.dlg .btn--ghost').click();
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

test('seguridad: urlOk rechaza enlaces que podrían inyectar atributos en HTML Maker', async ({ page }) => {
  await abrirEditor(page);
  const r = await page.evaluate(() => [
    'https://x"onmouseover=alert(1)', "https://x'onmouseover=1", 'https://x/<b>', 'https://x y', 'https://x\ty', 'javascript:alert(1)',
    'https://', 'ftp://x.com', 'https://www.linkedin.com/in/ana-prueba', 'http://kpmg.es/tendencias?a=1&b=2'
  ].map(u => CVK.urlOk(u)));
  expect(r).toEqual([false, false, false, false, false, false, false, false, true, true]);
  const cv = JSON.parse(fs.readFileSync(FIX('cv-completo.json'), 'utf8'));
  cv.linkedin = 'https://x"onmouseover=window.__pwned=5 x="';
  cv.tendencias = 'https://kpmg.es/tendencias/articulo';
  const ruta = test.info().outputPath('enlace-malo.json');
  fs.writeFileSync(ruta, JSON.stringify(cv));
  await abrirCV(page, ruta);
  await expect(page.locator('#cvbox .cv-link')).toHaveCount(1);
  await expect(page.locator('#cvbox .cv-link')).toHaveAttribute('href', 'https://kpmg.es/tendencias/articulo');
  const g = await guardar(page);
  const d = datosDe(g.texto);
  expect(d.linkedin).toBe('');
  expect(d.tendencias).toBe('https://kpmg.es/tendencias/articulo');
  await expect(page.locator('.toast--error')).toContainText('LinkedIn no es válido');
});

test('ajuste automático: texto largo pasa a 2 columnas y letra menor', async ({ page }) => {
  await abrirEditor(page);
  const largo = JSON.parse(fs.readFileSync(FIX('cv-completo.json'), 'utf8'));
  largo.cuerpo = [{ tipo: 'lista', items: Array.from({ length: 24 }, (_, i) => 'Proyecto ' + i + ' — cliente del sector financiero: revisión del modelo de control interno y pruebas de diseño y eficacia.') }];
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

/* ---------- «slides» de HTML Maker (contexto/contrato-datos.md, «slides») ---------- */
/* Firma de HTML Maker (cv-equipo.js, firma/firmaExperiencia), copiada aquí para comprobar la del CV Maker. */
function firmaHM(v) { const s = JSON.stringify(v); let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + '.' + s.length; }
const firmaExpHM = d => firmaHM([d.parrafo_azul || '', d.cuerpo || []]);
const MUESTRAS = path.join(RAIZ, 'assets', 'datos-prueba', 'muestras-cvs.json');
const muestra = patron => { const m = JSON.parse(fs.readFileSync(MUESTRAS, 'utf8')); return JSON.parse(JSON.stringify((Array.isArray(m) ? m : m.cvs).find(c => patron.test(c.nombre)))); };
const textoDe = html => html.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
async function abrirJson(page, obj, nombre) {
  const ruta = test.info().outputPath(nombre || 'cv.json');
  fs.writeFileSync(ruta, JSON.stringify(obj));
  await abrirCV(page, ruta);
}

test('slides: un CV de 1 columna guarda 1 bloque que ocupa la zona, con la firma de HTML Maker', async ({ page }) => {
  await abrirEditor(page);
  await abrirCV(page, FIX('cv-completo.json'));
  const d = datosDe((await guardar(page)).texto);
  expect(d.slides.base).toBe(firmaExpHM(d));
  expect(d.slides.lineas).toEqual([]);
  expect(d.slides.bloques).toHaveLength(1);
  const b = d.slides.bloques[0];
  expect([b.x, b.y, b.w]).toEqual([0, 0, 1140]);
  expect(b.h).toBeGreaterThan(630); expect(b.h).toBeLessThan(650);
  expect(b.attrs).toEqual({ 'data-fmt-inter': '1.15' });
  expect(b.html).toContain('<p class="cv-exp-p cv-exp-p--azul" style="--fmt-despues: 26px;"><strong>Manager con experiencia en <strong>control interno</strong> y cumplimiento.</strong></p>');
  expect(b.html).toContain('<p class="cv-exp-p cv-exp-p--punto txt-vin" data-vin="flecha" style="--vin-c: #00338D;">2019-2022 — Banco A: revisión SOx</p>');
  expect(d.slides.columna).toBeUndefined();
  expect(d.slides.formacion).toBeUndefined();
  expect(d.en.slides).toBeUndefined(); // sin experiencia EN propia, HTML Maker usa el slides español
});

test('slides: si la firma coincide se conserva tal cual (layout manual de HTML Maker, ES y EN)', async ({ page }) => {
  await abrirEditor(page);
  const cv = muestra(/Melero/);
  expect(cv.slides.base).toBe(firmaExpHM(cv));
  await abrirJson(page, cv, 'melero.json');
  const d = datosDe((await guardar(page)).texto);
  expect(d.slides).toEqual(cv.slides);
  expect(d.en.slides).toEqual(cv.en.slides);
});

test('slides: si el texto cambia se regenera en 2 bloques de 538 px con línea, sin texto repetido ni escapes rotos', async ({ page }) => {
  await abrirEditor(page);
  const cv = muestra(/Melero/);
  cv.cuerpo[1].items[0] = 'Proyecto con <b onclick="x()">etiquetas</b> & "comillas" ' + cv.cuerpo[1].items[0];
  await abrirJson(page, cv, 'melero-cambiado.json');
  const g = await guardar(page);
  const d = datosDe(g.texto);
  const s = d.slides;
  expect(s.base).toBe(firmaExpHM(d));
  expect(s.bloques.map(b => [b.x, b.y, b.w])).toEqual([[0, 0, 538], [602, 0, 538]]);
  const alto = Math.max(...s.bloques.map(b => b.h));
  expect(s.lineas).toEqual([{ dir: 'v', x: 562, y: -10, l: alto + 20 }]);
  for (const b of s.bloques) { expect(b.h).toBeLessThanOrEqual(645); expect(b.attrs['data-fmt-inter']).toBe('1.15'); }
  // el tamaño de letra del CV Maker pasa a HTML Maker
  const fs2 = await page.locator('#cvbox .cv-texto').evaluate(e => parseFloat(e.style.fontSize));
  if (fs2 < 16) expect(s.bloques[0].attrs).toMatchObject({ 'data-hero-tam': String(fs2), style: '--hero-n: ' + fs2 + ';' });
  else expect(s.bloques[0].attrs['data-hero-tam']).toBeUndefined();
  // todo el texto una sola vez y en orden
  const esperado = [d.parrafo_azul, ...d.cuerpo.flatMap(b => b.items || [b.texto])].map(t => t.replace(/\*\*/g, '')).join(' ').replace(/\s+/g, ' ');
  expect(textoDe(s.bloques.map(b => b.html).join(' '))).toBe(esperado);
  // HTML escapado: ninguna etiqueta que no sea p/strong
  const html = s.bloques.map(b => b.html).join('');
  expect(html.match(/<\/?([a-z]+)/g).filter(t => !/^<\/?(p|strong)$/.test(t))).toEqual([]);
  expect(html).toContain('&lt;b onclick=&quot;x()&quot;&gt;etiquetas&lt;/b&gt; &amp; &quot;comillas&quot;');
  // la columna derecha no empieza con la 1.ª viñeta separada de su frase de presentación
  const der = s.bloques[1].html;
  expect(der).toMatch(/^<p class="cv-exp-p cv-exp-p--punto txt-vin" data-vin="flecha" style="--vin-arriba: 0px; --vin-c: #00338D;">|^<p class="cv-exp-p"/);
  expect(s.bloques[0].html).not.toMatch(/<p class="cv-exp-p"[^>]*><strong>[^<]*:<\/strong><\/p>$/);
  // EN: tiene experiencia propia y su texto no cambió, así que su slides se conserva
  expect(d.en.slides).toEqual(cv.en.slides);
  // y vuelve a guardarse igual (idempotente)
  const d2 = datosDe((await guardar(page)).texto);
  expect(d2.slides).toEqual(s);
});

test('slides EN: se regenera solo con experiencia EN propia; sin ella se quita uno que ya no casa', async ({ page }) => {
  await abrirEditor(page);
  const cv = muestra(/Melero/);
  cv.en.parrafo_azul = 'Changed intro.';
  await abrirJson(page, cv, 'melero-en.json');
  let d = datosDe((await guardar(page)).texto);
  expect(d.en.slides.base).toBe(firmaExpHM(Object.assign({}, d, { parrafo_azul: d.en.parrafo_azul, cuerpo: d.en.cuerpo })));
  expect(d.en.slides.bloques[0].html).toMatch(/^<p class="cv-exp-p cv-exp-p--azul"[^>]*><strong>Changed intro\.<\/strong><\/p>/);
  expect(d.slides).toEqual(cv.slides);

  const sinEn = muestra(/Melero/);
  delete sinEn.en.parrafo_azul; delete sinEn.en.cuerpo;
  const p2 = await page.context().newPage();
  await abrirEditor(p2);
  await abrirJson(p2, sinEn, 'melero-sin-en.json');
  d = datosDe((await guardar(p2)).texto);
  expect(d.en.slides).toBeUndefined();
  expect(d.en.cargo).toBe(sinEn.en.cargo);
});

test('slides: la columna azul se regenera como la pinta el CV Maker (posición y letra de la formación)', async ({ page }) => {
  await abrirEditor(page);
  const cv = muestra(/Tuir/);
  delete cv.slides; delete cv.en.slides;
  await abrirJson(page, cv, 'tuiran.json');
  const d = datosDe((await guardar(page)).texto);
  // en español la formación cabe a 16 px y en su sitio: sin formacion ni columna
  expect(d.slides.formacion).toBeUndefined();
  expect(d.slides.columna).toBeUndefined();
  // en inglés no cabe a 16 px: HTML Maker recibe la letra que usa el CV Maker
  const f = d.en.slides.formacion;
  expect(f.attrs).toEqual({ 'data-hero-tam': '15.5', style: '--hero-n: 15.5;' });
  expect(f.base).toBe(firmaHM(d.en.formacion));
  expect(f.html).toBe(d.en.formacion.map(x => '<li>' + x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') + '</li>').join(''));

  const am = muestra(/Valcarce/);
  delete am.slides; if (am.en) delete am.en.slides;
  const p2 = await page.context().newPage();
  await abrirEditor(p2);
  await abrirJson(p2, am, 'valcarce.json');
  const top = await p2.locator('#cvbox .cv-formacion').evaluate(e => e.offsetTop);
  expect(top).toBeGreaterThan(388);
  expect(datosDe((await guardar(p2)).texto).slides.columna).toEqual({ formacion: top });
});

test('foto con ruta de HTML Maker: avisa de que hay que subirla y conserva la ruta hasta sustituirla', async ({ page }) => {
  await abrirEditor(page);
  const cv = JSON.parse(fs.readFileSync(FIX('cv-completo.json'), 'utf8'));
  cv.foto = '../../assets/maestro-cvs/fotos-equipo/Ana_Prueba.jpg';
  await abrirJson(page, cv, 'con-ruta.json');
  const dlg = page.locator('.dlg');
  await expect(dlg.locator('h2')).toHaveText('Hay que subir la foto');
  await expect(dlg).toContainText('../../assets/maestro-cvs/fotos-equipo/Ana_Prueba.jpg');
  await dlg.locator('.btn--ghost').click();
  expect(await page.locator('#cvbox .cv-foto').getAttribute('src')).toMatch(/^data:image\/svg\+xml,/);
  // se guarda con la ruta y, al abrir el HTML guardado, vuelve a avisar
  const g = await guardar(page);
  expect(datosDe(g.texto).foto).toBe(cv.foto);
  const p2 = await page.context().newPage();
  await abrirEditor(p2, pathToFileURL(g.ruta).href);
  await expect(p2.locator('.dlg h2')).toHaveText('Hay que subir la foto');
  // «Subir foto» lleva al campo; el aviso del panel desaparece al subirla
  const [fc] = await Promise.all([p2.waitForEvent('filechooser'), p2.locator('.dlg .btn--prim').click()]);
  await expect(p2.locator('#panel .aviso-foto')).toBeVisible();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
  await fc.setFiles({ name: 'foto.png', mimeType: 'image/png', buffer: png });
  await expect(p2.locator('#panel .aviso-foto')).toHaveCount(0);
  await expect(p2.locator('#cvbox .cv-foto')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
});
