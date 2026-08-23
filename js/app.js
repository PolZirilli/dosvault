(function mobileGuard() {
  const uaBlock = /Android|iPhone|iPad|iPod|Windows Phone|BlackBerry|Opera Mini|IEMobile/i.test(navigator.userAgent);
  const coarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 700;
  if (uaBlock || (coarsePointer && narrow)) {
    document.getElementById('mobileBlock').classList.add('show');
  }
})();

let GENRES = {};
let GAMES = [];
let LEFT_ITEMS = [];
let RIGHT_ITEMS = [];
let currentGenre = null;

const state = { focus: 'left', leftIndex: 0, rightIndex: 0 };
const openWins = {};
const dosInstances = {};
// Referencia directa a `.layers` de cada instancia de js-dos (ver
// launchGame). Se guarda aparte de dosInstances porque dosInstances guarda
// la PROMISE de .run(), y layers.toggleFullscreen() está disponible antes
// de que esa promise resuelva -- es una propiedad sincrónica de la
// instancia devuelta por Dos(container, {}).
const dosLayers = {};
let zTop = 100;

const panelLeftList = document.getElementById('panelLeftList');
const panelRightList = document.getElementById('panelRightList');
const panelRightHeader = document.getElementById('panelRightHeader');
const panelLeftStatus = document.getElementById('panelLeftStatus');
const panelRightStatus = document.getElementById('panelRightStatus');
const cmdline = document.getElementById('cmdline');
const runningEl = document.getElementById('running');
const fkeysEl = document.getElementById('fkeys');
// Pueden no existir si index.html quedó desactualizado respecto a este
// archivo (ej. deploy parcial) -- todo lo que los use más abajo chequea
// null primero, así una falta de sincronía nunca tira abajo el resto del
// script (que es justo lo que pasó: F3 no abría nada y las columnas
// quedaban vacías porque este app.js estaba desactualizado en el server).
const infoModalEl = document.getElementById('infoModal');
const infoModalBody = document.getElementById('infoModalBody');
const infoModalCloseBtn = document.getElementById('infoModalClose');
const controlsModalEl = document.getElementById('controlsModal');
const controlsModalBody = document.getElementById('controlsModalBody');
const controlsModalResetBtn = document.getElementById('controlsModalReset');
const controlsModalCloseBtn = document.getElementById('controlsModalClose');

// Repo público de GitHub de donde sale la fecha real del último cambio a
// data/games.json (columna Date/Time del panel izquierdo). Si el repo
// cambia de dueño/nombre, actualizar acá.
const GITHUB_REPO = 'PolZirilli/dosvault';

/* ---------- CONTROLES MAPEABLES (F2) ---------- */
// Catálogo de acciones que se pueden reasignar a otra tecla desde el popup
// "Controles". Se guarda en localStorage por navegador (cada visitante
// configura la suya). Se usa event.code (no event.key) porque identifica la
// tecla física sin importar el layout ni si hay Shift apretado -- y porque
// distingue izquierda/derecha en Ctrl/Alt/Shift, que es justo lo que hace
// falta para más adelante poder mapear también controles DENTRO de un
// juego (ej. el caso de la palanca derecha del pinball que vimos antes:
// ahí el problema terminaba siendo indistinguible sin .code).
//
// group "nav": mueven el catálogo de DOSVault, ya están conectadas.
// group "game": reservadas para el día que el remapeo llegue también a
// adentro de los juegos (js-dos/ScummVM) -- por ahora no hacen nada al
// activarse, pero quedan guardadas y visibles para no tener que rediseñar
// el popup cuando se conecten.
const CONTROL_ACTIONS = [
  { id: 'moveUp', label: 'Mover arriba', group: 'nav', default: 'ArrowUp' },
  { id: 'moveDown', label: 'Mover abajo', group: 'nav', default: 'ArrowDown' },
  { id: 'switchPanel', label: 'Cambiar de panel', hint: '← y → siempre funcionan además, pase lo que pase acá', group: 'nav', default: 'Tab' },
  { id: 'confirm', label: 'Confirmar', hint: 'Abrir categoría / lanzar juego', group: 'nav', default: 'Enter' },
  { id: 'run', label: 'Ejecutar juego', hint: 'Igual que Confirmar, con un juego seleccionado', group: 'nav', default: 'F4' },
  { id: 'help', label: 'Ayuda', group: 'nav', default: 'F1' },
  { id: 'info', label: 'Info del juego', group: 'nav', default: 'F3' },
  { id: 'refresh', label: 'Refrescar', group: 'nav', default: 'F5' },
  { id: 'closeActive', label: 'Cerrar ventana activa', group: 'nav', default: 'F10' },
  { id: 'action1', label: 'Acción primaria', hint: 'Reservado para más adelante (ej. palanca/botón principal de un juego)', group: 'game', default: 'ControlLeft' },
  { id: 'action2', label: 'Acción secundaria', hint: 'Reservado para más adelante (ej. palanca/botón secundario de un juego)', group: 'game', default: 'AltLeft' },
];

const CONTROLS_STORAGE_KEY = 'dosvaultControls';

