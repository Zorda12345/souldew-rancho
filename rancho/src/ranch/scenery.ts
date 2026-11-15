// Escenarios del rancho, dibujados por código (sin imágenes). Cada caja puede tener el suyo.
// Todos comparten la misma geometría (claro, camino, "agua" y "rincón"), así los Pokémon se mueven igual
// y solo cambia el aspecto y qué tipos prefieren cada sitio.
import { Graphics } from "pixi.js";
import type { TypeId } from "../data/types.ts";
import { insideEllipse, pointInEllipse, type Ellipse } from "./critter.ts";

export const W = 480;
export const H = 320;
/** El agua de cada escenario (estanque, poza, lago helado). */
export const WATER: Ellipse = { x: 118, y: 104, rx: 50, ry: 26 };
/** El rincón de cada escenario (hierba alta, rocas, matorral nevado). */
export const SPOT: Ellipse = { x: 352, y: 262, rx: 58, ry: 24 };

export type SceneId = "prado" | "playa" | "nieve";
export const SCENES: { id: SceneId; name: string }[] = [
  { id: "prado", name: "Prado" },
  { id: "playa", name: "Playa" },
  { id: "nieve", name: "Bosque nevado" },
];

export interface Scenery {
  /** Fondo: se pinta por detrás de los Pokémon. */
  back: Graphics;
  /** Detalles por delante (briznas, ramas), para que parezca que están metidos dentro. */
  front: Graphics;
  /** Sitios favoritos: el primero cuyo tipo coincida. */
  homes: { place: Ellipse; types: TypeId[] }[];
  /** Sitio al que no van por gusto (el agua), salvo los que lo tienen de favorito. */
  avoid: Ellipse;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
/** Altura del camino en cada x: una onda suave que cruza el claro. */
export const pathY = (x: number) => 182 + Math.sin(x / 75) * 26;

/** Suelo con motas de dos colores, más grande que el mundo para que no se vean bordes. */
function ground(g: Graphics, base: number, dots: [number, number], clearing: number) {
  g.rect(-W, -H, W * 3, H * 3).fill(base);
  g.roundRect(18, 34, W - 36, H - 40, 26).fill({ color: clearing, alpha: 0.3 });
  for (let i = 0; i < 1400; i++) {
    const x = Math.floor(rand(-W, W * 2));
    const y = Math.floor(rand(-H, H * 2));
    g.rect(x, y, 2, 1).rect(x + 1, y - 1, 1, 1).fill(i % 3 ? dots[0] : dots[1]);
  }
}

/** Camino: círculos solapados a lo largo de la onda (borde, relleno y motas). */
function path(g: Graphics, edge: number, fill: number, dots: number) {
  for (let x = -W; x <= W * 2; x += 5) g.circle(x, pathY(x), 13);
  g.fill(edge);
  for (let x = -W; x <= W * 2; x += 5) g.circle(x, pathY(x), 11);
  g.fill(fill);
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rand(-W, W * 2));
    g.rect(x, Math.floor(pathY(x) + rand(-8, 8)), 2, 1);
  }
  g.fill(dots);
}

/** Posiciones para árboles o palmeras: dos filas arriba y columnas a los lados, con hueco para el camino. */
function borderSpots(withTop: boolean): [number, number][] {
  const spots: [number, number][] = [];
  if (withTop) {
    for (let x = -W; x <= W * 2; x += 21) spots.push([x + rand(-3, 3), rand(-12, -6)], [x + 10 + rand(-3, 3), 14 + rand(-3, 3)]);
  }
  for (let y = withTop ? 40 : 70; y < H + 20; y += 23) {
    for (const x of [8, W - 8]) {
      if (Math.abs(y - pathY(x)) > 26) spots.push([x + rand(-3, 3), y + rand(-3, 3)]);
    }
  }
  return spots.sort((a, b) => a[1] - b[1]); // los de más abajo, por delante
}

