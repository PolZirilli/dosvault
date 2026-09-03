/*
 * Motor ScummVM para DOSVault.
 *
 * A diferencia de js-dos (que emula la PC completa vía DOSBox y corre el
 * .EXE original), ScummVM reimplementa el motor del juego de forma nativa:
 * recibe los archivos de datos crudos del juego (RESOURCE.MAP, *.LFL, etc.)
 * y los auto-detecta, sin pasar por DOS.
 *
 * El build real de scummvm.js (generado por
 * .github/workflows/build-scummvm.yml) resuelve sus propios assets
 * ("data/gui-icons.dat", etc.) con rutas relativas a la página que lo
 * carga — no al script en sí. Por eso, en vez de inyectar scummvm.js
 * directo en esta página, lo corremos en un <iframe> apuntando a
 * js/vendor/scummvm/launcher.html, que vive en la misma carpeta que el
 * build vendorizado. Así las rutas relativas siempre caen bien, sin
 * importar la estructura del resto del sitio, y cada partida queda en su
 * propio contexto de JS aislado (cerrar = sacar el iframe del DOM, sin
 * necesidad de llamar ninguna función de salida especial de Emscripten).
 */

window.ScummVMEngine = (function () {
  function run(container, game) {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.className = 'scummvm-frame';
      iframe.src = 'js/vendor/scummvm/launcher.html?bundle=' + encodeURIComponent(game.bundle);
      // "autoplay" para el audio; "fullscreen" para que requestFullscreen()
      // funcione tanto desde adentro del iframe como pedido desde afuera
      // (ver requestFullscreen más abajo).
      iframe.setAttribute('allow', 'autoplay; fullscreen');
      iframe.allowFullscreen = true; // compat navegadores viejos
      iframe.addEventListener('error', () => reject(new Error('No se pudo cargar el iframe de ScummVM')));

      // Sin esto, el teclado se lo queda el documento principal (flechas/
      // Tab/Enter de la navegación estilo Norton Commander) y ni el juego
      // ni el menú de ScummVM reciben nada.
      iframe.addEventListener('load', () => {
        try { iframe.contentWindow.focus(); } catch (e) { /* cross-origin improbable acá, pero por las dudas */ }
      });

      container.appendChild(iframe);

      resolve({
        exit: () => {
          iframe.remove();
        },
        // app.js llama esto cuando la ventana del juego pasa a primer
        // plano (mousedown) o después de togglear pantalla completa, para
        // que el teclado vuelva a apuntar al iframe en vez de quedarse en
        // el documento principal.
        focus: () => {
          try { iframe.contentWindow.focus(); } catch (e) { /* ignorar */ }
        },
        // Pantalla completa real del navegador sobre el iframe (por eso el
        // atributo "allow=fullscreen" / allowFullscreen más arriba). Antes
        // se evitaba a propósito porque el navegador reserva ESC para
        // salir de pantalla completa real de forma no cancelable por JS,
        // y eso pisaba el ESC que usan los juegos para menús/cinemáticas.
        // Ahora se prioriza la pantalla completa real; el trade-off es que
        // un ESC te saca de pantalla completa en vez de llegarle al juego.
        //
        // El elemento que entra a fullscreen es TODA la ventana (.window,
        // titlebar incluida) y no solo el iframe: si fullscreneamos nomas
        // el iframe, la titlebar -- con el boton [≡] del menu de ScummVM,
        // que es la unica forma de llegar a Guardar/Cargar -- queda fuera
        // del subarbol que el navegador renderiza en fullscreen real, y se
        // vuelve inalcanzable (ver css/style.css, regla .window:fullscreen).
        toggleFullscreen: () => {
          const fsTarget = container.closest('.window') || iframe;
          if (document.fullscreenElement === fsTarget) {
            document.exitFullscreen();
          } else if (fsTarget.requestFullscreen) {
            fsTarget.requestFullscreen().catch(err => console.warn('[scummvm] no se pudo entrar a pantalla completa', err));
          }
        },
        // Simula Ctrl+F5 (Global Main Menu: Guardar/Cargar/Opciones) sin
        // depender de que el teclado físico lo mande bien (F5 suele estar
        // reservado por el navegador, y en Mac depende de fn). No hay
        // garantía de que el manejo de teclado de SDL2/Emscripten lo
        // acepte igual que un evento real, pero vale la pena como
        // alternativa.
        openMenu: () => {
          try {
            const doc = iframe.contentDocument;
            const target = (doc && doc.getElementById('canvas')) || (doc && doc.body) || iframe.contentWindow;
            ['keydown', 'keyup'].forEach(type => {
              target.dispatchEvent(new KeyboardEvent(type, {
                key: 'F5', code: 'F5', keyCode: 116, which: 116,
                ctrlKey: true, bubbles: true, cancelable: true,
              }));
            });
          } catch (e) {
            console.warn('[scummvm] no se pudo simular Ctrl+F5', e);
          }
        },
      });
    });
  }

  return { run };
})();