const CODE_LABELS = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  ControlLeft: 'Ctrl (izq)', ControlRight: 'Ctrl (der)',
  AltLeft: 'Alt (izq)', AltRight: 'Alt (der)',
  ShiftLeft: 'Shift (izq)', ShiftRight: 'Shift (der)',
  Space: 'Espacio', Enter: 'Enter', Tab: 'Tab', Escape: 'Escape',
};

function codeLabel(code) {
  if (!code) return '— sin asignar —';
  if (CODE_LABELS[code]) return CODE_LABELS[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  return code;
}

function defaultKeyMap() {
  const map = {};
  CONTROL_ACTIONS.forEach(a => { map[a.id] = a.default; });
  return map;
}

function loadKeyMap() {
  const map = defaultKeyMap();
  try {
    const raw = localStorage.getItem(CONTROLS_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      CONTROL_ACTIONS.forEach(a => {
        // null es válido (el usuario dejó esa acción sin asignar a propósito).
        if (a.id in saved && (saved[a.id] === null || typeof saved[a.id] === 'string')) {
          map[a.id] = saved[a.id];
        }
      });
    }
  } catch (err) {
    console.error('No se pudo leer la configuración de controles guardada, uso los valores por defecto:', err);
  }
  return map;
}

let KEYMAP = loadKeyMap();
let CODE_TO_ACTION = {};
function rebuildCodeToAction() {
  CODE_TO_ACTION = {};
  CONTROL_ACTIONS.forEach(a => {
    const code = KEYMAP[a.id];
    if (code) CODE_TO_ACTION[code] = a.id;
  });
}
rebuildCodeToAction();

function saveKeyMap() {
  try {
    localStorage.setItem(CONTROLS_STORAGE_KEY, JSON.stringify(KEYMAP));
  } catch (err) {
    console.error('No se pudo guardar la configuración de controles (localStorage no disponible):', err);
  }
  rebuildCodeToAction();
}

// Lo que efectivamente hace cada acción hoy en el shell. action1/action2
// son reservadas -- no hacen nada todavía a propósito (ver comentario del
// catálogo arriba).
const ACTION_HANDLERS = {
  moveUp: () => moveSelection(-1),
  moveDown: () => moveSelection(1),
  switchPanel: () => switchFocus(),
  confirm: () => activateSelection(),
  run: () => activateSelection(),
  help: () => showHelp(),
  info: () => openInfoModalForSelection(),
  refresh: () => render(),
  closeActive: () => {
    const ids = Object.keys(openWins);
    if (ids.length) closeWin(ids[ids.length - 1]);
  },
  action1: () => { },
  action2: () => { },
};

const pad2 = n => String(n).padStart(2, '0');

// Convierte una fecha real (Date o string ISO) al formato "MM-DD-YY" /
// "H:MMa" que ya usa el resto de la UI estilo Norton Commander.
function toDosDateTime(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return null;
  const h24 = d.getHours();
  const h12 = ((h24 + 11) % 12) + 1;
  const ampm = h24 < 12 ? 'a' : 'p';
  return {
    date: `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}-${String(d.getFullYear()).slice(-2)}`,
    time: `${h12}:${pad2(d.getMinutes())}${ampm}`,
  };
}

// ---- Fecha real del último commit que tocó data/games.json (columna
// Date/Time del panel izquierdo -- es la misma para todas las categorías,
// porque todas dependen del mismo archivo). Se pide una sola vez a la API
// pública de GitHub (sin API key, con CORS habilitado) y se cachea.
let gamesJsonDateTimePromise = null;
function fetchGamesJsonDateTime() {
  if (!gamesJsonDateTimePromise) {
    gamesJsonDateTimePromise = fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/commits?path=data/games.json&page=1&per_page=1`
    )
      .then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(commits => {
        const iso = commits && commits[0] && commits[0].commit && commits[0].commit.author && commits[0].commit.author.date;
        const dt = iso && toDosDateTime(iso);
        if (!dt) throw new Error('respuesta sin fecha de commit');
        return dt;
      })
      .catch(err => {
        console.error('No se pudo obtener la fecha real de data/games.json desde GitHub:', err);
        return null; // el llamador muestra "N/D" si esto es null
      });
  }
  return gamesJsonDateTimePromise;
}

// ---- Tamaño y fecha reales del bundle de cada juego (columnas Size/Date/
// Time del panel derecho). Se leen con un HEAD al propio archivo del
// bundle -- Content-Length y Last-Modified son headers "CORS-safelisted",
// así que se pueden leer aunque el bucket no exponga headers custom,
// siempre que el bucket permita el origen del sitio en su política CORS.
const BUNDLE_INFO_CACHE = {};
function fetchBundleInfo(g) {
  if (!g.bundle) return Promise.resolve(null);
  if (!(g.id in BUNDLE_INFO_CACHE)) {
    BUNDLE_INFO_CACHE[g.id] = fetch(g.bundle, { method: 'HEAD' })
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const len = res.headers.get('content-length');
        const lastMod = res.headers.get('last-modified');
        return {
          size: len != null ? parseInt(len, 10) : null,
          dateTime: lastMod ? toDosDateTime(new Date(lastMod)) : null,
        };
      })
      .catch(err => {
        console.error(`No se pudo leer tamaño/fecha real de ${g.bundle}:`, err);
        return null;
      });
  }
  return BUNDLE_INFO_CACHE[g.id];
}

// Nombre en mayúsculas, sin truncar -- se muestra el título completo del
// juego (antes se recortaba estilo 8.3 de DOS, ej. "DANGER~1").
function toDosName(name) {
  return String(name).toUpperCase();
}

function buildLeftItems() {
  LEFT_ITEMS = Object.keys(GENRES).map(id => {
    const count = GAMES.filter(g => g.genre === id).length;
    return { id, label: GENRES[id], count };
  }).filter(item => item.count > 0);
}

function renderLeftPanel() {
  panelLeftList.innerHTML = '';
  LEFT_ITEMS.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'panel-row is-dir' + (state.focus === 'left' && i === state.leftIndex ? ' selected' : '');
    // Los géneros son "carpetas": Size va como SUB-DIR (no tienen tamaño de
    // archivo propio). Date/Time arrancan en "..." y se completan solas
    // abajo con la fecha real del último commit a data/games.json.
    row.innerHTML = `
      <div class="col-name">${item.label.toUpperCase()}\\</div>
      <div class="col-size">SUB-DIR</div>
      <div class="col-date">...</div>
      <div class="col-time">...</div>`;
    row.addEventListener('click', () => {
      state.focus = 'left';
      state.leftIndex = i;
      selectGenre(item.id);
      render();
    });
    row.addEventListener('dblclick', () => {
      state.focus = 'right';
      render();
    });
    panelLeftList.appendChild(row);
  });

  // Una sola consulta a GitHub (cacheada) alcanza para las 6-9 filas: todas
  // dependen del mismo archivo data/games.json.
  fetchGamesJsonDateTime().then(dt => {
    panelLeftList.querySelectorAll('.col-date').forEach(el => { el.textContent = dt ? dt.date : 'N/D'; });
    panelLeftList.querySelectorAll('.col-time').forEach(el => { el.textContent = dt ? dt.time : 'N/D'; });
    updateStatusBars();
  });
}

function selectGenre(genreId) {
  currentGenre = genreId;
  state.rightIndex = 0;
  RIGHT_ITEMS = GAMES.filter(g => g.genre === genreId);
  const label = GENRES[genreId] || genreId;
  panelRightHeader.textContent = `C:\\${label.toUpperCase()}`;
}

function renderRightPanel() {
  panelRightList.innerHTML = '';
  RIGHT_ITEMS.forEach((g, i) => {
    const row = document.createElement('div');
    row.className = 'panel-row is-file' + (state.focus === 'right' && i === state.rightIndex ? ' selected' : '');
    // Nombre siempre en mayúsculas, sin límite de caracteres -- se ve el
    // título completo. El tooltip (title=) y el popup de info (F3) también
    // muestran el título completo.
    const dosName = toDosName(g.name);
    row.title = g.title || g.name;
    row.innerHTML = `
      <div class="col-name">
        <span>${dosName}<span style="opacity:.6">.EXE</span></span>
      </div>
      <div class="col-size">...</div>
      <div class="col-date">...</div>
      <div class="col-time">...</div>`;
    row.addEventListener('click', () => {
      state.focus = 'right';
      state.rightIndex = i;
      render();
    });
    row.addEventListener('dblclick', () => launchGame(g));
    panelRightList.appendChild(row);

    // Tamaño y fecha reales del bundle -- llegan async (HEAD request), se
    // completan en el lugar sin re-renderizar todo el panel. Si para cuando
    // responde ya se navegó a otra categoría, la fila ya no está en el DOM
    // y no se toca nada (evita pisar datos de otro juego).
    fetchBundleInfo(g).then(info => {
      if (!row.isConnected) return;
      const sizeEl = row.querySelector('.col-size');
      const dateEl = row.querySelector('.col-date');
      const timeEl = row.querySelector('.col-time');
      sizeEl.textContent = info && info.size != null ? String(info.size) : 'N/D';
      dateEl.textContent = info && info.dateTime ? info.dateTime.date : 'N/D';
      timeEl.textContent = info && info.dateTime ? info.dateTime.time : 'N/D';
      if (RIGHT_ITEMS[state.rightIndex] === g) updateStatusBars();
    });
  });
}

function updateCmdline() {
  let path = 'C:\\CATEGORIAS';
  if (currentGenre) {
    path += `\\${(GENRES[currentGenre] || currentGenre).toUpperCase()}`;
    if (state.focus === 'right' && RIGHT_ITEMS[state.rightIndex]) {
      path += `\\${RIGHT_ITEMS[state.rightIndex].id.toUpperCase()}.EXE`;
    }
  }
  cmdline.innerHTML = `${path}&gt;<span class="cursor-blink"></span>`;
}

function updateStatusBars() {
  const leftItem = LEFT_ITEMS[state.leftIndex];
  if (leftItem) {
    // Reusa lo que ya haya en caché (misma fecha real de data/games.json
    // que usan las columnas); si todavía no llegó, no dispara otro fetch,
    // solo muestra "..." hasta que renderLeftPanel la complete.
    const cached = gamesJsonDateTimePromise;
    panelLeftStatus.innerHTML = `<span class="st-name">${leftItem.label.toUpperCase()}\\ &lt;DIR&gt;</span><span class="st-date">...</span>`;
    if (cached) {
      cached.then(dt => {
        const el = panelLeftStatus.querySelector('.st-date');
        if (el) el.textContent = dt ? `${dt.date}  ${dt.time}` : 'N/D';
      });
    }
  } else {
    panelLeftStatus.innerHTML = '';
  }
  const rightItem = RIGHT_ITEMS[state.rightIndex];
  if (rightItem) {
    panelRightStatus.innerHTML = `<span class="st-name">${rightItem.name.toUpperCase()}.EXE</span><span class="st-date">...</span>`;
    const cached = BUNDLE_INFO_CACHE[rightItem.id];
    if (cached) {
      cached.then(info => {
        if (RIGHT_ITEMS[state.rightIndex] !== rightItem) return;
        const el = panelRightStatus.querySelector('.st-date');
        if (el) el.textContent = info && info.dateTime ? `${info.dateTime.date}  ${info.dateTime.time}` : 'N/D';
      });
    }
  } else {
    panelRightStatus.innerHTML = '';
  }
}

function render() {
  renderLeftPanel();
  renderRightPanel();
  updateCmdline();
  updateStatusBars();
}

function moveSelection(delta) {
  if (state.focus === 'left') {
    if (!LEFT_ITEMS.length) return;
    state.leftIndex = (state.leftIndex + delta + LEFT_ITEMS.length) % LEFT_ITEMS.length;
    selectGenre(LEFT_ITEMS[state.leftIndex].id);
  } else {
    if (!RIGHT_ITEMS.length) return;
    state.rightIndex = (state.rightIndex + delta + RIGHT_ITEMS.length) % RIGHT_ITEMS.length;
  }
  render();
}

function switchFocus() {
  if (state.focus === 'left') {
    if (!currentGenre && LEFT_ITEMS.length) selectGenre(LEFT_ITEMS[state.leftIndex].id);
    state.focus = 'right';
  } else {
    state.focus = 'left';
  }
  render();
}

function activateSelection() {
  if (state.focus === 'left') {
    switchFocus();
  } else if (RIGHT_ITEMS[state.rightIndex]) {
    launchGame(RIGHT_ITEMS[state.rightIndex]);
  }
}

document.addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

  // Popup de Controles esperando que se apriete la tecla nueva para una
  // acción: se la lleva entera, no debe disparar nada ni navegar atrás.
  if (controlsCapture) { e.preventDefault(); handleControlsCapture(e); return; }

  // Con el popup de info (F3) o el de Controles (F2) abiertos, Escape los
  // cierra y el resto de los atajos de navegación quedan bloqueados para no
  // mover la selección de atrás sin que se vea.
  if (infoModalEl && infoModalEl.classList.contains('show')) {
    if (e.key === 'Escape') { e.preventDefault(); closeInfoModal(); }
    return;
  }
  if (controlsModalEl && controlsModalEl.classList.contains('show')) {
    if (e.key === 'Escape') { e.preventDefault(); closeControlsModal(); }
    return;
  }

  // Alias fijos que siempre funcionan además de lo que esté configurado en
  // "switchPanel", para no perder la navegación base aunque se reasigne.
  if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { e.preventDefault(); switchFocus(); return; }

  const actionId = CODE_TO_ACTION[e.code];
  const handler = actionId && ACTION_HANDLERS[actionId];
  if (handler) { e.preventDefault(); handler(); }
});

function showHelp() {
  cmdline.innerHTML = 'Flechas: moverse &nbsp;|&nbsp; Tab: cambiar panel &nbsp;|&nbsp; Enter: abrir/ejecutar<span class="cursor-blink"></span>';
  setTimeout(updateCmdline, 2500);
}

/* ---------- FKEYS ---------- */
const FKEYS = [
  { key: 'F1', label: 'Ayuda', action: showHelp },
  { key: 'F2', label: 'Controles', action: () => openControlsModal() },
  { key: 'F3', label: 'Info', action: () => openInfoModalForSelection() },
  { key: 'F4', label: 'Ejecutar', action: activateSelection },
  { key: 'F5', label: 'Refrescar', action: render },
  {
    key: 'F10', label: 'Cerrar activa', action: () => {
      const ids = Object.keys(openWins);
      if (ids.length) closeWin(ids[ids.length - 1]);
    }
  },
];

function renderFkeys() {
  fkeysEl.innerHTML = '';
  FKEYS.forEach(fk => {
    const el = document.createElement('div');
    el.className = 'fkey';
    el.innerHTML = `<span class="num">${fk.key.replace('F', '')}</span><span class="label">${fk.label}</span>`;
    el.addEventListener('click', fk.action);
    fkeysEl.appendChild(el);
  });
}

/* ---------- POPUP DE INFO (F3): Wikipedia + Wikidata ---------- */
// Título, sinopsis e imagen salen de la API pública de Wikipedia
// (action=query, sin API key, con &origin=* para que funcione con fetch()
// desde cualquier dominio). La distribuidora sale de Wikidata (propiedad
// P123 "publisher") a partir del mismo artículo. Se busca primero en
// Wikipedia en español y, si no hay resultado, en inglés (muchos juegos DOS
// viejos tienen mejor cobertura ahí). Resultado en caché por juego para no
// repetir la búsqueda cada vez que se abre el popup.
const WIKI_CACHE = {};

async function wikiFetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchWikidataPublisher(wikidataId, lang) {
  try {
    const claimsUrl = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${wikidataId}&property=P123&format=json&origin=*`;
    const claims = (await wikiFetchJson(claimsUrl)).claims;
    const targetId = claims && claims.P123 && claims.P123[0] &&
      claims.P123[0].mainsnak && claims.P123[0].mainsnak.datavalue &&
      claims.P123[0].mainsnak.datavalue.value && claims.P123[0].mainsnak.datavalue.value.id;
    if (!targetId) return null;
    const labelUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${targetId}&props=labels&languages=${lang}|en&format=json&origin=*`;
    const labels = (await wikiFetchJson(labelUrl)).entities[targetId].labels;
    return (labels[lang] && labels[lang].value) || (labels.en && labels.en.value) || null;
  } catch (err) {
    console.error('No se pudo obtener la distribuidora desde Wikidata:', err);
    return null;
  }
}

async function fetchWikiInfo(query) {
  for (const lang of ['es', 'en']) {
    try {
      const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query + ' video game')}&srlimit=1&format=json&origin=*`;
      const search = (await wikiFetchJson(searchUrl)).query.search;
      if (!search || !search.length) continue;
      const pageId = search[0].pageid;

      const sumUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&pageids=${pageId}&prop=extracts%7Cpageimages%7Cpageprops&exintro=1&explaintext=1&piprop=original&format=json&origin=*`;
      const page = (await wikiFetchJson(sumUrl)).query.pages[pageId];
      if (!page) continue;

      const wikidataId = page.pageprops && page.pageprops.wikibase_item;
      const publisher = wikidataId ? await fetchWikidataPublisher(wikidataId, lang) : null;

      return {
        title: page.title,
        extract: (page.extract || '').trim(),
        image: page.original ? page.original.source : null,
        publisher,
        sourceUrl: `https://${lang}.wikipedia.org/?curid=${pageId}`,
      };
    } catch (err) {
      console.error(`Búsqueda en Wikipedia (${lang}) falló:`, err);
    }
  }
  return null;
}

