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
const GENRE_GAMES_CACHE = {};

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
// id del juego que tiene el foco de teclado en este momento, o null si el
// foco esta en el shell (panel de categorias/juegos). Mientras haya un id
// aca, el listener de keydown de mas abajo no procesa NADA de navegacion --
// las teclas le llegan derecho al juego (canvas de js-dos / iframe de
// ScummVM) en vez de mover la seleccion de la lista por atras. Se limpia
// clickeando fuera de la ventana del juego (ver el listener de mousedown en
// captura, mas abajo) o cerrando/minimizando esa ventana.
let gamePlaying = null;

const panelLeftList = document.getElementById('panelLeftList');
const panelRightList = document.getElementById('panelRightList');
const panelRightHeader = document.getElementById('panelRightHeader');
const panelLeftStatus = document.getElementById('panelLeftStatus');
const panelRightStatus = document.getElementById('panelRightStatus');
const cmdline = document.getElementById('cmdline');
const runningEl = document.getElementById('running');
const fkeysEl = document.getElementById('fkeys');
const toastEl = document.getElementById('toast');
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
const helpModalEl = document.getElementById('helpModal');
const helpForm = document.getElementById('helpForm');
const helpFormStatus = document.getElementById('helpFormStatus');
const helpFormSubmit = document.getElementById('helpFormSubmit');
const helpModalCloseBtn = document.getElementById('helpModalClose');
const newGamesModalEl = document.getElementById('newGamesModal');
const newGamesModalBody = document.getElementById('newGamesModalBody');
const newGamesModalCloseBtn = document.getElementById('newGamesModalClose');
const scummvmHintModalEl = document.getElementById('scummvmHintModal');
const scummvmHintModalBody = document.getElementById('scummvmHintModalBody');
const scummvmHintDismissCheckbox = document.getElementById('scummvmHintDismissCheckbox');
const scummvmHintModalCloseBtn = document.getElementById('scummvmHintModalClose');
const testBundleModalEl = document.getElementById('testBundleModal');
const testBundleModalBody = document.getElementById('testBundleModalBody');
const testBundleModalCloseBtn = document.getElementById('testBundleModalClose');
const testBundleJsdosBtn = document.getElementById('testBundleJsdosBtn');
const testBundleScummvmBtn = document.getElementById('testBundleScummvmBtn');
const testBundleFileInput = document.getElementById('testBundleFileInput');

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
  { id: 'moveUp', group: 'nav', default: 'ArrowUp' },
  { id: 'moveDown', group: 'nav', default: 'ArrowDown' },
  { id: 'switchPanel', hint: true, group: 'nav', default: 'Tab' },
  { id: 'confirm', hint: true, group: 'nav', default: 'Enter' },
  { id: 'run', hint: true, group: 'nav', default: 'F4' },
  { id: 'help', group: 'nav', default: 'F1' },
  { id: 'controls', group: 'nav', default: 'F2' },
  { id: 'info', group: 'nav', default: 'F3' },
  { id: 'refresh', group: 'nav', default: 'F5' },
  { id: 'closeActive', group: 'nav', default: 'F10' },
  { id: 'action1', hint: true, group: 'game', default: 'ControlLeft' },
  { id: 'action2', hint: true, group: 'game', default: 'AltLeft' },
];

// Los labels/hints de cada accion viven en I18N (js/i18n.js), no aca --
// asi CONTROL_ACTIONS no hay que reconstruirlo al cambiar de idioma, solo
// releer estas dos funciones en cada render.
function actionLabel(a) { return t('ctrl.' + a.id + '.label'); }
function actionHint(a) { return a.hint ? t('ctrl.' + a.id + '.hint') : ''; }

const CONTROLS_STORAGE_KEY = 'dosvaultControls';

// ArrowLeft/ArrowRight se escriben "<-"/"->" en vez de los glifos ← → -- la
// fuente bitmap del sitio (PxPlus IBM VGA8) no los tiene y se veian como
// "+" en el popup de Controles. Estos no cambian con el idioma (glifos y
// nombres de tecla ya son universales); Ctrl/Alt/Shift izq/der si tienen
// traduccion, ver I18N (js/i18n.js).
const CODE_LABELS_FIXED = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '<-', ArrowRight: '->',
  Enter: 'Enter', Tab: 'Tab', Escape: 'Escape',
};
const CODE_LABEL_KEYS = {
  ControlLeft: 'code.ctrlLeft', ControlRight: 'code.ctrlRight',
  AltLeft: 'code.altLeft', AltRight: 'code.altRight',
  ShiftLeft: 'code.shiftLeft', ShiftRight: 'code.shiftRight',
  Space: 'code.space',
};

