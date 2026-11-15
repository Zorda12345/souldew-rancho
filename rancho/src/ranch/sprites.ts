// Carga las hojas de sprites de PMD y las trocea en fotogramas según AnimData.xml.
import { Assets, Rectangle, Texture } from "pixi.js";

export const ANIM_NAMES = ["Walk", "Idle", "Sleep"] as const; // imprescindibles
export const EXTRA_ANIMS = ["Attack", "Hurt"] as const; // para los combates; si faltan, se usa la de reposo
export type AnimName = (typeof ANIM_NAMES)[number] | (typeof EXTRA_ANIMS)[number];

export interface Anim {
  frames: Texture[][]; // frames[fila = dirección][columna = fotograma]
  durations: number[]; // duración de cada fotograma en ticks de 1/60 s
}

export interface SpriteSet {
  anims: Record<(typeof ANIM_NAMES)[number], Anim> & Partial<Record<(typeof EXTRA_ANIMS)[number], Anim>>;
  shadow: number; // tamaño de sombra 0-2 que indica AnimData
  body: { x: number; y: number; w: number; h: number }; // zona realmente dibujada, respecto al centro del fotograma
}

/** Los fotogramas tienen mucho margen transparente: busca el recuadro que ocupa el dibujo en el primero. */
function opaqueBounds(frame: Texture): SpriteSet["body"] {
  const { x, y, width: w, height: h } = frame.frame;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(frame.source.resource as CanvasImageSource, x, y, w, h, 0, 0, w, h);
  const alpha = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      if (alpha[(py * w + px) * 4 + 3] === 0) continue;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px);
      y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
  }
  return { x: x0 - w / 2, y: y0 - h / 2, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Clave de la carpeta de sprites de un Pokémon: "6" o "130/shiny". */
export const spriteKey = (p: { species: number; shiny: boolean }) => (p.shiny ? `${p.species}/shiny` : `${p.species}`);

/**
 * Canvas HTML (fuera de Pixi) recortado al dibujo, para la ficha y la franja del equipo.
 * draw(i) pinta el fotograma i de la animación de reposo, mirando al frente.
 */
export function idleCanvas(set: SpriteSet): { canvas: HTMLCanvasElement; draw(frame: number): void } {
  const pad = 2; // margen para que la animación no se corte al moverse
  const b = set.body;
  const canvas = document.createElement("canvas");
  canvas.width = b.w + pad * 2;
  canvas.height = b.h + pad * 2;
  const ctx = canvas.getContext("2d")!;
  return {
    canvas,
    draw(i) {
      const { source, frame } = set.anims.Idle.frames[0][i];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        source.resource as CanvasImageSource,
        frame.x, frame.y, frame.width, frame.height,
        pad - (frame.width / 2 + b.x), pad - (frame.height / 2 + b.y), frame.width, frame.height,
      );
    },
  };
}

const BASE = `${import.meta.env.BASE_URL}sprites/`;
// Los que no vienen descargados: el servidor de souldew los baja de SpriteCollab y los guarda (server/lib/pmd.mjs).
const REMOTE = `${import.meta.env.BASE_URL}pmd/`;

async function loadSet(dir: string): Promise<SpriteSet> {
  const res = await fetch(`${dir}AnimData.xml`);
  if (!res.ok) throw new Error(`sin AnimData.xml (${res.status})`);
  const xml = new DOMParser().parseFromString(await res.text(), "application/xml");
  const nodes = [...xml.querySelectorAll("Anim")];
  const find = (name: string) => nodes.find((n) => n.querySelector("Name")?.textContent === name);

  const loadAnim = async (name: string): Promise<Anim> => {
    // Algunas animaciones no tienen hoja propia: "CopyOf" indica de cuál se copian.
    const copyOf = find(name)?.querySelector("CopyOf")?.textContent;
    const source = copyOf ?? name;
    const node = find(source);
    const fw = Number(node?.querySelector("FrameWidth")?.textContent);
    const fh = Number(node?.querySelector("FrameHeight")?.textContent);
    const durations = [...(node?.querySelectorAll("Duration") ?? [])].map((d) => Number(d.textContent));
    if (!fw || !fh || durations.length === 0) throw new Error(`AnimData sin datos de ${name}`);

    const sheet = await Assets.load<Texture>(`${dir}${source}-Anim.png`);
    sheet.source.scaleMode = "nearest"; // píxeles nítidos al ampliar
    const rows = Math.round(sheet.height / fh);
    const frames: Texture[][] = [];
    for (let r = 0; r < rows; r++) {
      frames.push(durations.map((_, c) => new Texture({ source: sheet.source, frame: new Rectangle(c * fw, r * fh, fw, fh) })));
    }
    return { frames, durations };
  };

  const anims = {} as SpriteSet["anims"];
  for (const name of ANIM_NAMES) anims[name] = await loadAnim(name);
  for (const name of EXTRA_ANIMS) {
    try {
      anims[name] = await loadAnim(name);
    } catch {
      // Sin esa animación: en combate se verá la de reposo.
    }
  }
  return {
    anims,
    shadow: Number(xml.querySelector("ShadowSize")?.textContent) || 1,
    body: opaqueBounds(anims.Idle.frames[0][0]),
  };
}

/**
 * Sprite fijo (sin animación) a partir de una imagen suelta, p. ej. el sprite de juego que sirve souldew.
 * Se reduce a la mitad para que tenga el tamaño de los de Mundo Misterioso y se usa en todas las animaciones.
 */
async function loadStatic(url: string): Promise<SpriteSet> {
  const image = await Assets.load<Texture>(url);
  const img = image.source.resource as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(img.width / 2);
  canvas.height = Math.ceil(img.height / 2);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false; // píxeles nítidos
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const texture = Texture.from(canvas);
  texture.source.scaleMode = "nearest";
  const still: Anim = { frames: Array.from({ length: 8 }, () => [texture]), durations: [60] };
  return { anims: { Walk: still, Idle: still, Sleep: { frames: [[texture]], durations: [60] } }, shadow: 1, body: opaqueBounds(texture) };
}

/**
 * Devuelve un SpriteSet por clave ("6", "130/shiny"…) o null si no está disponible: nunca lanza.
 * Orden: sprite de Mundo Misterioso descargado -> el mismo pedido al servidor (cualquier especie) -> imagen fija de
 * `fallback` (solo si SpriteCollab no tiene esa especie o no hay conexión).
 */
export async function loadSprites(keys: string[], fallback?: (key: string) => string | null): Promise<Map<string, SpriteSet | null>> {
  let available: string[] = [];
  try {
    available = (await (await fetch(`${BASE}manifest.json`)).json()).ok ?? [];
  } catch {
    console.warn("No hay manifest.json de sprites: se usarán marcadores provisionales");
  }
  const entries = await Promise.all(
    [...new Set(keys)].map(async (key): Promise<[string, SpriteSet | null]> => {
      try {
        if (available.includes(key)) return [key, await loadSet(`${BASE}${key}/`)];
        try {
          return [key, await loadSet(`${REMOTE}${key}/`)];
        } catch (e) {
          console.warn(`Sin sprite de Mundo Misterioso para ${key}:`, e);
        }
        const url = fallback?.(key);
        return [key, url ? await loadStatic(url) : null];
      } catch (e) {
        console.warn(`Sprite ${key} no disponible:`, e);
        return [key, null];
      }
    }),
  );
  return new Map(entries);
}