function openInfoModalForSelection() {
  const g = RIGHT_ITEMS[state.rightIndex];
  if (state.focus === 'right' && g) openInfoModal(g);
}

async function openInfoModal(g) {
  if (!g || !infoModalEl || !infoModalBody) return;
  const displayTitle = g.title || g.name;
  infoModalBody.innerHTML = `<div class="info-loading">Buscando información de ${displayTitle}...<span class="cursor-blink"></span></div>`;
  infoModalEl.classList.add('show');

  if (!(g.id in WIKI_CACHE)) {
    WIKI_CACHE[g.id] = await fetchWikiInfo(g.title || g.name);
  }
  // Por si se cerró el popup mientras la búsqueda seguía en vuelo.
  if (infoModalEl.classList.contains('show')) renderInfoModal(g, WIKI_CACHE[g.id]);
}

function renderInfoModal(g, data) {
  if (!infoModalBody) return;
  const titleText = (data && data.title) || g.title || g.name;
  const publisher = (data && data.publisher) || 'Desconocida';
  const synopsis = (data && data.extract) ? data.extract : 'No se encontró sinopsis para este juego en Wikipedia.';
  const image = data && data.image;

  infoModalBody.innerHTML = `
    <div class="info-cols">
      ${image
      ? `<img class="info-image" src="${image}" alt="${titleText}">`
      : `<div class="info-image info-image-empty">Sin imagen<br>disponible</div>`}
      <div class="info-text">
        <div class="info-title">${titleText}</div>
        <div class="info-meta"><b>Año:</b> ${g.year} &nbsp;&nbsp; <b>Distribuidora:</b> ${publisher}</div>
        <div class="info-synopsis">${synopsis}</div>
        ${data && data.sourceUrl ? `<a class="info-source" href="${data.sourceUrl}" target="_blank" rel="noopener">Fuente: Wikipedia</a>` : ''}
      </div>
    </div>`;
}