function codeLabel(code) {
  if (!code) return t('ctrl.unassigned');
  if (CODE_LABELS_FIXED[code]) return CODE_LABELS_FIXED[code];
  if (CODE_LABEL_KEYS[code]) return t(CODE_LABEL_KEYS[code]);
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
  run: () => runSelection(),
  help: () => showHelp(),
  controls: () => openControlsModal(),
  info: () => openInfoModalForSelection(),
  refresh: () => location.reload(),
  closeActive: () => {
    const ids = Object.keys(openWins);
    if (ids.length) closeWin(ids[ids.length - 1]);
  },
  action1: () => { },
  action2: () => { },
};

// Toast corto (ej. "seleccioná un juego primero") -- ver #toast en
// index.html. Reemplaza cualquier mensaje que estuviera mostrandose.
let toastTimer = null;
function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

// "Ejecutar" (F3 en la barra inferior / F4 físico por defecto): a
// diferencia de Confirmar (Enter), que también sirve para entrar a una
// categoría, esta acción es específicamente "correr el juego ya
// seleccionado" -- si todavía no hay uno (foco en el panel izquierdo, o
// panel derecho vacío), se avisa en vez de no hacer nada.
function runSelection() {
  const g = state.focus === 'right' ? RIGHT_ITEMS[state.rightIndex] : null;
  if (g) {
    launchGame(g);
  } else {
    showToast(t('toast.selectGameFirst'));
  }
}

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

// Etiqueta visible de un genero en el idioma actual. I18N_GENRES (en
// js/i18n.js) trae la traduccion para los generos conocidos; si en el
// futuro se agrega uno nuevo a data/games.json sin agregar su traduccion
// ahi, cae de vuelta al texto que ya trae el propio games.json.
function genreLabel(id) {
  const dict = I18N_GENRES[currentLang] || I18N_GENRES.en;
  const entry = GENRES && GENRES[id];
  const nameFromEntry = entry && (typeof entry === 'object' ? entry.name : entry);
  return dict[id] || nameFromEntry || id;
}

function buildLeftItems() {
  LEFT_ITEMS = Object.keys(GENRES).map(id => {
    const item = GENRES[id] || {};
    const count = typeof item === 'object' && typeof item.count === 'number'
      ? item.count
      : GAMES.filter(g => g.genre === id).length;
    return { id, label: genreLabel(id), count };
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
      renderLeftPanel();
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
    panelLeftList.querySelectorAll('.col-date').forEach(el => { el.textContent = dt ? dt.date : t('common.na'); });
    panelLeftList.querySelectorAll('.col-time').forEach(el => { el.textContent = dt ? dt.time : t('common.na'); });
    updateStatusBars();
  });
}

// Orden alfabetico (por titulo visible) dentro de cada categoria -- antes
// quedaban en el orden en que aparecen en data/games.json, que no tenia
// ningun criterio para quien navega el catalogo.
function gameSortLabel(g) {
  return (g.title || g.name || '').toUpperCase();
}

let loadingGenreId = null;

function selectGenre(genreId) {
  currentGenre = genreId;
  state.rightIndex = 0;
  const label = genreLabel(genreId);
  panelRightHeader.textContent = `C:\\${label.toUpperCase()}`;

  // 1. Si ya tenemos en caché los juegos de este género, mostramos inmediatamente
  if (GENRE_GAMES_CACHE[genreId]) {
    loadingGenreId = null;
    RIGHT_ITEMS = GENRE_GAMES_CACHE[genreId];
    renderRightPanel();
    updateCmdline();
    updateStatusBars();
    return;
  }

  // 2. Si los juegos venían en GAMES (compatibilidad / fallback)
  const legacyGames = GAMES.filter(g => g.genre === genreId);
  if (legacyGames.length > 0) {
    loadingGenreId = null;
    RIGHT_ITEMS = legacyGames.sort((a, b) => gameSortLabel(a).localeCompare(gameSortLabel(b), 'es'));
    GENRE_GAMES_CACHE[genreId] = RIGHT_ITEMS;
    renderRightPanel();
    updateCmdline();
    updateStatusBars();
    return;
  }

  // 3. Lazy Loading: indicador de carga en estilo DOS
  loadingGenreId = genreId;
  RIGHT_ITEMS = [];
  renderRightPanel();
  updateCmdline();
  updateStatusBars();

  const genreEntry = GENRES[genreId];
  const url = genreEntry && typeof genreEntry === 'object' ? genreEntry.url : null;
  if (!url) {
    loadingGenreId = null;
    RIGHT_ITEMS = [];
    renderRightPanel();
    return;
  }

  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(data => {
      const rawGames = Array.isArray(data) ? data : (data.games || []);
      const sorted = rawGames.slice().sort((a, b) => gameSortLabel(a).localeCompare(gameSortLabel(b), 'es'));
      GENRE_GAMES_CACHE[genreId] = sorted;

      // Condición de carrera: solo actualizamos el panel si el usuario sigue en este género
      if (currentGenre === genreId) {
        loadingGenreId = null;
        RIGHT_ITEMS = sorted;
        renderRightPanel();
        updateCmdline();
        updateStatusBars();
      }
    })
    .catch(err => {
      console.error(`No se pudieron cargar los juegos para el género ${genreId}:`, err);
      if (currentGenre === genreId) {
        loadingGenreId = null;
        RIGHT_ITEMS = [];
        panelRightList.innerHTML = `<div class="panel-row" style="color:#ff5555;padding:10px 14px;">${t('err.loadGames')}</div>`;
      }
    });
}

