// Los 17 tipos de la 3ª generación (todavía no existía el tipo hada).
export const TYPE_IDS = [
  "normal", "fire", "water", "grass", "electric", "ice", "fighting", "poison", "ground",
  "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel",
] as const;
export type TypeId = (typeof TYPE_IDS)[number];

const DARK_INK = "#3b2416";

/** name: nombre en español. color: color clásico del tipo. ink: color de texto legible encima. */
export const TYPES: Record<TypeId, { name: string; color: string; ink: string }> = {
  normal: { name: "Normal", color: "#a8a878", ink: DARK_INK },
  fire: { name: "Fuego", color: "#f08030", ink: DARK_INK },
  water: { name: "Agua", color: "#6890f0", ink: DARK_INK },
  grass: { name: "Planta", color: "#78c850", ink: DARK_INK },
  electric: { name: "Eléctrico", color: "#f8d030", ink: DARK_INK },
  ice: { name: "Hielo", color: "#98d8d8", ink: DARK_INK },
  fighting: { name: "Lucha", color: "#c03028", ink: "#fff" },
  poison: { name: "Veneno", color: "#a040a0", ink: "#fff" },
  ground: { name: "Tierra", color: "#e0c068", ink: DARK_INK },
  flying: { name: "Volador", color: "#a890f0", ink: DARK_INK },
  psychic: { name: "Psíquico", color: "#f85888", ink: DARK_INK },
  bug: { name: "Bicho", color: "#a8b820", ink: DARK_INK },
  rock: { name: "Roca", color: "#b8a038", ink: DARK_INK },
  ghost: { name: "Fantasma", color: "#705898", ink: "#fff" },
  dragon: { name: "Dragón", color: "#7038f8", ink: "#fff" },
  dark: { name: "Siniestro", color: "#705848", ink: "#fff" },
  steel: { name: "Acero", color: "#b8b8d0", ink: DARK_INK },
};

// Tabla de efectividades de la 3ª generación, vista desde el tipo que ATACA.
// strong: ×2 · weak: ×0,5 · none: ×0 · lo que no aparece: ×1.
const CHART: Record<TypeId, { strong: TypeId[]; weak: TypeId[]; none: TypeId[] }> = {
  normal: { strong: [], weak: ["rock", "steel"], none: ["ghost"] },
  fire: { strong: ["grass", "ice", "bug", "steel"], weak: ["fire", "water", "rock", "dragon"], none: [] },
  water: { strong: ["fire", "ground", "rock"], weak: ["water", "grass", "dragon"], none: [] },
  grass: { strong: ["water", "ground", "rock"], weak: ["fire", "grass", "poison", "flying", "bug", "dragon", "steel"], none: [] },
  electric: { strong: ["water", "flying"], weak: ["electric", "grass", "dragon"], none: ["ground"] },
  ice: { strong: ["grass", "ground", "flying", "dragon"], weak: ["fire", "water", "ice", "steel"], none: [] },
  fighting: { strong: ["normal", "ice", "rock", "dark", "steel"], weak: ["poison", "flying", "psychic", "bug"], none: ["ghost"] },
  poison: { strong: ["grass"], weak: ["poison", "ground", "rock", "ghost"], none: ["steel"] },
  ground: { strong: ["fire", "electric", "poison", "rock", "steel"], weak: ["grass", "bug"], none: ["flying"] },
  flying: { strong: ["grass", "fighting", "bug"], weak: ["electric", "rock", "steel"], none: [] },
  psychic: { strong: ["fighting", "poison"], weak: ["psychic", "steel"], none: ["dark"] },
  bug: { strong: ["grass", "psychic", "dark"], weak: ["fire", "fighting", "poison", "flying", "ghost", "steel"], none: [] },
  rock: { strong: ["fire", "ice", "flying", "bug"], weak: ["fighting", "ground", "steel"], none: [] },
  ghost: { strong: ["psychic", "ghost"], weak: ["dark", "steel"], none: ["normal"] },
  dragon: { strong: ["dragon"], weak: ["steel"], none: [] },
  dark: { strong: ["psychic", "ghost"], weak: ["fighting", "dark", "steel"], none: [] },
  steel: { strong: ["ice", "rock"], weak: ["fire", "water", "electric", "steel"], none: [] },
};

/** Multiplicador de un ataque de tipo `attack` contra UN tipo defensor: 2, 1, 0.5 o 0. */
export function effectiveness(attack: TypeId, defense: TypeId): number {
  const row = CHART[attack];
  return row.none.includes(defense) ? 0 : row.strong.includes(defense) ? 2 : row.weak.includes(defense) ? 0.5 : 1;
}

/** Contra un Pokémon con uno o dos tipos se multiplican: de ahí salen el ×4 y el ×¼. */
export function effectivenessAgainst(attack: TypeId, defender: TypeId[]): number {
  return defender.reduce((total, type) => total * effectiveness(attack, type), 1);
}
