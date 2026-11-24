/* ===== CV Hub — visor de todos los CVs del equipo (gestión + consulta) ===== */
(function () {
  'use strict';
  const K = CVK, $ = K.$, $$ = K.$$, esc = K.esc;
  const H = document.documentElement;
  const S = {
    cvs: [], modo: 'consulta', vista: 'tarjetas', lang: 'es', q: '', orden: 'nombre', sel: new Set(), informe: null, soloAvisos: false, filtroLib: '',
    f: { cat: new Set(), ofi: new Set(), area: new Set(), idi: new Set(), act: new Set() }, publicado: H.getAttribute('data-publicado') === '1', detalle: null
  };
  const FACETAS = [['cat', 'Categoría'], ['ofi', 'Oficina / zona'], ['area', 'Área'], ['idi', 'Idiomas del CV'], ['act', 'Actualización']];
  const CORTO = { nombre: 'nombre', cargo: 'cargo', foto: 'foto', categoria: 'categoría', oficina: 'oficina', formacion: 'formación', azul: 'presentación', cuerpo: 'experiencia', en: 'inglés' };

  /* ---------- Modelo ---------- */
  function entrada(data, archivo, mod) {
    const id = K.slug(data.nombre) || 'sin_nombre';
    return { id, data, archivo: archivo || '', mod: mod || 0, cargado: Date.now() };
  }
  function derivar(e) {
    e.der = K.derivados(e.data);
    e.textoN = K.norm(K.textoCompleto(e.data));
    e.nombreN = K.norm(e.data.nombre + ' ' + e.data.cargo);
    const m = K.mesesDesde(e.der.act);
    e.meses = m;
    e.actCat = m == null ? 'Sin fecha' : m <= 3 ? 'Últimos 3 meses' : m <= 12 ? 'Entre 3 y 12 meses' : 'Más de 12 meses';
    e.idiCat = K.tieneEN(e.data) ? 'ES + EN' : 'Solo ES';
    e.avisos = K.comprobar(e.data).filter(c => c.req && !c.ok).map(c => CORTO[c.id] || c.id);
    if (e.meses != null && e.meses > 12) e.avisos.push('desactualizado');
    return e;
  }
  const porId = id => S.cvs.find(e => e.id === id);

  /* ---------- Persistencia (solo en el visor editable) ---------- */
  async function guardarBiblioteca() {
    if (S.publicado) return;
    const ok = await K.IDB.set('biblioteca', S.cvs.map(e => ({ id: e.id, data: e.data, archivo: e.archivo, mod: e.mod, cargado: e.cargado })));
    return ok;
  }
  async function cargarBiblioteca() {
    let lista = null;
    if (S.publicado) { try { lista = JSON.parse($('#cvs-data').textContent); } catch (e) { lista = []; } lista = lista.map(d => ({ data: K.normalize(d), archivo: '', mod: 0 })); }
    else { lista = await K.IDB.get('biblioteca'); lista = (lista || []).map(x => ({ data: K.normalize(x.data), archivo: x.archivo, mod: x.mod })); }
    S.cvs = lista.map(x => derivar(entrada(x.data, x.archivo, x.mod)));
  }

  /* ---------- Arranque ---------- */
  async function arrancar() {
    K.tema.init();
    await cargarBiblioteca();
    S.modo = (S.publicado || S.cvs.length) ? 'consulta' : 'gestion';
    montar(); pintar();
    addEventListener('keydown', alTecla);
  }
  function montar() {
    $('#app').innerHTML =
      '<header class="top"><div class="marca"><img src="' + (window.__LOGO__ || '') + '" alt="KPMG"><b>CV Hub</b><small>Visor de CVs</small></div>' +
      (S.publicado ? '' : '<div class="seg" role="group" aria-label="Modo"><button data-modo="gestion" aria-pressed="false">Gestión</button><button data-modo="consulta" aria-pressed="false">Consulta</button></div>') +
      '<div class="esp"></div><span class="estado" id="estado"><i></i><span></span></span>' +
      '<div class="seg" role="group" aria-label="Idioma de los CVs"><button data-lang="es" aria-pressed="true">ES</button><button data-lang="en" aria-pressed="false">EN</button></div>' +
      '<button class="btn btn--icono" data-acc="tema" aria-label="Modo día o noche" title="Modo día / noche"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg></button></header>' +
      '<main class="cuerpo" id="cuerpo"></main><div class="selbar" id="selbar" hidden></div>';
    $('#app').addEventListener('click', alClic);
    $('#app').addEventListener('input', alEntrada);
    $('#app').addEventListener('change', alCambio);
    $('#app').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.tarjeta')) { e.preventDefault(); abrirDetalle(e.target.dataset.id); } });
    const cuerpo = $('#cuerpo');
    ['dragenter', 'dragover'].forEach(ev => addEventListener(ev, e => { if (S.modo === 'gestion' && e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); const z = $('#zona'); if (z) z.classList.add('zona--on'); } }));
    addEventListener('dragleave', e => { if (!e.relatedTarget) { const z = $('#zona'); if (z) z.classList.remove('zona--on'); } });
    addEventListener('drop', async e => {
      if (S.modo !== 'gestion' || !e.dataTransfer) return; e.preventDefault(); const z = $('#zona'); if (z) z.classList.remove('zona--on');
      cargarArchivos(await archivosDeDrop(e.dataTransfer));
    });
    document.addEventListener('click', e => { if (!e.target.closest('.menu')) $$('.menu-lista').forEach(m => m.hidden = true); });
  }
  function pintar() {
    $$('[data-modo]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.modo === S.modo)));
    $$('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === S.lang)));
    const n = S.cvs.length, fechas = S.cvs.map(e => e.der.act).filter(Boolean).sort();
    $('#estado span').textContent = S.publicado ? n + ' CVs' + (H.getAttribute('data-fecha') ? ' · datos a ' + K.fechaLarga(H.getAttribute('data-fecha')) : '') : n + (n === 1 ? ' CV en la biblioteca' : ' CVs en la biblioteca');
    $('#estado').dataset.e = n ? 'ok' : '';
    if (S.modo === 'gestion') pintarGestion(); else pintarConsulta();
    pintarSel();
  }

  /* ================= GESTIÓN ================= */
  function kpis() {
    const c = S.cvs; const n = c.length;
    return [
      ['CVs', n, ''], ['Con versión EN', c.filter(e => e.idiCat === 'ES + EN').length, n && c.some(e => e.idiCat !== 'ES + EN') ? 'warn' : ''],
      ['Sin foto', c.filter(e => !K.fotoOk(e.data.foto)).length, c.some(e => !K.fotoOk(e.data.foto)) ? 'warn' : ''],
      ['Sin categoría / oficina', c.filter(e => !e.data.meta.categoria || !e.data.meta.oficina).length, c.some(e => !e.data.meta.categoria || !e.data.meta.oficina) ? 'warn' : ''],
      ['Desactualizados (+12 m)', c.filter(e => e.meses != null && e.meses > 12).length, c.some(e => e.meses != null && e.meses > 12) ? 'bad' : '']
    ];
  }
  function pintarGestion() {
    const k = kpis();
    $('#cuerpo').innerHTML =
      '<div class="gest"><section class="gest-izq">' +
      '<div class="zona" id="zona"><div class="zona-ico">⇪</div><h2>Carga los CVs del equipo</h2><p>Arrastra aquí los archivos <b>.html</b> o <b>.json</b>, o una carpeta entera. Si cargas un CV de alguien que ya está, se queda el más reciente.</p>' +
      '<div class="zona-btn"><button class="btn btn--prim" data-acc="elegir-archivos">Elegir archivos</button><button class="btn" data-acc="elegir-carpeta">Elegir carpeta</button></div>' +
      '<input type="file" id="in-archivos" accept=".html,.htm,.json" multiple hidden><input type="file" id="in-carpeta" webkitdirectory multiple hidden></div>' +
      '<div class="kpis">' + k.map(x => '<div class="kpi' + (x[2] ? ' kpi--' + x[2] : '') + '"><b>' + x[1] + '</b><span>' + x[0] + '</span></div>').join('') + '</div>' +
      (S.informe ? informeHtml() : '') + '</section>' +
      '<section class="gest-der"><div class="lib-cab"><h2>Biblioteca</h2><div class="lib-acc">' +
      '<input type="search" id="lib-q" placeholder="Buscar en la biblioteca…" value="' + esc(S.filtroLib) + '"><label class="chk"><input type="checkbox" id="lib-avisos"' + (S.soloAvisos ? ' checked' : '') + '> Solo con avisos</label></div></div>' +
      '<div class="lib-barra"><button class="btn btn--prim" data-acc="publicar"' + (S.cvs.length ? '' : ' disabled') + '>Publicar visor</button>' +
      '<div class="menu"><button class="btn" data-acc="menu-export"' + (S.cvs.length ? '' : ' disabled') + '>Exportar ▾</button><div class="menu-lista" id="menu-export" hidden>' +
      '<button data-acc="exp-json">Catálogo de CVs (JSON)<small>Para HTML Maker u otros usos</small></button><button data-acc="exp-csv">Tabla para Excel (CSV)</button><button data-acc="copiar-pend">Copiar lista de pendientes<small>Para reclamar datos a cada persona</small></button></div></div>' +
      '<button class="btn btn--ghost" data-acc="vaciar"' + (S.cvs.length ? '' : ' disabled') + '>Vaciar biblioteca</button></div>' +
      '<div class="lib-tabla" id="lib-tabla"></div></section></div>';
    pintarLibreria();
  }
  function pintarLibreria() {
    const q = K.norm(S.filtroLib);
    let l = S.cvs.filter(e => (!q || e.nombreN.includes(q) || K.norm(e.archivo).includes(q)) && (!S.soloAvisos || e.avisos.length));
    l = l.slice().sort((a, b) => a.data.nombre.localeCompare(b.data.nombre, 'es'));
    const t = $('#lib-tabla'); if (!t) return;
    if (!S.cvs.length) { t.innerHTML = '<div class="vacio-estado"><p><b>Todavía no hay CVs.</b></p><p>Carga los archivos que te vayan enviando: el visor los valida y avisa de lo que falta.</p></div>'; return; }
    t.innerHTML = '<table class="tab"><thead><tr><th>Persona</th><th>Archivo</th><th>Actualizado</th><th>Avisos</th><th></th></tr></thead><tbody>' + l.map(e =>
      '<tr><td><b>' + esc(e.data.nombre) + '</b><small>' + esc(e.data.cargo) + '</small></td><td class="tab-arch">' + esc(e.archivo || '—') + '</td>' +
      '<td>' + fechaChip(e) + '</td><td>' + (e.avisos.length ? e.avisos.map(a => '<span class="chip chip--' + (a === 'desactualizado' ? 'bad' : 'warn') + '">' + a + '</span>').join(' ') : '<span class="chip chip--ok">Completo</span>') + '</td>' +
      '<td class="tab-acc"><button class="btn btn--sm btn--ghost" data-acc="ver" data-id="' + esc(e.id) + '">Ver</button><button class="btn btn--sm btn--ghost" data-acc="quitar" data-id="' + esc(e.id) + '" aria-label="Quitar ' + esc(e.data.nombre) + '">✕</button></td></tr>').join('') + '</tbody></table>' + (l.length ? '' : '<div class="vacio-estado">Ningún CV coincide con el filtro.</div>');
  }
  function informeHtml() {
    const r = S.informe, cuenta = x => r.filter(i => i.e === x).length;
    return '<div class="informe"><div class="informe-cab"><h3>Última carga</h3><button class="btn btn--sm btn--ghost" data-acc="cerrar-informe">Cerrar</button></div><div class="chips">' +
      [['ok', 'correctos', 'ok'], ['aviso', 'con avisos', 'warn'], ['nuevo', 'nuevos', 'ok'], ['reemp', 'actualizados', 'ok'], ['ign', 'ignorados', 'gris'], ['err', 'con error', 'bad']].filter(x => cuenta(x[0])).map(x => '<span class="chip chip--' + x[2] + '">' + cuenta(x[0]) + ' ' + x[1] + '</span>').join('') + '</div>' +
      '<ul class="informe-lista">' + r.map(i => '<li class="inf inf--' + i.e + '"><b>' + esc(i.nombre) + '</b><span>' + esc(i.det) + '</span></li>').join('') + '</ul></div>';
  }

  /* ---------- Carga de archivos ---------- */
  async function archivosDeDrop(dt) {
    const out = [];
    const leerEntrada = (en) => new Promise(res => {
      if (en.isFile) en.file(f => { out.push(f); res(); }, () => res());
      else if (en.isDirectory) {
        const rd = en.createReader(); const todo = [];
        (function leer() { rd.readEntries(async es => { if (!es.length) { await Promise.all(todo.map(leerEntrada)); res(); } else { todo.push(...es); leer(); } }, () => res()); }());
      } else res();
    });
    const items = Array.from(dt.items || []).map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
    if (items.length) await Promise.all(items.map(leerEntrada)); else out.push(...Array.from(dt.files));
    return out;
  }
  async function cargarArchivos(files) {
    files = files.filter(f => /\.(html?|json)$/i.test(f.name));
    if (!files.length) { K.toast('No hay archivos .html o .json en lo que has soltado.', 'error'); return; }
    const inf = []; let hechos = 0;
    $('#estado span').textContent = 'Cargando…';
    for (const f of files) {
      try {
        if (f.size > 30 * 1024 * 1024) throw new Error('El archivo es demasiado grande (más de 30 MB).');
        const lista = K.leerCVs(f.name, await K.leerTexto(f));
        for (const data of lista) {
          const nuevo = derivar(entrada(data, f.name, f.lastModified));
          if (!data.nombre.trim()) throw new Error('El CV no tiene nombre.');
          const ex = porId(nuevo.id), av = nuevo.avisos.length ? ' · falta: ' + nuevo.avisos.join(', ') : '';
          if (!ex) { S.cvs.push(nuevo); inf.push({ e: nuevo.avisos.length ? 'aviso' : 'ok', nombre: data.nombre, det: 'Nuevo' + av }); continue; }
          const a = nuevo.der.act || '', b = ex.der.act || '';
          if (a === b && nuevo.mod === ex.mod) { inf.push({ e: 'ign', nombre: data.nombre, det: 'Ya estaba cargado, sin cambios' }); continue; }
          const nuevoGana = a !== b ? a > b : nuevo.mod >= ex.mod;
          if (nuevoGana) { S.cvs[S.cvs.indexOf(ex)] = nuevo; inf.push({ e: 'reemp', nombre: data.nombre, det: 'Actualiza la versión anterior' + (a !== b ? ' (' + K.fechaLarga(b) + ' → ' + K.fechaLarga(a) + ')' : ' (archivo modificado más recientemente)') + av }); }
          else inf.push({ e: 'ign', nombre: data.nombre, det: 'Ya había una versión más reciente' + (a !== b ? ' (' + K.fechaLarga(b) + ' frente a ' + K.fechaLarga(a) + ')' : '') });
        }
      } catch (err) { inf.push({ e: 'err', nombre: f.name, det: err.message || String(err) }); }
      if (++hechos % 10 === 0) await new Promise(r => setTimeout(r, 0));
    }
    const prio = { err: 0, aviso: 1, reemp: 2, nuevo: 3, ok: 3, ign: 4 }; inf.sort((x, y) => (prio[x.e] - prio[y.e]));
    S.informe = inf;
    const ok = await guardarBiblioteca();
    pintar();
    const bien = inf.filter(i => i.e !== 'err' && i.e !== 'ign').length, mal = inf.filter(i => i.e === 'err').length;
    K.toast(bien + ' CVs cargados' + (mal ? ' · ' + mal + ' con error' : '') + (ok === false ? ' · no se pudo guardar en este navegador' : ''), mal ? 'error' : 'ok');
  }

  /* ---------- Exportar / publicar ---------- */
  function datosLimpios(lista) { return (lista || S.cvs).map(e => K.clean(e.data)); }
  async function publicar() {
    const c = H.cloneNode(true);
    c.querySelectorAll('[data-dinamico]').forEach(n => { n.innerHTML = ''; });
    c.removeAttribute('style'); c.removeAttribute('data-tema'); const b = c.querySelector('body'); b.removeAttribute('class'); b.removeAttribute('style');
    c.setAttribute('data-publicado', '1'); c.setAttribute('data-fecha', K.hoy());
    c.querySelector('#cvs-data').textContent = '\n' + JSON.stringify(datosLimpios()).replace(/</g, '\\u003c') + '\n';
    c.querySelector('title').textContent = 'CV Hub | KPMG GRC';
    const html = '<!DOCTYPE html>\n' + c.outerHTML;
    const r = await K.guardar('CV-Hub_' + K.hoy() + '.html', html, { key: 'cv-hub-pub', id: 'cv-hub' });
    if (r.ok) K.toast(r.via === 'archivo' ? 'Visor publicado en «' + r.nombre + '» (' + Math.round(html.length / 1024) + ' KB)' : 'Visor descargado como «' + r.nombre + '». Súbelo a la carpeta compartida.', 'ok');
  }
  function csv(lista) {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const cab = ['Nombre', 'Cargo', 'Categoría', 'Oficina', 'Áreas', 'Empresa', 'Versión EN', 'Actualizado', 'LinkedIn'];
    return '﻿' + [cab].concat(lista.map(e => [e.data.nombre, e.data.cargo, e.der.cat, e.der.ofi, e.data.meta.areas.join(' | '), e.data.empresa, e.idiCat === 'ES + EN' ? 'Sí' : 'No', e.der.act, e.data.linkedin])).map(r => r.map(q).join(';')).join('\r\n');
  }
  function pendientes() {
    const l = S.cvs.filter(e => e.avisos.length).sort((a, b) => a.data.nombre.localeCompare(b.data.nombre, 'es'));
    return l.length ? 'CVs con datos pendientes (' + K.hoy() + '):\n' + l.map(e => '- ' + e.data.nombre + ': ' + e.avisos.join(', ')).join('\n') : 'Todos los CVs están completos.';
  }

  /* ================= CONSULTA ================= */
  const tokens = () => K.norm(S.q).split(/\s+/).filter(t => t.length >= 2);
  function pasa(e, excluir) {
    const T = tokens(); if (T.length && !T.every(t => e.textoN.includes(t))) return false;
    for (const [k] of FACETAS) {
      if (k === excluir || !S.f[k].size) continue;
      const v = k === 'cat' ? [e.der.cat] : k === 'ofi' ? [e.der.ofi] : k === 'area' ? e.der.areas : k === 'idi' ? [e.idiCat] : [e.actCat];
      if (!v.some(x => S.f[k].has(x))) return false;
    }
    return true;
  }
  function ordenar(l) {
    const c = (a, b) => a.data.nombre.localeCompare(b.data.nombre, 'es');
    const o = { nombre: c, cat: (a, b) => K.ordenCat(a.der.cat) - K.ordenCat(b.der.cat) || c(a, b), act: (a, b) => (b.der.act || '').localeCompare(a.der.act || '') || c(a, b), ofi: (a, b) => a.der.ofi.localeCompare(b.der.ofi, 'es') || c(a, b) };
    return l.slice().sort(o[S.orden] || c);
  }
  function valoresFaceta(k) {
    const cuenta = new Map();
    S.cvs.forEach(e => { if (!pasa(e, k)) return; (k === 'cat' ? [e.der.cat] : k === 'ofi' ? [e.der.ofi] : k === 'area' ? e.der.areas : k === 'idi' ? [e.idiCat] : [e.actCat]).forEach(v => cuenta.set(v, (cuenta.get(v) || 0) + 1)); });
    S.f[k].forEach(v => { if (!cuenta.has(v)) cuenta.set(v, 0); });
    let v = Array.from(cuenta.entries());
    const ordFijo = { act: ['Últimos 3 meses', 'Entre 3 y 12 meses', 'Más de 12 meses', 'Sin fecha'], idi: ['ES + EN', 'Solo ES'] };
    if (k === 'cat') v.sort((a, b) => K.ordenCat(a[0]) - K.ordenCat(b[0]) || a[0].localeCompare(b[0], 'es'));
    else if (ordFijo[k]) v.sort((a, b) => ordFijo[k].indexOf(a[0]) - ordFijo[k].indexOf(b[0]));
    else v.sort((a, b) => (a[0] === 'Sin indicar') - (b[0] === 'Sin indicar') || b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
    return v;
  }
  function pintarConsulta() {
    if (!S.cvs.length) {
      $('#cuerpo').innerHTML = '<div class="vacio-estado vacio-grande"><h2>Aún no hay CVs</h2><p>' + (S.publicado ? 'Este visor se ha publicado sin datos.' : 'Ve a <b>Gestión</b>, carga los CVs del equipo y vuelve aquí para consultarlos.') + '</p>' + (S.publicado ? '' : '<button class="btn btn--prim" data-modo="gestion">Ir a Gestión</button>') + '</div>'; return;
    }
    $('#cuerpo').innerHTML =
      '<div class="cons"><aside class="filtros" id="filtros"></aside><section class="res">' +
      '<div class="res-barra"><div class="buscar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input type="search" id="q" placeholder="Busca por nombre, cliente, certificación, herramienta…  ( / )" value="' + esc(S.q) + '" autocomplete="off"></div>' +
      '<select id="orden" aria-label="Ordenar por"><option value="nombre">Ordenar: nombre</option><option value="cat">Ordenar: categoría</option><option value="ofi">Ordenar: oficina</option><option value="act">Ordenar: más recientes</option></select>' +
      '<div class="seg seg--claro" role="group" aria-label="Vista"><button data-vista="tarjetas" aria-pressed="true">▦ Tarjetas</button><button data-vista="tabla" aria-pressed="false">☰ Tabla</button></div></div>' +
      '<div class="res-info" id="res-info"></div><div id="res-lista"></div></section></div>';
    $('#orden').value = S.orden;
    pintarResultados();
  }
  function pintarResultados() {
    const l = ordenar(S.cvs.filter(e => pasa(e)));
    S.visibles = l.map(e => e.id);
    // facetas
    $('#filtros').innerHTML = '<div class="filtros-cab"><b>Filtros</b><button class="btn btn--sm btn--ghost" data-acc="limpiar"' + (hayFiltros() ? '' : ' disabled') + '>Limpiar</button></div>' +
      FACETAS.map(([k, t]) => { const v = valoresFaceta(k); if (v.length < 1) return ''; return '<fieldset class="faceta"><legend>' + t + '</legend>' + v.map(([val, n]) => '<label class="opc' + (n ? '' : ' opc--0') + '"><input type="checkbox" data-f="' + k + '" value="' + esc(val) + '"' + (S.f[k].has(val) ? ' checked' : '') + '><span>' + esc(val) + '</span><em>' + n + '</em></label>').join('') + '</fieldset>'; }).join('');
    // info + chips activos
    const act = []; FACETAS.forEach(([k]) => S.f[k].forEach(v => act.push([k, v])));
    $('#res-info').innerHTML = '<b>' + l.length + '</b> de ' + S.cvs.length + ' CVs' + (act.length ? ' · ' + act.map(([k, v]) => '<span class="chip">' + esc(v) + '<button data-acc="quita-f" data-f="' + k + '" data-v="' + esc(v) + '" aria-label="Quitar filtro ' + esc(v) + '">×</button></span>').join(' ') : '');
    $$('[data-vista]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.vista === S.vista)));
    const cont = $('#res-lista');
    if (!l.length) { cont.innerHTML = '<div class="vacio-estado"><p><b>Ningún CV coincide.</b></p><p>Prueba con menos filtros o con otra palabra.</p>' + (hayFiltros() || S.q ? '<button class="btn" data-acc="limpiar-todo">Quitar búsqueda y filtros</button>' : '') + '</div>'; return; }
    cont.innerHTML = S.vista === 'tarjetas' ? '<div class="rejilla">' + l.map(tarjeta).join('') + '</div>' : tablaHtml(l);
  }
  const hayFiltros = () => FACETAS.some(([k]) => S.f[k].size);
  function fechaChip(e) {
    if (e.meses == null) return '<span class="chip chip--gris">Sin fecha</span>';
    return '<span class="chip chip--' + (e.meses > 12 ? 'bad' : e.meses <= 3 ? 'ok' : 'gris') + '" title="' + K.fechaLarga(e.der.act) + '">' + K.fechaLarga(e.der.act) + '</span>';
  }
  function snippetHtml(e) {
    const T = tokens(); if (!T.length) return '';
    const d = e.data, en = d.en || {};
    const campos = [['Resumen', d.insights.join(' · ')], ['Presentación', d.parrafo_azul], ['Formación', d.formacion.join(' · ')],
    ['Experiencia', d.cuerpo.map(b => (b.texto || '') + ' ' + (b.items || []).join(' · ')).join(' · ')], ['Inglés', [en.parrafo_azul, (en.insights || []).join(' · '), (en.cuerpo || []).map(b => (b.texto || '') + ' ' + (b.items || []).join(' · ')).join(' · ')].join(' · ')]];
    if (T.every(t => e.nombreN.includes(t))) return '';
    for (const [lab, tx] of campos) {
      const n = K.norm(tx); const i = n.indexOf(T[0]); if (i < 0) continue;
      const a = Math.max(0, i - 55), z = Math.min(tx.length, i + T[0].length + 85);
      let frag = tx.slice(a, z); const fn = n.slice(a, z); const marcas = [];
      T.forEach(t => { let p = fn.indexOf(t); if (p >= 0) marcas.push([p, p + t.length]); });
      marcas.sort((x, y) => x[0] - y[0]); let out = '', pos = 0;
      marcas.forEach(([s, f]) => { if (s < pos) return; out += esc(frag.slice(pos, s)) + '<mark>' + esc(frag.slice(s, f)) + '</mark>'; pos = f; });
      out += esc(frag.slice(pos));
      return '<p class="t-match"><b>' + lab + ':</b> ' + (a > 0 ? '…' : '') + out + (z < tx.length ? '…' : '') + '</p>';
    }
    return '';
  }
  function tarjeta(e) {
    const d = K.pick(e.data, S.lang), foto = K.fotoOk(d.foto) ? d.foto : K.FOTO_GENERICA;
    const ins = d.insights.filter(x => x.trim()).slice(0, 2);
    const sn = snippetHtml(e);
    return '<article class="tarjeta" tabindex="0" data-id="' + esc(e.id) + '"><label class="sel" title="Seleccionar"><input type="checkbox" data-sel="' + esc(e.id) + '"' + (S.sel.has(e.id) ? ' checked' : '') + '></label>' +
      '<div class="t-cab"><div class="t-foto"><img src="' + foto + '" alt="" loading="lazy"></div><div class="t-id"><h3>' + esc(d.nombre) + '</h3><p class="t-cargo">' + esc(d.cargo) + '</p>' +
      '<div class="chips"><span class="chip">' + esc(e.der.cat) + '</span><span class="chip chip--gris">' + esc(e.der.ofi) + '</span></div></div></div>' +
      (sn || (ins.length ? '<ul class="t-ins">' + ins.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '')) +
      '<div class="t-pie">' + fechaChip(e) + (e.idiCat === 'ES + EN' ? '<span class="chip chip--gris">ES · EN</span>' : '') + '<span class="t-ver">Ver CV →</span></div></article>';
  }
  function tablaHtml(l) {
    return '<table class="tab tab--cons"><thead><tr><th>Persona</th><th>Categoría</th><th>Oficina</th><th>Áreas</th><th>Idiomas</th><th>Actualizado</th></tr></thead><tbody>' + l.map(e => {
      const d = K.pick(e.data, S.lang);
      return '<tr class="fila-cv" tabindex="0" data-id="' + esc(e.id) + '"><td><span class="mini-foto"><img src="' + (K.fotoOk(d.foto) ? d.foto : K.FOTO_GENERICA) + '" alt="" loading="lazy"></span><span class="mini-txt"><b>' + esc(d.nombre) + '</b><small>' + esc(d.cargo) + '</small></span></td><td>' + esc(e.der.cat) + '</td><td>' + esc(e.der.ofi) + '</td><td>' + esc(e.data.meta.areas.join(', ') || '—') + '</td><td>' + e.idiCat + '</td><td>' + fechaChip(e) + '</td></tr>';
    }).join('') + '</tbody></table>';
  }
  function pintarSel() {
    const b = $('#selbar'); if (!b) return;
    const n = S.sel.size; b.hidden = !n || S.modo !== 'consulta';
    if (!b.hidden) b.innerHTML = '<b>' + n + ' seleccionado' + (n > 1 ? 's' : '') + '</b><button class="btn btn--sm" data-acc="exp-sel">Exportar selección (JSON)</button><button class="btn btn--sm" data-acc="exp-sel-csv">CSV</button><button class="btn btn--sm btn--ghost" data-acc="sel-limpia">Quitar selección</button>';
  }

  /* ---------- Detalle (el CV completo) ---------- */
  function abrirDetalle(id) {
    const e = porId(id); if (!e) return;
    cerrarDetalle(true);
    const f = document.createElement('div'); f.className = 'det-fondo'; f.id = 'detalle';
    f.innerHTML = '<div class="det" role="dialog" aria-modal="true" aria-label="CV de ' + esc(e.data.nombre) + '"><div class="det-barra"><button class="btn btn--sm" data-d="prev" aria-label="Anterior" title="← Anterior">‹</button><button class="btn btn--sm" data-d="next" aria-label="Siguiente" title="Siguiente →">›</button>' +
      '<b id="det-nombre"></b><span class="esp"></span><div class="seg seg--claro"><button data-dl="es" aria-pressed="true">ES</button><button data-dl="en" aria-pressed="false">EN</button></div>' +
      '<button class="btn btn--sm" data-d="imprimir">Imprimir / PDF</button><button class="btn btn--sm btn--icono" data-d="cerrar" aria-label="Cerrar">×</button></div><div class="det-caja" id="det-caja"></div></div>';
    $('#capas').appendChild(f);
    f.addEventListener('mousedown', ev => { if (ev.target === f || ev.target.id === 'det-caja') cerrarDetalle(); });
    f.addEventListener('click', ev => {
      const b = ev.target.closest('[data-d],[data-dl]'); if (!b) return;
      if (b.dataset.dl) { S.detalle.lang = b.dataset.dl; pintarDetalle(); return; }
      ({ cerrar: () => cerrarDetalle(), prev: () => navegar(-1), next: () => navegar(1), imprimir: () => K.imprimirCV(porId(S.detalle.id).data, S.detalle.lang) })[b.dataset.d]();
    });
    S.detalle = { id, lang: S.lang, ctl: null, foco: document.activeElement };
    S.detalle.ctl = K.montarCV($('#det-caja'), e.data, S.detalle.lang, { margen: 16 });
    pintarDetalle();
  }
  function pintarDetalle() {
    const D = S.detalle; if (!D) return; const e = porId(D.id);
    $('#det-nombre').textContent = e.data.nombre;
    $$('[data-dl]', $('#detalle')).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dl === D.lang)));
    D.ctl.pintar(e.data, D.lang);
  }
  function navegar(d) {
    const ids = S.visibles && S.visibles.length ? S.visibles : S.cvs.map(e => e.id); const i = ids.indexOf(S.detalle.id);
    const j = (i + d + ids.length) % ids.length; S.detalle.id = ids[j]; pintarDetalle();
  }
  function cerrarDetalle(silencio) {
    const f = $('#detalle'); if (!f) return;
    if (S.detalle && S.detalle.ctl && S.detalle.ctl.destruir) S.detalle.ctl.destruir();
    const foco = S.detalle && S.detalle.foco; f.remove(); S.detalle = null; if (!silencio && foco && foco.focus) try { foco.focus(); } catch (e) { }
  }
  function alTecla(e) {
    if ($('.dlg-fondo')) return;
    if (S.detalle) {
      if (e.key === 'Escape') { e.preventDefault(); cerrarDetalle(); } else if (e.key === 'ArrowRight') { e.preventDefault(); navegar(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); navegar(-1); }
      return;
    }
    if (e.key === '/' && S.modo === 'consulta' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { const q = $('#q'); if (q) { e.preventDefault(); q.focus(); q.select(); } }
  }

  /* ---------- Eventos ---------- */
  const buscarLuego = K.debounce(() => { pintarResultados(); const q = $('#q'); }, 120);
  function alEntrada(e) {
    const t = e.target;
    if (t.id === 'q') { S.q = t.value; buscarLuego(); }
    else if (t.id === 'lib-q') { S.filtroLib = t.value; pintarLibreria(); }
  }
  function alCambio(e) {
    const t = e.target;
    if (t.matches('[data-f]')) { const s = S.f[t.dataset.f]; t.checked ? s.add(t.value) : s.delete(t.value); pintarResultados(); }
    else if (t.matches('[data-sel]')) { t.checked ? S.sel.add(t.dataset.sel) : S.sel.delete(t.dataset.sel); pintarSel(); }
    else if (t.id === 'orden') { S.orden = t.value; pintarResultados(); }
    else if (t.id === 'lib-avisos') { S.soloAvisos = t.checked; pintarLibreria(); }
    else if (t.id === 'in-archivos' || t.id === 'in-carpeta') { cargarArchivos(Array.from(t.files)); t.value = ''; }
  }
  async function alClic(e) {
    if (e.target.closest('.sel')) { e.stopPropagation(); return; }
    const t = e.target.closest('[data-acc],[data-modo],[data-lang],[data-vista],.tarjeta,.fila-cv'); if (!t) return;
    if (t.matches('.tarjeta,.fila-cv')) { abrirDetalle(t.dataset.id); return; }
    if (t.dataset.modo) { S.modo = t.dataset.modo; pintar(); return; }
    if (t.dataset.lang) { S.lang = t.dataset.lang; pintar(); return; }
    if (t.dataset.vista) { S.vista = t.dataset.vista; pintarResultados(); return; }
    const a = t.dataset.acc;
    $$('.menu-lista').forEach(m => { if (a !== 'menu-export') m.hidden = true; });
    switch (a) {
      case 'tema': K.tema.alternar(); break;
      case 'elegir-archivos': $('#in-archivos').click(); break;
      case 'elegir-carpeta': $('#in-carpeta').click(); break;
      case 'cerrar-informe': S.informe = null; pintarGestion(); break;
      case 'menu-export': { const m = $('#menu-export'); m.hidden = !m.hidden; break; }
      case 'publicar': publicar(); break;
      case 'exp-json': K.descargar(JSON.stringify(datosLimpios(), null, 1), 'catalogo-cvs_' + K.hoy() + '.json', 'application/json;charset=utf-8'); break;
      case 'exp-csv': K.descargar(csv(S.cvs), 'cvs_' + K.hoy() + '.csv', 'text/csv;charset=utf-8'); break;
      case 'copiar-pend': try { await navigator.clipboard.writeText(pendientes()); K.toast('Lista de pendientes copiada.', 'ok'); } catch (er) { K.toast('No se pudo copiar al portapapeles.', 'error'); } break;
      case 'vaciar': if (await K.confirmar('Vaciar la biblioteca', 'Se quitarán los <b>' + S.cvs.length + ' CVs</b> cargados en este navegador. Los archivos originales no se tocan.', 'Vaciar', true)) { S.cvs = []; S.sel.clear(); S.informe = null; await guardarBiblioteca(); pintar(); } break;
      case 'quitar': { const c = porId(t.dataset.id); if (c && await K.confirmar('Quitar CV', 'Se quitará <b>' + esc(c.data.nombre) + '</b> de la biblioteca (el archivo original no se toca).', 'Quitar', true)) { S.cvs = S.cvs.filter(x => x !== c); S.sel.delete(c.id); await guardarBiblioteca(); pintar(); } break; }
      case 'ver': abrirDetalle(t.dataset.id); break;
      case 'limpiar': FACETAS.forEach(([k]) => S.f[k].clear()); pintarResultados(); break;
      case 'limpiar-todo': FACETAS.forEach(([k]) => S.f[k].clear()); S.q = ''; { const q = $('#q'); if (q) q.value = ''; } pintarResultados(); break;
      case 'quita-f': S.f[t.dataset.f].delete(t.dataset.v); pintarResultados(); break;
      case 'sel-limpia': S.sel.clear(); $$('[data-sel]').forEach(c => c.checked = false); pintarSel(); break;
      case 'exp-sel': K.descargar(JSON.stringify(datosLimpios(S.cvs.filter(x => S.sel.has(x.id))), null, 1), 'seleccion-cvs_' + K.hoy() + '.json', 'application/json;charset=utf-8'); break;
      case 'exp-sel-csv': K.descargar(csv(S.cvs.filter(x => S.sel.has(x.id))), 'seleccion-cvs_' + K.hoy() + '.csv', 'text/csv;charset=utf-8'); break;
    }
  }

  window.__CVHUB = { S, cargarArchivos, derivar, entrada }; // utilidades para pruebas
  arrancar();
}());