/** Puntos sueltos del claro que no caen en el camino ni en el agua. */
function freeSpots(count: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < count * 3 && out.length < count; i++) {
    const x = rand(30, W - 30);
    const y = rand(52, H - 12);
    if (Math.abs(y - pathY(x)) < 22 || insideEllipse(WATER, x, y) || insideEllipse(SPOT, x, y)) continue;
    out.push([x, y]);
  }
  return out;
}

// ---------- Prado: césped, camino de tierra, flores, estanque y hierba alta ----------
function prado(): Scenery {
  const g = new Graphics();
  ground(g, 0x5fa84a, [0x4f9440, 0x77bd5c], 0x8fd16a);
  path(g, 0xb9945a, 0xd9b77a, 0xc4a066);

  const petals = [0xffffff, 0xffe066, 0xff9ec4];
  freeSpots(22).forEach(([cx, cy], i) => {
    for (let j = 0; j < 4; j++) {
      const x = Math.floor(cx + rand(-9, 9));
      const y = Math.floor(cy + rand(-6, 6));
      g.rect(x - 1, y, 3, 1).rect(x, y - 1, 1, 3).fill(petals[i % petals.length]);
      g.rect(x, y, 1, 1).fill(0xe07b2a);
    }
  });

  g.ellipse(WATER.x, WATER.y + 2, WATER.rx + 4, WATER.ry + 4).fill(0xb9945a);
  g.ellipse(WATER.x, WATER.y, WATER.rx, WATER.ry).fill(0x4f9fdc);
  g.ellipse(WATER.x - 6, WATER.y - 4, WATER.rx * 0.7, WATER.ry * 0.6).fill(0x6db7ec);
  g.rect(WATER.x - 20, WATER.y - 8, 10, 1).rect(WATER.x + 8, WATER.y + 6, 12, 1).rect(WATER.x - 4, WATER.y + 12, 8, 1).fill(0xc9e8fb);
  g.ellipse(WATER.x + 28, WATER.y - 10, 5, 3).ellipse(WATER.x - 30, WATER.y + 9, 4, 2.5).fill(0x3f8a47);

  g.ellipse(SPOT.x, SPOT.y, SPOT.rx, SPOT.ry).fill(0x4a8f3c);
  for (const color of [0x3d7a33, 0x6dbb63]) {
    for (let i = 0; i < 90; i++) {
      const p = pointInEllipse(SPOT);
      g.rect(Math.floor(p.x), Math.floor(p.y) - 3, 1, 4).rect(Math.floor(p.x) + 2, Math.floor(p.y) - 2, 1, 3);
    }
    g.fill(color);
  }

  for (const [x, y] of borderSpots(true)) {
    g.ellipse(x, y + 11, 9, 3).fill({ color: 0x000000, alpha: 0.2 });
    g.rect(x - 2, y + 3, 4, 8).fill(0x6b4423);
    g.circle(x, y - 4, 10).circle(x - 7, y + 1, 7).circle(x + 7, y + 1, 7).fill(0x2f6b3a);
    g.circle(x - 2, y - 7, 6).circle(x + 5, y - 2, 4).fill(0x3f8a47);
    g.rect(x - 4, y - 9, 2, 1).rect(x - 1, y - 11, 2, 1).fill(0x6dbb63);
  }

  const front = new Graphics();
  for (let i = 0; i < 70; i++) {
    const p = pointInEllipse(SPOT);
    front.rect(Math.floor(p.x), Math.floor(p.y) + 2, 1, 5).rect(Math.floor(p.x) + 1, Math.floor(p.y) + 4, 1, 3);
  }
  front.fill(0x4a8f3c);
  return { back: g, front, avoid: WATER, homes: [{ place: WATER, types: ["water"] }, { place: SPOT, types: ["grass"] }] };
}

