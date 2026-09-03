/* ---------- I18N (Español / English) ----------
 * Todo el texto visible del sitio (menus, mensajes, formulario) vive aca en
 * dos diccionarios planos (I18N.es / I18N.en) mas uno separado para los
 * generos (I18N_GENRES), porque esos ids vienen de data/games.json y no
 * queremos duplicar esa lista en dos lugares.
 *
 * Deteccion de idioma: si el visitante ya eligio uno a mano (guardado en
 * localStorage) se respeta esa eleccion para siempre. Si no, se usa el
 * idioma del navegador: cualquier variante de español ("es", "es-AR",
 * "es-MX", etc.) muestra el sitio en español; cualquier otro idioma
 * (ingles, portugues, frances, lo que sea) muestra el sitio en ingles, que
 * es el idioma por default para todo lo que no sea español.
 */

const LANG_STORAGE_KEY = 'dosvaultLang';

const I18N = {
  es: {
    'mobile.title': 'Aviso del sistema',
    'mobile.body': '<span class="mb-strong">Este catálogo requiere una computadora de escritorio.</span>La emulación de DOS necesita teclado, mouse y más potencia de la que un navegador móvil puede ofrecer. Abrí este sitio desde tu PC para continuar.',

    'col.name': 'Nombre',
    'col.size': 'Tamaño',
    'col.date': 'Fecha',
    'col.time': 'Hora',

    'modal.info.title': 'Info del juego',
    'modal.controls.title': 'Controles',
    'modal.help.title': 'Ayuda / Contacto',
    'modal.newgames.title': 'Novedades',

    'btn.close': '[ Cerrar ]',
    'btn.resetDefaults': '[ Restaurar por defecto ]',
    'btn.change': '[ Cambiar ]',
    'btn.submit': '[ Enviar ]',

    'help.intro2': '¿Encontraste un error, tenes feedback o queres pedir un juego que falta? Dejalo aca abajo:',

    'form.honeypot': 'No completar este campo:',
    'form.name': 'Nombre (opcional)',
    'form.email': 'Email (opcional, para poder responderte)',
    'form.type': 'Tipo',
    'form.type.feedback': 'Feedback general',
    'form.type.request': 'Pedido de un juego',
    'form.type.bug': 'Reporte de error',
    'form.type.other': 'Otro',
    'form.message': 'Mensaje',
    'form.sending': 'Enviando...',
    'form.sent': '¡Gracias! Tu mensaje se envio.',
    'form.error': 'No se pudo enviar. Probá de nuevo en un rato.',

    'ctrl.moveUp.label': 'Mover arriba',
    'ctrl.moveDown.label': 'Mover abajo',
    'ctrl.switchPanel.label': 'Cambiar de panel',
    'ctrl.switchPanel.hint': '<- y -> siempre funcionan además, pase lo que pase acá',
    'ctrl.confirm.label': 'Confirmar',
    'ctrl.confirm.hint': 'Abrir categoría / lanzar juego',
    'ctrl.run.label': 'Ejecutar juego',
    'ctrl.run.hint': 'Igual que Confirmar, con un juego seleccionado',
    'ctrl.help.label': 'Ayuda',
    'ctrl.controls.label': 'Controles',
    'ctrl.info.label': 'Info del juego',
    'ctrl.refresh.label': 'Refrescar',
    'ctrl.closeActive.label': 'Cerrar ventana activa',
    'ctrl.action1.label': 'Acción primaria',
    'ctrl.action1.hint': 'Reservado para más adelante (ej. palanca/botón principal de un juego)',
    'ctrl.action2.label': 'Acción secundaria',
    'ctrl.action2.hint': 'Reservado para más adelante (ej. palanca/botón secundario de un juego)',

    'ctrl.group.nav': 'Navegación',
    'ctrl.group.game': 'Dentro del juego',
    'ctrl.group.game.note': 'Reservado para más adelante -- por ahora no hacen nada dentro de los juegos, pero ya se pueden asignar.',
    'ctrl.pressKey': 'Presioná una tecla...',
    'ctrl.unassigned': '— sin asignar —',

    'code.ctrlLeft': 'Ctrl (izq)',
    'code.ctrlRight': 'Ctrl (der)',
    'code.altLeft': 'Alt (izq)',
    'code.altRight': 'Alt (der)',
    'code.shiftLeft': 'Shift (izq)',
    'code.shiftRight': 'Shift (der)',
    'code.space': 'Espacio',

    'fkey.f1': 'Controles',
    'fkey.f2': 'Informacion',
    'fkey.f3': 'Ejecutar',
    'fkey.f4': 'Refrescar',
    'fkey.f5': 'Ayuda',
    'fkey.f9': 'Probar',
    'fkey.f10': 'Cerrar',

    'info.searching': 'Buscando información de {title}...',
    'info.unknownPublisher': 'Desconocida',
    'info.noSynopsis': 'No se encontró sinopsis para este juego en Wikipedia.',
    'info.noImage': 'Sin imagen<br>disponible',
    'info.year': 'Año:',
    'info.publisher': 'Distribuidora:',
    'info.more': '[ Ver más ]',

    'toast.selectGameFirst': 'Seleccioná un juego primero y después presioná Ejecutar.',

    'win.menuTooltip': 'Menu ScummVM (Guardar/Cargar/Opciones)',
    'win.fsTooltip': 'Pantalla completa (ESC queda libre para el juego)',
    'win.fsRealTooltip': 'Pantalla completa real (ESC para salir)',
    'win.fsExitTooltip': 'Salir de pantalla completa (ESC)',
    'win.noBundleHint': 'Todavía no hay un bundle asignado a este juego. Agregalo en data/games.json (campo "bundle") o dejalo local en la carpeta games/ para que arranque acá el motor real.',

    'modal.scummvmHint.title': 'Cómo jugar con ScummVM',
    'scummvmhint.body1': 'Este juego usa el motor <strong>ScummVM</strong>, que no corre el .EXE original: reimplementa el juego, así que no vas a ver su menú de guardado nativo.',
    'scummvmhint.body2': 'Mientras jugás, el botón <strong>[≡]</strong> de la barra de arriba de la ventana abre el menú de ScummVM (Guardar, Cargar, Opciones) — y sigue disponible aunque actives la pantalla completa con <strong>[⛶]</strong>.',
    'scummvmhint.dontShowAgain': 'No volver a mostrar este mensaje',
    'btn.continue': '[ Continuar ]',

    'modal.testBundle.title': 'Probar un bundle',
    'testbundle.body': 'Elegí el motor y después el archivo (.jsdos para js-dos, .zip para ScummVM). Se juega directo en tu navegador — el archivo no se sube a ningún servidor.',
    'testbundle.jsdos': '[ js-dos (.jsdos) ]',
    'testbundle.scummvm': '[ ScummVM (.zip) ]',

    'boot.scummEngine': 'ScummVM Engine v1.0',
    'boot.dosEngine': 'MS-DOS Emulator v1.0',
    'boot.detectingEngineScumm': 'Detectando motor del juego...',
    'boot.detectingSound': 'Detectando controladora de sonido... Sound Blaster 16 OK',
    'boot.mounting': 'Montando C:\\GAMES\\{id}...',
    'boot.autoDetecting': 'Auto-detectando juego...',
    'boot.loading': 'Cargando {id}.EXE...',

    'err.scummStart': 'No se pudo iniciar ScummVM: ',
    'err.scummEngineMissing': 'No se pudo cargar el motor de ScummVM (js/scummvm-engine.js).',
    'err.jsdosMissing': 'No se pudo cargar js-dos (revisá la conexión a internet).',
    'err.loadGames': 'No se pudo cargar data/games.json. Si abriste el archivo directo (file://), corré un servidor local — ver README.md.',

    'common.na': 'N/D',
    'common.loading': 'Cargando...',
    'cmd.categories': 'CATEGORIAS',

    'newgames.intro.one': 'Se agregó 1 juego nuevo desde tu última visita:',
    'newgames.intro.many': 'Se agregaron {n} juegos nuevos desde tu última visita:',
  },

  en: {
    'mobile.title': 'System notice',
    'mobile.body': '<span class="mb-strong">This catalog requires a desktop computer.</span> DOS emulation needs a keyboard, mouse, and more power than a mobile browser can offer. Open this site from your PC to continue.',

    'col.name': 'Name',
    'col.size': 'Size',
    'col.date': 'Date',
    'col.time': 'Time',

    'modal.info.title': 'Game info',
    'modal.controls.title': 'Controls',
    'modal.help.title': 'Help / Contact',
    'modal.newgames.title': "What's new",

    'btn.close': '[ Close ]',
    'btn.resetDefaults': '[ Reset to default ]',
    'btn.change': '[ Change ]',
    'btn.submit': '[ Send ]',

    'help.intro2': 'Found a bug, have feedback, or want to request a missing game? Leave it below:',

    'form.honeypot': 'Do not fill this field:',
    'form.name': 'Name (optional)',
    'form.email': 'Email (optional, so we can reply)',
    'form.type': 'Type',
    'form.type.feedback': 'General feedback',
    'form.type.request': 'Game request',
    'form.type.bug': 'Bug report',
    'form.type.other': 'Other',
    'form.message': 'Message',
    'form.sending': 'Sending...',
    'form.sent': 'Thanks! Your message was sent.',
    'form.error': "Couldn't send it. Try again in a bit.",

    'ctrl.moveUp.label': 'Move up',
    'ctrl.moveDown.label': 'Move down',
    'ctrl.switchPanel.label': 'Switch panel',
    'ctrl.switchPanel.hint': "<- and -> always work too, no matter what's set here",
    'ctrl.confirm.label': 'Confirm',
    'ctrl.confirm.hint': 'Open category / launch game',
    'ctrl.run.label': 'Run game',
    'ctrl.run.hint': 'Same as Confirm, with a game selected',
    'ctrl.help.label': 'Help',
    'ctrl.controls.label': 'Controls',
    'ctrl.info.label': 'Game info',
    'ctrl.refresh.label': 'Refresh',
    'ctrl.closeActive.label': 'Close active window',
    'ctrl.action1.label': 'Primary action',
    'ctrl.action1.hint': "Reserved for later (e.g. a game's main stick/button)",
    'ctrl.action2.label': 'Secondary action',
    'ctrl.action2.hint': "Reserved for later (e.g. a game's secondary stick/button)",

    'ctrl.group.nav': 'Navigation',
    'ctrl.group.game': 'Inside the game',
    'ctrl.group.game.note': "Reserved for later -- these don't do anything inside games yet, but they can already be assigned.",
    'ctrl.pressKey': 'Press a key...',
    'ctrl.unassigned': '— unassigned —',

    'code.ctrlLeft': 'Ctrl (L)',
    'code.ctrlRight': 'Ctrl (R)',
    'code.altLeft': 'Alt (L)',
    'code.altRight': 'Alt (R)',
    'code.shiftLeft': 'Shift (L)',
    'code.shiftRight': 'Shift (R)',
    'code.space': 'Space',

    'fkey.f1': 'Controls',
    'fkey.f2': 'Info',
    'fkey.f3': 'Run',
    'fkey.f4': 'Refresh',
    'fkey.f5': 'Help',
    'fkey.f9': 'Test',
    'fkey.f10': 'Close',

    'info.searching': 'Searching for info on {title}...',
    'info.unknownPublisher': 'Unknown',
    'info.noSynopsis': 'No synopsis was found for this game on Wikipedia.',
    'info.noImage': 'No image<br>available',
    'info.year': 'Year:',
    'info.publisher': 'Publisher:',
    'info.more': '[ See more ]',

    'toast.selectGameFirst': 'Select a game first, then press Run.',

    'win.menuTooltip': 'ScummVM menu (Save/Load/Options)',
    'win.fsTooltip': 'Fullscreen (ESC stays free for the game)',
    'win.fsRealTooltip': 'Real fullscreen (ESC to exit)',
    'win.fsExitTooltip': 'Exit fullscreen (ESC)',
    'win.noBundleHint': 'There is no bundle assigned to this game yet. Add one in data/games.json (the "bundle" field), or drop it locally in the games/ folder so the real engine can boot it here.',

    'modal.scummvmHint.title': 'How to play with ScummVM',
    'scummvmhint.body1': 'This game runs on the <strong>ScummVM</strong> engine, which reimplements the game instead of running the original .EXE — so you won\'t see its native save menu.',
    'scummvmhint.body2': 'While playing, the <strong>[≡]</strong> button on the window\'s title bar opens the ScummVM menu (Save, Load, Options) — it stays available even if you switch to fullscreen with <strong>[⛶]</strong>.',
    'scummvmhint.dontShowAgain': "Don't show this again",
    'btn.continue': '[ Continue ]',

    'modal.testBundle.title': 'Test a bundle',
    'testbundle.body': 'Pick the engine, then the file (.jsdos for js-dos, .zip for ScummVM). It plays straight in your browser — the file is never uploaded anywhere.',
    'testbundle.jsdos': '[ js-dos (.jsdos) ]',
    'testbundle.scummvm': '[ ScummVM (.zip) ]',

    'boot.scummEngine': 'ScummVM Engine v1.0',
    'boot.dosEngine': 'MS-DOS Emulator v1.0',
    'boot.detectingEngineScumm': 'Detecting game engine...',
    'boot.detectingSound': 'Detecting sound controller... Sound Blaster 16 OK',
    'boot.mounting': 'Mounting C:\\GAMES\\{id}...',
    'boot.autoDetecting': 'Auto-detecting game...',
    'boot.loading': 'Loading {id}.EXE...',

    'err.scummStart': "Couldn't start ScummVM: ",
    'err.scummEngineMissing': "Couldn't load the ScummVM engine (js/scummvm-engine.js).",
    'err.jsdosMissing': "Couldn't load js-dos (check your internet connection).",
    'err.loadGames': "Couldn't load data/games.json. If you opened the file directly (file://), run a local server — see README.md.",

    'common.na': 'N/A',
    'common.loading': 'Loading...',
    'cmd.categories': 'CATEGORIES',

    'newgames.intro.one': '1 new game was added since your last visit:',
    'newgames.intro.many': '{n} new games were added since your last visit:',
  },
};