function closeInfoModal() {
  if (infoModalEl) infoModalEl.classList.remove('show');
}

if (infoModalCloseBtn) infoModalCloseBtn.addEventListener('click', closeInfoModal);
// Click en el fondo oscuro (fuera del diálogo) también cierra.
if (infoModalEl) infoModalEl.addEventListener('click', e => { if (e.target === infoModalEl) closeInfoModal(); });

/* ---------- POPUP DE CONTROLES (F2) ---------- */
// controlsCapture: null cuando el popup no está esperando una tecla nueva
// para reasignar; si no, { actionId, btnEl, keyEl } de la fila que está
// "escuchando" el próximo keydown (ver el guard al principio del listener
// de keydown más arriba, que intercepta esa tecla entera y la manda a
// handleControlsCapture en vez de dejarla navegar/disparar acciones).
let controlsCapture = null;

function openControlsModal() {
  if (!controlsModalEl) return;
  if (infoModalEl && infoModalEl.classList.contains('show')) closeInfoModal();
  controlsCapture = null;
  renderControlsModal();
  controlsModalEl.classList.add('show');
}

function closeControlsModal() {
  controlsCapture = null;
  if (controlsModalEl) controlsModalEl.classList.remove('show');
}

function renderControlsModal() {
  if (!controlsModalBody) return;
  const groups = [
    { id: 'nav', title: 'Navegación', note: '' },
    {
      id: 'game', title: 'Dentro del juego',
      note: 'Reservado para más adelante -- por ahora no hacen nada dentro de los juegos, pero ya se pueden asignar.',
    },
  ];
  controlsModalBody.innerHTML = groups.map(group => {
    const actions = CONTROL_ACTIONS.filter(a => a.group === group.id);
    if (!actions.length) return '';
    const rows = actions.map(a => `
      <div class="controls-row">
        <div class="cr-label">${a.label}${a.hint ? `<span class="cr-hint">${a.hint}</span>` : ''}</div>
        <span class="cr-key">${codeLabel(KEYMAP[a.id])}</span>
        <span class="cr-btn" data-action="${a.id}">[ Cambiar ]</span>
      </div>`).join('');
    return `
      <div class="controls-group-title">${group.title}</div>
      ${group.note ? `<div class="controls-group-note">${group.note}</div>` : ''}
      ${rows}`;
  }).join('');

  controlsModalBody.querySelectorAll('.cr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const actionId = btn.dataset.action;
      const row = btn.closest('.controls-row');
      const keyEl = row && row.querySelector('.cr-key');
      startCapture(actionId, btn, keyEl);
    });
  });
}