// ---------- Playa: arena, mar arriba con espuma, poza entre rocas, roquedal, conchas y palmeras ----------
function playa(): Scenery {
  const g = new Graphics();
  ground(g, 0xe6cf8f, [0xd4b977, 0xf3e2b0], 0xfff1c4);
  // El mar ocupa la parte de arriba, donde en el prado están los árboles
  const shore = (x: number) => 30 + Math.sin(x / 40) * 4;
  g.rect(-W, -H, W * 3, H + 30).fill(0x3f88c8);
  for (let x = -W; x <= W * 2; x += 4) g.rect(x, shore(x) - 14, 4, 14);
  g.fill(0x5aa6dc);
  for (let x = -W; x <= W * 2; x += 4) g.rect(x, shore(x) - 2, 4, 3);
  g.fill(0xf4fbff); // espuma en la orilla
  for (let i = 0; i < 60; i++) g.rect(Math.floor(rand(-W, W * 2)), Math.floor(rand(-H, 6)), 6, 1);
  g.fill({ color: 0xbfe2f7, alpha: 0.8 }); // brillos del agua
  for (let x = -W; x <= W * 2; x += 4) g.rect(x, shore(x) + 2, 4, 3);
  g.fill({ color: 0xc9b077, alpha: 0.6 }); // arena mojada

  path(g, 0xd8bf83, 0xf0dfae, 0xe0c890);

  // Conchas y estrellas de mar
  freeSpots(16).forEach(([x, y], i) => {
    const px = Math.floor(x);
    const py = Math.floor(y);
    if (i % 2) g.rect(px - 1, py, 3, 2).rect(px, py - 1, 1, 1).fill(0xf7d2c4);
    else g.rect(px, py - 2, 1, 5).rect(px - 2, py, 5, 1).fill(0xf08a5d);
  });

  // Poza entre rocas
  g.ellipse(WATER.x, WATER.y + 3, WATER.rx + 6, WATER.ry + 6).fill(0x8d8577);
  for (let a = 0; a < Math.PI * 2; a += 0.45) {
    g.circle(WATER.x + Math.cos(a) * (WATER.rx + 3), WATER.y + 2 + Math.sin(a) * (WATER.ry + 3), 4 + (a * 7) % 3);
  }
  g.fill(0xa59c8b);
  g.ellipse(WATER.x, WATER.y, WATER.rx, WATER.ry).fill(0x48a3cf);
  g.ellipse(WATER.x - 6, WATER.y - 4, WATER.rx * 0.7, WATER.ry * 0.6).fill(0x6cc0e4);
  g.rect(WATER.x - 20, WATER.y - 8, 10, 1).rect(WATER.x + 8, WATER.y + 6, 12, 1).fill(0xd7f0fb);

  // Roquedal: piedras grises de varios tamaños
  for (let i = 0; i < 26; i++) {
    const p = pointInEllipse(SPOT);
    const r = rand(3, 7);
    g.ellipse(p.x, p.y + r * 0.5, r + 1, r * 0.45).fill({ color: 0x000000, alpha: 0.15 });
    g.circle(p.x, p.y, r).fill(i % 3 ? 0x9a9284 : 0x857d70);
    g.circle(p.x - r * 0.3, p.y - r * 0.35, r * 0.4).fill(0xbdb6a8);
  }

  // Palmeras en los lados
  for (const [x, y] of borderSpots(false)) {
    g.ellipse(x + 4, y + 12, 10, 3).fill({ color: 0x000000, alpha: 0.18 });
    for (let k = 0; k < 6; k++) g.rect(x - 1 + k * 0.6, y + 10 - k * 3, 3, 3);
    g.fill(0x9a6b3e);
    const top = { x: x + 3.6, y: y - 8 };
    for (const [dx, dy] of [[-11, 2], [11, 2], [-7, -4], [7, -4], [0, -6]]) {
      g.moveTo(top.x, top.y).lineTo(top.x + dx, top.y + dy).lineTo(top.x + dx * 0.6, top.y + dy + 3).closePath();
    }
    g.fill(0x3e9a4a);
    g.circle(top.x, top.y, 2).fill(0x6b4a2a);
  }
  return {
    back: g,
    front: new Graphics(),
    avoid: WATER,
    homes: [{ place: WATER, types: ["water"] }, { place: SPOT, types: ["rock", "ground"] }],
  };
}

