// La ficha: un panel lateral de HTML normal que se rellena con los datos del Pokémon.
import { moveType } from "../data/moves.ts";
import type { Pokemon } from "../data/schema.ts";
import { SPECIES } from "../data/species.ts";
import { STAT_KEYS, natureEffect, type Nature, type StatKey } from "../data/stats.ts";
import { idleCanvas, type SpriteSet } from "../ranch/sprites.ts";
import { typeChip, typeIcon } from "../ui/pixel.ts";

const STAT_ES: Record<StatKey, string> = {
  hp: "PS", atk: "Ataque", def: "Defensa", spa: "At. Esp.", spd: "Def. Esp.", spe: "Velocidad",
};

const NATURE_ES: Record<Nature, string> = {
  hardy: "Fuerte", lonely: "Huraña", brave: "Audaz", adamant: "Firme", naughty: "Pícara",
  bold: "Osada", docile: "Dócil", relaxed: "Plácida", impish: "Agitada", lax: "Floja",
  timid: "Miedosa", hasty: "Activa", serious: "Seria", jolly: "Alegre", naive: "Ingenua",
  modest: "Modesta", mild: "Afable", quiet: "Mansa", bashful: "Tímida", rash: "Alocada",
  calm: "Serena", gentle: "Amable", sassy: "Grosera", careful: "Cauta", quirky: "Rara",
};

const STATUS_ES: Record<Pokemon["status"], string> = {
  none: "Sano", sleep: "Dormido", poison: "Envenenado", badPoison: "Gravemente envenenado",
  burn: "Quemado", freeze: "Congelado", paralysis: "Paralizado",
};

const GENDER = { male: ["♂", "Macho"], female: ["♀", "Hembra"], genderless: ["", ""] } as const;

// Los textos vienen de un archivo externo: se escapan antes de meterlos en el HTML.
const esc = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const pct = (ratio: number) => `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;

/**
 * Valor de una estadística ajustado al nivel, para poder comparar Pokémon de niveles distintos.
 * Devuelve el tramo (1 floja … 5 excelente) y cuánto llenar la barra.
 */
function rate(key: StatKey, value: number, level: number): { tier: number; fill: string; label: string } {
  const perLevel = key === "hp" ? (value - level - 10) / level : (value - 5) / level;
  const tier = perLevel < 1.2 ? 1 : perLevel < 1.8 ? 2 : perLevel < 2.4 ? 3 : perLevel < 3 ? 4 : 5;
  return { tier, fill: pct(perLevel / 3.6), label: ["Floja", "Justa", "Normal", "Buena", "Excelente"][tier - 1] };
}

function render(p: Pokemon): string {
  const species = SPECIES[p.species];
  const { up, down } = natureEffect(p.nature);
  const [genderIcon, genderName] = GENDER[p.gender];
  const evTotal = STAT_KEYS.reduce((sum, k) => sum + p.evs[k], 0);

  const natureNote = up && down
    ? `<span class="up">▲ ${STAT_ES[up]}</span> <span class="down">▼ ${STAT_ES[down]}</span>`
    : `<span class="muted">neutra</span>`;

  const statRows = STAT_KEYS.map((k) => {
    const mark = k === up ? "up" : k === down ? "down" : "";
    const arrow = k === up ? " ▲" : k === down ? " ▼" : "";
    const r = rate(k, p.stats[k], p.level);
    return `<tr>
      <th scope="row" class="${mark}">${STAT_ES[k]}${arrow}</th>
      <td class="num strong">${p.stats[k]}</td>
      <td class="bar-cell"><div class="bar" title="${r.label}"><i class="tier-${r.tier}" style="width:${r.fill}"></i></div></td>
      <td class="num${p.ivs[k] === 31 ? " best" : ""}">${p.ivs[k]}</td>
      <td class="num">${p.evs[k]}</td>
    </tr>`;
  }).join("");

  const moves = p.moves.map((m) => {
    const type = moveType(m.name);
    return `<li>
      ${type ? typeIcon(type) : `<span class="type-icon unknown" title="Tipo desconocido"></span>`}
      <span class="move-name">${esc(m.name)}</span>
      <span class="num${m.pp === 0 ? " empty" : ""}">PP ${m.pp}/${m.ppMax}</span>
      <div class="bar pp"><i style="width:${pct(m.pp / m.ppMax)}"></i></div>
    </li>`;
  }).join("");

  return `
    <button class="close" type="button" aria-label="Cerrar ficha">✕</button>
    <header>
      <div class="portrait"></div>
      <div class="who">
        <h2>${esc(p.nickname)} <span class="gender ${p.gender}" title="${genderName}">${genderIcon}</span></h2>
        <p class="muted">${esc(species?.name ?? `Especie ${p.species}`)}, N.º ${String(p.species).padStart(3, "0")}</p>
        <p class="types">${(species?.types ?? []).map(typeChip).join("")}</p>
      </div>
    </header>
    <p class="chips">
      <span class="chip">Nivel ${p.level}</span>
      ${p.shiny ? `<span class="chip shiny">★ Shiny</span>` : ""}
      ${p.status !== "none" ? `<span class="chip status">${STATUS_ES[p.status]}</span>` : ""}
    </p>

    <dl>
      <dt>Naturaleza</dt><dd>${NATURE_ES[p.nature]} ${natureNote}</dd>
      <dt>Habilidad</dt><dd>${esc(p.ability)}</dd>
      <dt>Objeto</dt><dd>${p.item ? esc(p.item) : `<span class="muted">Ninguno</span>`}</dd>
      <dt>Amistad</dt><dd>${p.friendship} de 255</dd>
    </dl>

    <h3>Estadísticas</h3>
    <table>
      <thead><tr><th></th><th></th><th></th><th class="num">IV</th><th class="num">EV</th></tr></thead>
      <tbody>${statRows}</tbody>
      <tfoot><tr><td colspan="4" class="muted">EVs repartidos</td><td class="num">${evTotal}/510</td></tr></tfoot>
    </table>

    <h3>Movimientos</h3>
    <ul class="moves">${moves}</ul>`;
}

export interface Card {
  show(pokemon: Pokemon, sprites: SpriteSet | null): void;
  close(): void;
}

export function createCard(root: HTMLElement, onClose: () => void): Card {
  const close = () => {
    if (!root.classList.contains("open")) return;
    root.classList.remove("open");
    onClose();
  };
  root.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest(".close")) close();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  return {
    close,
    show(pokemon, sprites) {
      root.innerHTML = render(pokemon);
      root.scrollTop = 0;
      const box = root.querySelector(".portrait")!;
      if (sprites) {
        const { canvas, draw } = idleCanvas(sprites);
        draw(0);
        const zoom = Math.max(1, Math.min(3, Math.floor(88 / Math.max(canvas.width, canvas.height))));
        canvas.style.width = `${canvas.width * zoom}px`;
        box.append(canvas);
      } else {
        box.innerHTML = `<span class="placeholder">${pokemon.species}</span>`; // mismo marcador que en el rancho
      }
      root.classList.add("open");
    },
  };
}