function startCapture(actionId, btnEl, keyEl) {
  // Si ya había otra fila esperando tecla, la des-marcamos in-place (sin
  // volver a dibujar todo el popup, para no perder la referencia a los
  // elementos de la fila que se acaba de clickear).
  if (controlsCapture) {
    const prevRow = controlsCapture.btnEl && controlsCapture.btnEl.closest('.controls-row');
    if (prevRow) prevRow.classList.remove('capturing');
    if (controlsCapture.keyEl) controlsCapture.keyEl.textContent = codeLabel(KEYMAP[controlsCapture.actionId]);
  }
  controlsCapture = { actionId, btnEl, keyEl };
  if (keyEl) keyEl.textContent = 'Presioná una tecla...';
  const row = btnEl && btnEl.closest('.controls-row');
  if (row) row.classList.add('capturing');
}

function handleControlsCapture(e) {
  const capture = controlsCapture;
  controlsCapture = null;
  if (!capture) return;

  if (e.code === 'Escape') {
    // Cancelar sin reasignar nada.
    renderControlsModal();
    return;
  }

  // Si la tecla nueva ya estaba usada por otra acción, esa otra queda sin
  // asignar para no tener dos acciones respondiendo a la misma tecla.
  const previousOwner = CODE_TO_ACTION[e.code];
  if (previousOwner && previousOwner !== capture.actionId) {
    KEYMAP[previousOwner] = null;
  }
  KEYMAP[capture.actionId] = e.code;
  saveKeyMap();
  renderControlsModal();
}