function renderRightPanel() {
  panelRightList.innerHTML = '';
  if (loadingGenreId === currentGenre) {
    const loadingText = (t('common.loading') || 'LOADING...').toUpperCase();
    panelRightList.innerHTML = `<div class="panel-row" style="color:var(--dos-yellow);padding:10px 14px;font-style:italic;">C:\\DOS\\${loadingText}</div>`;
    return;
  }
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
      sizeEl.textContent = info && info.size != null ? String(info.size) : t('common.na');
      dateEl.textContent = info && info.dateTime ? info.dateTime.date : t('common.na');
      timeEl.textContent = info && info.dateTime ? info.dateTime.time : t('common.na');
      if (RIGHT_ITEMS[state.rightIndex] === g) updateStatusBars();
    });
  });
}

function updateCmdline() {
  let path = `C:\\${t('cmd.categories')}`;
  if (currentGenre) {
    path += `\\${genreLabel(currentGenre).toUpperCase()}`;
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
        if (el) el.textContent = dt ? `${dt.date}  ${dt.time}` : t('common.na');
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
        if (el) el.textContent = info && info.dateTime ? `${info.dateTime.date}  ${info.dateTime.time}` : t('common.na');
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

  // Hay un juego con el foco: el teclado es todo suyo. No se procesa ningun
  // atajo del shell (ni navegacion ni F-keys) hasta que se salga del juego
  // (cerrando la ventana o clickeando afuera de ella) -- ver `gamePlaying`.
  if (gamePlaying) return;

  // Popup de Controles esperando que se apriete la tecla nueva para una
  // acción: se la lleva entera, no debe disparar nada ni navegar atrás.
  if (controlsCapture) { e.preventDefault(); handleControlsCapture(e); return; }

  // Con algun popup abierto (info F3, Controles F2, Ayuda F1 o Novedades),
  // Escape lo cierra y el resto de los atajos de navegación quedan
  // bloqueados para no mover la selección de atrás sin que se vea.
  if (infoModalEl && infoModalEl.classList.contains('show')) {
    if (e.key === 'Escape') { e.preventDefault(); closeInfoModal(); }
    return;
  }
  if (controlsModalEl && controlsModalEl.classList.contains('show')) {
    if (e.key === 'Escape') { e.preventDefault(); closeControlsModal(); }
    return;
  }
  if (helpModalEl && helpModalEl.classList.contains('show')) {
    if (e.key === 'Escape') { e.preventDefault(); closeHelpModal(); }
    return;
  }
  if (newGamesModalEl && newGamesModalEl.classList.contains('show')) {
    if (e.key === 'Escape') { e.preventDefault(); closeNewGamesModal(); }
    return;
  }

  // Alias fijos que siempre funcionan además de lo que esté configurado en
  // "switchPanel", para no perder la navegación base aunque se reasigne.
  if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { e.preventDefault(); switchFocus(); return; }

  const actionId = CODE_TO_ACTION[e.code];
  const handler = actionId && ACTION_HANDLERS[actionId];
  if (handler) { e.preventDefault(); handler(); }
});

// Cualquier click que no caiga dentro de una ventana de juego (.window)
// cuenta como "salir del juego": le devuelve el teclado al shell. Captura
// (no bubbling) para llegar antes que el propio handler de mousedown de la
// ventana (que hace foco/`gamePlaying = id` cuando el click SI es adentro).
document.addEventListener('mousedown', e => {
  if (!e.target.closest || !e.target.closest('.window')) gamePlaying = null;
}, true);

// F1 solia escribir una linea de ayuda en el cmdline; ahora abre el popup
// de Ayuda / Contacto (ver #helpModal en index.html) con el mismo resumen
// de atajos arriba de un formulario para feedback o pedidos de juegos.
function showHelp() {
  openHelpModal();
}

function openHelpModal() {
  if (!helpModalEl) return;
  if (infoModalEl) closeInfoModal();
  if (controlsModalEl) closeControlsModal();
  helpModalEl.classList.add('show');
}

function closeHelpModal() {
  if (helpModalEl) helpModalEl.classList.remove('show');
}

if (helpModalCloseBtn) helpModalCloseBtn.addEventListener('click', closeHelpModal);
// Click en el fondo oscuro (fuera del diálogo) también cierra.
if (helpModalEl) helpModalEl.addEventListener('click', e => { if (e.target === helpModalEl) closeHelpModal(); });

