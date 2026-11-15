# souldew + Rancho

Fork de [souldew](https://github.com/souldewapp/souldew) (GPL-3.0-or-later) al que se le añade el Rancho Pokémon.
El remoto `upstream` apunta al original para traer sus versiones nuevas.

## Cómo trabajar
- Responder en español. El usuario es principiante: explicar brevemente cada concepto nuevo.
- Trabajar por fases, PARAR al final de cada una y esperar aprobación. Un commit por fase. Sin subagentes.
- Tocar lo mínimo del código de souldew (para poder fusionar sus versiones nuevas): nada de reordenar
  archivos como `web/i18n/*.json`; añadir al final.
- Normas de souldew: todo texto visible pasa por `t('area.clave', 'Texto en inglés')` y se traduce a de/fr/es/it;
  `node scripts/extract-i18n.mjs` debe acabar en "0 missing, 0 stale". `npm run lint` y `npm test` en verde.

## Comandos
- `npm start` — servidor + interfaz en el navegador (http://localhost:7373); `npm run app` — app de escritorio
- `npm test`, `npm run lint` — tests y lint de souldew
- `npm run rancho:build` — compila `rancho/` a `web/rancho/` (hay que hacerlo tras cambiar el rancho; lo compilado va en git)
- `npm run rancho:dev` — servidor de desarrollo solo del rancho (http://localhost:5173/rancho/)
- `npm run rancho:test` — tests del rancho (Vitest); `npx tsc -p rancho` — tipos
- `npm run rancho:species` — regenera la tabla de 649 especies desde PokeAPI
- `npm run rancho:sprites` / `npm run rancho:mock` — descarga sprites a `web/rancho/sprites/` / regenera el mock

## Rancho dentro de souldew
- Código fuente en `rancho/` (Vite + TypeScript + PixiJS, Zod, Vitest), copiado de pokemon-rancho sin el login ni el Soul Link propio.
  `rancho/src/main.ts` arranca solo el rancho; importa `pixi.js/unsafe-eval` porque la CSP de souldew prohíbe eval.
- Se compila a `web/rancho/` (base `/rancho/`); los sprites viven en `web/rancho/sprites/` y no se copian
  (`rancho/vite.config.ts`: `publicDir: false`, y en desarrollo un middleware los sirve).
- Vista `web/views/rancho.mjs` (`RanchView`): `iframe` a `/rancho/index.html`. Ruta `#/rancho`, entrada «Rancho»
  en el menú (`web/app.mjs`), icono `ranch` en `web/lib/icons.mjs`, estilos `.rancho-view` al final de `web/styles.css`.
- Textos nuevos: `nav.rancho`, `rancho.title`, `rancho.intro`, `rancho.frame`.
- Licencias: sprites CC BY-NC 4.0 (autores en `rancho/CREDITS.md`), anotado en `THIRD_PARTY_NOTICES.md`.

## Estado
- Fase 1 (clonar y arrancar) y fase 2 (rancho como vista) hechas.
- Mejoras del rancho (orden acordado, parar tras cada una): 1) aspecto de souldew HECHA (tokens de la app en `rancho/src/tokens.css`, fuentes de `/assets/fonts/fonts.css`, sigue `data-theme` del padre); 2) 3 escenarios por caja HECHA (`rancho/src/ranch/scenery.ts`: prado, playa, nieve; misma geometría WATER/SPOT, cada uno con `homes` por tipo; selector en el letrero, localStorage `rancho.escenarios`); 3) peleas HECHA (`rancho/src/battle/motion.ts`: `moveSpeed` por Velocidad base, `DASH` {multiplier, seconds, cooldown 3.6, recovery}, `knockback`, `hitstop`, `shake`, `friction`; arena: dash para acercarse/alejarse/esquivar, golpe esquivado si se apartó, retroceso con `Critter.hit`, pausa de impacto y temblor con el hook `shake`); 4) IA y animaciones HECHA (`rancho/src/battle/ai.ts`: `expectedDamage`, `bestAttack`, `scoreTarget`/`pickTarget` (daño relativo, rematar ×1,6, amenaza, menos si está lejos o ya tiene cazadores), `chooseMove` (rematar con prioridad > curarse < 40 % > subida útil si va bien y la pelea es larga > mejor ataque, a veces el segundo); fx: `shot`/`hitFx`/`wave` por familia de tipo (burst, splash, bolt, leaf, shard, ring, rock, slash), embestida `Critter.nudge` en los físicos); 5) datos de la run de souldew HECHA (opción A, solo la API de stream `/api/v1/runs/current?lang=es`, mismo origen): `rancho/src/data/source.ts` (`loadSource`: run o mock si 404/error; jugador elegido en localStorage `rancho.jugador`, cambiar recarga), `data/souldew.ts` (`StateSchema`, `toPokemon`, `saveFromState`: equipo; cajas «Caja», «Parejas», «Caídos»), Pokémon con `estimated: true` (sin naturaleza/IVs/EVs/movimientos: la ficha solo muestra lo real y «Estadísticas estimadas»; en peleas `basicMoves` = un ataque de potencia 60 por tipo; afinidad fija 0,5), especies 1-649 generadas (`npm run rancho:species`, `species-data.json`), sprite fijo de souldew (`/api/v1/sprites/gen{N}/front[-shiny]/{id}.png`, reducido a la mitad) si no hay de Mundo Misterioso; reyes y escenarios guardados por run.
- RetroAchievements (3 fases, parar tras cada una): 1) servidor HECHA: `server/lib/retroach.mjs` (API web
  `https://retroachievements.org/API/*.php`, parámetros `u` usuario e `y` clave; imágenes de `media.retroachievements.org`).
  La clave vive solo en `retroachievements.json` de la carpeta de datos (en desarrollo `runs/`), nunca en la página,
  registros ni errores; sin redirecciones. Rutas: `GET /api/retroach` (`{linked,user}`), `POST`/`DELETE /api/retroach/link`
  (comprueba con `API_GetUserProfile` antes de guardar), `GET /api/retroach/summary` (perfil, logros de 7 días, progreso del
  último juego con `mainPokemon`; caché 60 s, los fallos no se guardan; errores `notLinked|input|key|user|offline|rate|server`),
  imágenes con caché en `/retroach/(UserPic|Badge|Images)/x.png`. `SOULDEW_RA_URL` = API falsa de los tests
  (`test/retroach.test.mjs`). La web de RetroAchievements tiene Cloudflare; la API y `media.` no.
  Juegos principales de DS con logros: Diamante, Platino, HG/SS, Negro, Blanco, Negro 2 (y Blanco 2).
  Siguen: 2) pestaña «Logros» (cuenta, recientes, progreso; ajustes para pegar usuario y clave) y 3) avisos en directo + i18n.
