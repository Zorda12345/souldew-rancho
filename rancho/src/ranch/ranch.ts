// El escenario: césped, un prado con la caja visible y el bucle del juego.
import { Container, type Application } from "pixi.js";
import type { Pokemon } from "../data/schema.ts";
import { SPECIES } from "../data/species.ts";
import { natureEffect } from "../data/stats.ts";
import { Critter, MIN_SPEED, type Environment, type Rect } from "./critter.ts";
import { H, W, buildScenery, type SceneId, type Scenery } from "./scenery.ts";
import { Arena } from "./arena.ts";
import { Fx } from "./fx.ts";
import { spriteKey, type SpriteSet } from "./sprites.ts";

// El mundo mide siempre 480×320 "píxeles de juego" (W×H, en scenery.ts) y se amplía hasta llenar el hueco disponible.
const AREA: Rect = { x: 34, y: 56, w: 412, h: 244 }; // por donde pasean (dentro del claro, lejos de los árboles)
const SLIDE_SECONDS = 0.35;

// Luz del día: a cada hora clave le corresponde un color de luz y cuánta "noche" hay (0 a 1).
// Entre dos horas clave se mezcla poco a poco.
const SKY: [hour: number, tint: number, night: number][] = [
  [0, 0x8d9cd8, 1], [5.5, 0x8d9cd8, 1], [7, 0xffd9b8, 0.3], [9, 0xffffff, 0],
  [17.5, 0xffffff, 0], [19.5, 0xffb98a, 0.3], [21.5, 0x8d9cd8, 1], [24, 0x8d9cd8, 1],
];

function skyAt(hour: number): { tint: number; night: number } {
  const i = Math.max(1, SKY.findIndex(([h]) => h >= hour));
  const [h0, c0, n0] = SKY[i - 1];
  const [h1, c1, n1] = SKY[i];
  const t = (hour - h0) / (h1 - h0);
  const mix = (shift: number) => Math.round(((c0 >> shift) & 255) + (((c1 >> shift) & 255) - ((c0 >> shift) & 255)) * t);
  return { tint: (mix(16) << 16) | (mix(8) << 8) | mix(0), night: n0 + (n1 - n0) * t };
}

/** Hora real del ordenador, con decimales. Para probar: añadir ?hora=23 a la dirección. */
function currentHour(): number {
  const forced = Number(new URLSearchParams(location.search).get("hora") ?? NaN);
  if (forced >= 0 && forced < 24) return forced;
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
}