/* ---------- FORMULARIO DE CONTACTO (dentro del popup de Ayuda) ---------- */
// Se envia a Netlify Forms: el sitio esta hosteado en Netlify, que detecta
// el <form data-netlify="true"> al buildear el sitio (por eso el form tiene
// que existir siempre en el HTML, no armarse recien por JS) y junta los
// envios en Site settings -> Forms del panel de Netlify. Aca solo se
// intercepta el submit para mandarlo por fetch y no recargar la pagina.
function encodeFormData(form) {
  return new URLSearchParams(new FormData(form)).toString();
}

if (helpForm) {
  helpForm.addEventListener('submit', e => {
    e.preventDefault();
    if (helpFormSubmit) helpFormSubmit.disabled = true;
    if (helpFormStatus) { helpFormStatus.textContent = t('form.sending'); helpFormStatus.className = 'dv-form-status'; }

    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: encodeFormData(helpForm),
    })
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        helpForm.classList.add('sent');
        if (helpFormStatus) { helpFormStatus.textContent = t('form.sent'); helpFormStatus.className = 'dv-form-status ok'; }
        helpForm.reset();
      })
      .catch(err => {
        console.error('No se pudo enviar el formulario de contacto:', err);
        if (helpFormStatus) { helpFormStatus.textContent = t('form.error'); helpFormStatus.className = 'dv-form-status error'; }
      })
      .finally(() => {
        if (helpFormSubmit) helpFormSubmit.disabled = false;
      });
  });
}

/* ---------- POPUP DE NOVEDADES ---------- */
// Compara el campo "added" ("YYYY-MM-DD") de cada juego en data/games.json
// contra la fecha de la ultima visita guardada en localStorage (por
// navegador). Si hay juegos con "added" mas nuevo, los lista en un popup al
// entrar. La primera vez que alguien entra (sin fecha guardada todavia) no
// se muestra nada -- solo se guarda la fecha de hoy como punto de partida,
// para no mostrar los 52 juegos existentes como si fueran "nuevos".
const LAST_VISIT_KEY = 'dosvaultLastVisit';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function checkNewGames(recentList) {
  let lastVisit = null;
  try { lastVisit = localStorage.getItem(LAST_VISIT_KEY); } catch (err) {
    console.error('No se pudo leer la fecha de la ultima visita (localStorage no disponible):', err);
  }

  const candidateGames = (Array.isArray(recentList) && recentList.length) ? recentList : GAMES;

  if (lastVisit) {
    const newOnes = candidateGames
      .filter(g => g.added && g.added > lastVisit)
      .sort((a, b) => a.added === b.added ? gameSortLabel(a).localeCompare(gameSortLabel(b), 'es') : a.added.localeCompare(b.added));
    if (newOnes.length) openNewGamesModal(newOnes);
  }

  try { localStorage.setItem(LAST_VISIT_KEY, todayStr()); } catch (err) {
    console.error('No se pudo guardar la fecha de esta visita (localStorage no disponible):', err);
  }
}

function newGamesIntro(n) {
  return n === 1 ? t('newgames.intro.one') : t('newgames.intro.many', { n });
}

function openNewGamesModal(list) {
  if (!newGamesModalEl || !newGamesModalBody) return;
  const rows = list.map(g => {
    const genreText = genreLabel(g.genre).toUpperCase();
    return `<div class="newgame-row"><span class="ng-name">${toDosName(g.title || g.name)}</span><span class="ng-meta">${genreText} · ${g.year}</span></div>`;
  }).join('');
  newGamesModalBody.innerHTML = `<p class="ng-intro">${newGamesIntro(list.length)}</p>${rows}`;
  newGamesModalEl.classList.add('show');
}

function closeNewGamesModal() {
  if (newGamesModalEl) newGamesModalEl.classList.remove('show');
}

if (newGamesModalCloseBtn) newGamesModalCloseBtn.addEventListener('click', closeNewGamesModal);
if (newGamesModalEl) newGamesModalEl.addEventListener('click', e => { if (e.target === newGamesModalEl) closeNewGamesModal(); });

/* ---------- POPUP DE AYUDA SCUMMVM ----------
 * ScummVM reimplementa el motor del juego (no corre el .EXE original), asi
 * que no hay un menu nativo del juego separado del propio de ScummVM: el
 * boton [≡] de la titlebar (ver launchGame) es la UNICA forma de llegar a
 * Guardar/Cargar/Opciones, y no se explica en ningun otro lado del sitio.
 * Por eso, antes de arrancar un juego con ese motor, se avisa que boton usar
 * y que sigue disponible en pantalla completa (ver scummvm-engine.js). Se
 * muestra SIEMPRE, salvo que el usuario tilde "No volver a mostrar" (se
 * guarda en localStorage por navegador, mismo patron que CONTROLS_STORAGE_KEY
 * / LAST_VISIT_KEY mas arriba/abajo). */
const SCUMMVM_HINT_DISMISSED_KEY = 'dosvaultScummvmHintDismissed';

