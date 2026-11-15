// Panel "Analizar equipo": pinta en un <dialog> lo que calcula analysis/analyze.ts.
import { analyzeTeam } from "../analysis/analyze.ts";
import type { Pokemon, Save } from "../data/schema.ts";
import { SPECIES } from "../data/species.ts";
import { TYPES } from "../data/types.ts";
import { idleCanvas, spriteKey, type SpriteSet } from "../ranch/sprites.ts";
import { typeChip } from "./pixel.ts";

const esc = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Cómo se escribe y se colorea cada multiplicador de daño.
const CELL: Record<string, [text: string, cls: string, label: string]> = {
  "4": ["×4", "m4", "recibe el cuádruple"],
  "2": ["×2", "m2", "recibe el doble"],
  "1": ["", "", "daño normal"],
  "0.5": ["×½", "mh", "recibe la mitad"],
  "0.25": ["×¼", "mq", "recibe la cuarta parte"],
  "0": ["×0", "m0", "no le afecta"],
};

function render(save: Save): string {
  const { defense, uncovered, suggestions } = analyzeTeam(save.party, save.boxes);

  const heads = save.party
    .map((p, i) => `<th scope="col"><span class="mini" data-team="${i}"></span><span class="who">${esc(p.nickname)}</span></th>`)
    .join("");

  const rows = defense.map((row) => {
    const cells = row.multipliers.map((m) => {
      const [text, cls, label] = CELL[String(m)];
      return `<td class="${cls}" title="${label}">${text}</td>`;
    }).join("");
    return `<tr${row.problem ? ` class="problem"` : ""}>
      <th scope="row">${typeChip(row.type)}</th>${cells}
      <td class="num count${row.weak ? " bad" : ""}">${row.weak}</td>
      <td class="num count${row.resist ? " good" : ""}">${row.resist}</td>
    </tr>`;
  }).join("");

  const problems = defense.filter((row) => row.problem).map((row) => TYPES[row.type].name);
  const problemNote = problems.length
    ? `Puntos débiles del equipo (filas marcadas): <b>${problems.join(", ")}</b>.`
    : "No hay ningún tipo que le duela a medio equipo sin que alguien lo aguante.";

  const coverage = uncovered.length
    ? `<p class="chips">${uncovered.map((u) =>
        `<span class="cover">${typeChip(u.type)}${u.best < 1 ? `<small>${u.best === 0 ? "no le afecta nada" : "solo poco eficaz"}</small>` : ""}</span>`,
      ).join("")}</p>`
    : `<p>Tus ataques pegan con ventaja a los 17 tipos.</p>`;

  const tips = suggestions.length
    ? `<ul class="suggestions">${suggestions.map((s, i) => `<li>
        <span class="mini" data-tip="${i}"></span>
        <div>
          <b>${esc(s.pokemon.nickname)}</b>
          <span class="muted">${esc(SPECIES[s.pokemon.species]?.name ?? "")}, nivel ${s.pokemon.level}, caja ${esc(s.box)}</span>
          ${s.reasons.map((r) => `<p>${r}</p>`).join("")}
        </div>
      </li>`).join("")}</ul>`
    : `<p>Ningún Pokémon de tus cajas mejora claramente lo que ya tienes.</p>`;

  return `
    <form method="dialog"><button class="close" aria-label="Cerrar análisis">✕</button></form>
    <h2>Análisis del equipo</h2>

    <h3>Qué ataques le duelen a tu equipo</h3>
    <p class="muted">Cada casilla indica cuánto daño recibe ese Pokémon de un ataque de ese tipo. Vacía significa daño normal.</p>
    <div class="scroll">
      <table class="matrix">
        <thead><tr><th scope="col">Ataque de tipo</th>${heads}<th scope="col" class="num">Débiles</th><th scope="col" class="num">Aguantan</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p>${problemNote}</p>

    <h3>Tipos a los que tus ataques no pegan con ventaja</h3>
    ${coverage}

    <h3>Quién de tus cajas ayudaría</h3>
    ${tips}`;
}

export function createAnalyzer(button: HTMLElement, dialog: HTMLDialogElement, save: Save, sprites: Map<string, SpriteSet | null>): void {
  const paint = (slot: Element | null, pokemon: Pokemon) => {
    const set = sprites.get(spriteKey(pokemon));
    if (!slot) return;
    if (!set) {
      slot.textContent = String(pokemon.species); // sin sprite: su número, como el marcador del rancho
      return;
    }
    const { canvas, draw } = idleCanvas(set);
    draw(0);
    slot.append(canvas);
  };

  button.addEventListener("click", () => {
    dialog.innerHTML = render(save);
    save.party.forEach((p, i) => paint(dialog.querySelector(`[data-team="${i}"]`), p));
    analyzeTeam(save.party, save.boxes).suggestions.forEach((s, i) => paint(dialog.querySelector(`[data-tip="${i}"]`), s.pokemon));
    dialog.showModal(); // modal: oscurece el fondo y se cierra con Esc
    dialog.scrollTop = 0;
  });
}