if (controlsModalResetBtn) controlsModalResetBtn.addEventListener('click', () => {
  KEYMAP = defaultKeyMap();
  saveKeyMap();
  renderControlsModal();
});
if (controlsModalCloseBtn) controlsModalCloseBtn.addEventListener('click', closeControlsModal);
// Click en el fondo oscuro (fuera del diálogo) también cierra.
if (controlsModalEl) controlsModalEl.addEventListener('click', e => { if (e.target === controlsModalEl) closeControlsModal(); });

/* ---------- WINDOWS / MOTORES DE EMULACIÓN ---------- */
// Un juego corre con js-dos (DOSBox/WASM) por default. Si en games.json trae
// "engine": "scummvm", se usa el motor nativo de ScummVM (ver
// js/scummvm-engine.js) en vez de emular la PC completa.
function launchGame(g) {
  if (openWins[g.id]) {
    focusWin(g.id);
    restoreWin(g.id);
    return;
  }
  const win = document.createElement('div');
  win.className = 'window';
  const w = 520, h = 360;
  const left = 40 + Object.keys(openWins).length * 24;
  const top = 30 + Object.keys(openWins).length * 24;
  win.style.width = w + 'px'; win.style.height = h + 'px';
  win.style.left = left + 'px'; win.style.top = top + 'px';
  win.style.zIndex = ++zTop;

  const isScummvm = g.engine === 'scummvm';

  win.innerHTML = `
    <div class="titlebar">
      <div class="titlebar-title">${g.name.toUpperCase()}.EXE</div>
      <div class="win-controls">
        ${isScummvm ? '<span class="win-btn menu" title="Menu ScummVM (Guardar/Cargar/Opciones)">[≡]</span>' : ''}
        ${g.bundle ? '<span class="win-btn fs" title="Pantalla completa (ESC queda libre para el juego)">[⛶]</span>' : ''}
        <span class="win-btn max">[□]</span>
        <span class="win-btn close">[X]</span>
      </div>
    </div>
    <div class="win-body">
      <div class="boot-lines"></div>
      <div class="win-screen" style="display:none;">
        <div class="big-title">${g.name.toUpperCase()}</div>
        <div class="hint">Todavía no hay un bundle asignado a este juego. Agregalo en data/games.json (campo "bundle") o dejalo local en la carpeta games/ para que arranque acá el motor real.</div>
        <div style="margin-top:16px;">C:\\GAMES\\${g.id.toUpperCase()}&gt;<span class="cursor-blink"></span></div>
      </div>
    </div>
  `;
  document.body.appendChild(win);
  openWins[g.id] = win;

  const bootLines = win.querySelector('.boot-lines');
  const screen = win.querySelector('.win-screen');
  const body = win.querySelector('.win-body');
  const lines = [
    isScummvm ? 'ScummVM Engine v1.0' : 'MS-DOS Emulator v1.0',
    isScummvm ? 'Detectando motor del juego...' : 'Detectando controladora de sonido... Sound Blaster 16 OK',
    `Montando C:\\GAMES\\${g.id.toUpperCase()}...`,
    isScummvm ? 'Auto-detectando juego...' : `Cargando ${g.id.toUpperCase()}.EXE...`,
  ];
  lines.forEach((t, i) => {
    setTimeout(() => {
      const l = document.createElement('div');
      l.className = 'boot-line';
      l.textContent = t;
      bootLines.appendChild(l);
    }, i * 260);
  });

  setTimeout(() => {
    bootLines.style.display = 'none';
    if (g.bundle && isScummvm) {
      body.classList.add('no-pad');
      const container = document.createElement('div');
      container.className = 'jsdos-container';
      body.appendChild(container);
      if (window.ScummVMEngine) {
        dosInstances[g.id] = window.ScummVMEngine.run(container, g).catch(err => {
          console.error(err);
          container.innerHTML = '';
          container.style.color = '#f66';
          container.style.padding = '14px';
          container.textContent = 'No se pudo iniciar ScummVM: ' + err.message;
          return null;
        });
        // En cuanto la ventana quede activa (foco de mouse/teclado), que
        // el teclado apunte al iframe del juego, no al documento principal.
        dosInstances[g.id].then(inst => { if (inst && inst.focus) inst.focus(); });
      } else {
        container.style.color = '#f66';
        container.style.padding = '14px';
        container.textContent = 'No se pudo cargar el motor de ScummVM (js/scummvm-engine.js).';
      }
    } else if (g.bundle) {
      body.classList.add('no-pad');
      const container = document.createElement('div');
      container.className = 'jsdos-container';
      body.appendChild(container);
      if (window.Dos) {
        // OJO: Dos(container, {}) devuelve la instancia en sí (sincrónico);
        // .run(bundle) es lo asincrónico. Hay que quedarse con la
        // instancia ANTES de encadenar .run(), porque instance.layers
        // (con .toggleFullscreen()) es una propiedad que ya existe desde
        // el constructor, no algo que aparece recién cuando .run() resuelve.
        const dosInstance = Dos(container, {});
        dosLayers[g.id] = dosInstance.layers;
        dosInstances[g.id] = dosInstance.run(g.bundle);
        // Arranca en modo "ventana grande" (ocupa el browser, no todavía
        // el monitor): pseudo-fs por CSS, sin tocar la Fullscreen API real
        // todavía. La pantalla completa real del MONITOR se pide recién
        // cuando el usuario clickea el botón [⛶] (ver más abajo) -- el
        // navegador no permite invocar requestFullscreen() fuera de un
        // gesto directo del usuario, así que no se puede auto-activar sola
        // al arrancar el juego.
        win.classList.add('pseudo-fs');
        const fsBtnEl = win.querySelector('.win-btn.fs');
        if (fsBtnEl) fsBtnEl.title = 'Pantalla completa real (ESC para salir)';
        // Mantiene el título del botón sincronizado si el usuario sale de
        // pantalla completa apretando ESC directamente (en vez de clickear
        // el botón).
        dosLayers[g.id].setOnFullscreen(active => {
          if (fsBtnEl) fsBtnEl.title = active ? 'Salir de pantalla completa (ESC)' : 'Pantalla completa real (ESC para salir)';
        });
      } else {
        container.style.color = '#f66';
        container.style.padding = '14px';
        container.textContent = 'No se pudo cargar js-dos (revisá la conexión a internet).';
      }
    } else {
      screen.style.display = 'block';
    }
  }, lines.length * 260 + 300);

  win.addEventListener('mousedown', () => focusWin(g.id));
  win.querySelector('.win-btn.close').addEventListener('click', e => { e.stopPropagation(); closeWin(g.id); });
  win.querySelector('.win-btn.max').addEventListener('click', e => { e.stopPropagation(); win.classList.toggle('maximized'); });
  if (isScummvm) {
    const menuBtn = win.querySelector('.win-btn.menu');
    if (menuBtn) {
      menuBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (dosInstances[g.id]) dosInstances[g.id].then(inst => { if (inst && inst.openMenu) inst.openMenu(); });
      });
    }
  }
  // Botón [⛶] de pantalla completa: pide la Fullscreen API REAL del
  // navegador (el monitor entero, sin barra de direcciones ni pestañas).
  // Antes esto togleaba solo una clase CSS (.pseudo-fs) para esquivar el
  // hecho de que el navegador reserva ESC para salir de pantalla completa
  // de forma no cancelable por JS -- pero eso significaba que nunca se
  // salía realmente del browser. Ahora entramos a pantalla completa de
  // verdad; el trade-off inevitable es que ESC va a salir de pantalla
  // completa en vez de llegarle al juego (así lo exige el estándar, no
  // hay forma de evitarlo). Al salir, la ventana vuelve a pseudo-fs
  // (llena el browser) en vez de al tamaño chico original.
  const fsBtn = win.querySelector('.win-btn.fs');
  if (fsBtn) {
    fsBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (isScummvm) {
        if (dosInstances[g.id]) dosInstances[g.id].then(inst => { if (inst && inst.toggleFullscreen) inst.toggleFullscreen(); });
      } else if (dosLayers[g.id]) {
        dosLayers[g.id].toggleFullscreen();
      }
      if (dosInstances[g.id]) dosInstances[g.id].then(inst => { if (inst && inst.focus) inst.focus(); });
    });
  }
  makeDraggable(win, win.querySelector('.titlebar'));

  addRunningTab(g);
}

