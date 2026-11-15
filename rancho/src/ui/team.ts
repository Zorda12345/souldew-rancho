// Franja fija con los 6 huecos del equipo. Es HTML normal; solo el sprite es un canvas pequeño.
import type { Pokemon } from "../data/schema.ts";
import { idleCanvas, spriteKey, type SpriteSet } from "../ranch/sprites.ts";
import { BAG_ICON, pixelSvg } from "./pixel.ts";

const SLOTS = 6;

// Abreviaturas de estado como las del juego en español.
const STATUS_SHORT: Record<Pokemon["status"], string> = {
  none: "", sleep: "DOR", poison: "ENV", badPoison: "ENV", burn: "QUE", freeze: "CON", paralysis: "PAR",
};

function el(tag: string, className: string, text = ""): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text; // textContent no interpreta HTML: los motes no pueden inyectar nada
  return node;
}

export interface TeamStrip {
  clearSelection(): void;
}

export function createTeam(
  root: HTMLElement,
  party: Pokemon[],
  sprites: Map<string, SpriteSet | null>,
  onSelect: (pokemon: Pokemon, set: SpriteSet | null) => void,
): TeamStrip {
  const animated: { draw(frame: number): void; durations: number[]; frame: number; ticks: number }[] = [];
  const buttons: HTMLElement[] = [];
  const clearSelection = () => buttons.forEach((b) => b.classList.remove("selected"));

  for (let i = 0; i < SLOTS; i++) {
    const pokemon = party[i];
    if (!pokemon) {
      const empty = el("div", "slot empty", "Vacío");
      empty.setAttribute("aria-label", `Hueco ${i + 1} vacío`);
      root.append(empty);
      continue;
    }

    const slot = el("button", "slot");
    (slot as HTMLButtonElement).type = "button";
    const set = sprites.get(spriteKey(pokemon)) ?? null;

    const art = el("div", "art");
    if (set) {
      const { canvas, draw } = idleCanvas(set);
      // Todos ocupan un tamaño parecido: los pequeños se amplían (hasta x2) y los grandes se reducen.
      const zoom = Math.min(2, 54 / Math.max(canvas.width, canvas.height));
      canvas.style.width = `${canvas.width * zoom}px`;
      draw(0);
      art.append(canvas);
      animated.push({ draw, durations: set.anims.Idle.durations, frame: 0, ticks: 0 });
    } else {
      art.append(el("span", "placeholder", String(pokemon.species))); // mismo marcador que en el rancho
    }

    const icons = el("div", "icons");
    if (pokemon.status !== "none") {
      const status = el("span", `status ${pokemon.status}`, STATUS_SHORT[pokemon.status]);
      status.title = "Estado alterado";
      icons.append(status);
    }
    if (pokemon.item) {
      const item = el("span", "item");
      item.innerHTML = pixelSvg(BAG_ICON, "#a06a35", 12); // icono fijo, no texto del archivo
      item.title = `Objeto: ${pokemon.item}`;
      icons.append(item);
    }

    const head = el("div", "head");
    head.append(el("span", "name", pokemon.nickname), el("span", "level", `Nv. ${pokemon.level}`));

    // El contrato solo guarda los PS máximos, así que la barra se muestra llena con ese valor.
    const hp = el("div", "hp");
    hp.append(el("span", "hp-label", "PS"), el("div", "hp-bar"), el("span", "hp-value", String(pokemon.stats.hp)));

    slot.append(icons, art, head, hp);
    slot.addEventListener("click", () => {
      clearSelection();
      slot.classList.add("selected");
      onSelect(pokemon, set);
    });
    buttons.push(slot);
    root.append(slot);
  }

  // Un único bucle anima los seis sprites, respetando la duración de cada fotograma (en 1/60 s).
  let last = performance.now();
  const tick = (now: number) => {
    const ticks = (Math.min(now - last, 50) / 1000) * 60;
    last = now;
    for (const a of animated) {
      a.ticks += ticks;
      let changed = false;
      while (a.ticks >= a.durations[a.frame]) {
        a.ticks -= a.durations[a.frame];
        a.frame = (a.frame + 1) % a.durations.length;
        changed = true;
      }
      if (changed) a.draw(a.frame); // solo se repinta cuando cambia el fotograma
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  return { clearSelection };
}
