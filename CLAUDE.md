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
- Mejoras del rancho (orden acordado, parar tras cada una): 1) aspecto de souldew HECHA (tokens de la app en `rancho/src/tokens.css`, fuentes de `/assets/fonts/fonts.css`, sigue `data-theme` del padre); 2) 3 escenarios por caja HECHA (`rancho/src/ranch/scenery.ts`: prado, playa, nieve; misma geometría WATER/SPOT, cada uno con `homes` por tipo; selector en el letrero, localStorage `rancho.escenarios`); 3) peleas HECHA (`rancho/src/battle/motion.ts`: `moveSpeed` por Velocidad base, `DASH` {multiplier, seconds, cooldown 3.6, recovery}, `knockback`, `hitstop`, `shake`, `friction`; arena: dash para acercarse/alejarse/esquivar, golpe esquivado si se apartó, retroceso con `Critter.hit`, pausa de impacto y temblor con el hook `shake`); 4) IA y animaciones HECHA (`rancho/src/battle/ai.ts`: `expectedDamage`, `bestAttack`, `scoreTarget`/`pickTarget` (daño relativo, rematar ×1,6, amenaza, menos si está lejos o ya tiene cazadores), `chooseMove` (rematar con prioridad > curarse < 40 % > subida útil si va bien y la pelea es larga > mejor ataque, a veces el segundo); fx: `shot`/`hitFx`/`wave` por familia de tipo (burst, splash, bolt, leaf, shard, ring, rock, slash), embestida `Critter.nudge` en los físicos); 5) datos de la run de souldew.
- Siguiente: fase 3, que el rancho muestre los Pokémon de la run de souldew en vez del mock de Rojo Fuego.