/** Cuánto se buscan dos Pokémon: suma su amistad media (0 a 1) y un extra si sus naturalezas son afines. */
function affinity(a: Pokemon, b: Pokemon): number {
  const friendship = (a.friendship + b.friendship) / 2 / 255;
  // Regla propia del rancho: son afines si sus naturalezas suben la misma estadística (o ambas son neutras).
  const compatible = natureEffect(a.nature).up === natureEffect(b.nature).up;
  return friendship + (compatible ? 0.6 : 0);
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export interface Page {
  name: string;
  pokemon: Pokemon[];
}

export interface RanchHooks {
  onSelect(critter: Critter): void;
  onBattleLog(text: string): void;
  onBattleEnd(winner: Pokemon | null, boxIndex: number, kind: "king" | "duel"): void;
}

export interface Ranch {
  clearSelection(): void;
  /** Reserva píxeles arriba (barra), a la derecha (ficha) y a la izquierda (equipo) y reencaja el rancho en el resto. */
  setInsets(top: number, right: number, left: number): void;
  /** Multiplica el zoom actual (1 = se ve todo el rancho, máximo 4). */
  zoomBy(factor: number): void;
  resetZoom(): void;
  /** Todos los de la caja visible contra todos. Devuelve false si no hay al menos dos. */
  startKing(): boolean;
  /** Duelo entre dos Pokémon: de la caja visible o de fuera (entonces aparecen de invitados). */
  startDuel(a: Pokemon, b: Pokemon): void;
  stopBattle(): void;
  /** Pone la corona al rey de una caja (o la quita con null). */
  setKing(boxIndex: number, pokemon: Pokemon | null): void;
  /** Cambia el escenario de una caja (prado, playa, bosque nevado). */
  setScene(boxIndex: number, scene: SceneId): void;
  /** Muestra una caja. direction: 1 entra por la derecha, -1 por la izquierda, 0 sin transición. */
  show(index: number, direction: number): void;
}

export function createRanch(
  app: Application,
  pages: Page[],
  sprites: Map<string, SpriteSet | null>,
  scenes: SceneId[],
  hooks: RanchHooks,
): Ranch {
  const world = new Container();
  app.stage.addChild(world);

  // Día y noche: se tiñe todo el mundo con el color de la luz y se avisa a los Pokémon.
  const env: Environment = { night: 0 };
  const applySky = () => {
    const sky = skyAt(currentHour());
    world.tint = sky.tint;
    env.night = sky.night;
  };
  applySky();
  let skyTimer = 30; // se recalcula cada 30 segundos

  let selected: Critter | null = null;
  const select = (critter: Critter | null) => {
    if (selected) selected.selected = false;
    selected = critter;
    if (critter) {
      critter.selected = true;
      hooks.onSelect(critter);
    }
  };

  /** Sitio favorito y sitio a evitar de un Pokémon en un escenario, según sus tipos. */
  const placesFor = (p: Pokemon, scenery: Scenery) => {
    const types = SPECIES[p.species]?.types ?? [];
    const home = scenery.homes.find((h) => h.types.some((t) => types.includes(t)))?.place ?? null;
    return { home, avoid: home === scenery.avoid ? null : scenery.avoid };
  };

  // Una capa por caja, con su propio decorado: fondo, Pokémon (ordenados por y) y detalles por delante.
  // Todas existen desde el principio, pero solo la visible se dibuja y se anima.
  const herds = pages.map((page, i) => {
    const layer = new Container();
    layer.visible = false;
    const mons = new Container();
    mons.sortableChildren = true; // ordena por zIndex para dar sensación de profundidad
    let scenery = buildScenery(scenes[i] ?? "prado");
    layer.addChild(scenery.back, mons, scenery.front);
    const critters = page.pokemon.map((p) => {
      const { home, avoid } = placesFor(p, scenery);
      return new Critter(p, sprites.get(spriteKey(p)) ?? null, AREA, home, avoid, env);
    });
    critters.forEach((c) => {
      mons.addChild(c.view);
      c.view.on("pointertap", () => {
        if (!dragged) select(c); // soltar tras arrastrar el rancho no cuenta como clic
      });
    });
    world.addChild(layer);
    const setScene = (id: SceneId) => {
      const next = buildScenery(id);
      layer.removeChild(scenery.back, scenery.front);
      scenery.back.destroy();
      scenery.front.destroy();
      scenery = next;
      layer.addChildAt(next.back, 0);
      layer.addChild(next.front);
      for (const c of critters) {
        const places = placesFor(c.pokemon, next);
        c.setPlaces(places.home, places.avoid);
      }
    };
    return { layer, mons, critters, setScene };
  });

  // Combates: los efectos van por encima de todo; la arena dirige a los que pelean.
  const fx = new Fx();
  world.addChild(fx.layer);
  let battleKind: "king" | "duel" | null = null;
  let guests: Critter[] = []; // Pokémon de fuera de la caja traídos para un duelo
  const arena = new Arena(fx, AREA, {
    log: (text) => hooks.onBattleLog(text),
    end: (winner) => {
      const kind = battleKind;
      const pokemon = winner?.pokemon ?? null;
      battleKind = null;
      for (const guest of guests) guest.view.destroy({ children: true });
      guests = [];
      if (kind) hooks.onBattleEnd(pokemon, current, kind);
    },
  });

  let top = 0;
  let right = 0;
  let left = 0;
  let zoom = 1; // 1 = el rancho entero encaja en el hueco
  const pan = { x: 0, y: 0 }; // desplazamiento en píxeles de pantalla cuando hay zoom
  const layout = () => {
    const width = app.screen.width - left - right;
    const height = app.screen.height - top;
    const scale = Math.min(width / W, height / H) * zoom;
    // Solo se puede desplazar lo que sobresale del hueco: nunca se pierde el rancho de vista.
    const maxX = Math.max(0, (W * scale - width) / 2);
    const maxY = Math.max(0, (H * scale - height) / 2);
    pan.x = Math.min(maxX, Math.max(-maxX, pan.x));
    pan.y = Math.min(maxY, Math.max(-maxY, pan.y));
    world.scale.set(scale);
    world.position.set(left + (width - W * scale) / 2 + pan.x, top + (height - H * scale) / 2 + pan.y);
  };
  app.renderer.on("resize", layout);
  layout();

  /** Cambia el zoom dejando quieto el punto del rancho que hay bajo (sx, sy), en píxeles de pantalla. */
  const zoomAt = (factor: number, sx: number, sy: number) => {
    const next = Math.min(4, Math.max(1, zoom * factor));
    if (next === zoom) return;
    const wx = (sx - world.x) / world.scale.x; // punto del mundo bajo el cursor
    const wy = (sy - world.y) / world.scale.y;
    zoom = next;
    pan.x = 0;
    pan.y = 0;
    layout(); // coloca el mundo centrado con el zoom nuevo…
    pan.x = sx - (world.x + wx * world.scale.x); // …y lo desplaza para que ese punto vuelva bajo el cursor
    pan.y = sy - (world.y + wy * world.scale.y);
    layout();
  };

  // Rueda del ratón: acercar y alejar. Arrastrar: moverse por el rancho ampliado.
  let dragged = false;
  let dragFrom: { x: number; y: number } | null = null;
  app.canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomAt(Math.exp(-e.deltaY * 0.0015), e.offsetX, e.offsetY);
  }, { passive: false });
  app.canvas.addEventListener("pointerdown", (e) => {
    dragged = false;
    dragFrom = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener("pointermove", (e) => {
    if (!dragFrom || zoom === 1) return;
    const dx = e.clientX - dragFrom.x;
    const dy = e.clientY - dragFrom.y;
    if (!dragged && Math.hypot(dx, dy) < 4) return; // un temblor de la mano no es arrastrar
    dragged = true;
    pan.x += dx;
    pan.y += dy;
    dragFrom = { x: e.clientX, y: e.clientY };
    layout();
  });
  window.addEventListener("pointerup", () => {
    dragFrom = null;
  });

  // Transición: la caja que se va se desliza y se desvanece mientras entra la nueva.
  let current = -1;
  let leaving: (typeof herds)[number] | null = null;
  let direction = 0;
  let slide = 1; // progreso de 0 a 1
  const placeLayers = () => {
    const t = 1 - (1 - slide) ** 3; // "ease-out": rápido al principio, suave al final
    const entering = herds[current].layer;
    entering.x = direction * W * (1 - t);
    entering.alpha = leaving ? t : 1;
    if (leaving) {
      leaving.layer.x = -direction * W * t;
      leaving.layer.alpha = 1 - t;
    }
  };

  // De vez en cuando, dos Pokémon libres de la caja visible quedan en un punto intermedio.
  let nextMeet = rand(3, 6);
  const tryMeet = () => {
    const free = herds[current].critters.filter((c) => c.canMeet);
    if (free.length < 2) return;
    const a = free.splice(Math.floor(Math.random() * free.length), 1)[0];
    // El compañero se elige a suertes, pero cuanta más afinidad, más papeletas tiene.
    const weights = free.map((c) => 0.2 + affinity(a.pokemon, c.pokemon));
    let pick = Math.random() * weights.reduce((sum, w) => sum + w, 0);
    const b = free.find((_, i) => (pick -= weights[i]) <= 0) ?? free[free.length - 1];
    const emote = affinity(a.pokemon, b.pokemon) >= 1 ? "♥" : "♪";
    const [left, rightOne] = a.view.x <= b.view.x ? [a, b] : [b, a];
    const mx = Math.min(Math.max((a.view.x + b.view.x) / 2, AREA.x + 12), AREA.x + AREA.w - 12);
    const my = (a.view.y + b.view.y) / 2;
    const far = Math.max(Math.hypot(mx - a.view.x, my - a.view.y), Math.hypot(mx - b.view.x, my - b.view.y));
    const seconds = far / MIN_SPEED + 2.5; // tiempo de llegar el más lento + un rato mirándose
    left.startMeet(rightOne, mx - 12, my, seconds, emote);
    rightOne.startMeet(left, mx + 12, my, seconds, emote);
  };

  // BUCLE DEL JUEGO: Pixi llama a esta función una vez por fotograma (unas 60 veces por segundo).
  app.ticker.add((ticker) => {
    if (current < 0) return;
    const dt = Math.min(ticker.deltaMS, 50) / 1000; // segundos desde el fotograma anterior (con tope)
    skyTimer -= dt;
    if (skyTimer <= 0) {
      skyTimer = 30;
      applySky();
    }
    if (slide < 1) {
      slide = Math.min(1, slide + dt / SLIDE_SECONDS);
      placeLayers();
      if (slide === 1 && leaving) {
        leaving.layer.visible = false;
        leaving = null;
      }
    }
    nextMeet -= dt;
    if (nextMeet <= 0) {
      nextMeet = rand(4, 9);
      tryMeet();
    }
    for (const critter of herds[current].critters) critter.update(dt); // solo la caja visible
    for (const guest of guests) guest.update(dt);
    if (arena.active) arena.update(dt);
    fx.update(dt);
  });

  return {
    clearSelection: () => select(null),
    setInsets: (newTop, newRight, newLeft) => {
      top = newTop;
      right = newRight;
      left = newLeft;
      layout();
    },
    startKing: () => {
      const fighters = herds[current].critters;
      if (arena.active || fighters.length < 2) return false;
      select(null);
      battleKind = "king";
      arena.start(fighters);
      return true;
    },
    startDuel: (a, b) => {
      if (arena.active) return;
      select(null);
      battleKind = "duel";
      const fighters = [a, b].map((pokemon) => {
        const local = herds[current].critters.find((c) => c.pokemon === pokemon);
        if (local) return local;
        const guest = new Critter(pokemon, sprites.get(spriteKey(pokemon)) ?? null, AREA, null, null, env);
        herds[current].mons.addChild(guest.view);
        guests.push(guest);
        return guest;
      });
      arena.start(fighters);
    },
    stopBattle: () => {
      if (arena.active) arena.stop();
    },
    setScene: (boxIndex, scene) => herds[boxIndex]?.setScene(scene),
    setKing: (boxIndex, pokemon) => {
      for (const critter of herds[boxIndex]?.critters ?? []) critter.setCrown(critter.pokemon === pokemon);
    },
    zoomBy: (factor) => zoomAt(factor, left + (app.screen.width - left - right) / 2, top + (app.screen.height - top) / 2),
    resetZoom: () => {
      zoom = 1;
      layout();
    },
    show: (index, dir) => {
      if (index === current) return;
      if (arena.active) arena.stop(); // cambiar de caja corta la pelea
      if (leaving) leaving.layer.visible = false; // por si se cambia de caja a mitad de transición
      const previous = herds[current];
      leaving = dir !== 0 && previous ? previous : null;
      if (previous && !leaving) previous.layer.visible = false;
      current = index;
      direction = dir;
      slide = leaving ? 0 : 1;
      herds[current].layer.visible = true;
      placeLayers();
    },
  };
}
