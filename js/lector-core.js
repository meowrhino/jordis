// /app/visualizador-core.js
(function (global) {
  const $ = (root, sel) => root.querySelector(sel);

  async function fetchJSON(url) {
    const res = await fetch(`${url}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Error ${res.status} al cargar ${url}`);
    return res.json();
  }

  // Render por defecto: <li><a href="...">fecha [hora] — título</a></li>
  function defaultRenderItem(item) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = item.path || item.file || '#';
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
    return /\.(mp3|m4a|ogg|wav)$/i.test(item.path || item.file || '');
  }
  function pensamientosRenderItem(item) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = item.path || item.file || '#';
    a.target = '_blank';

    if (isAudio(item)) {
      // Audio (WhatsApp u otros) — muestra player + título
      const wrap = document.createElement('div');
      const title = document.createElement('div');
      title.textContent = `${item.date || ''} ${item.time || ''} — audio`;
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = a.href;
      wrap.appendChild(title);
      wrap.appendChild(audio);
      li.appendChild(wrap);
    } else {
      // Texto (html)
      a.textContent = [
        item.date || '',
        item.time ? item.time : '',
        item.title ? `— ${item.title}` : ''
      ].join(' ').replace(/\s+/g, ' ').trim();
      li.appendChild(a);
    }
    return li;
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
      const data = await fetchJSON(`/data/${categoria}.json`);
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
        (categoria === 'pensamientos' ? pensamientosRenderItem : defaultRenderItem);

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