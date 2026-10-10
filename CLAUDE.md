# DOSVault — Instrucciones para Claude Code (Bondi612)

## Proyecto
DOSVault es un catálogo de juegos DOS que se juegan en el navegador, con dos motores: js-dos v7 y ScummVM-WASM. La interfaz imita al Norton Commander. Todo el detalle funcional está en `readme.md`; leelo antes de cualquier tarea que no sea trivial.

- Repo: https://github.com/PolZirilli/dosvault
- Sitio en producción: https://dosvault.netlify.app/
- Bundles de juegos: Cloudflare R2 (`pub-13140bd15eda49b4a3f35bc937ab1c58.r2.dev/projects/dosvault/`)

## Stack
Sitio **estático, sin paso de build**: `index.html`, `css/style.css`, `js/app.js`, `js/i18n.js`, `js/scummvm-engine.js` y el catálogo en `data/`. No hay `package.json`, ni npm, ni tests automáticos. Así se queda: no se agregan frameworks, bundlers ni dependencias sin aprobación del Director.

## Roles
- **Sesión principal (Director)**: recibe el pedido, delega en los agentes y cierra con el bloque PARA PROBAR. No commitea ni pushea.
- **programmer** (`~/.claude/agents/programmer.md`, genérico): implementa.
- **qa** (`~/.claude/agents/qa.md`, genérico): valida sin modificar.
- **build-manager** (`~/.claude/agents/build-manager.md`, genérico): commitea y pushea.

## Publicación
Decisión de Pol (2026-10-06): en DOSVault **se trabaja directo sobre `main`** y build-manager pushea a `main`. Pol revisa cada cambio después de publicado.
- **Rama de trabajo y de publicación**: `main`.
- **Cada push a `main` publica el sitio**: Netlify lo despliega en 1 o 2 minutos (a confirmar en la configuración de Netlify).
- build-manager pushea si qa dio APROBADO o APROBADO CON OBSERVACIONES. Si qa dio RECHAZADO, no se publica.
- Nunca `--force` ni reescritura de historia. Para deshacer un cambio publicado: `git revert` y push.
- Antes de empezar una tarea, el Director deja `main` al día con `git pull --ff-only origin main`.

## Qué no se toca
- `js/vendor/` (js-dos y ScummVM son de terceros), salvo un pedido explícito.
- `.github/workflows/build-scummvm.yml`, salvo un pedido explícito.
- Nada de R2, Cloudflare, Netlify, DNS ni CORS: son de Pol.
- Armar bundles (`.jsdos`, `.scummvm`) **no** es tarea de estos agentes. Se hace con el skill `dosvault-bundle-creator` o con `dosvault-builder`, y los sube Pol.

## Reglas de datos del catálogo
- Si se agrega, quita o mueve un juego en `data/genres/<id>.json`, se actualiza el `count` del género en `data/games.json` en el mismo cambio.
- Campos obligatorios de cada juego: `id`, `name`, `genre`, `added`, `year`, `cover`, `bundle`. El `genre` debe coincidir con el id del archivo.
- Textos visibles: siempre en español y en inglés (`js/i18n.js`).

## Flujo estándar
1. El Director comprueba que está en `main`, al día y sin cambios ajenos (`git status`).
2. Delega en programmer.
3. Delega en qa con el informe de programmer. Validación liviana: la prueba de humo más capturas de lo que tocó el cambio.
4. Si qa rechaza, vuelve a programmer con los problemas. Máximo dos vueltas; después, consultar a Pol.
5. Con qa aprobado, delega en build-manager con los dos informes. build-manager commitea y pushea a `main`.
6. El Director cierra con el resumen y el bloque PARA PROBAR que armó build-manager.

## Vista previa y QA
- **Levantar la app**: `python3 -m http.server 8612 --bind 127.0.0.1 --directory /opt/dosvault`
- **URL**: http://127.0.0.1:8612/
- **Carpeta de capturas**: `/opt/dosvault/qa-shots/latest/` (está en `.gitignore`).
- **Planes de captura guardados**: `qa/plans/`. El plan de humo es `qa/plans/humo.json` y se corre en cada revisión:
  `node /opt/bondi612-tools/web-qa/shot.mjs /opt/dosvault/qa/plans/humo.json`
- **Viewport**: siempre de escritorio, mínimo 1280×720. En pantallas chicas el sitio muestra a propósito el aviso de "se requiere escritorio".
- **Flujos críticos (prueba de humo)**:
  1. Carga inicial: el panel izquierdo muestra los géneros.
  2. Enter abre el primer género y el panel derecho lista sus juegos.
  3. El botón EN cambia la interfaz a inglés.
  4. Enter sobre un juego abre su ventana y js-dos arranca. Lo esperado es ver el juego cargando o corriendo.

### Errores conocidos del entorno (qa los lista, pero no rechaza por ellos)
- **CORS de R2 desde 127.0.0.1:8612.** Si la política CORS del bucket no incluye ese origen, aparecen en `report.json` errores "blocked by CORS policy" sobre `r2.dev`. En ese caso, Tamaño y Fecha muestran `N/D` y el juego de la captura 04 termina en "UNEXPECTED ERROR OCCURED". Mientras pase esto, el flujo 4 cuenta como **NO PUDE PROBAR**, no como aprobado. (Pol: estado a confirmar con el chequeo del instalador.)
- **GitHub API 403** sobre `api.github.com/repos/PolZirilli/dosvault/commits`: es el límite de pedidos sin autenticar. Afecta solo la fecha del catálogo.

## Pendientes conocidos
Ver la sección 10 de `readme.md`, que lista las observaciones abiertas: counts desactualizados, teclas F que no coinciden con la barra, extensión `.scummvm` en F9, claves de géneros en i18n, campo `lang` y archivos sueltos. No se arreglan de paso; cada uno es una tarea propia.

## Nombres visibles de los agentes
Al delegar a un agente, empezá siempre la descripción de la tarea (el campo description) con su nombre visible, en formato "nombre-rol: tarea". La tarea tiene que ser corta: el panel muestra solo 40 caracteres en total.

| Agente        | Nombre visible  |
|---------------|-----------------|
| programmer    | tito-programmer |
| qa            | nina-qa         |
| build-manager | beto-build      |

Ejemplo: "tito-programmer: counts de géneros".

## Bloque PARA PROBAR
Todo resumen final de una tarea que cambie el sitio termina con este bloque:

```
PARA PROBAR
- Commit: <hash corto> (<n> commits en total)
- Push: main -> <resultado>
- Veredicto de qa: <APROBADO / APROBADO CON OBSERVACIONES>
- Capturas: /opt/dosvault/qa-shots/latest/
- Publicado en: https://dosvault.netlify.app/ (Netlify tarda 1 o 2 minutos)
- Vista previa local: http://localhost:8612/ (en la Mac, con el comando dosvault)
- Para deshacer: pedile al Director "revertí <hash>"
```

El servidor de vista previa (`python3 -m http.server 8612 ...`) se deja corriendo. Si no está, el Director lo levanta con `nohup` al cerrar la tarea.

## Una sola sesión
Claude Code se usa solo dentro de la sesión de tmux `dosvault` (`tmux attach -t dosvault`). No abras una segunda sesión sobre este repo.
