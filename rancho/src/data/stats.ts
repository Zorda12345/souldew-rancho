// Fórmulas de estadísticas de la 3ª generación (Rubí/Zafiro/Esmeralda/Rojo Fuego/Verde Hoja).

export const STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;

// Las 25 naturalezas en el orden interno del juego (naturaleza = personalidad % 25).
export const NATURES = [
  "hardy", "lonely", "brave", "adamant", "naughty",
  "bold", "docile", "relaxed", "impish", "lax",
  "timid", "hasty", "serious", "jolly", "naive",
  "modest", "mild", "quiet", "bashful", "rash",
  "calm", "gentle", "sassy", "careful", "quirky",
] as const;
export type Nature = (typeof NATURES)[number];

// Orden en que el juego cruza las naturalezas: fila = sube, columna = baja.
const NATURE_STAT_ORDER = ["atk", "def", "spe", "spa", "spd"] as const;

/** Qué estadística sube (+10 %) y cuál baja (-10 %). Ambas null si es neutra. */
export function natureEffect(nature: Nature): { up: StatKey | null; down: StatKey | null } {
  const i = NATURES.indexOf(nature);
  const up = NATURE_STAT_ORDER[Math.floor(i / 5)];
  const down = NATURE_STAT_ORDER[i % 5];
  return up === down ? { up: null, down: null } : { up, down };
}

export interface StatInput {
  base: Stats;
  ivs: Stats;
  evs: Stats;
  level: number;
  nature: Nature;
}

/**
 * PS    = floor((2·Base + IV + floor(EV/4)) · Nivel / 100) + Nivel + 10
 * Resto = floor((floor((2·Base + IV + floor(EV/4)) · Nivel / 100) + 5) · Naturaleza)
 * El juego usa aritmética entera: la naturaleza es ·110/100 o ·90/100 redondeando hacia abajo.
 */
export function calcStats({ base, ivs, evs, level, nature }: StatInput): Stats {
  const { up, down } = natureEffect(nature);
  const out = {} as Stats;
  for (const key of STAT_KEYS) {
    const core = Math.floor(((2 * base[key] + ivs[key] + Math.floor(evs[key] / 4)) * level) / 100);
    if (key === "hp") {
      out.hp = base.hp === 1 ? 1 : core + level + 10; // Shedinja siempre tiene 1 PS
      continue;
    }
    const pct = key === up ? 110 : key === down ? 90 : 100;
    out[key] = Math.floor(((core + 5) * pct) / 100);
  }
  return out;
}
