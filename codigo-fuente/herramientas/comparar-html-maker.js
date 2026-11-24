// Compara el CV Maker con HTML Maker (../Editor-Propuestas, solo lectura): genera «slides» con el CV Maker para los
// CVs de assets/datos-prueba/muestras-cvs.json (sin su layout manual, para forzar la regeneración), los abre en la
// ventana «Ver CV completo» del editor de HTML Maker y mide cada párrafo, la línea y la formación en los dos.
// Requisitos: build hecho (npm run build) y HTML Maker construido en ../Editor-Propuestas/entregable-final.
// Uso, desde codigo-fuente/:  node herramientas/comparar-html-maker.js <carpeta-salida> [patrón-nombre] [--fotos] [--json=<cv.json>]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = process.argv[2], SOLO = (process.argv[3] && !process.argv[3].startsWith('--')) ? new RegExp(process.argv[3]) : null, SHOTS = process.argv.includes('--fotos');
const { pathToFileURL } = require('url');
const RAIZ = path.join(__dirname, '..', '..');
const CVM = pathToFileURL(path.join(RAIZ, 'entregable-final', 'cv-maker.html')).href;
const HMU = pathToFileURL(path.join(RAIZ, '..', 'Editor-Propuestas', 'entregable-final', 'editor-propuesta.html')).href;
const m = require(path.join(RAIZ, 'assets', 'datos-prueba', 'muestras-cvs.json'));
let cvs = (Array.isArray(m) ? m : m.cvs).map(c => JSON.parse(JSON.stringify(c)));
const extra = process.argv.find(a => a.startsWith('--json='));
if (extra) cvs = [JSON.parse(fs.readFileSync(extra.slice(7), 'utf8'))];
if (SOLO) cvs = cvs.filter(c => SOLO.test(c.nombre));
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const A = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  await A.goto(CVM); await A.waitForFunction(() => window.CVK && document.fonts.status === 'loaded');
  const B = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  await B.goto(HMU);
  await B.waitForFunction(() => { const w = document.getElementById('preview').contentWindow; return w && w.__abrirCvModal && w.__CVS__; }, null, { timeout: 60000 });
  await B.waitForTimeout(1500);
  await B.evaluate(() => { [...document.querySelectorAll('body *')].forEach(e => { if (/Crear plantilla/.test(e.textContent) && !e.querySelector('iframe') && getComputedStyle(e).position === 'fixed') e.style.display = 'none'; }); });
  const fr = await (await B.$('#preview')).contentFrame();
  let peor = 0;
  for (const [n, raw] of cvs.entries()) {
    if (!extra) { delete raw.slides; if (raw.en) delete raw.en.slides; }
    for (const lang of ['es', 'en']) {
      // CV Maker
      const r = await A.evaluate(([raw, lang]) => {
        const K = CVK; const o = K.clean(K.normalize(raw)); K.prepararSlides(o);
        if (lang === 'en' && !(o.en && o.en.slides)) return null;
        let box = document.getElementById('cmp'); if (!box) { box = document.createElement('div'); box.id = 'cmp'; box.style.cssText = 'position:fixed;left:0;top:0;width:1600px;height:900px;z-index:9999;background:#fff'; document.body.appendChild(box); }
        const ctl = K.montarCV(box, K.normalize(o), lang, { margen: 0 });
        const z = ctl.cv.querySelector('.cv-zona').getBoundingClientRect(), s = ctl.escala;
        const ps = [...ctl.cv.querySelectorAll('.cv-p')].map(p => { const q = p.getBoundingClientRect(); return [(q.left - z.left) / s, (q.top - z.top) / s, q.width / s, q.height / s]; });
        const li = ctl.cv.querySelector('.cv-linea'); const lr = li.getBoundingClientRect();
        const ft = ctl.cv.querySelector('.cv-formacion'), fl = ctl.cv.querySelector('.cv-formacion-l li');
        return { o, ps, linea: li.hidden ? null : [(lr.left - z.left) / s, (lr.top - z.top) / s, lr.height / s], zona: [z.width / s, z.height / s], form: [ft.offsetTop, fl ? parseFloat(getComputedStyle(fl).fontSize) : 0], info: ctl.info.cols + 'c ' + ctl.info.fs + 'px' };
      }, [raw, lang]);
      if (!r) continue;
      if (SHOTS) await A.locator('#cmp .cv-lienzo').screenshot({ path: path.join(OUT, `cvm-${n}-${lang}.png`) });
      // HTML Maker
      const h = await fr.evaluate(([o, lang, k]) => {
        document.documentElement.lang = lang; window.__CVS__[k] = o; window.__abrirCvModal(k);
        return new Promise(res => setTimeout(() => {
          const zona = document.getElementById('cv-exp-zona'), z = zona.getBoundingClientRect(), zoom = parseFloat(getComputedStyle(document.querySelector('.cv-modal-panel')).zoom) || 1;
          const sc = z.width / zona.offsetWidth;
          const ps = [...zona.querySelectorAll('.cv-exp-texto > p')].map(p => { const q = p.getBoundingClientRect(); return [(q.left - z.left) / sc, (q.top - z.top) / sc, q.width / sc, q.height / sc]; });
          const li = zona.querySelector('.cv-exp-linea'); const lr = li && li.getBoundingClientRect();
          const ft = document.querySelector('.cv-sidebar-formation'), fl = document.querySelector('#cv-form-list li');
          res({ ps, linea: li ? [(lr.left - z.left) / sc, (lr.top - z.top) / sc, lr.height / sc] : null, zona: [zona.offsetWidth, zona.offsetHeight], form: [ft.offsetTop, fl ? parseFloat(getComputedStyle(fl).fontSize) : 0], textos: zona.querySelectorAll('.cv-exp-texto').length });
        }, 900));
      }, [r.o, lang, 'x/cmp-' + n + '.json']);
      if (SHOTS) await fr.locator('.cv-modal-panel').screenshot({ path: path.join(OUT, `hm-${n}-${lang}.png`) });
      await fr.evaluate(() => { document.getElementById('cv-modal-close').click(); document.documentElement.lang = 'es'; });
      await B.waitForTimeout(350);
      let dif = 0, nota = '';
      if (h.ps.length !== r.ps.length) { dif = 999; nota = `párrafos ${r.ps.length} vs ${h.ps.length}`; }
      else r.ps.forEach((p, i) => p.forEach((v, j) => { const d = Math.abs(v - h.ps[i][j]); if (d > dif) { dif = d; nota = `p${i} [${j}] ${v.toFixed(1)} vs ${h.ps[i][j].toFixed(1)}`; } }));
      const ld = (r.linea && h.linea) ? Math.max(...r.linea.map((v, j) => Math.abs(v + (j === 0 ? 0 : 0) - h.linea[j]))) : (r.linea || h.linea ? 999 : 0);
      const fd = Math.max(Math.abs(r.form[0] - h.form[0]), Math.abs(r.form[1] - h.form[1]));
      peor = Math.max(peor, dif, ld, fd);
      console.log(`${String(n).padStart(2)} ${lang} ${raw.nombre.padEnd(36)} ${r.info.padEnd(10)} párrafos Δ${dif.toFixed(1)} ${nota}  línea Δ${ld.toFixed(1)}  formación Δ${fd.toFixed(1)} (${r.form} / ${h.form})  zona ${r.zona.map(Math.round)} / ${h.zona}`);
    }
  }
  console.log('peor diferencia (px):', peor.toFixed(1));
  await b.close();
})();
