/* ===== Núcleo compartido (editor y visor): esquema, validación, render del CV, archivos, utilidades ===== */
(function (g) {
  'use strict';
  const D = document;
  const $ = (s, r) => (r || D).querySelector(s);
  const $$ = (s, r) => Array.from((r || D).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const bold = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const slug = s => norm(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  /* Nombre estable del archivo de un CV, sin extensión (HTML, JSON y PDF): «Ana Prueba Núñez» → CV_Ana_Prueba_Nunez. */
  const nombreArchivo = nombre => 'CV_' + (String(nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^A-Za-z0-9]+/).filter(Boolean).map(p => p[0].toUpperCase() + p.slice(1)).join('_') || 'Nuevo');
  const vacio = v => v == null || v === '' || (Array.isArray(v) && v.length === 0);
  const hoy = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  /* ---------- Constantes ---------- */
  const SCHEMA = 1;
  const CAMPOS_EN = ['cargo', 'empresa', 'insights', 'formacion', 'parrafo_azul', 'cuerpo'];
  // Listas SUGERIDAS (texto libre permitido). Provisionales: sin lista oficial.
  const CATEGORIAS = ['Socio/a', 'Associate Partner', 'Director/a', 'Senior Manager', 'Manager', 'Consultor/a sénior', 'Consultor/a', 'Analista'];
  const OFICINAS = ['Madrid', 'Barcelona', 'Bilbao', 'Valencia', 'Sevilla', 'Málaga', 'Zaragoza', 'Vigo', 'Palma', 'Canarias'];
  const AREAS = ['Control interno / SOx', 'Auditoría interna', 'Compliance', 'Gestión de riesgos', 'Sostenibilidad / ESG', 'Riesgos tecnológicos / ITGC'];
  const LABELS = {
    es: { cv: 'Curriculum Vitae', exp: 'Experiencia', form: 'Formación:', linkedin: 'Perfil de LinkedIn', tend: 'Artículos en KPMG Tendencias' },
    en: { cv: 'Curriculum Vitae', exp: 'Experience', form: 'Education:', linkedin: 'LinkedIn profile', tend: 'Articles on KPMG Tendencias' }
  };
  const COPY = {
    es: '© 2026 KPMG Asesores, S.L.U., sociedad limitada unipersonal española y firma miembro de la organización global de KPMG de firmas miembro independientes afiliadas a KPMG International Limited, sociedad inglesa limitada por garantía. Todos los derechos reservados.',
    en: '© 2026 KPMG Asesores, S.L.U., a Spanish single-member limited liability company and a member firm of the KPMG global organization of independent member firms affiliated with KPMG International Limited, a private English company limited by guarantee. All rights reserved.'
  };
  const FOTO_GENERICA = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 92 108'%3E%3Crect width='92' height='108' fill='%23EEF3FB'/%3E%3Cg transform='translate(26,40) scale(1.7)' fill='none' stroke='%2300338D' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='9' cy='7' r='4'/%3E%3C/g%3E%3C/svg%3E";
  const LINKEDIN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>';
  const ARTICLE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';

  /* ---------- Esquema ---------- */
  function emptyCV() {
    return {
      nombre: '', cargo: '', empresa: 'KPMG España', foto: '', linkedin: '', tendencias: '',
      insights: [], formacion: [], parrafo_azul: '', cuerpo: [],
      en: { cargo: '', empresa: '', insights: [], formacion: [], parrafo_azul: '', cuerpo: [] },
      meta: { schema: SCHEMA, categoria: '', oficina: '', areas: [], actualizado: '' }
    };
  }
  const strArr = v => (Array.isArray(v) ? v : []).map(x => String(x == null ? '' : x));
  function cuerpoNorm(v) {
    return (Array.isArray(v) ? v : []).filter(b => b && typeof b === 'object').map(b => {
      const tipo = ['parrafo', 'intro_lista', 'lista', 'bullet'].includes(b.tipo) ? b.tipo : 'parrafo';
      return (tipo === 'lista') ? { tipo, items: strArr(b.items) } : { tipo, texto: String(b.texto == null ? '' : b.texto) };
    });
  }
  /* Tolerante: conserva claves desconocidas (p. ej. "slides" de HTML Maker) para no perderlas al guardar. */
  function normalize(raw) {
    const base = emptyCV();
    const r = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    const d = Object.assign({}, r);
    ['nombre', 'cargo', 'empresa', 'foto', 'linkedin', 'tendencias', 'parrafo_azul'].forEach(k => { d[k] = r[k] == null ? base[k] : String(r[k]); });
    d.insights = strArr(r.insights); d.formacion = strArr(r.formacion); d.cuerpo = cuerpoNorm(r.cuerpo);
    const en = (r.en && typeof r.en === 'object') ? r.en : {};
    d.en = Object.assign({}, en, {
      cargo: en.cargo == null ? '' : String(en.cargo), empresa: en.empresa == null ? '' : String(en.empresa),
      parrafo_azul: en.parrafo_azul == null ? '' : String(en.parrafo_azul),
      insights: strArr(en.insights), formacion: strArr(en.formacion), cuerpo: cuerpoNorm(en.cuerpo)
    });
    const m = (r.meta && typeof r.meta === 'object') ? r.meta : {};
    d.meta = Object.assign({}, m, {
      schema: SCHEMA, categoria: m.categoria ? String(m.categoria) : '', oficina: m.oficina ? String(m.oficina) : '',
      areas: strArr(m.areas).filter(Boolean), actualizado: m.actualizado ? String(m.actualizado).slice(0, 10) : ''
    });
    return d;
  }
  /* Para guardar: sin campos EN vacíos (HTML Maker los pisaría con vacío) ni listas con elementos en blanco. */
  function clean(d) {
    const o = JSON.parse(JSON.stringify(d));
    const limpiaCuerpo = c => c.map(b => b.tipo === 'lista' ? { tipo: 'lista', items: b.items.map(x => x.trim()).filter(Boolean) } : { tipo: b.tipo, texto: b.texto.trim() })
      .filter(b => b.tipo === 'lista' ? b.items.length : b.texto);
    o.insights = o.insights.map(x => x.trim()).filter(Boolean); o.formacion = o.formacion.map(x => x.trim()).filter(Boolean);
    o.cuerpo = limpiaCuerpo(o.cuerpo);
    const en = o.en || {};
    en.insights = (en.insights || []).map(x => x.trim()).filter(Boolean); en.formacion = (en.formacion || []).map(x => x.trim()).filter(Boolean);
    en.cuerpo = limpiaCuerpo(en.cuerpo || []);
    CAMPOS_EN.forEach(k => { if (vacio(en[k])) delete en[k]; });
    if (Object.keys(en).length) o.en = en; else delete o.en;
    ['nombre', 'cargo', 'empresa', 'parrafo_azul'].forEach(k => { o[k] = (o[k] || '').trim(); });
    /* Un enlace no válido no se guarda: HTML Maker lo pintaría tal cual dentro de href. */
    ['linkedin', 'tendencias'].forEach(k => { o[k] = (o[k] || '').trim(); if (o[k] && !urlOk(o[k])) o[k] = ''; });
    return o;
  }
  function pick(d, lang) {
    if (lang !== 'en' || !d.en) return d;
    const r = Object.assign({}, d);
    CAMPOS_EN.forEach(k => { if (!vacio(d.en[k])) r[k] = d.en[k]; });
    return r;
  }
  const tieneEN = d => !!(d.en && (!vacio(d.en.parrafo_azul) || !vacio(d.en.cuerpo)));
  /* Enlace http(s) seguro también para HTML Maker, que mete linkedin y tendencias en href="…" sin escapar:
     se rechazan comillas, < y >, espacios y caracteres de control, y la URL debe ser válida para el navegador. */
  function urlOk(u) {
    const s = String(u || '');
    if (!/^https?:\/\//i.test(s) || /["'`<>\s\u0000-\u001f\u007f]/.test(s)) return false;
    try { const p = new URL(s); return (p.protocol === 'http:' || p.protocol === 'https:') && !!p.hostname; } catch (e) { return false; }
  }
  const fotoOk = f => /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(f || '');
  function vacioTotal(d) { return !d.nombre && !d.cargo && !d.parrafo_azul && !d.cuerpo.length && !d.formacion.length && !d.insights.length; }

  /* Comprobaciones de calidad: req = obligatorio (bloquea «completo»), si no, recomendado. */
  function comprobar(d) {
    const en = d.en || {};
    return [
      { id: 'nombre', sec: 'persona', txt: 'Nombre y apellidos', ok: !!d.nombre.trim(), req: true },
      { id: 'cargo', sec: 'persona', txt: 'Cargo', ok: !!d.cargo.trim(), req: true },
      { id: 'foto', sec: 'persona', txt: 'Foto', ok: fotoOk(d.foto), req: true },
      { id: 'linkedin', sec: 'persona', txt: 'Enlace de LinkedIn válido', ok: !d.linkedin || urlOk(d.linkedin), req: false, soloSiHay: true },
      { id: 'categoria', sec: 'visor', txt: 'Categoría profesional', ok: !!d.meta.categoria, req: true },
      { id: 'oficina', sec: 'visor', txt: 'Oficina / zona geográfica', ok: !!d.meta.oficina, req: true },
      { id: 'areas', sec: 'visor', txt: 'Al menos un área de especialización', ok: d.meta.areas.length > 0, req: false },
      { id: 'insights', sec: 'resumen', txt: 'Resumen en viñetas (3-4)', ok: d.insights.filter(x => x.trim()).length >= 3, req: false },
      { id: 'formacion', sec: 'formacion', txt: 'Formación', ok: d.formacion.some(x => x.trim()), req: true },
      { id: 'azul', sec: 'exp', txt: 'Párrafo de presentación', ok: !!d.parrafo_azul.trim(), req: true },
      { id: 'cuerpo', sec: 'exp', txt: 'Experiencia (cuerpo)', ok: d.cuerpo.some(b => (b.texto || '').trim() || (b.items || []).some(x => x.trim())), req: true },
      { id: 'en', sec: 'exp', txt: 'Versión en inglés (presentación y experiencia)', ok: !!(en.parrafo_azul && en.parrafo_azul.trim()) && !vacio(en.cuerpo), req: true, lang: 'en' }
    ];
  }
  function completitud(d) {
    const c = comprobar(d), req = c.filter(x => x.req);
    return { checks: c, hechos: req.filter(x => x.ok).length, total: req.length, pend: c.filter(x => !x.ok) };
  }

  /* ---------- Taxonomías inferidas (solo cuando el CV no trae meta) ---------- */
  function inferCategoria(cargo) {
    const n = norm(cargo);
    if (/associate partner/.test(n)) return 'Associate Partner';
    if (/\bsoci[oa]\b|\bpartner\b/.test(n)) return 'Socio/a';
    if (/director/.test(n)) return 'Director/a';
    if (/senior manager|manager senior|gerente senior/.test(n)) return 'Senior Manager';
    if (/manager|gerente/.test(n)) return 'Manager';
    if (/consultor\w*\s+senior|senior consultant/.test(n)) return 'Consultor/a sénior';
    if (/consultor|consultant/.test(n)) return 'Consultor/a';
    if (/analista|analyst/.test(n)) return 'Analista';
    return 'Otros';
  }
  function inferOficina(empresa) { const m = /\s[-–]\s(.+)$/.exec(empresa || ''); return m ? m[1].trim() : ''; }
  const ordenCat = c => { const i = CATEGORIAS.indexOf(c); return i < 0 ? 99 : i; };
  function derivados(d) {
    return {
      cat: d.meta.categoria || inferCategoria(d.cargo),
      catInferida: !d.meta.categoria,
      ofi: d.meta.oficina || inferOficina(d.empresa) || 'Sin indicar',
      areas: d.meta.areas.length ? d.meta.areas : ['Sin indicar'],
      act: d.meta.actualizado || ''
    };
  }
  function mesesDesde(iso) {
    if (!iso) return null;
    const t = Date.parse(iso + 'T00:00:00'); if (isNaN(t)) return null;
    return (Date.now() - t) / (30.44 * 864e5);
  }
  function fechaLarga(iso) {
    if (!iso) return 'Sin fecha';
    const t = Date.parse(iso + 'T00:00:00'); if (isNaN(t)) return iso;
    return new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  /* Texto plano de todo el CV (ES + EN) para buscar. */
  function textoCompleto(d) {
    const p = [d.nombre, d.cargo, d.empresa, d.parrafo_azul, d.meta.categoria, d.meta.oficina, d.meta.areas.join(' '), d.insights.join(' '), d.formacion.join(' ')];
    d.cuerpo.forEach(b => p.push(b.texto || '', (b.items || []).join(' ')));
    if (d.en) { p.push(d.en.cargo || '', d.en.parrafo_azul || '', (d.en.insights || []).join(' '), (d.en.formacion || []).join(' ')); (d.en.cuerpo || []).forEach(b => p.push(b.texto || '', (b.items || []).join(' '))); }
    return p.join(' \n ').replace(/\*\*/g, '');
  }

  /* ---------- Lectura de archivos de CV (HTML del editor, JSON suelto o catálogo) ---------- */
  function extraerJsonDeHtml(texto) {
    const doc = new DOMParser().parseFromString(texto, 'text/html'); // inerte: no ejecuta scripts
    const s = doc.getElementById('cv-data');
    if (!s) return null;
    return JSON.parse(s.textContent);
  }
  function jsonDeTexto(t) {
    t = String(t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    try { return JSON.parse(t); } catch (e) { /* busca el primer objeto equilibrado */ }
    const i = t.indexOf('{'); if (i < 0) throw new Error('No se encuentra ningún JSON en el texto.');
    let prof = 0, enStr = false, prev = '';
    for (let k = i; k < t.length; k++) {
      const c = t[k];
      if (enStr) { if (c === '"' && prev !== '\\') enStr = false; } else if (c === '"') enStr = true; else if (c === '{') prof++; else if (c === '}') { prof--; if (!prof) return JSON.parse(t.slice(i, k + 1)); }
      prev = (prev === '\\' && c === '\\') ? '' : c;
    }
    throw new Error('El JSON está incompleto (faltan llaves de cierre).');
  }
  /* Devuelve lista de CVs normalizados contenidos en un archivo. */
  function leerCVs(nombreArchivo, texto) {
    const esHtml = /\.html?$/i.test(nombreArchivo);
    let raw;
    if (esHtml) {
      raw = extraerJsonDeHtml(texto);
      if (raw == null) throw new Error('No contiene datos de CV (no es un archivo generado por el editor de CV).');
    } else raw = jsonDeTexto(texto);
    const lista = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.cvs) ? raw.cvs : [raw]);
    return lista.map(x => {
      if (!x || typeof x !== 'object' || !('nombre' in x)) throw new Error('Estructura no reconocida: falta el campo «nombre».');
      return normalize(x);
    });
  }

  /* ---------- Render del CV ---------- */
  function cvHtml(data, lang, L) {
    const d = pick(data, lang);
    const foto = fotoOk(d.foto) ? d.foto : FOTO_GENERICA;
    let links = '';
    if (urlOk(d.linkedin)) links += '<a class="cv-link" href="' + esc(d.linkedin) + '" target="_blank" rel="noopener noreferrer" aria-label="' + L.linkedin + '">' + LINKEDIN_SVG + '</a>';
    if (urlOk(d.tendencias)) links += '<a class="cv-link" href="' + esc(d.tendencias) + '" target="_blank" rel="noopener noreferrer" aria-label="' + L.tend + '">' + ARTICLE_SVG + '</a>';
    const form = d.formacion.filter(x => x.trim()).map(f => '<li>' + esc(f) + '</li>').join('');
    return '<aside class="cv-side"><div class="cv-persona">' +
      '<img class="cv-foto" data-campo="foto" src="' + foto + '" alt="' + esc(d.nombre) + '">' +
      '<p class="cv-nombre" data-campo="nombre">' + esc(d.nombre) + '</p>' +
      '<p class="cv-cargo" data-campo="cargo">' + esc(d.cargo) + '</p>' +
      '<p class="cv-empresa" data-campo="empresa">' + esc(d.empresa) + '</p>' +
      '<div class="cv-links" data-campo="links">' + links + '</div></div>' +
      '<div class="cv-formacion" data-campo="formacion"><p class="cv-formacion-t">' + L.form + '</p><ul class="cv-formacion-l">' + form + '</ul></div></aside>' +
      '<section class="cv-main"><div class="cv-fijo"><h2>' + L.cv + '</h2><h3>' + L.exp + '</h3></div>' +
      '<div class="cv-zona"><div class="cv-texto" data-campo="exp">' + expHtml(d) + '</div><div class="cv-linea" hidden></div></div>' +
      '<div class="cv-pie"><img src="' + (g.__LOGO__ || '') + '" alt="KPMG"><span>' + esc(COPY[lang === 'en' ? 'en' : 'es']) + '</span></div></section>';
  }
  /* Piezas de la experiencia, en el orden de experienciaInicial de HTML Maker (cv-equipo.js). Cada pieza es un párrafo:
     k = azul | azul-punto | p | intro | punto; html = texto ya escapado (solo **negrita**). */
  function expPiezas(d) {
    const out = [];
    (d.parrafo_azul ? d.parrafo_azul.split(/\n\s*\n/) : []).forEach((p, i) => {
      const t = p.trim(); if (!t) return;
      if (/^-\s+/.test(t)) out.push({ k: 'azul-punto', html: bold(t.replace(/^-\s+/, '')) });
      else out.push({ k: 'azul', html: i === 0 ? '<strong>' + bold(t) + '</strong>' : bold(t) });
    });
    const c = d.cuerpo || [];
    c.forEach((b, i) => {
      const sigueLista = c[i + 1] && (c[i + 1].tipo === 'lista' || c[i + 1].tipo === 'bullet');
      if (b.tipo === 'parrafo' || b.tipo === 'intro_lista') { if ((b.texto || '').trim()) out.push(sigueLista ? { k: 'intro', html: '<strong>' + bold(b.texto) + '</strong>' } : { k: 'p', html: bold(b.texto) }); }
      else if (b.tipo === 'bullet') { if ((b.texto || '').trim()) out.push({ k: 'punto', html: bold(b.texto) }); }
      else if (b.tipo === 'lista') (b.items || []).forEach(it => { if (it.trim()) out.push({ k: 'punto', html: bold(it) }); });
    });
    return out;
  }
  const CLASE_CV = { azul: ' cv-p--azul', 'azul-punto': ' cv-p--azul cv-p--punto', p: '', intro: ' cv-p--intro', punto: ' cv-p--punto' };
  function expHtml(d) {
    return expPiezas(d).map((p, i) => '<p class="cv-p' + CLASE_CV[p.k] + '" data-i="' + i + '">' + p.html + '</p>').join('');
  }
  /* Medidas del layout de HTML Maker (cv-equipo.js / cv-equipo.css, modo slides), comprobadas en su editor:
     zona de 1144 px de ancho; un bloque de 1140 px o dos de 538 px separados 64 px; línea vertical de 16 px de caja en x = 562. */
  const HM = { ancho: 1140, col: 538, hueco: 64, lineaX: 562, lineaFuera: 10, formTop: 388 };
  /* Ajuste automático como HTML Maker: 1 columna a 16 px; si no cabe, 2 columnas; si no, letra menor (hasta 12 px).
     Devuelve también cómo ha quedado: qué párrafos van en cada columna y su alto (para la línea y para «slides»). */
  function ajustar(cv) {
    const side = $('.cv-formacion', cv), per = $('.cv-persona', cv), lst = $('.cv-formacion-l', cv);
    const formTop = Math.max(HM.formTop, per.offsetTop + per.offsetHeight + 28);
    side.style.top = formTop + 'px';
    let ffs = 16; lst.style.fontSize = ffs + 'px';
    while (ffs > 11 && side.offsetTop + side.offsetHeight > 872) { ffs -= 0.5; lst.style.fontSize = ffs + 'px'; }
    const z = $('.cv-zona', cv), t = $('.cv-texto', cv);
    const cabe = () => t.scrollHeight <= z.clientHeight + 1 && t.scrollWidth <= t.clientWidth + 1;
    const cand = [[1, 16]]; for (let s = 16; s >= 12; s -= 0.5) cand.push([2, s]);
    let res = null;
    for (const [cols, size] of cand) {
      t.style.setProperty('--cols', cols); t.style.fontSize = size + 'px';
      if (cabe()) { res = { cols, fs: size, ok: true }; break; }
    }
    if (!res) res = { cols: 2, fs: 12, ok: false };
    cv.dataset.cols = res.cols; cv.dataset.ajuste = res.ok ? 'si' : 'no';
    /* Columnas y altos reales (en px del lienzo, aunque esté escalado). */
    const esc = (cv.getBoundingClientRect().width / 1600) || 1, tr = t.getBoundingClientRect();
    const columnas = [{ ps: [], h: 0 }, { ps: [], h: 0 }];
    $$('.cv-p', t).forEach(p => {
      const r = p.getBoundingClientRect(), col = (res.cols === 2 && (r.left - tr.left) / esc > HM.col + HM.hueco / 2) ? 1 : 0;
      columnas[col].ps.push(p); columnas[col].h = Math.max(columnas[col].h, (r.bottom - tr.top) / esc);
    });
    res.columnas = res.cols === 2 ? columnas.filter(c => c.ps.length) : [columnas[0]];
    res.zonaH = z.clientHeight; res.formTop = formTop; res.formFs = ffs;
    /* Línea entre columnas: empieza 10 px por encima del texto y acaba 10 px por debajo de su última línea, como en HTML Maker. */
    const linea = $('.cv-linea', cv);
    if (linea) {
      const alto = Math.max.apply(null, res.columnas.map(c => c.h));
      linea.hidden = res.cols !== 2;
      linea.style.top = -HM.lineaFuera + 'px'; linea.style.height = Math.ceil(alto) + 2 * HM.lineaFuera + 'px';
    }
    return res;
  }
  /* Monta el CV dentro de «box» escalado para caber (con margen). Devuelve un controlador. */
  function montarCV(box, data, lang, opt) {
    opt = opt || {};
    box.innerHTML = '';
    const wrap = D.createElement('div'); wrap.className = 'cv-escala';
    const cv = D.createElement('div'); cv.className = 'cv-lienzo' + (opt.editable ? ' cv-editable' : '');
    wrap.appendChild(cv); box.appendChild(wrap);
    const ctl = { cv, wrap, info: null, data, lang: lang || 'es' };
    function escalar() {
      const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return;
      const m = opt.margen != null ? opt.margen : Math.max(12, Math.min(w, h) * 0.03);
      const s = Math.max(0.05, Math.min((w - 2 * m) / 1600, (h - 2 * m) / 900));
      cv.style.transform = 'scale(' + s + ')'; wrap.style.width = (1600 * s) + 'px'; wrap.style.height = (900 * s) + 'px';
      wrap.style.marginTop = Math.max(0, (h - 900 * s) / 2) + 'px'; ctl.escala = s;
    }
    function pintar(nuevo, idioma) {
      if (nuevo) ctl.data = nuevo; if (idioma) ctl.lang = idioma;
      const foco = cv.dataset.foco;
      cv.lang = ctl.lang; cv.innerHTML = cvHtml(ctl.data, ctl.lang, LABELS[ctl.lang === 'en' ? 'en' : 'es']);
      if (foco) cv.dataset.foco = foco;
      ctl.info = ajustar(cv); escalar();
      if (opt.onFit) opt.onFit(ctl.info);
    }
    ctl.pintar = pintar; ctl.escalar = escalar;
    ctl.foco = c => { if (c) cv.dataset.foco = c; else delete cv.dataset.foco; };
    if (g.ResizeObserver) { const ro = new ResizeObserver(escalar); ro.observe(box); ctl.destruir = () => ro.disconnect(); }
    pintar();
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(() => { if (D.body.contains(cv)) pintar(); });
    return ctl;
  }
  /* ---------- «slides» de HTML Maker (layout del modo slides de «Ver CV completo») ----------
     HTML Maker (cv-equipo.js) usa data.slides (o data.en.slides) si su «base» es la firma del texto actual; si no,
     rehace solo el 1.er bloque y deja los demás, con lo que el texto saldría repetido. Por eso, al guardar:
     firma igual, se conserva tal cual (layout manual); si no, se regenera como lo pinta el CV Maker. */
  function firma(valor) {
    const s = JSON.stringify(valor); let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36) + '.' + s.length;
  }
  const firmaExperiencia = d => firma([d.parrafo_azul || '', d.cuerpo || []]);
  const firmaFormacion = d => firma(d.formacion || []);
  const VIN = ' data-vin="flecha" style="--vin-c: #00338D;"';
  const CLASE_HM = { azul: 'cv-exp-p cv-exp-p--azul', 'azul-punto': 'cv-exp-p cv-exp-p--azul cv-exp-p--punto txt-vin', p: 'cv-exp-p', intro: 'cv-exp-p', punto: 'cv-exp-p cv-exp-p--punto txt-vin' };
  /* Interlineado «1,15» de HTML Maker (1,362 × 1,15): el mismo que usa el lienzo del CV Maker (cv.css). */
  const INTER_HM = '1.15';
  /* Pinta el CV fuera de la pantalla, sin escalar, y devuelve el «slides» equivalente para un idioma. */
  function generarSlides(data, lang) {
    const host = D.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:fixed;left:-20000px;top:0;width:1600px;height:900px;visibility:hidden;pointer-events:none;';
    const cv = D.createElement('div'); cv.className = 'cv-lienzo'; cv.lang = lang; host.appendChild(cv); D.body.appendChild(host);
    try {
      cv.innerHTML = cvHtml(data, lang, LABELS[lang === 'en' ? 'en' : 'es']);
      const r = ajustar(cv), d = pick(data, lang), piezas = expPiezas(d);
      const attrs = { 'data-fmt-inter': INTER_HM };
      if (r.fs < 16) { attrs['data-hero-tam'] = String(r.fs); attrs.style = '--hero-n: ' + r.fs + ';'; }
      const bloques = r.columnas.map((c, n) => ({
        html: c.ps.map((p, j) => {
          const pz = piezas[+p.dataset.i], punto = /punto/.test(pz.k);
          let at = '';
          if (punto) at = (n > 0 && j === 0) ? ' data-vin="flecha" style="--vin-arriba: 0px; --vin-c: #00338D;"' : VIN;
          else if (j < c.ps.length - 1) { const mb = Math.round(parseFloat(getComputedStyle(p).marginBottom) || 0); if (mb) at = ' style="--fmt-despues: ' + mb + 'px;"'; }
          return '<p class="' + CLASE_HM[pz.k] + '"' + at + '>' + pz.html + '</p>';
        }).join(''),
        attrs: Object.assign({}, attrs),
        x: n * (HM.col + HM.hueco), y: 0,
        w: r.cols === 2 ? HM.col : HM.ancho,
        h: r.cols === 2 ? Math.ceil(c.h) : Math.round(r.zonaH)
      }));
      const alto = Math.max.apply(null, r.columnas.map(c => Math.ceil(c.h)));
      const s = { base: firmaExperiencia(d), bloques, lineas: r.cols === 2 ? [{ dir: 'v', x: HM.lineaX, y: -HM.lineaFuera, l: alto + 2 * HM.lineaFuera }] : [] };
      if (r.formFs < 16) s.formacion = { base: firmaFormacion(d), html: d.formacion.map(f => '<li>' + esc(f) + '</li>').join(''), attrs: { 'data-hero-tam': String(r.formFs), style: '--hero-n: ' + r.formFs + ';' } };
      if (r.formTop !== HM.formTop) s.columna = { formacion: Math.round(r.formTop) };
      return s;
    } finally { host.remove(); }
  }
  /* Pone en «o» (datos ya limpios con clean) el slides de ES y, si hay experiencia EN propia, el de EN.
     Devuelve qué ha hecho en cada idioma: 'conservado' | 'regenerado' | 'quitado' | ''. */
  function prepararSlides(o) {
    const hecho = { es: '', en: '' };
    const valido = s => s && typeof s === 'object' && !Array.isArray(s);
    if (valido(o.slides) && o.slides.base === firmaExperiencia(o)) hecho.es = 'conservado';
    else { o.slides = generarSlides(o, 'es'); hecho.es = 'regenerado'; }
    const en = o.en;
    if (en) {
      const propia = !vacio(en.parrafo_azul) || !vacio(en.cuerpo), dEn = pick(o, 'en');
      if (propia) {
        if (valido(en.slides) && en.slides.base === firmaExperiencia(dEn)) hecho.en = 'conservado';
        else { en.slides = generarSlides(o, 'en'); hecho.en = 'regenerado'; }
      } else if ('slides' in en && !(valido(en.slides) && en.slides.base === firmaExperiencia(dEn))) {
        /* Sin experiencia EN propia, HTML Maker usa el slides español; uno inglés que ya no casa repetiría texto. */
        delete en.slides; hecho.en = 'quitado';
        if (!Object.keys(en).length) delete o.en;
      }
    }
    return hecho;
  }
  function imprimirCV(data, lang) {
    const host = D.createElement('div'); host.id = 'cv-impresion'; D.body.appendChild(host);
    const cv = D.createElement('div'); cv.className = 'cv-lienzo'; cv.lang = lang; host.appendChild(cv);
    cv.innerHTML = cvHtml(data, lang, LABELS[lang === 'en' ? 'en' : 'es']);
    host.style.display = 'block'; cv.style.position = 'relative'; ajustar(cv); host.style.display = '';
    D.body.classList.add('imprimiendo');
    const fin = () => { D.body.classList.remove('imprimiendo'); host.remove(); };
    g.addEventListener('afterprint', fin, { once: true });
    const t = D.title; D.title = nombreArchivo(data.nombre); // Chrome y Edge proponen el título como nombre del PDF
    setTimeout(() => { g.print(); D.title = t; }, 80);
  }

  /* ---------- Foto: recorte centrado-arriba a 92:108 y reducción ---------- */
  function procesarFoto(file) {
    return new Promise((ok, ko) => {
      if (!/^image\//.test(file.type)) return ko(new Error('El archivo no es una imagen.'));
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const W = 276, H = 324, ratio = W / H;
        let sw = img.width, sh = img.height, sx = 0, sy = 0;
        if (sw / sh > ratio) { const nw = sh * ratio; sx = (sw - nw) / 2; sw = nw; } else { const nh = sw / ratio; sy = (sh - nh) * 0.18; sh = nh; }
        const c = D.createElement('canvas'); c.width = W; c.height = H;
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.imageSmoothingQuality = 'high';
        x.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
        URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.88));
      };
      img.onerror = () => { URL.revokeObjectURL(url); ko(new Error('No se pudo leer la imagen.')); };
      img.src = url;
    });
  }

  /* ---------- IndexedDB mínima (asas de archivo, biblioteca del visor) ---------- */
  const IDB = {
    _db: null,
    abrir() {
      if (this._db) return this._db;
      this._db = new Promise(res => {
        try {
          const r = indexedDB.open('kpmg-cv-tools', 1);
          r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv'); };
          r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null);
        } catch (e) { res(null); }
      });
      return this._db;
    },
    async get(k) { const db = await this.abrir(); if (!db) return null; return new Promise(res => { try { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result == null ? null : q.result); q.onerror = () => res(null); } catch (e) { res(null); } }); },
    async set(k, v) { const db = await this.abrir(); if (!db) return false; return new Promise(res => { try { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(true); tx.onerror = () => res(false); } catch (e) { res(false); } }); },
    async del(k) { const db = await this.abrir(); if (!db) return false; return new Promise(res => { try { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').delete(k); tx.oncomplete = () => res(true); tx.onerror = () => res(false); } catch (e) { res(false); } }); }
  };

  /* ---------- Archivos: guardar (sobrescribiendo si el navegador lo permite) y abrir ---------- */
  function descargar(texto, nombre, tipo) {
    const url = URL.createObjectURL(new Blob([texto], { type: tipo || 'text/html;charset=utf-8' }));
    const a = D.createElement('a'); a.href = url; a.download = nombre; D.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  const TIPOS = { html: ['Página HTML', 'text/html', '.html'], json: ['JSON', 'application/json', '.json'], csv: ['CSV', 'text/csv', '.csv'] };
  /* Guarda con File System Access (Edge/Chrome) sobrescribiendo el mismo archivo; si no se puede, lo descarga.
     opt: {id (recuerda carpeta), key (recuerda archivo), asa (asa ya abierta), mod (lastModified de cuando se abrió
     o guardó esa asa), antesDeSobrescribir(file) → true (sobrescribir) | false (cancelar) | 'como' (elegir otro)}.
     Antes de sobrescribir compara lastModified: si el archivo cambió en disco desde entonces, pregunta. */
  async function guardar(nombre, texto, opt) {
    opt = opt || {};
    const ext = (nombre.split('.').pop() || 'html').toLowerCase(), T = TIPOS[ext] || TIPOS.html;
    if (g.showSaveFilePicker) {
      try {
        let h = opt.asa || null, mod = opt.asa ? (opt.mod || null) : null, recordada = false;
        if (!h && opt.key) { h = await IDB.get('asa:' + opt.key); if (h && h.name !== nombre) h = null; if (h) { recordada = true; mod = await IDB.get('mod:' + opt.key); } }
        if (h) { try { const p = (await h.queryPermission({ mode: 'readwrite' })) === 'granted' || (await h.requestPermission({ mode: 'readwrite' })) === 'granted'; if (!p) h = null; } catch (e) { h = null; } }
        if (h && opt.antesDeSobrescribir) {
          let f = null; try { f = await h.getFile(); } catch (e) { f = null; /* borrado o movido: se elige de nuevo */ }
          if (!f) h = null;
          else if (mod ? f.lastModified !== mod : recordada) {
            const r = await opt.antesDeSobrescribir(f);
            if (r === 'como') h = null; else if (!r) return { ok: false, cancelado: true };
          }
        }
        if (!h) h = await g.showSaveFilePicker({ id: opt.id || 'kpmg-cv', suggestedName: nombre, types: [{ description: T[0], accept: { [T[1]]: [T[2]] } }] });
        const w = await h.createWritable(); await w.write(new Blob([texto], { type: T[1] })); await w.close();
        let nuevo = null; try { nuevo = (await h.getFile()).lastModified; } catch (e) { }
        if (opt.key) { await IDB.set('asa:' + opt.key, h); await IDB.set('mod:' + opt.key, nuevo); }
        return { ok: true, nombre: h.name, via: 'archivo', asa: h, mod: nuevo };
      } catch (e) {
        if (e && e.name === 'AbortError') return { ok: false, cancelado: true };
        /* sin permisos o contexto no válido: se descarga */
      }
    }
    descargar(texto, nombre, T[1] + ';charset=utf-8');
    return { ok: true, nombre, via: 'descarga' };
  }
  const leerTexto = f => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => ko(r.error || new Error('No se pudo leer el archivo.')); r.readAsText(f, 'utf-8'); });
  /* Abre un archivo (HTML/JSON). Devuelve {name,text,asa} o null. */
  async function abrir(opt) {
    opt = opt || {};
    if (g.showOpenFilePicker) {
      try {
        const [h] = await g.showOpenFilePicker({ id: opt.id || 'kpmg-cv-abrir', types: [{ description: 'CV (HTML o JSON)', accept: { 'text/html': ['.html', '.htm'], 'application/json': ['.json'] } }] });
        const f = await h.getFile(); return { name: f.name, text: await leerTexto(f), asa: h, lastModified: f.lastModified };
      } catch (e) { if (e && e.name === 'AbortError') return null; }
    }
    return new Promise(res => {
      const i = D.createElement('input'); i.type = 'file'; i.accept = '.html,.htm,.json';
      i.onchange = async () => { const f = i.files[0]; if (!f) return res(null); res({ name: f.name, text: await leerTexto(f), asa: null, lastModified: f.lastModified }); };
      i.addEventListener('cancel', () => res(null)); i.click();
    });
  }

  /* ---------- UI común: toast, diálogo, tema ---------- */
  function capas() { return $('#capas') || D.body; }
  function toast(msg, tipo) {
    let c = $('#toasts'); if (!c) { c = D.createElement('div'); c.id = 'toasts'; capas().appendChild(c); }
    const t = D.createElement('div'); t.className = 'toast' + (tipo ? ' toast--' + tipo : ''); t.setAttribute('role', 'status'); t.textContent = msg;
    c.appendChild(t); while (c.children.length > 3) c.firstChild.remove();
    requestAnimationFrame(() => t.classList.add('on'));
    setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 300); }, tipo === 'aviso' ? 10000 : tipo === 'error' ? 6000 : 3200);
  }
  /* dialogo({titulo, cuerpo: Node|string(html), botones:[{texto, clase, cb → false para no cerrar}], ancho, cerrar}) */
  /* Pila de diálogos abiertos: solo el de arriba atiende Escape y Tab. */
  const PILA_DLG = [];
  let nDlg = 0;
  const ENFOCABLES = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function dialogo(o) {
    const id = 'dlg-' + (++nDlg);
    const fondo = D.createElement('div'); fondo.className = 'dlg-fondo';
    const v = D.createElement('div'); v.className = 'dlg'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true'); v.tabIndex = -1;
    v.setAttribute('aria-labelledby', id + '-t'); v.setAttribute('aria-describedby', id + '-c');
    if (o.ancho) v.style.width = o.ancho + 'px'; if (o.clase) v.classList.add(o.clase);
    v.innerHTML = '<div class="dlg-cab"><h2 id="' + id + '-t"></h2><button type="button" class="dlg-x" aria-label="Cerrar">×</button></div><div class="dlg-cuerpo" id="' + id + '-c"></div><div class="dlg-pie"></div>';
    $('h2', v).textContent = o.titulo || '';
    const cu = $('.dlg-cuerpo', v); if (typeof o.cuerpo === 'string') cu.innerHTML = o.cuerpo; else if (o.cuerpo) cu.appendChild(o.cuerpo);
    const pie = $('.dlg-pie', v);
    const prevFoco = D.activeElement;
    let cerrado = false;
    const api = { el: v, cuerpo: cu, pie, cerrar() {
      if (cerrado) return; cerrado = true;
      fondo.remove(); D.removeEventListener('keydown', tecla, true); D.removeEventListener('focusin', retener, true);
      const i = PILA_DLG.indexOf(api); if (i >= 0) PILA_DLG.splice(i, 1);
      if (prevFoco && prevFoco.focus && D.body.contains(prevFoco)) try { prevFoco.focus(); } catch (e) { }
      if (o.alCerrar) o.alCerrar();
    } };
    (o.botones || []).forEach(b => {
      const bt = D.createElement('button'); bt.type = 'button'; bt.className = 'btn ' + (b.clase || ''); bt.textContent = b.texto;
      bt.addEventListener('click', async () => { const r = b.cb ? await b.cb(api) : undefined; if (r !== false) api.cerrar(); });
      pie.appendChild(bt); b.el = bt;
    });
    if (!(o.botones || []).length) pie.remove();
    const enfocables = () => $$(ENFOCABLES, v).filter(x => x.offsetParent !== null);
    /* Foco retenido: Tab y Mayús+Tab dan la vuelta dentro del diálogo; Escape lo cierra. */
    function tecla(e) {
      if (PILA_DLG[PILA_DLG.length - 1] !== api) return;
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); api.cerrar(); return; }
      if (e.key !== 'Tab') return;
      const f = enfocables(); if (!f.length) { e.preventDefault(); v.focus(); return; }
      const i = f.indexOf(D.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
    }
    function retener(e) { if (PILA_DLG[PILA_DLG.length - 1] === api && !v.contains(e.target)) { const f = enfocables(); (f[0] || v).focus(); } }
    PILA_DLG.push(api);
    D.addEventListener('keydown', tecla, true);
    D.addEventListener('focusin', retener, true);
    $('.dlg-x', v).addEventListener('click', api.cerrar);
    fondo.addEventListener('mousedown', e => { if (e.target === fondo) api.cerrar(); });
    fondo.appendChild(v); capas().appendChild(fondo);
    const f = $('[autofocus], input, textarea, select', cu) || $('.btn--prim', v) || $('.dlg-pie .btn:last-child', v) || v;
    setTimeout(() => { if (!cerrado) f.focus(); }, 30);
    return api;
  }
  function confirmar(titulo, msg, textoOk, peligro) {
    return new Promise(res => {
      let hecho = false;
      dialogo({ titulo, cuerpo: '<p class="dlg-p">' + msg + '</p>', ancho: 460, alCerrar() { if (!hecho) res(false); },
        botones: [{ texto: 'Cancelar', clase: 'btn--ghost' }, { texto: textoOk || 'Aceptar', clase: peligro ? 'btn--peligro' : 'btn--prim', cb() { hecho = true; res(true); } }] });
    });
  }
  const tema = {
    init() { let t = 'dia'; try { t = localStorage.getItem('kpmg-cv-tema') || 'dia'; } catch (e) { } D.documentElement.setAttribute('data-tema', t); },
    alternar() { const t = D.documentElement.getAttribute('data-tema') === 'noche' ? 'dia' : 'noche'; D.documentElement.setAttribute('data-tema', t); try { localStorage.setItem('kpmg-cv-tema', t); } catch (e) { } return t; }
  };
  const debounce = (f, ms) => { let t; return function () { clearTimeout(t); const a = arguments; t = setTimeout(() => f.apply(null, a), ms); }; };

  g.CVK = {
    $, $$, esc, bold, norm, slug, nombreArchivo, vacio, hoy, SCHEMA, CAMPOS_EN, CATEGORIAS, OFICINAS, AREAS, LABELS, FOTO_GENERICA,
    emptyCV, normalize, clean, pick, tieneEN, urlOk, fotoOk, vacioTotal, comprobar, completitud,
    inferCategoria, inferOficina, ordenCat, derivados, mesesDesde, fechaLarga, textoCompleto,
    extraerJsonDeHtml, jsonDeTexto, leerCVs, expPiezas, firma, firmaExperiencia, firmaFormacion, generarSlides, prepararSlides, montarCV, imprimirCV, procesarFoto, IDB, descargar, guardar, abrir, leerTexto,
    toast, dialogo, confirmar, tema, debounce
  };
}(window));