// Generos: los ids (fps, accion, rts, ...) vienen de data/games.json y son
// el idioma "interno" del sitio -- lo unico que cambia con el idioma es la
// etiqueta que se muestra. Si en el futuro se agrega un genero nuevo al
// json sin agregar su traduccion aca, genreLabel() (en app.js) cae de
// vuelta al texto que ya trae games.json.
const I18N_GENRES = {
  es: {
    fps: 'FPS', accion: 'Acción', rts: 'Estrategia', platformer: 'Plataformas',
    avg: 'Aventuras', rpg: 'Rol', sim: 'Simulación', arcade: 'Arcade', race: 'Carreras',
  },
  en: {
    fps: 'FPS', accion: 'Action', rts: 'Strategy', platformer: 'Platformer',
    avg: 'Adventure', rpg: 'RPG', sim: 'Simulation', arcade: 'Arcade', race: 'Racing',
  },
};

function detectLang() {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'es' || saved === 'en') return saved;
  } catch (err) {
    console.error('No se pudo leer el idioma guardado (localStorage no disponible):', err);
  }
  const candidates = (navigator.languages && navigator.languages.length)
    ? navigator.languages
    : [navigator.language || navigator.userLanguage || 'en'];
  // Cualquier variante de español (es, es-AR, es-419, es-MX...) => sitio en
  // español. Cualquier otro idioma detectado => ingles, que es el default
  // para todo lo que no sea español (no solo para navegadores en ingles).
  for (const l of candidates) {
    if (/^es/i.test(l)) return 'es';
  }
  return 'en';
}