function isScummvmHintDismissed() {
  try {
    return localStorage.getItem(SCUMMVM_HINT_DISMISSED_KEY) === '1';
  } catch (err) {
    console.error('No se pudo leer el estado del aviso de ScummVM (localStorage no disponible):', err);
    return false;
  }
}

// Se resuelve cuando el usuario cierra el modal, para que launchGame pueda
// esperar (.then) antes de arrancar el juego de verdad.
let scummvmHintResolve = null;

function openScummvmHintModal() {
  return new Promise(resolve => {
    if (!scummvmHintModalEl || !scummvmHintModalBody) { resolve(); return; }
    scummvmHintResolve = resolve;
    scummvmHintModalBody.innerHTML = `<p>${t('scummvmhint.body1')}</p><p>${t('scummvmhint.body2')}</p>`;
    if (scummvmHintDismissCheckbox) scummvmHintDismissCheckbox.checked = false;
    scummvmHintModalEl.classList.add('show');
  });
}

function closeScummvmHintModal() {
  if (!scummvmHintModalEl) return;
  scummvmHintModalEl.classList.remove('show');
  try {
    if (scummvmHintDismissCheckbox && scummvmHintDismissCheckbox.checked) {
      localStorage.setItem(SCUMMVM_HINT_DISMISSED_KEY, '1');
    }
  } catch (err) {
    console.error('No se pudo guardar el estado del aviso de ScummVM (localStorage no disponible):', err);
  }
  const resolve = scummvmHintResolve;
  scummvmHintResolve = null;
  if (resolve) resolve();
}

if (scummvmHintModalCloseBtn) scummvmHintModalCloseBtn.addEventListener('click', closeScummvmHintModal);
if (scummvmHintModalEl) scummvmHintModalEl.addEventListener('click', e => { if (e.target === scummvmHintModalEl) closeScummvmHintModal(); });

/* ---------- PROBAR UN BUNDLE LOCAL (F9) ----------
 * Herramienta de testing: deja elegir un archivo LOCAL (.jsdos o .zip) y
 * jugarlo directo, sin pasar por data/games.json ni por ningun storage --
 * el archivo nunca sale del navegador. Se lee con la File API y se le pasa
 * al motor una blob: URL (URL.createObjectURL), que tanto js-dos como el
 * fetch() de scummvm-engine.js/launcher.html resuelven igual que una URL
 * http normal. Sirve para probar un bundle recien armado con el skill
 * dosvault-bundle-creator antes de subirlo a R2 y sumarlo al catalogo.
 * El motor NO se auto-detecta por extension a proposito: se le pregunta
 * siempre al usuario (dos botones), asi no hay ambiguedad si algun bundle
 * no sigue la convencion .jsdos/.zip. */
const testBundleBlobUrls = {}; // id de ventana -> blob: URL, para revocarla al cerrar (ver closeWin)
let testBundlePendingEngine = null;

function openTestBundleModal() {
  if (!testBundleModalEl || !testBundleModalBody) return;
  testBundleModalBody.innerHTML = `<p>${t('testbundle.body')}</p>`;
  testBundleModalEl.classList.add('show');
}

function closeTestBundleModal() {
  if (!testBundleModalEl) return;
  testBundleModalEl.classList.remove('show');
}

function pickTestBundleFile(engine, accept) {
  if (!testBundleFileInput) return;
  testBundlePendingEngine = engine;
  testBundleFileInput.accept = accept;
  testBundleFileInput.value = '';
  testBundleFileInput.click();
}

if (testBundleJsdosBtn) testBundleJsdosBtn.addEventListener('click', () => pickTestBundleFile('jsdos', '.jsdos'));
if (testBundleScummvmBtn) testBundleScummvmBtn.addEventListener('click', () => pickTestBundleFile('scummvm', '.zip'));
if (testBundleModalCloseBtn) testBundleModalCloseBtn.addEventListener('click', closeTestBundleModal);
if (testBundleModalEl) testBundleModalEl.addEventListener('click', e => { if (e.target === testBundleModalEl) closeTestBundleModal(); });

if (testBundleFileInput) {
  testBundleFileInput.addEventListener('change', () => {
    const file = testBundleFileInput.files && testBundleFileInput.files[0];
    const engine = testBundlePendingEngine;
    testBundlePendingEngine = null;
    if (!file || !engine) return;
    closeTestBundleModal();
    const id = 'test-' + Date.now();
    const blobUrl = URL.createObjectURL(file);
    testBundleBlobUrls[id] = blobUrl;
    const name = file.name.replace(/\.(jsdos|zip)$/i, '') || 'TEST';
    launchGame({ id, name, engine, bundle: blobUrl });
  });
}

/* ---------- FKEYS ----------
 * El texto de cada botón (fkey.f1..f5, en js/i18n.js) es el que el usuario
 * define como nombre visible; la acción de acá abajo tiene que corresponder
 * a ESE nombre, no al número de F-key original. Con la traducción actual:
 * F1=Controles, F2=Información, F3=Ejecutar, F4=Refrescar, F5=Ayuda. */
