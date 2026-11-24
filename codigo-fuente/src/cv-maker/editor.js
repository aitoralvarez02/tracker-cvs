/* ===== CV Maker — editor de un CV (plantilla de edición) ===== */
(function () {
  'use strict';
  const K = CVK, $ = K.$, $$ = K.$$, esc = K.esc;
  const S = {
    data: K.emptyCV(), lang: 'es', modo: 'editar', sucio: false, guardadoEn: null, nombreArchivo: '', asa: null,
    abierto: { persona: true, visor: false, resumen: false, formacion: false, exp: false }, ctl: null
  };
  const LANGUAGED = ['cargo', 'empresa', 'insights', 'formacion', 'parrafo_azul', 'cuerpo'];
  const raiz = k => (S.lang === 'en' && LANGUAGED.includes(k)) ? S.data.en : S.data;
  const get = k => raiz(k)[k];
  const set = (k, v) => { raiz(k)[k] = v; };
  const esEN = () => S.lang === 'en';
  const SECCIONES = [
    ['persona', 'Persona'], ['visor', 'Datos para el visor'], ['resumen', 'Resumen en viñetas'], ['formacion', 'Formación'], ['exp', 'Experiencia']
  ];
  const CAMPO_A_SEC = { nombre: 'persona', cargo: 'persona', empresa: 'persona', foto: 'persona', links: 'persona', formacion: 'formacion', exp: 'exp' };

  /* ---------- Arranque ---------- */
  function leerDatosIncrustados() {
    try { const t = $('#cv-data').textContent.trim(); if (t && t !== '{}') return K.normalize(JSON.parse(t)); } catch (e) { console.warn('Datos incrustados no válidos', e); }
    return null;
  }
  function arrancar() {
    K.tema.init();
    const d = leerDatosIncrustados();
    if (d) { S.data = d; S.modo = K.vacioTotal(d) ? 'editar' : 'ver'; }
    montar();
    if (!d || K.vacioTotal(S.data)) recuperarBorrador();
    addEventListener('beforeunload', e => { if (S.sucio) { e.preventDefault(); e.returnValue = ''; } });
    addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); guardar(); } });
    addEventListener('dragover', e => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault(); });
    addEventListener('drop', alSoltar);
  }

  /* ---------- Estructura ---------- */
  function montar() {
    $('#app').innerHTML =
      '<header class="top">' +
      '<div class="marca"><img src="' + (window.__LOGO__ || '') + '" alt="KPMG"><b>CV Maker</b><small>Editor de CV</small></div>' +
      '<div class="seg" role="group" aria-label="Modo"><button data-modo="editar" aria-pressed="true">✎ Editar</button><button data-modo="ver" aria-pressed="false">▤ Ver CV</button></div>' +
      '<div class="seg" role="group" aria-label="Idioma del CV"><button data-lang="es" aria-pressed="true">ES</button><button data-lang="en" aria-pressed="false">EN</button></div>' +
      '<div class="esp"></div>' +
      '<button class="btn" id="btn-comp" title="Qué falta por completar"></button>' +
      '<span class="estado" id="estado" data-e=""><i></i><span></span></span>' +
      '<div class="menu"><button class="btn" id="btn-copilot">Copilot ▾</button><div class="menu-lista" id="menu-copilot" hidden>' +
      '<button data-acc="importar-copilot">Importar mi CV con Copilot<small>Pega tu CV de Word/PowerPoint y rellena todo</small></button>' +
      '<button data-acc="traducir-copilot">Traducir al inglés con Copilot<small>Genera la versión EN a partir del español</small></button></div></div>' +
      '<button class="btn" data-acc="abrir">Abrir CV</button>' +
      '<button class="btn btn--prim" data-acc="guardar" title="Ctrl+S">Guardar</button>' +
      '<div class="menu"><button class="btn btn--icono" id="btn-mas" aria-label="Más opciones">⋯</button><div class="menu-lista" id="menu-mas" hidden>' +
      '<button data-acc="guardar-como">Guardar como…<small>Elegir otra carpeta o nombre</small></button>' +
      '<button data-acc="descargar">Descargar una copia</button>' +
      '<button data-acc="imprimir">Imprimir / guardar en PDF</button>' +
      '<button data-acc="json">Exportar datos (JSON)<small>Mismo formato que el catálogo de HTML Maker</small></button><hr>' +
      '<button data-acc="tema">Cambiar modo día / noche</button><button data-acc="nuevo">Nuevo CV en blanco</button></div></div>' +
      '</header>' +
      '<div class="cuerpo"><aside class="panel" id="panel" aria-label="Formulario del CV"></aside>' +
      '<main class="vista" id="vista"><div class="vista-caja" id="cvbox"></div>' +
      '<div class="ajuste" id="ajuste" hidden></div><div class="flot" id="flot" hidden></div><div class="bienv" id="bienv" hidden></div></main></div>';
    S.ctl = K.montarCV($('#cvbox'), S.data, S.lang, { editable: true, onFit: pintarAjuste });
    S.ctl.cv.addEventListener('click', alClicVista);
    $('#app').addEventListener('click', alClic);
    $('#panel').addEventListener('input', alEntrada);
    $('#panel').addEventListener('change', alEntrada);
    $('#panel').addEventListener('focusin', e => { const c = e.target.closest('[data-campo]'); S.ctl.foco(c ? c.dataset.campo : null); });
    $('#panel').addEventListener('focusout', () => S.ctl.foco(null));
    D_cierraMenus();
    aplicarModo(); pintarPanel(); pintarEstado(); pintarBienvenida();
  }
  function D_cierraMenus() {
    document.addEventListener('click', e => { if (!e.target.closest('.menu')) $$('.menu-lista').forEach(m => m.hidden = true); });
  }

  /* ---------- Panel de formulario ---------- */
  function secEstado(sec) {
    const c = K.comprobar(S.data).filter(x => x.sec === sec && (x.req || !x.ok) && !(x.soloSiHay && x.ok));
    const pend = c.filter(x => !x.ok).length;
    return pend ? '<span class="sec-est sec-est--pend" title="' + pend + ' pendiente(s)">' + pend + '</span>' : '<span class="sec-est sec-est--ok" title="Completo">✓</span>';
  }
  const ph = (k) => esEN() ? (typeof S.data[k] === 'string' ? S.data[k] : '') : '';
  function campoTexto(k, titulo, o) {
    o = o || {}; const v = k.startsWith('meta.') ? S.data.meta[k.slice(5)] : get(k);
    const lista = o.lista ? ' list="' + o.lista + '"' : '';
    return '<label class="campo" data-campo="' + (o.campo || '') + '"><span>' + titulo + (o.req ? '<b class="req">*</b>' : '') + (o.nota ? '<em>' + o.nota + '</em>' : '') + '</span>' +
      '<input type="text" data-k="' + k + '" value="' + esc(v) + '"' + lista + ' placeholder="' + esc(o.ph != null ? o.ph : ph(k)) + '" autocomplete="off" spellcheck="' + (o.spell === false ? 'false' : 'true') + '"></label>';
  }
  function listaHtml(k, campo, ph1, anadir) {
    const arr = get(k); const en = esEN(), es = S.data[k];
    const filas = arr.map((v, i) => '<div class="fila" data-i="' + i + '"><input type="text" data-lista="' + k + '" value="' + esc(v) + '" placeholder="' + esc(ph1) + '" spellcheck="true">' +
      '<button class="btn btn--sm btn--icono btn--ghost" data-acc="sube" data-k="' + k + '" data-i="' + i + '" title="Subir" aria-label="Subir">↑</button>' +
      '<button class="btn btn--sm btn--icono btn--ghost" data-acc="baja" data-k="' + k + '" data-i="' + i + '" title="Bajar" aria-label="Bajar">↓</button>' +
      '<button class="btn btn--sm btn--icono btn--ghost" data-acc="quita" data-k="' + k + '" data-i="' + i + '" title="Quitar" aria-label="Quitar">✕</button></div>').join('');
    const copiar = (en && !arr.length && es.length) ? '<button class="btn btn--sm" data-acc="copiar-es" data-k="' + k + '">Copiar del español para traducir</button>' : '';
    return '<div data-campo="' + campo + '">' + filas + '<div class="fila-acc"><button class="btn btn--sm" data-acc="anade" data-k="' + k + '">+ ' + anadir + '</button>' + copiar + '</div></div>';
  }
  function cuerpoHtml() {
    const c = get('cuerpo');
    const bl = c.map((b, i) => {
      const lista = b.tipo === 'lista';
      return '<div class="bloque" data-i="' + i + '"><div class="bloque-cab"><select data-b="tipo" aria-label="Tipo de bloque">' +
        '<option value="parrafo"' + (b.tipo === 'parrafo' || b.tipo === 'bullet' ? ' selected' : '') + '>Párrafo</option>' +
        '<option value="intro_lista"' + (b.tipo === 'intro_lista' ? ' selected' : '') + '>Frase que introduce una lista (negrita)</option>' +
        '<option value="lista"' + (lista ? ' selected' : '') + '>Lista de viñetas</option></select>' +
        '<span class="bloque-btn"><button class="btn btn--sm btn--icono btn--ghost" data-acc="negrita" title="Negrita (selecciona texto)" aria-label="Negrita"><b>B</b></button>' +
        '<button class="btn btn--sm btn--icono btn--ghost" data-acc="sube-b" data-i="' + i + '" aria-label="Subir">↑</button>' +
        '<button class="btn btn--sm btn--icono btn--ghost" data-acc="baja-b" data-i="' + i + '" aria-label="Bajar">↓</button>' +
        '<button class="btn btn--sm btn--icono btn--ghost" data-acc="quita-b" data-i="' + i + '" aria-label="Quitar">✕</button></span></div>' +
        '<textarea data-b="texto" rows="' + (lista ? 6 : 3) + '" placeholder="' + (lista ? 'Una viñeta por línea. Ej.: 2022-2024 — Empresa: rol y logros' : 'Escribe el párrafo. Usa **texto** para negrita.') + '" spellcheck="true">' + esc(lista ? (b.items || []).join('\n') : (b.texto || '')) + '</textarea></div>';
    }).join('');
    return bl + '<div class="fila-acc"><button class="btn btn--sm" data-acc="anade-b" data-t="parrafo">+ Párrafo</button><button class="btn btn--sm" data-acc="anade-b" data-t="lista">+ Lista de viñetas</button>' +
      ((esEN() && !c.length && S.data.cuerpo.length) ? '<button class="btn btn--sm" data-acc="copiar-es" data-k="cuerpo">Copiar del español</button>' : '') + '</div>';
  }
  function areasHtml() {
    const a = S.data.meta.areas;
    return '<div class="campo" data-campo=""><span>Áreas de especialización<em>Enter para añadir</em></span><div class="etq" id="etq">' +
      a.map((x, i) => '<span class="chip">' + esc(x) + '<button data-acc="quita-area" data-i="' + i + '" aria-label="Quitar ' + esc(x) + '">×</button></span>').join('') +
      '<input type="text" id="area-in" list="dl-areas" placeholder="' + (a.length ? 'Añadir otra…' : 'Ej.: Control interno / SOx') + '" autocomplete="off"></div>' +
      '<p class="ayuda">Escribe libremente o elige una sugerida. Sirven para encontrarte en el visor.</p></div>';
  }
  function pintarPanel() {
    const p = $('#panel'); const scroll = p.scrollTop; const en = esEN(); const d = S.data;
    const dls = '<datalist id="dl-cat">' + K.CATEGORIAS.map(x => '<option value="' + esc(x) + '">').join('') + '</datalist><datalist id="dl-ofi">' + K.OFICINAS.map(x => '<option value="' + esc(x) + '">').join('') + '</datalist><datalist id="dl-areas">' + K.AREAS.map(x => '<option value="' + esc(x) + '">').join('') + '</datalist>';
    const foto = K.fotoOk(d.foto);
    const cuerpos = {
      persona:
        campoTexto('nombre', 'Nombre y apellidos', { req: true, campo: 'nombre', ph: 'Ej.: Amadeo Valcarce Martín', nota: en ? 'igual en ES y EN' : '' }) +
        campoTexto('cargo', 'Cargo', { req: true, campo: 'cargo', ph: en ? (d.cargo || 'Position') : 'Ej.: Manager de Gobierno, Riesgo & Cumplimiento' }) +
        campoTexto('empresa', 'Empresa / zona', { req: true, campo: 'empresa', ph: en ? (d.empresa || '') : 'KPMG España' }) +
        '<div class="campo foto-campo" data-campo="foto"><span>Foto<b class="req">*</b></span><div class="foto-fila"><div class="foto-prev"><img src="' + (foto ? d.foto : K.FOTO_GENERICA) + '" alt=""></div><div>' +
        '<button class="btn btn--sm" data-acc="foto">' + (foto ? 'Cambiar foto' : 'Subir foto') + '</button> ' + (foto ? '<button class="btn btn--sm btn--ghost" data-acc="foto-quita">Quitar</button>' : '') +
        '<p class="ayuda">También puedes arrastrar una imagen a la página. Se recorta en vertical (92×108) automáticamente.</p></div></div><input type="file" id="foto-in" accept="image/*" hidden></div>' +
        campoTexto('linkedin', 'LinkedIn', { campo: 'links', ph: 'https://www.linkedin.com/in/…', spell: false, nota: en ? 'igual en ES y EN' : 'opcional' }) +
        campoTexto('tendencias', 'KPMG Tendencias', { campo: 'links', ph: 'https://…', spell: false, nota: 'opcional' }),
      visor:
        '<p class="ayuda ayuda--caja">Solo sirven para filtrar y buscar en el <b>visor de CVs</b>; no aparecen en el CV.</p>' +
        campoTexto('meta.categoria', 'Categoría profesional', { req: true, lista: 'dl-cat', ph: 'Ej.: Manager' }) +
        campoTexto('meta.oficina', 'Oficina / zona geográfica', { req: true, lista: 'dl-ofi', ph: 'Ej.: Madrid' }) + areasHtml(),
      resumen:
        '<p class="ayuda ayuda--caja">3-4 frases cortas que resumen tu perfil. Salen en las tarjetas del visor.</p>' + listaHtml('insights', '', 'Ej.: Más de 10 años de experiencia en control interno', 'Añadir viñeta'),
      formacion:
        listaHtml('formacion', 'formacion', 'Ej.: Licenciatura en ADE - Universidad Complutense', 'Añadir formación'),
      exp:
        '<div data-campo="exp"><label class="campo"><span>Párrafo de presentación<b class="req">*</b><em>en azul y negrita</em></span><textarea data-k="parrafo_azul" rows="4" placeholder="' + esc(en ? (d.parrafo_azul || '') : 'Una o dos frases que presentan tu perfil profesional.') + '" spellcheck="true">' + esc(get('parrafo_azul')) + '</textarea></label>' + cuerpoHtml() + '</div>'
    };
    p.innerHTML =
      '<div class="panel-cab">' + (en ? '<div class="aviso-en">Editas la versión en <b>inglés</b>. Los campos vacíos se muestran en español.</div>' : '') + '</div>' + dls +
      SECCIONES.map((s, n) => '<section class="sec' + (S.abierto[s[0]] ? ' sec--abierta' : '') + '" data-sec="' + s[0] + '">' +
        '<button class="sec-cab" data-acc="sec" data-sec="' + s[0] + '" aria-expanded="' + !!S.abierto[s[0]] + '"><span class="sec-n">' + (n + 1) + '</span><b>' + s[1] + '</b>' + secEstado(s[0]) + '<span class="sec-f">▾</span></button>' +
        '<div class="sec-cuerpo">' + cuerpos[s[0]] + '</div></section>').join('');
    p.scrollTop = scroll;
  }

  /* ---------- Eventos del formulario ---------- */
  const refrescarLuego = K.debounce(() => { S.ctl.pintar(S.data, S.lang); pintarBienvenida(); }, 70);
  const borradorLuego = K.debounce(guardarBorrador, 700);
  function cambio() { S.sucio = true; refrescarLuego(); borradorLuego(); pintarEstado(); actualizarBadgesSec(); }
  function actualizarBadgesSec() {
    SECCIONES.forEach(s => { const cab = $('.sec-cab[data-sec="' + s[0] + '"]'); if (!cab) return; const old = $('.sec-est', cab); const nuevo = document.createElement('span'); nuevo.innerHTML = secEstado(s[0]); old.replaceWith(nuevo.firstChild); });
  }
  function alEntrada(e) {
    const t = e.target;
    if (t.matches('[data-k]')) {
      const k = t.dataset.k;
      if (k.startsWith('meta.')) S.data.meta[k.slice(5)] = t.value; else set(k, t.value);
      cambio();
    } else if (t.matches('[data-lista]')) {
      const i = +t.closest('.fila').dataset.i; get(t.dataset.lista)[i] = t.value; cambio();
    } else if (t.matches('[data-b]')) {
      const i = +t.closest('.bloque').dataset.i, b = get('cuerpo')[i];
      if (t.dataset.b === 'tipo') {
        if (e.type !== 'change') return;
        const ta = $('textarea', t.closest('.bloque')).value; const nuevo = t.value;
        if (nuevo === 'lista') get('cuerpo')[i] = { tipo: 'lista', items: ta ? ta.split('\n') : [''] };
        else get('cuerpo')[i] = { tipo: nuevo, texto: b.tipo === 'lista' ? (b.items || []).join(' ') : ta };
        pintarPanel(); cambio();
      } else {
        if (b.tipo === 'lista') b.items = t.value.split('\n'); else b.texto = t.value;
        cambio();
      }
    }
  }
  function alClic(e) {
    const t = e.target.closest('[data-acc],[data-modo],[data-lang],#btn-comp,#btn-copilot,#btn-mas'); if (!t) return;
    if (t.id === 'btn-copilot') { $('#menu-copilot').hidden = !$('#menu-copilot').hidden; $('#menu-mas').hidden = true; return; }
    if (t.id === 'btn-mas') { $('#menu-mas').hidden = !$('#menu-mas').hidden; $('#menu-copilot').hidden = true; return; }
    if (t.id === 'btn-comp') return dialogoPendientes();
    $$('.menu-lista').forEach(m => m.hidden = true);
    if (t.dataset.modo) { S.modo = t.dataset.modo; aplicarModo(); return; }
    if (t.dataset.lang) { S.lang = t.dataset.lang; aplicarModo(); pintarPanel(); S.ctl.pintar(S.data, S.lang); return; }
    const a = t.dataset.acc, k = t.dataset.k, i = +t.dataset.i;
    const mover = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return false;[arr[i], arr[j]] = [arr[j], arr[i]]; return true; };
    const nuevaFila = (k) => { const f = $$('[data-lista="' + k + '"]'); const u = f[f.length - 1]; if (u) u.focus(); };
    switch (a) {
      case 'sec': S.abierto[t.dataset.sec] = !S.abierto[t.dataset.sec]; pintarPanel(); break;
      case 'anade': get(k).push(''); pintarPanel(); nuevaFila(k); cambio(); break;
      case 'quita': get(k).splice(i, 1); pintarPanel(); cambio(); break;
      case 'sube': if (mover(get(k), i, -1)) { pintarPanel(); cambio(); } break;
      case 'baja': if (mover(get(k), i, 1)) { pintarPanel(); cambio(); } break;
      case 'copiar-es': set(k, JSON.parse(JSON.stringify(S.data[k]))); pintarPanel(); cambio(); break;
      case 'anade-b': get('cuerpo').push(t.dataset.t === 'lista' ? { tipo: 'lista', items: [''] } : { tipo: 'parrafo', texto: '' }); pintarPanel(); { const x = $$('.bloque textarea'); if (x.length) x[x.length - 1].focus(); } cambio(); break;
      case 'quita-b': get('cuerpo').splice(i, 1); pintarPanel(); cambio(); break;
      case 'sube-b': if (mover(get('cuerpo'), i, -1)) { pintarPanel(); cambio(); } break;
      case 'baja-b': if (mover(get('cuerpo'), i, 1)) { pintarPanel(); cambio(); } break;
      case 'negrita': negrita(t.closest('.bloque')); break;
      case 'quita-area': S.data.meta.areas.splice(i, 1); pintarPanel(); cambio(); break;
      case 'foto': $('#foto-in').click(); break;
      case 'foto-quita': S.data.foto = ''; pintarPanel(); cambio(); break;
      case 'guardar': guardar(); break;
      case 'guardar-como': guardar(true); break;
      case 'descargar': K.descargar(buildHtml(), nombreSugerido()); toast('Copia descargada.'); break;
      case 'imprimir': K.imprimirCV(S.data, S.lang); break;
      case 'json': K.descargar(JSON.stringify(K.clean(S.data), null, 1), nombreSugerido().replace(/\.html$/, '.json'), 'application/json;charset=utf-8'); break;
      case 'abrir': abrirArchivo(); break;
      case 'tema': K.tema.alternar(); break;
      case 'nuevo': nuevoCV(); break;
      case 'importar-copilot': dialogoCopilot('importar'); break;
      case 'traducir-copilot': dialogoCopilot('traducir'); break;
      case 'empezar': S.abierto.persona = true; pintarPanel(); { const n = $('[data-k="nombre"]'); if (n) n.focus(); } break;
      case 'ver-editar': S.modo = 'editar'; aplicarModo(); break;
    }
    if (a === 'foto') { const fi = $('#foto-in'); fi.onchange = () => { if (fi.files[0]) ponerFoto(fi.files[0]); fi.value = ''; }; }
  }
  const toast = K.toast;
  function negrita(bloque) {
    const ta = $('textarea', bloque); ta.focus();
    const a = ta.selectionStart, b = ta.selectionEnd, v = ta.value;
    ta.value = v.slice(0, a) + '**' + v.slice(a, b) + '**' + v.slice(b);
    ta.setSelectionRange(a + 2, b + 2); ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  document.addEventListener('keydown', e => {
    if (e.target && e.target.id === 'area-in' && (e.key === 'Enter' || e.key === ',')) {
      e.preventDefault(); const v = e.target.value.trim().replace(/,$/, ''); if (!v) return;
      if (!S.data.meta.areas.includes(v)) S.data.meta.areas.push(v);
      pintarPanel(); $('#area-in').focus(); cambio();
    }
    if (e.target && e.target.id === 'area-in' && e.key === 'Backspace' && !e.target.value && S.data.meta.areas.length) { S.data.meta.areas.pop(); pintarPanel(); $('#area-in').focus(); cambio(); }
  });
  async function ponerFoto(file) {
    try { S.data.foto = await K.procesarFoto(file); pintarPanel(); cambio(); toast('Foto añadida.', 'ok'); } catch (err) { toast(err.message, 'error'); }
  }
  function alSoltar(e) {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (!f) return;
    e.preventDefault();
    if (/^image\//.test(f.type)) { S.modo = 'editar'; aplicarModo(); ponerFoto(f); }
    else if (/\.(html?|json)$/i.test(f.name)) K.leerTexto(f).then(t => cargarArchivo(f.name, t, null));
  }
  function alClicVista(e) {
    if (S.modo !== 'editar') return;
    const el = e.target.closest('[data-campo]'); if (!el || e.target.closest('a')) return;
    const c = el.dataset.campo; const sec = CAMPO_A_SEC[c]; if (!sec) return;
    S.abierto[sec] = true; pintarPanel();
    const dest = $('#panel [data-campo="' + c + '"] input, #panel [data-campo="' + c + '"] textarea') || $('#panel [data-campo="' + c + '"] button');
    if (dest) { dest.focus(); dest.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }

  /* ---------- Modo, estado y avisos ---------- */
  function aplicarModo() {
    const ver = S.modo === 'ver';
    $('#app').dataset.modo = S.modo;
    $$('[data-modo]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.modo === S.modo)));
    $$('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === S.lang)));
    $('#flot').hidden = !ver;
    if (ver) $('#flot').innerHTML = '<button class="btn btn--prim" data-acc="ver-editar">✎ Editar este CV</button><button class="btn" data-acc="imprimir">Imprimir / PDF</button>';
    S.ctl.cv.classList.toggle('cv-editable', !ver);
    setTimeout(() => { S.ctl.escalar(); }, 0);
    pintarAjuste(S.ctl.info);
  }
  function pintarAjuste(info) {
    const a = $('#ajuste'); if (!a || !info) return;
    a.hidden = false;
    if (!info.ok) { a.className = 'ajuste ajuste--mal'; a.textContent = 'La experiencia no cabe en la página ni con letra de 12 px: acórtala.'; return; }
    a.className = 'ajuste'; a.textContent = 'Experiencia: ' + (info.cols === 1 ? '1 columna' : '2 columnas') + ' · letra ' + String(info.fs).replace('.', ',') + ' px' + (info.fs < 14 ? ' (texto largo)' : '');
    if (info.fs < 14) a.classList.add('ajuste--aviso');
  }
  function pintarEstado() {
    const e = $('#estado'), c = K.completitud(S.data), b = $('#btn-comp');
    const hora = S.guardadoEn ? S.guardadoEn.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
    e.dataset.e = S.sucio ? '' : (S.guardadoEn ? 'ok' : '');
    $('span', e).textContent = S.sucio ? 'Sin guardar' : (S.guardadoEn ? 'Guardado ' + hora : 'Sin cambios');
    e.title = S.nombreArchivo || '';
    b.innerHTML = '<span class="prog"><i style="width:' + Math.round(100 * c.hechos / c.total) + '%"></i></span> ' + c.hechos + '/' + c.total + ' completado';
    document.title = (S.data.nombre ? 'CV · ' + S.data.nombre : 'CV Maker') + ' | KPMG';
  }
  function pintarBienvenida() {
    const b = $('#bienv'); if (!b) return;
    const v = K.vacioTotal(S.data) && S.modo === 'editar';
    b.hidden = !v; if (!v) return;
    b.innerHTML = '<div class="bienv-caja"><h2>Crea tu CV</h2><p>Se genera con la misma plantilla que «Ver CV completo» de HTML Maker. Elige cómo empezar:</p>' +
      '<button class="bienv-op bienv-op--rec" data-acc="importar-copilot"><b>Importar con Copilot</b><span>La opción más rápida si tu CV está en Word o PowerPoint. Copias un prompt, pegas la respuesta y listo.</span></button>' +
      '<button class="bienv-op" data-acc="abrir"><b>Abrir un CV que ya tengo</b><span>Un HTML generado antes con esta herramienta, o el JSON de HTML Maker.</span></button>' +
      '<button class="bienv-op" data-acc="empezar"><b>Empezar desde cero</b><span>Rellena el formulario de la izquierda; el CV se actualiza al instante.</span></button></div>';
  }
  function dialogoPendientes() {
    const c = K.completitud(S.data); const cu = document.createElement('div');
    cu.innerHTML = '<ul class="lista-check">' + c.checks.filter(x => !(x.soloSiHay && x.ok)).map(x => '<li class="' + (x.ok ? 'ok' : 'pend') + '"><span>' + (x.ok ? '✓' : '○') + '</span>' + x.txt + (x.req ? '' : ' <em>(recomendado)</em>') + (x.ok ? '' : '<button class="btn btn--sm" data-ir="' + x.sec + '" data-l="' + (x.lang || '') + '">Ir</button>') + '</li>').join('') + '</ul>';
    const dlg = K.dialogo({ titulo: 'Qué falta por completar (' + c.hechos + '/' + c.total + ')', cuerpo: cu, ancho: 520, botones: [{ texto: 'Cerrar', clase: 'btn--prim' }] });
    cu.addEventListener('click', e => {
      const b = e.target.closest('[data-ir]'); if (!b) return;
      dlg.cerrar(); S.modo = 'editar'; if (b.dataset.l) S.lang = b.dataset.l; aplicarModo(); S.abierto[b.dataset.ir] = true; pintarPanel(); S.ctl.pintar(S.data, S.lang);
      const s = $('.sec[data-sec="' + b.dataset.ir + '"]'); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ---------- Guardado ---------- */
  function nombreSugerido() {
    const partes = (S.data.nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^A-Za-z0-9]+/).filter(Boolean).map(p => p[0].toUpperCase() + p.slice(1));
    return 'CV_' + (partes.join('_') || 'Nuevo') + '.html';
  }
  function buildHtml() {
    const c = document.documentElement.cloneNode(true);
    c.querySelectorAll('[data-dinamico]').forEach(n => { n.innerHTML = ''; });
    c.removeAttribute('data-tema'); c.removeAttribute('style'); const b = c.querySelector('body'); b.removeAttribute('class'); b.removeAttribute('style');
    c.querySelector('#cv-data').textContent = '\n' + JSON.stringify(K.clean(S.data), null, 1).replace(/</g, '\\u003c') + '\n';
    c.querySelector('title').textContent = (S.data.nombre ? 'CV · ' + S.data.nombre : 'CV Maker') + ' | KPMG';
    return '<!DOCTYPE html>\n' + c.outerHTML;
  }
  async function guardar(como) {
    if (!S.data.nombre.trim()) { toast('Escribe tu nombre antes de guardar.', 'error'); S.modo = 'editar'; aplicarModo(); S.abierto.persona = true; pintarPanel(); const n = $('[data-k="nombre"]'); if (n) n.focus(); return; }
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    S.data.meta.actualizado = K.hoy();
    const malos = [['linkedin', 'LinkedIn'], ['tendencias', 'KPMG Tendencias']].filter(([k]) => S.data[k].trim() && !K.urlOk(S.data[k].trim()));
    if (malos.length) { malos.forEach(([k]) => { S.data[k] = ''; }); pintarPanel(); S.ctl.pintar(S.data, S.lang); toast('El enlace de ' + malos.map(m => m[1]).join(' y ') + ' no es válido (debe empezar por https:// y no llevar espacios ni comillas): se ha quitado.', 'error'); }
    const nombre = nombreSugerido();
    const r = await K.guardar(nombre, buildHtml(), { key: 'cv-maker', id: 'cv-maker', asa: como ? null : S.asa });
    if (!r.ok) return;
    S.sucio = false; S.guardadoEn = new Date(); S.asa = r.asa || null; S.nombreArchivo = r.nombre; try { localStorage.removeItem('cvmaker-borrador'); } catch (e) { }
    const pend = K.completitud(S.data); pintarEstado();
    if (r.via === 'archivo') toast('Guardado en «' + r.nombre + '»' + (pend.hechos < pend.total ? ' · faltan ' + (pend.total - pend.hechos) + ' campos' : ''), 'ok');
    else toast('Descargado «' + r.nombre + '». Guárdalo en la carpeta compartida del equipo.', 'ok');
  }
  function guardarBorrador() { try { if (S.sucio && !K.vacioTotal(S.data)) localStorage.setItem('cvmaker-borrador', JSON.stringify({ t: Date.now(), data: S.data })); } catch (e) { } }
  function recuperarBorrador() {
    let b = null; try { b = JSON.parse(localStorage.getItem('cvmaker-borrador') || 'null'); } catch (e) { }
    if (!b || !b.data) return;
    const dlg = K.dialogo({ titulo: 'Hay un borrador sin guardar', ancho: 460,
      cuerpo: '<p class="dlg-p">Quedó un borrador' + (b.data.nombre ? ' de <b>' + esc(b.data.nombre) + '</b>' : '') + ' sin guardar (' + new Date(b.t).toLocaleString('es-ES') + '). ¿Quieres recuperarlo?</p>',
      botones: [{ texto: 'Descartar', clase: 'btn--ghost', cb() { try { localStorage.removeItem('cvmaker-borrador'); } catch (e) { } } },
      { texto: 'Recuperar', clase: 'btn--prim', cb() { S.data = K.normalize(b.data); S.sucio = true; refrescarTodo(); } }] });
    return dlg;
  }
  function refrescarTodo() { pintarPanel(); S.ctl.pintar(S.data, S.lang); pintarEstado(); pintarBienvenida(); }

  /* ---------- Abrir / nuevo / cargar ---------- */
  async function abrirArchivo() {
    const r = await K.abrir({ id: 'cv-maker-abrir' }); if (!r) return;
    cargarArchivo(r.name, r.text, r.asa);
  }
  async function cargarArchivo(nombre, texto, asa) {
    if (S.sucio && !(await K.confirmar('Cambios sin guardar', 'Si abres otro CV se perderán los cambios actuales. ¿Continuar?', 'Abrir', true))) return;
    try {
      const l = K.leerCVs(nombre, texto);
      S.data = l[0]; S.asa = (asa && /\.html?$/i.test(nombre)) ? asa : null; S.nombreArchivo = nombre; S.sucio = false; S.guardadoEn = null;
      S.modo = 'ver'; aplicarModo(); refrescarTodo();
      toast(l.length > 1 ? 'El archivo tenía ' + l.length + ' CVs; se ha abierto el primero.' : 'CV abierto: ' + (S.data.nombre || nombre), 'ok');
    } catch (err) { toast('No se pudo abrir «' + nombre + '»: ' + err.message, 'error'); }
  }
  async function nuevoCV() {
    if (S.sucio && !(await K.confirmar('Cambios sin guardar', 'Se perderán los cambios actuales. ¿Crear un CV en blanco?', 'Crear en blanco', true))) return;
    S.data = K.emptyCV(); S.asa = null; S.sucio = false; S.guardadoEn = null; S.nombreArchivo = ''; S.modo = 'editar'; aplicarModo(); refrescarTodo();
  }

  /* ---------- Copilot: importar / traducir ---------- */
  const ESQUEMA = '{\n  "nombre": "Nombre y apellidos",\n  "cargo": "Cargo actual",\n  "empresa": "KPMG España",\n  "linkedin": "",\n  "tendencias": "",\n  "insights": ["3-4 frases cortas que resumen el perfil"],\n  "formacion": ["Titulación - Institución", "Certificaciones o membresías"],\n  "parrafo_azul": "1-2 frases que presentan el perfil",\n  "cuerpo": [\n    { "tipo": "parrafo", "texto": "**Frase en negrita que introduce una lista:**" },\n    { "tipo": "lista", "items": ["2019-2022 — Empresa: rol y logros", "…"] }\n  ],\n  "en": { "cargo": "", "empresa": "", "insights": [], "formacion": [], "parrafo_azul": "", "cuerpo": [] }\n}';
  const PROMPT_IMPORTAR = 'Convierte mi currículum en un JSON con el esquema de abajo. Responde SOLO con un bloque JSON válido, sin comentarios ni texto adicional.\n\nReglas:\n- No inventes datos. Si algo no aparece en mi CV, deja "" o [].\n- Mantén tal cual los nombres de clientes, empresas y titulaciones.\n- "cuerpo" es una lista de bloques: {"tipo":"parrafo","texto":"…"} para párrafos, {"tipo":"lista","items":["…"]} para viñetas. Usa **doble asterisco** solo en la frase que introduce una lista.\n- Escribe cada viñeta de experiencia en una línea, empezando por el periodo si lo hay (p. ej. "2019-2022 — Empresa: rol y logros").\n- "insights": 3-4 frases cortas (máx. 120 caracteres) que resuman el perfil.\n- Rellena primero la versión en español y, dentro de "en", la traducción al inglés profesional de cargo, empresa, insights, formacion, parrafo_azul y cuerpo.\n\nEsquema:\n' + ESQUEMA + '\n\nMi CV:\n[pega aquí el texto de tu CV]';
  function promptTraducir() {
    const d = K.clean(S.data), es = { cargo: d.cargo, empresa: d.empresa, insights: d.insights, formacion: d.formacion, parrafo_azul: d.parrafo_azul, cuerpo: d.cuerpo };
    return 'Traduce al inglés profesional el siguiente contenido de un CV. Responde SOLO con un bloque JSON válido con exactamente las mismas claves y la misma estructura (incluidos los "tipo" de "cuerpo"). Mantén los nombres propios de clientes, empresas y titulaciones, y respeta los **dobles asteriscos** de negrita.\n\n' + JSON.stringify(es, null, 1);
  }
  function dialogoCopilot(modo) {
    const imp = modo === 'importar'; const cu = document.createElement('div');
    cu.innerHTML = '<ol class="pasos"><li><b>Copia el prompt</b> y pégalo en Copilot (la versión de empresa).' + (imp ? ' Añade debajo el texto de tu CV.' : '') + '</li><li><b>Pega aquí la respuesta</b> de Copilot (el bloque JSON) y pulsa «' + (imp ? 'Importar' : 'Aplicar traducción') + '».</li></ol>' +
      '<div class="campo"><span>Prompt para Copilot<em><button class="btn btn--sm" id="cp-copiar">Copiar prompt</button></em></span><textarea id="cp-prompt" rows="6" readonly></textarea></div>' +
      '<div class="campo"><span>Respuesta de Copilot</span><textarea id="cp-resp" rows="7" placeholder="Pega aquí el JSON…" spellcheck="false"></textarea></div><p class="cp-error" id="cp-error" hidden></p>';
    $('#cp-prompt', cu).value = imp ? PROMPT_IMPORTAR : promptTraducir();
    $('#cp-copiar', cu).addEventListener('click', async () => { const t = $('#cp-prompt', cu); try { await navigator.clipboard.writeText(t.value); toast('Prompt copiado.', 'ok'); } catch (e) { t.select(); document.execCommand('copy'); toast('Prompt copiado.', 'ok'); } });
    K.dialogo({ titulo: imp ? 'Importar mi CV con Copilot' : 'Traducir al inglés con Copilot', cuerpo: cu, ancho: 680,
      botones: [{ texto: 'Cancelar', clase: 'btn--ghost' }, { texto: imp ? 'Importar' : 'Aplicar traducción', clase: 'btn--prim', async cb() {
        const err = $('#cp-error', cu); err.hidden = true;
        try {
          const obj = K.jsonDeTexto($('#cp-resp', cu).value);
          if (imp) {
            if (!K.vacioTotal(S.data) && !(await K.confirmar('Sustituir contenido', 'Los textos actuales se sustituirán por los importados (la foto y los datos del visor se conservan). ¿Continuar?', 'Sustituir', true))) return false;
            aplicarImportacion(obj);
          } else aplicarTraduccion(obj);
        } catch (e) { err.textContent = 'No se ha podido leer la respuesta: ' + e.message; err.hidden = false; return false; }
      } }] });
  }
  function aplicarImportacion(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || !('nombre' in obj || 'cuerpo' in obj)) throw new Error('El JSON no tiene el formato esperado (faltan «nombre» o «cuerpo»).');
    const imp = K.normalize(obj), act = S.data;
    S.data = K.normalize(Object.assign({}, act, imp, { foto: K.fotoOk(imp.foto) ? imp.foto : act.foto, meta: Object.assign({}, act.meta, imp.meta && imp.meta.categoria ? imp.meta : {}), en: Object.assign({}, act.en, obj.en || {}) }));
    S.sucio = true; S.modo = 'editar'; aplicarModo(); refrescarTodo();
    const c = K.completitud(S.data); toast('CV importado. Revisa el contenido (' + c.hechos + '/' + c.total + ' completado).', 'ok');
  }
  function aplicarTraduccion(obj) {
    const en = (obj && obj.en && typeof obj.en === 'object') ? obj.en : obj;
    if (!en || typeof en !== 'object' || !K.CAMPOS_EN.some(k => k in en)) throw new Error('No se encuentran campos traducidos (cargo, parrafo_azul, cuerpo…).');
    const n = K.normalize({ en }).en; K.CAMPOS_EN.forEach(k => { if (k in en) S.data.en[k] = n[k]; });
    S.lang = 'en'; S.sucio = true; aplicarModo(); refrescarTodo(); toast('Traducción aplicada. Revísala en la pestaña EN.', 'ok');
  }

  arrancar();
}());