// ---------- Bosque nevado: nieve, sendero pisado, lago helado, matorral nevado y pinos ----------
function nieve(): Scenery {
  const g = new Graphics();
  ground(g, 0xe9eff5, [0xd2dde8, 0xffffff], 0xffffff);
  path(g, 0xb8c8d8, 0xd6e0ea, 0xc4d2e0);

  // Pisadas en la nieve
  freeSpots(14).forEach(([x, y]) => {
    for (let k = 0; k < 3; k++) g.rect(Math.floor(x + k * 5), Math.floor(y + (k % 2) * 3), 2, 1);
  });
  g.fill(0xbccbd9);

  // Lago helado: hielo, brillos y grietas
  g.ellipse(WATER.x, WATER.y + 2, WATER.rx + 4, WATER.ry + 4).fill(0xc5d6e4);
  g.ellipse(WATER.x, WATER.y, WATER.rx, WATER.ry).fill(0x9fd0ec);
  g.ellipse(WATER.x - 8, WATER.y - 5, WATER.rx * 0.6, WATER.ry * 0.5).fill(0xc8e8f8);
  g.moveTo(WATER.x - 28, WATER.y + 4).lineTo(WATER.x - 10, WATER.y - 2).lineTo(WATER.x + 6, WATER.y + 6).lineTo(WATER.x + 24, WATER.y - 4);
  g.moveTo(WATER.x - 10, WATER.y - 2).lineTo(WATER.x - 4, WATER.y - 14);
  g.stroke({ width: 1, color: 0x6fa8cc });

  // Matorral nevado
  const bush = (gr: Graphics, x: number, y: number, r: number) => {
    gr.circle(x, y, r).circle(x - r * 0.8, y + 1, r * 0.75).circle(x + r * 0.8, y + 1, r * 0.75).fill(0x2f5e47);
    gr.ellipse(x, y - r * 0.55, r * 0.9, r * 0.4).ellipse(x - r * 0.8, y - r * 0.2, r * 0.5, r * 0.25).fill(0xf7fbff);
  };
  g.ellipse(SPOT.x, SPOT.y, SPOT.rx, SPOT.ry).fill(0xd6e1ec);
  for (let i = 0; i < 18; i++) {
    const p = pointInEllipse(SPOT);
    bush(g, p.x, p.y - 2, rand(4, 7));
  }

  // Pinos con nieve en los bordes
  for (const [x, y] of borderSpots(true)) {
    g.ellipse(x, y + 11, 9, 3).fill({ color: 0x5a7590, alpha: 0.2 });
    g.rect(x - 1.5, y + 5, 3, 6).fill(0x5d4030);
    for (const [w, top] of [[10, -2], [8, -8], [5, -13]]) {
      g.moveTo(x, y + top - 6).lineTo(x + w, y + top + 6).lineTo(x - w, y + top + 6).closePath().fill(0x23513f);
      g.moveTo(x, y + top - 6).lineTo(x + w * 0.5, y + top).lineTo(x - w * 0.5, y + top).closePath().fill(0xf4f8fc);
    }
  }

  const front = new Graphics();
  for (let i = 0; i < 8; i++) {
    const p = pointInEllipse(SPOT, 0.9);
    bush(front, p.x, p.y + 5, rand(3, 5));
  }
  return {
    back: g,
    front,
    avoid: WATER,
    homes: [{ place: WATER, types: ["water", "ice"] }, { place: SPOT, types: ["grass", "bug"] }],
  };
}

const BUILDERS: Record<SceneId, () => Scenery> = { prado, playa, nieve };

export function buildScenery(id: SceneId): Scenery {
  return BUILDERS[id]();
}

export const isSceneId = (value: unknown): value is SceneId => SCENES.some((s) => s.id === value);
