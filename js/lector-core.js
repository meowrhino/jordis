// /app/visualizador-core.js
(function (global) {
  const $ = (root, sel) => root.querySelector(sel);

  async function fetchJSON(url) {
    const res = await fetch(`${url}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Error ${res.status} al cargar ${url}`);
    return res.json();
  }

  // Resolve a data path regardless of whether the current page is served from / or /htmls/
  function resolveDataPath(p){
    const rel = (p||'').replace(/^\/+/, ''); // strip leading slashes
    const underHtmls = location.pathname.includes('/htmls/');
    return (underHtmls ? '../' : './') + rel;
  }

  async function fetchText(u){
    const r = await fetch(u, { cache: 'no-store' });
    if (!r.ok) throw new Error(`Error ${r.status} al cargar ${u}`);
    return r.text();
  }

function extractContentFromHTML(html){
  // Use a real HTML parser so <html>/<body> are preserved reliably
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const pick = (sel) => doc.querySelector(sel)?.innerHTML;
  return (
    pick('#editor') ||
    pick('.box') ||
    pick('main') ||
    (doc.body ? doc.body.innerHTML : '') ||
    ''
  );
}

  const _meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  function fmtFechaBonita(yyyy_mm_dd){
    const m = (yyyy_mm_dd||'').match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return (yyyy_mm_dd||'').trim();
    return `${parseInt(m[3],10)} de ${_meses[parseInt(m[2],10)-1]}`;
  }

  // Render por defecto: <li><a href="...">fecha [hora] — título</a></li>
  function defaultRenderItem(item) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    const p = item.path || item.file || '#';
    a.href = p ? resolveDataPath(p) : '#';
    a.textContent = [
      item.date || '',
      item.time ? item.time : '',
      item.title ? `— ${item.title}` : ''
    ].join(' ').replace(/\s+/g, ' ').trim();
    li.appendChild(a);
    return li;
  }

  // Opcional: render “bonito” para pensamientos si es audio
  function isAudio(item) {
    return /\.(mp3|m4a|ogg|wav|opus)$/i.test(item.path || item.file || '');
  }
  function pensamientosRenderItem(item) {
    const li = document.createElement('li');
    const p = item.path || item.file || '';
    const href = p ? resolveDataPath(p) : '#';

    if (isAudio(item)) {
      const wrap = document.createElement('div');
      const title = document.createElement('div');
      title.textContent = `${item.date || ''} ${item.time || ''} — audio`;
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = href;
      wrap.appendChild(title);
      wrap.appendChild(audio);
      li.appendChild(wrap);
    } else {
      const a = document.createElement('a');
      a.href = href || '#';
      a.target = '_blank';
      a.textContent = [
        item.date || '',
        item.time ? item.time : '',
        item.title ? `— ${item.title}` : ''
      ].join(' ').replace(/\s+/g, ' ').trim();
      li.appendChild(a);
    }
    return li;
  }

  function diarioRenderItem(item){
    const wrap = document.createElement('div');
    wrap.className = 'diario-entrada';

    const h3 = document.createElement('h3');
    const bonito = fmtFechaBonita(item.date || '');
    h3.textContent = `${item.place || ''}, ${bonito}`.replace(/^,\s*/, '').trim();

    const body = document.createElement('div');
    body.className = 'diario-contenido';
    body.textContent = 'cargando…';

    const url = resolveDataPath(item.path || '');
    fetchText(url).then(html => {
      const inner = extractContentFromHTML(html);
      body.innerHTML = inner || '(vacío)';
    }).catch(() => { body.textContent = '(no se pudo cargar)'; });

    wrap.appendChild(h3);
    wrap.appendChild(body);
    return wrap;
  }

  async function init(opts) {
    const {
      root = document,
      containerSel = '#lista',
      categoria,                  // 'diarios' | 'extras' | 'libros' | 'pensamientos'
      renderItem,                 // opcional: función de render por item
      emptyText = 'No hay entradas aún.',
      loadingText = 'Cargando…',
      errorText = 'No se pudo cargar el contenido.'
    } = opts || {};

    if (!categoria) throw new Error('visualizador-core: falta {categoria}');
    const cont = $(root, containerSel);
    if (!cont) throw new Error(`visualizador-core: no existe container ${containerSel}`);

    cont.innerHTML = `<li>${loadingText}</li>`;

    try {
      // Intentar raíz del sitio y, si falla (404), intentar ../data para páginas dentro de /htmls
      const candidateUrls = [
        `/data/${categoria}.json`,
        `../data/${categoria}.json`
      ];
      let data = [];
      let lastErr = null;
      for (const url of candidateUrls) {
        try {
          data = await fetchJSON(url);
          lastErr = null;
          console.info('visualizador-core: usando', url);
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (lastErr) {
        console.warn('visualizador-core: no se encontró JSON para', categoria, '— mostrando lista vacía.');
        data = [];
      }

      let items = Array.isArray(data) ? data.slice() : [];

      // Normalización: asegurar .path
      items = items.map(it => ({
        ...it,
        path: it.path || it.file || it.href || ''
      }));

      // Orden: más nuevo primero. Si vienen con YYYY-MM-DD__HH-mm-ss en el nombre, basta con ordenar por path desc
      items.sort((a, b) => (a.path < b.path ? 1 : -1));

      cont.innerHTML = '';
      if (!items.length) {
        cont.innerHTML = `<li>${emptyText}</li>`;
        return;
      }

      const renderer =
        renderItem ||
        (categoria === 'pensamientos' ? pensamientosRenderItem :
         categoria === 'diario' ? diarioRenderItem :
         defaultRenderItem);

      const frag = document.createDocumentFragment();
      for (const item of items) {
        try {
          frag.appendChild(renderer(item));
        } catch (e) {
          console.warn('Error renderizando item', item, e);
        }
      }
      cont.appendChild(frag);
    } catch (err) {
      console.error(err);
      cont.innerHTML = `<li>${errorText}</li>`;
    }
  }

  global.VisualizadorCore = { init };
})(window);

// ---- lector-core.js (capítulo individual) ----
(function (global) {
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

  function fmtFechaBonita(yyyy_mm_dd){
    const m = (yyyy_mm_dd||'').match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return (yyyy_mm_dd||'').trim();
    const D = parseInt(m[3],10), Mo = parseInt(m[2],10)-1;
    return `${D} de ${meses[Mo]}`;
  }

  async function fetchText(u){ const r = await fetch(u, {cache:'no-store'}); if(!r.ok) throw new Error(`No se pudo cargar: ${u}`); return r.text(); }
  async function fetchJSON(u){ const r = await fetch(u, {cache:'no-store'}); if(!r.ok) throw new Error(`No se pudo cargar: ${u}`); return r.json(); }

  function samePath(a,b){
    const na = decodeURIComponent(a||'').replace(/^\.\/+/, '').replace(/^\/+/, '');
    const nb = decodeURIComponent(b||'').replace(/^\.\/+/, '').replace(/^\/+/, '');
    return na === nb;
  }

  function getMetaFromHTML(html, src){
    const div = document.createElement('div');
    div.innerHTML = html;
    const getText = id => (div.querySelector(`#${id}`)?.textContent || '').trim();

    let fecha = getText('fecha');
    if(!fecha && src){
      const fn = src.split('/').pop() || '';
      const m = fn.match(/^(\d{4}-\d{2}-\d{2})__/);
      if (m) fecha = m[1];
    }

    const content =
      div.querySelector('#editor')?.innerHTML ||
      div.querySelector('.box')?.innerHTML    ||
      div.querySelector('main')?.innerHTML    ||
      div.querySelector('body')?.innerHTML    || '';

    return {
      libro:    getText('libro'),
      capitulo: getText('capitulo'),
      titulo:   getText('titulo'),
      fecha,
      content
    };
  }

  function $(sel){ return document.querySelector(sel); }

  async function render({ src, dataPath = '../data/libros.json' }){
    const html = await fetchText(src);
    const meta = getMetaFromHTML(html, src);

    $('#h2libro').textContent = meta.libro || '—';
    $('#h4titulo').textContent = meta.titulo || '';
    $('#h3detalle').textContent =
      `capítulo ${meta.capitulo||''}, ${meta.titulo||''}, ${fmtFechaBonita(meta.fecha||'')}`
        .replace(/\s+,/g, ',').trim();
    $('#capBody').innerHTML = meta.content;

    const lista = await fetchJSON(dataPath);
    const idx = lista.findIndex(it => samePath(it.path, src));
    const prev = (idx > 0) ? lista[idx-1] : null;
    const next = (idx >= 0 && idx < lista.length-1) ? lista[idx+1] : null;

    const nav = document.getElementById('navRight');
    if (nav) {
      nav.innerHTML = '';
      if (prev){
        const a=document.createElement('a');
        a.className='btn-prev';
        a.href=`./capitulo.html?src=${encodeURIComponent(prev.path)}`;
        a.textContent='anterior capítulo';
        nav.appendChild(a);
      }
      if (next){
        if (prev) nav.appendChild(document.createTextNode(' '));
        const a=document.createElement('a');
        a.className='btn-next';
        a.href=`./capitulo.html?src=${encodeURIComponent(next.path)}`;
        a.textContent='siguiente capítulo';
        nav.appendChild(a);
      }
    }
  }

  async function init(){
    const qs = new URLSearchParams(location.search);
    const rawSrc = qs.get('src') || '';
    const src = decodeURIComponent(rawSrc).replace(/^\.\/+/, '').replace(/^\/+/, './');

    if (!src){
      const body = document.getElementById('capBody') || document.body;
      body.textContent = 'Capítulo no encontrado.';
      return;
    }

    try{
      await render({ src });
      window.scrollTo({ top: 0, behavior: 'instant' });
    }catch(e){
      console.error(e);
      const body = document.getElementById('capBody') || document.body;
      body.textContent = 'Error cargando el capítulo.';
    }
  }

  global.LectorCore = { init };
})(window);