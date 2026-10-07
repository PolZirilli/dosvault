# DOSVault — Project Overview

> Draft prepared on 2026-10-05 from a read-only review of the public repo (`main`, last commit 2026-09-13), the live site, the project's troubleshooting notes (`dosvault-jsdos-troubleshooting.md`) and previous working sessions. Nothing in the repo was changed while writing it. Items marked **(to confirm)** could not be verified from the public sources.

## 1. What DOSVault is

DOSVault is a free, browser-based catalog of classic DOS and abandonware games. Visitors pick a game and play it directly in the browser, with no installation, through one of two WebAssembly emulation engines: **js-dos** (a full DOSBox PC emulated in the browser) or **ScummVM** (native re-implementation of classic adventure game engines).

The interface imitates a **Norton Commander**-style DOS file manager: two blue panels (genres on the left, games on the right), a command line, and an F-key bar at the bottom. Games open in draggable, DOS-styled windows inside the page.

| Item | Location |
|---|---|
| Live site | https://dosvault.netlify.app/ |
| Repository | https://github.com/PolZirilli/dosvault (public) |
| Local working copy | `/Users/pacata/Documents/Proyectos/dosvault` |
| Game bundles | Cloudflare R2, public URL `https://pub-13140bd15eda49b4a3f35bc937ab1c58.r2.dev/projects/dosvault/` |
| Owner | Pol Zirilli |

## 2. Scope

**In scope**

- MS-DOS games playable through js-dos v7 (`.jsdos` bundles).
- Classic graphic adventures (SCUMM, Sierra SCI/AGI, AGOS, Kyra, etc.) playable through ScummVM-WASM.
- Desktop browsers with keyboard and mouse; optional gamepad support via the browser Gamepad API.
- Bilingual UI: Spanish and English.

**Out of scope (current decisions)**

- Mobile and tablet devices. They are actively blocked with a "desktop required" notice (user-agent check plus coarse-pointer/narrow-screen check).
- Windows 3.x / 9x games.
- Any bundle larger than **300 MB**: this is a hard hosting limit (see section 8).
- User accounts, cloud saves, server-side logic. The site is fully static.

## 3. Architecture at a glance

DOSVault is a **static site with no build step**: plain HTML, CSS and vanilla JavaScript, served by Netlify straight from the repository. All dynamic behavior happens in the visitor's browser.

```
Visitor's browser
 ├─ index.html + css/ + js/          ← served by Netlify (from GitHub repo)
 ├─ data/games.json, data/genres/*   ← catalog, same origin, lazy-loaded per genre
 ├─ Game bundles (.jsdos / ScummVM)  ← Cloudflare R2 (fetched on launch; HEAD for size/date)
 ├─ js-dos v7 (vendored)             ← emulates the DOS PC
 ├─ ScummVM WASM (vendored, iframe)  ← adventure game engines
 └─ Third-party lookups (client-side, no keys):
     • GitHub API   → date of last commit to data/games.json
     • Wikipedia / Wikidata → game info popup (F2)
     • libretro thumbnails → box art covers
     • Netlify Forms → Help/Contact form submissions
```

## 4. Repository structure

```
dosvault/
├─ index.html                 Single page: panels, F-key bar, all modals, script loading
├─ favicon.png
├─ css/
│  ├─ style.css               Full site styling (DOS/Norton Commander look)
│  └─ fonts/                  PxPlus IBM VGA8 (self-hosted, CC BY-SA 4.0) + license
├─ js/
│  ├─ app.js                  Main application: catalog, navigation, windows, modals,
│  │                          key remapping, gamepad, test-bundle tool (~1,700 lines)
│  ├─ i18n.js                 ES/EN dictionaries, genre labels, language detection
│  ├─ scummvm-engine.js       Wrapper that runs ScummVM inside an iframe
│  └─ vendor/
│     ├─ js-dos/              js-dos 7.1.0 (js-dos.js, wdosbox.js/.wasm, css)
│     └─ scummvm/             ScummVM WASM build + launcher.html + fflate + engine plugins
├─ data/
│  ├─ games.json              Genre index (name, count, URL of each genre file)
│  └─ genres/*.json           One file per genre with its game entries
└─ .github/workflows/
   └─ build-scummvm.yml       Manual workflow that compiles ScummVM to WASM
```