function addRunningTab(g) {
  if (!runningEl) return;
  const tab = document.createElement('div');
  tab.className = 'running-tab active';
  tab.dataset.id = g.id;
  tab.textContent = g.name.toUpperCase() + '.EXE';
  tab.addEventListener('click', () => {
    const win = openWins[g.id];
    if (!win) return;
    if (win.style.display === 'none') { restoreWin(g.id); }
    else if (parseInt(win.style.zIndex) === zTop) { minimizeWin(g.id); }
    else { focusWin(g.id); }
  });
  runningEl.appendChild(tab);
}

function focusWin(id) {
  const win = openWins[id];
  if (!win) return;
  win.style.zIndex = ++zTop;
  document.querySelectorAll('.running-tab').forEach(b => b.classList.toggle('active', b.dataset.id === id));
  // Si es una ventana de ScummVM, devolverle el foco de teclado al iframe
  // del juego (si no, el menú Ctrl+F5 / Guardar / Opciones no recibe nada).
  if (dosInstances[id]) {
    dosInstances[id].then(inst => { if (inst && inst.focus) inst.focus(); });
  }
}
function minimizeWin(id) {
  const win = openWins[id];
  if (!win) return;
  win.style.display = 'none';
  const tab = runningEl ? runningEl.querySelector(`.running-tab[data-id="${id}"]`) : null;
  if (tab) tab.classList.remove('active');
}
function restoreWin(id) {
  const win = openWins[id];
  if (!win) return;
  win.style.display = 'flex';
  focusWin(id);
}
function closeWin(id) {
  const win = openWins[id];
  if (win) win.remove();
  delete openWins[id];
  if (dosInstances[id]) {
    // Tanto js-dos (CommandInterface) como el wrapper de ScummVM exponen
    // una promesa que resuelve a un objeto con .exit() — mismo contrato,
    // no hace falta bifurcar acá según el motor.
    dosInstances[id].then(ci => { if (ci && ci.exit) ci.exit(); }).catch(() => { });
    delete dosInstances[id];
  }
  const tab = runningEl ? runningEl.querySelector(`.running-tab[data-id="${id}"]`) : null;
  if (tab) tab.remove();
}

function makeDraggable(win, handle) {
  let dragging = false, ox = 0, oy = 0;
  handle.addEventListener('mousedown', e => {
    if (win.classList.contains('maximized')) return;
    dragging = true;
    ox = e.clientX - win.offsetLeft;
    oy = e.clientY - win.offsetTop;
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    win.style.left = Math.max(0, e.clientX - ox) + 'px';
    win.style.top = Math.max(0, e.clientY - oy) + 'px';
  });
  document.addEventListener('mouseup', () => dragging = false);
}

/* ---------- LOAD ---------- */
renderFkeys();

fetch('data/games.json')
  .then(r => r.json())
  .then(data => {
    GENRES = data.genres;
    GAMES = data.games;
    buildLeftItems();
    if (LEFT_ITEMS.length) selectGenre(LEFT_ITEMS[0].id);
    render();
  })
  .catch(err => {
    panelRightList.innerHTML = '<div class="panel-row" style="color:#fff;padding:20px;">No se pudo cargar data/games.json. Si abriste el archivo directo (file://), corré un servidor local — ver README.md.</div>';
    console.error(err);
  });