let currentLang = detectLang();

function getLang() {
  return currentLang;
}

// vars: objeto con los placeholders {nombre} a reemplazar en el string.
function t(key, vars) {
  const dict = I18N[currentLang] || I18N.en;
  let str = dict[key];
  if (str == null) str = (I18N.es[key] != null) ? I18N.es[key] : key;
  if (vars) {
    Object.keys(vars).forEach(k => {
      str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
    });
  }
  return str;
}

function updateLangButtons() {
  const esBtn = document.getElementById('langBtnEs');
  const enBtn = document.getElementById('langBtnEn');
  if (esBtn) esBtn.classList.toggle('active', currentLang === 'es');
  if (enBtn) enBtn.classList.toggle('active', currentLang === 'en');
}

function applyStaticI18n() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.getAttribute('data-i18n-html'));
  });
  updateLangButtons();
}

function setLang(lang) {
  if (lang !== 'es' && lang !== 'en') return;
  if (lang === currentLang) return;
  currentLang = lang;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch (err) {
    console.error('No se pudo guardar el idioma elegido (localStorage no disponible):', err);
  }
  applyStaticI18n();
  document.dispatchEvent(new CustomEvent('dv:langchange', { detail: { lang } }));
}

applyStaticI18n();

document.addEventListener('click', e => {
  const btn = e.target.closest('.lang-btn');
  if (btn && btn.dataset.lang) setLang(btn.dataset.lang);
});