## 5. Catalog data model

### 5.1 `data/games.json` — genre index

```json
{
  "genres": {
    "race": { "name": "Carreras", "count": 17, "url": "data/genres/race.json" }
  }
}
```

- `name`: fallback label (the visible label normally comes from `I18N_GENRES` in `js/i18n.js`).
- `count`: maintained **by hand**. It is shown in the **Files** column only until the genre files finish loading; from then on the column shows the number of **visible** games of the genre (games whose bundle returned 404/410 on R2 are not counted). Genres with 0 games are hidden.
- `url`: genre file, loaded only when the visitor opens that genre (lazy loading with in-memory cache).

Current genre ids: `fps`, `rts`, `platformer`, `avg`, `rpg`, `sim`, `arcade`, `action`, `race`, `sports`.

### 5.2 `data/genres/<id>.json` — game entries

```json
{
  "id": "race",
  "name": "Carreras",
  "games": [
    {
      "id": "deathrally",
      "name": "DEATHRALLY",
      "genre": "race",
      "added": "2026-08-11",
      "year": "1996",
      "cover": "https://thumbnails.libretro.com/DOS/Named_Boxarts/Death%20Rally.png",
      "bundle": "https://pub-…r2.dev/projects/dosvault/deathrally.jsdos"
    }
  ]
}
```

| Field | Required | Purpose |
|---|---|---|
| `id` | yes | Unique key; also used for window ids and cache keys |
| `name` | yes | Short DOS-style name shown in the list and window title |
| `title` | no | Full display title; preferred over `name` for sorting, tooltip and info lookup |
| `genre` | yes | Must match the genre id |
| `added` | yes | `YYYY-MM-DD`; drives the "New games" popup |
| `year` | yes | Release year, shown in info/new-games popups |
| `cover` | yes | Box-art image URL (libretro thumbnails) |
| `bundle` | yes | Absolute URL of the bundle on R2 |
| `engine` | no | `"scummvm"` to use ScummVM; omitted = js-dos |
| `lang` | no | `"es"`/`"en"`, shown in the **Language** column; defaults to `EN` |

Size and date shown in the right panel are **not** stored in JSON: they are read live from the bundle with an HTTP `HEAD` request (`Content-Length` / `Last-Modified`), which requires the R2 bucket's CORS policy to allow the site's origin.

The same `HEAD` decides whether a game is listed. On load, every bundle in the catalog is checked in the background (at most 6 requests at a time, 15 s timeout each). A game is **hidden** only when R2 answers a definitive 404 or 410. Network errors, CORS errors, timeouts and any other status (403, 5xx, 429) keep the game visible, so a CORS or bucket problem never empties the catalog. Games without a `bundle` field stay visible, as before. `data/` is never modified: the filter is applied at runtime.

Catalog snapshot at the time of this review: **99 games**, 85 on js-dos and 14 on ScummVM.

## 6. Emulation engines

### 6.1 js-dos (default engine)

- Vendored **js-dos 7.1.0** in `js/vendor/js-dos/`, with `emulators.pathPrefix` pointing there.
- Launched with the standard API: `Dos(container, {}).run(bundleUrl)`. No custom extraction logic of our own.
- Bundle format: `.jsdos` = a regular zip containing the game files plus `.jsdos/dosbox.conf` (with the `[autoexec]` that mounts `C:` and starts the game).
- Windows open in "large window" mode (CSS pseudo-fullscreen); the `[⛶]` button requests real browser fullscreen. Trade-off: in real fullscreen, `Esc` exits fullscreen instead of reaching the game (browser standard, cannot be overridden).

### 6.2 ScummVM