const FKEYS = [
  { key: 'F1', labelKey: 'fkey.f1', action: () => openControlsModal() },
  { key: 'F2', labelKey: 'fkey.f2', action: () => openInfoModalForSelection() },
  { key: 'F3', labelKey: 'fkey.f3', action: () => runSelection() },
  { key: 'F4', labelKey: 'fkey.f4', action: () => location.reload() },
  { key: 'F5', labelKey: 'fkey.f5', action: () => showHelp() },
  { key: 'F9', labelKey: 'fkey.f9', action: () => openTestBundleModal() },
  {
    key: 'F10', labelKey: 'fkey.f10', action: () => {
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
    el.innerHTML = `<span class="num">${fk.key.replace('F', '')}</span><span class="label">${t(fk.labelKey)}</span>`;
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
  // Se busca primero en el idioma activo del sitio y despues en el otro --
  // asi alguien viendo el sitio en ingles recibe la sinopsis en ingles
  // cuando existe (muchos juegos DOS viejos tienen mejor cobertura ahi).
  const langOrder = currentLang === 'en' ? ['en', 'es'] : ['es', 'en'];
  for (const lang of langOrder) {
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
  infoModalBody.innerHTML = `<div class="info-loading">${t('info.searching', { title: displayTitle })}<span class="cursor-blink"></span></div>`;
  infoModalEl.classList.add('show');

  // La cache se indexa tambien por idioma: si el visitante cambia de
  // idioma y vuelve a abrir el mismo juego, se busca de nuevo en vez de
  // mostrar la sinopsis que habia quedado en el idioma anterior.
  const cacheKey = currentLang + ':' + g.id;
  if (!(cacheKey in WIKI_CACHE)) {
    WIKI_CACHE[cacheKey] = await fetchWikiInfo(g.title || g.name);
  }
  // Por si se cerró el popup mientras la búsqueda seguía en vuelo.
  if (infoModalEl.classList.contains('show')) renderInfoModal(g, WIKI_CACHE[cacheKey]);
}

// Largo máximo de la sinopsis antes de cortar (y ofrecer "ver más"). Corta
// en el espacio más cercano para no partir una palabra a la mitad.
const INFO_SYNOPSIS_LIMIT = 260;
function truncateSynopsis(text) {
  if (!text || text.length <= INFO_SYNOPSIS_LIMIT) return text;
  const cut = text.slice(0, INFO_SYNOPSIS_LIMIT);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + '…';
}

function renderInfoModal(g, data) {
  if (!infoModalBody) return;
  const titleText = (data && data.title) || g.title || g.name;
  const publisher = (data && data.publisher) || t('info.unknownPublisher');
  const fullSynopsis = (data && data.extract) ? data.extract : t('info.noSynopsis');
  const synopsis = truncateSynopsis(fullSynopsis);
  // Portada: primero la de data/games.json (campo "cover", curada a mano),
  // y si no hay ("empty" o vacío) la que haya traído la búsqueda en
  // Wikipedia.
  const cover = (g.cover && g.cover !== 'empty') ? g.cover : (data && data.image);
  // "Ver más": a la página de Wikipedia si se encontró una, si no a una
  // búsqueda en Google -- así el botón siempre lleva a algún lado.
  const moreUrl = (data && data.sourceUrl) ||
    `https://www.google.com/search?q=${encodeURIComponent((g.title || g.name) + ' DOS video game')}`;

  infoModalBody.innerHTML = `
    <div class="info-cols">
      ${cover
      ? `<img class="info-image" src="${cover}" alt="${titleText}">`
      : `<div class="info-image info-image-empty">${t('info.noImage')}</div>`}
      <div class="info-text">
        <div class="info-title">${titleText}</div>
        <div class="info-meta"><b>${t('info.year')}</b> ${g.year} &nbsp;&nbsp; <b>${t('info.publisher')}</b> ${publisher}</div>
        <div class="info-synopsis">${synopsis}</div>
        <a class="info-more" href="${moreUrl}" target="_blank" rel="noopener">${t('info.more')}</a>
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
// Qué tab del popup está activo: "nav" (controles de navegación del sitio)
// o "game" (controles básicos dentro del juego -- ESC/CTRL/ALT/Espacio).
// Separados en tabs porque son dos cosas conceptualmente distintas: nav ya
// está conectado a la UI del shell, game queda guardado/asignable pero
// todavía no le llega al juego (ver nota en CONTROL_ACTIONS más arriba).
let controlsActiveTab = 'nav';

function openControlsModal() {
  if (!controlsModalEl) return;
  if (infoModalEl && infoModalEl.classList.contains('show')) closeInfoModal();
  controlsCapture = null;
  controlsActiveTab = 'nav';
  renderControlsModal();
  controlsModalEl.classList.add('show');
}

function closeControlsModal() {
  controlsCapture = null;
  if (controlsModalEl) controlsModalEl.classList.remove('show');
}

function setControlsTab(tab) {
  if (tab !== 'nav' && tab !== 'game') return;
  if (tab === controlsActiveTab) return;
  controlsCapture = null;
  controlsActiveTab = tab;
  renderControlsModal();
}

if (controlsModalEl) {
  controlsModalEl.querySelectorAll('.controls-tab').forEach(tabEl => {
    tabEl.addEventListener('click', () => setControlsTab(tabEl.dataset.tab));
  });
}

function renderControlsModal() {
  if (!controlsModalBody) return;

  const tabNavEl = document.getElementById('controlsTabNav');
  const tabGameEl = document.getElementById('controlsTabGame');
  [[tabNavEl, 'nav'], [tabGameEl, 'game']].forEach(([el, id]) => {
    if (!el) return;
    const isActive = controlsActiveTab === id;
    el.classList.toggle('active', isActive);
    el.setAttribute('aria-selected', String(isActive));
  });

  const note = controlsActiveTab === 'game' ? t('ctrl.group.game.note') : '';
  const actions = CONTROL_ACTIONS.filter(a => a.group === controlsActiveTab);
  const rows = actions.map(a => `
      <div class="controls-row">
        <div class="cr-label">${actionLabel(a)}${a.hint ? `<span class="cr-hint">${actionHint(a)}</span>` : ''}</div>
        <span class="cr-key">${codeLabel(KEYMAP[a.id])}</span>
        <span class="cr-btn" data-action="${a.id}">${t('btn.change')}</span>
      </div>`).join('');
  controlsModalBody.innerHTML = `${note ? `<div class="controls-group-note">${note}</div>` : ''}${rows}`;

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
  if (keyEl) keyEl.textContent = t('ctrl.pressKey');
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

/* ---------- KEYBOARD LOCK EN PANTALLA COMPLETA ---------- */
// Cuando un juego entra a pantalla completa REAL del navegador (Fullscreen
// API, boton [⛶] mas abajo), pedimos tambien el Keyboard Lock API
// (navigator.keyboard.lock()) para que combinaciones que el propio
// NAVEGADOR reserva (algunos atajos de Chrome/Edge) le lleguen al juego en
// vez de disparar su accion habitual mientras se esta jugando.
//
// OJO -- limite real, no es un bug: esto NO puede evitar atajos GLOBALES
// del sistema operativo (ej. una tecla o gesto configurado para abrir una
// app como Claude, Spotlight, Alfred, Raycast, etc.). Esos atajos los
// captura el sistema operativo ANTES de que el evento le llegue al
// navegador -- ninguna pagina web, DOSVault incluido, tiene forma de
// interceptarlos ni bloquearlos desde JS. Si "Opcion x3" abre Claude,
// hay que desactivar o cambiar ese atajo desde la configuracion de la app
// que lo escucha (ej. Configuracion de Claude de escritorio -> atajo
// global) o desde Preferencias del Sistema > Teclado en macOS.
//
// Solo funciona en navegadores Chromium (Chrome/Edge/Opera) y solo estando
// en fullscreen real; en el resto de los navegadores navigator.keyboard no
// existe y esto no hace nada (silenciosamente).
if (document.addEventListener) {
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
      if (navigator.keyboard && navigator.keyboard.lock) {
        navigator.keyboard.lock().catch(err => {
          console.warn('Keyboard Lock no disponible en este navegador:', err);
        });
      }
    } else if (navigator.keyboard && navigator.keyboard.unlock) {
      navigator.keyboard.unlock();
    }
  });
}

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
  if (g.engine === 'scummvm' && !isScummvmHintDismissed()) {
    openScummvmHintModal().then(() => doLaunchGame(g));
    return;
  }
  doLaunchGame(g);
}

function doLaunchGame(g) {
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
        ${isScummvm ? `<span class="win-btn menu" title="${t('win.menuTooltip')}">[≡]</span>` : ''}
        ${g.bundle ? `<span class="win-btn fs" title="${t('win.fsTooltip')}">[⛶]</span>` : ''}
        <span class="win-btn max">[□]</span>
        <span class="win-btn close">[X]</span>
      </div>
    </div>
    <div class="win-body">
      <div class="boot-lines"></div>
      <div class="win-screen" style="display:none;">
        <div class="big-title">${g.name.toUpperCase()}</div>
        <div class="hint">${t('win.noBundleHint')}</div>
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
    isScummvm ? t('boot.scummEngine') : t('boot.dosEngine'),
    isScummvm ? t('boot.detectingEngineScumm') : t('boot.detectingSound'),
    t('boot.mounting', { id: g.id.toUpperCase() }),
    isScummvm ? t('boot.autoDetecting') : t('boot.loading', { id: g.id.toUpperCase() }),
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
          container.textContent = t('err.scummStart') + err.message;
          return null;
        });
        // En cuanto la ventana quede activa (foco de mouse/teclado), que
        // el teclado apunte al iframe del juego, no al documento principal.
        dosInstances[g.id].then(inst => { if (inst && inst.focus) inst.focus(); });
      } else {
        container.style.color = '#f66';
        container.style.padding = '14px';
        container.textContent = t('err.scummEngineMissing');
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
        if (fsBtnEl) fsBtnEl.title = t('win.fsRealTooltip');
        // Mantiene el título del botón sincronizado si el usuario sale de
        // pantalla completa apretando ESC directamente (en vez de clickear
        // el botón).
        dosLayers[g.id].setOnFullscreen(active => {
          if (fsBtnEl) fsBtnEl.title = active ? t('win.fsExitTooltip') : t('win.fsRealTooltip');
        });
      } else {
        container.style.color = '#f66';
        container.style.padding = '14px';
        container.textContent = t('err.jsdosMissing');
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

  // La ventana recien abierta queda arriba de todo y con el foco: el
  // teclado pasa a ser del juego (ver `gamePlaying` y el guard al principio
  // del listener de keydown).
  gamePlaying = g.id;
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
  gamePlaying = id;
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
  if (gamePlaying === id) gamePlaying = null;
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
  if (gamePlaying === id) gamePlaying = null;
  if (dosInstances[id]) {
    // Tanto js-dos (CommandInterface) como el wrapper de ScummVM exponen
    // una promesa que resuelve a un objeto con .exit() — mismo contrato,
    // no hace falta bifurcar acá según el motor.
    dosInstances[id].then(ci => { if (ci && ci.exit) ci.exit(); }).catch(() => { });
    delete dosInstances[id];
  }
  // Bundles de prueba (F9): la blob: URL vive solo mientras dura la
  // ventana -- liberarla ahora evita ir acumulando memoria si se prueban
  // varios archivos seguidos en la misma visita.
  if (testBundleBlobUrls[id]) {
    URL.revokeObjectURL(testBundleBlobUrls[id]);
    delete testBundleBlobUrls[id];
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
    GENRES = data.genres || {};
    GAMES = data.games || [];
    buildLeftItems();
    renderLeftPanel();
    if (LEFT_ITEMS.length) selectGenre(LEFT_ITEMS[0].id);
    updateCmdline();
    updateStatusBars();
    // data/games.json es ahora solo el indice (genero -> url del JSON de ese
    // genero, ver GENRE_GAMES_CACHE / selectGenre mas arriba) -- ya no trae
    // "games" ni "recentGames" embebidos, asi que para el popup de
    // "novedades" hay que pedir los 9 archivos de genero una sola vez. Son
    // chicos (unos pocos KB cada uno), asi que no vale la pena mantener a
    // mano una lista aparte de "juegos recientes" que se puede desincronizar
    // de los archivos reales. De paso, lo que se descarga aca queda en
    // GENRE_GAMES_CACHE, asi que entrar a esa categoria despues no vuelve a
    // pedir el archivo.
    loadAllGamesForNewCheck(GENRES);
  })
  .catch(err => {
    panelRightList.innerHTML = `<div class="panel-row" style="color:#fff;padding:20px;">${t('err.loadGames')}</div>`;
    console.error(err);
  });

function loadAllGamesForNewCheck(genres) {
  const fetches = Object.keys(genres).map(gid => {
    const entry = genres[gid];
    const url = entry && typeof entry === 'object' ? entry.url : null;
    if (!url) return Promise.resolve([]);
    return fetch(url)
      .then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(data => {
        const rawGames = Array.isArray(data) ? data : (data.games || []);
        const sorted = rawGames.slice().sort((a, b) => gameSortLabel(a).localeCompare(gameSortLabel(b), 'es'));
        if (!GENRE_GAMES_CACHE[gid]) GENRE_GAMES_CACHE[gid] = sorted;
        return sorted;
      })
      .catch(err => {
        console.error(`No se pudieron precargar los juegos de "${gid}" para el chequeo de novedades:`, err);
        return [];
      });
  });
  Promise.all(fetches).then(lists => checkNewGames(lists.flat()));
}

// Cambio de idioma (switch ES/EN, ver js/i18n.js): todo lo que ya se haya
// dibujado con texto hardcodeado (fkeys, paneles, popup de controles si
// esta abierto) se vuelve a dibujar en el idioma nuevo. Lo que es HTML
// estatico (titulos de popup, formulario, etc.) ya lo actualiza
// applyStaticI18n() en i18n.js -- no hace falta tocarlo desde aca.
document.addEventListener('dv:langchange', () => {
  buildLeftItems();
  if (currentGenre) selectGenre(currentGenre);
  renderFkeys();
  render();
  if (controlsModalEl && controlsModalEl.classList.contains('show')) renderControlsModal();
});