- WebAssembly build produced by `.github/workflows/build-scummvm.yml` (manual `workflow_dispatch`, compiles `scummvm/scummvm` with Emscripten, publishes `scummvm-wasm.zip` as a GitHub Release; artifacts are then copied by hand into `js/vendor/scummvm/`).
- Engines included by default: `scumm, scumm_7_8, sci, sci32, agi, agos, agos2, sky, queen, drascula, lure, gob, tucker, touche, cine, cruise, kyra, parallaction`.
- Runs inside an **iframe** (`js/vendor/scummvm/launcher.html?bundle=<url>`) so that relative asset paths resolve correctly and each game gets an isolated JS context.
- The launcher downloads the bundle, unzips it in the browser with **fflate**, picks the folder with the most game files (ignoring `saves`, `extras`, `docs`, `dosbox`, etc.), flattens it into `/game`, pre-loads all engine plugins (`data/plugins/*.so`), and starts ScummVM with `--path=/game` auto-detection.
- Bundle format: zip of raw game data files, flat. The agreed naming convention is now **`<id>.scummvm`** (the extension is organizational only; fflate ignores it). Existing catalog entries still use `.zip` (see section 10).
- The `[≡]` titlebar button simulates `Ctrl+F5` to open ScummVM's Global Main Menu (save/load/options). A one-time "how to play with ScummVM" hint appears before the first ScummVM launch, with a "don't show again" option.

## 7. Site features

| Feature | How it works |
|---|---|
| Two-panel navigation | Genres on the left, games on the right; ↑/↓ move, ← goes to the left panel, → to the right panel, Tab switches, Enter opens/runs. The selected row is kept scrolled into view, and switching ES/EN keeps the selected game. While any popup is open (Info, Controls, Help, New games, F9 Test bundle, ScummVM hint) navigation is blocked and `Esc` closes it (on the ScummVM hint, `Esc` works like its close button and the game starts). Keyboard goes entirely to the game while a game window has focus; clicking outside returns it to the shell. |
| F-key bar | F1 Controls · F2 Info · F3 Run · F4 Refresh · F5 Help · F9 Test bundle · F10 Close. |
| Game windows | Draggable, maximizable, multiple at once; z-ordering and focus handling in `app.js`. |
| Info popup | Wikipedia summary + Wikidata publisher, fetched client-side, with a Google search fallback link. |
| Key remapping | "Controls" popup: Navigation tab (wired), In-game tab (`action1`/`action2` reserved, not wired yet), Gamepad tab. Uses `KeyboardEvent.code`. |
| Gamepad support | Browser Gamepad API (tested with Xbox Series X, "standard" mapping). Buttons are mapped to keyboard keys and sent to the game as synthetic key events. Remappable. |
| New games popup | Shown once per load, after all R2 checks finish. Lists games **added** (available now, not available on this browser's previous visit) and games **removed** (available on the previous visit, now gone from the catalog or 404/410 on R2). Games that could not be checked (network/CORS) count as available and are never reported as removed; they are reported as added only once R2 confirms the bundle. If any genre file fails to load, no removals are reported on that visit. First visit: no popup. Visitors with only the old `dosvaultLastVisit` key get the old `added`-date criterion once, without removals. |
| Help / Contact | Netlify Forms (`name="contacto"`, honeypot field): feedback, game requests, bug reports. |
| Test a local bundle (F9) | Loads a local `.jsdos` or ScummVM zip through a `blob:` URL; the file never leaves the browser. Used to test a bundle before uploading it to R2. |
| i18n | Spanish for any `es-*` browser language, English for everything else; manual ES/EN switch saved per browser. |
| Mobile block | Full-screen notice on phones/tablets. |

### Browser storage keys (localStorage)

| Key | Content |
|---|---|
| `dosvaultControls` | Keyboard remapping |
| `dosvaultGamepadControls` | Gamepad remapping |
| `dosvaultLang` | Chosen UI language |
| `dosvaultLastVisit` | Date of last visit (for "New games") |
| `dosvaultAvailableGames` | Games available on the last visit: `{ v: 1, games: { <id>: { n: name, g: genre, y: year } } }` (for "New games") |
| `dosvaultScummvmHintDismissed` | ScummVM hint dismissed |

## 8. Content pipeline: adding a game

1. **Get the source** (zip/7z of the game: extracted files, floppy images, CD images, or a "portable DOSBox" pack).
2. **Choose the engine.** ScummVM if the game runs on a supported adventure engine; js-dos otherwise. Never assume — confirm first.
3. **Build the bundle** with either:
   - the Claude skill `dosvault-bundle-creator` (`build_jsdos.py` / `build_scummvm.py`), or
   - the standalone web tool `dosvault-builder` (`js/core.js` + `js/app.js`, kept in a separate repo/zip, with feature parity with the skill).
4. **Verify locally** in dosbox-x (always on a throwaway copy, never on the folder that will be zipped), then in the real site with **F9 – Test bundle**.
5. **Upload** the bundle to the R2 bucket under `projects/dosvault/`.
6. **Register it**: add the entry to `data/genres/<genre>.json` and update `count` in `data/games.json`.
7. **Commit and push** to `main`; Netlify redeploys automatically **(to confirm)**.

### Hard rules for bundles

| Rule | Reason |
|---|---|
| Max **300 MB** per bundle; builders abort with exit code 6 | Cloudflare hosting limit |
| `cycles=20000` (fixed), never `cycles=auto` | `auto` hangs heavier games (especially DOS4GW) in the browser |
| `keyboardlayout=us` | Consistent key mapping |
| Explicit zip directory entries for every folder level | js-dos v7 freezes on "Extracting" with 2+ nested levels lacking them |
| `.jsdos` for js-dos, `.scummvm` for ScummVM | Naming convention for the bucket |
| Test on a throwaway copy | Games write config files on first run that would otherwise end up in the bundle |
| Drop installers, native Windows `.exe`s and pack extras | Smaller bundles; avoids extraction freezes |

Large bundles (roughly 40–90 MB and above) can freeze during extraction in js-dos v7 even under 300 MB. This is a known upstream issue with no fix on our side; the only mitigation is reducing content (with the owner's approval).

## 9. Related tooling and documents

| Item | Purpose |
|---|---|
| `dosvault-bundle-creator` (Claude skill) | Builds `.jsdos` and `.scummvm` bundles from game archives |
| `dosvault-builder` (web tool) | Same build engine in the browser (JSZip) |
| `dosvault-jsdos-troubleshooting.md` | Case log of every bundle problem diagnosed and how it was fixed |
| `build-scummvm.yml` | Rebuilds the ScummVM WASM engine when needed |

Skill updates only take effect once the `.skill` file delivered in a session is saved by the owner; if a skill still shows old behavior (e.g. `cycles=auto`), it was not saved.

## 10. Observations from this review (not changed — for decision)

These were noticed while reading the code. None has been modified.

1. **Genre counts are out of date.** `count` in `games.json` totals 69, but the genre files contain 99 games (e.g. `sports` says 4, has 13; `race` says 17, has 24). The **Files** column therefore shows wrong numbers.
2. **F-key bar vs. physical keys mismatch.** The on-screen bar (click) maps F1=Controls, F2=Info, F3=Run, F4=Refresh, F5=Help, but the keyboard defaults in `CONTROL_ACTIONS` are F1=Help, F2=Controls, F3=Info, F4=Run, F5=Refresh. Pressing F1 on the keyboard likely opens a different popup than the bar label says **(to confirm in the browser)**.
3. **F9 and F10 on the keyboard.** F9 (Test bundle) has no keyboard binding, so it only works by clicking the bar. F10 is bound.
4. **ScummVM extension.** The catalog uses `.zip` for its 14 ScummVM bundles and the F9 picker filters to `.zip`, while the skill and builder now output `.scummvm`. New `.scummvm` files will be hidden by default in the F9 file picker.
5. **Genre label keys.** The genre id is `action`, but `I18N_GENRES` uses the key `accion`, and `sports` has no entry at all. Both fall back to the Spanish `name` from `games.json`, so they won't be translated in English mode.
6. **No `lang` field in any entry**, so every game shows `EN` in the Language column, including Spanish releases.
7. **Stray files in the repo:** `dosvault-files-lang-columns.patch` (root), and 1-byte placeholder files `css/fonts/txt` and `js/vendor/scummvm/this`.
8. **R2 public development URL.** Bundles are served from an `r2.dev` address. Cloudflare positions these as development endpoints with rate limiting; a custom domain is the usual production setup **(worth evaluating)**.
9. **Pending idea:** evaluating js-dos v8 (live cycles/turbo control, sockdrive for large disks). Not started.

## 11. Open questions for the owner

- Netlify configuration: auto-deploy from `main`? Any environment variables, redirects or headers set in the Netlify UI?
- R2: bucket name, CORS policy, and whether a custom domain is planned.
- Where the `dosvault-builder` repo lives and whether it should be documented here.
- Any analytics, custom domain or legal/abandonware notice planned for the site.
