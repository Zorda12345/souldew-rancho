// Reglas de combate de la 3ª generación: solo cálculos, sin nada de pantalla.
import type { Move } from "../data/moves.ts";
import type { Pokemon } from "../data/schema.ts";
import { SPECIES } from "../data/species.ts";
import { calcStats, type StatKey, type Stats } from "../data/stats.ts";
import { effectivenessAgainst, type TypeId } from "../data/types.ts";

export const BATTLE_LEVEL = 50; // todos pelean al mismo nivel para que no gane siempre el más entrenado

/** Un Pokémon preparado para pelear. Los PS se gastan aquí, nunca en los datos de la partida. */
export interface Fighter {
  pokemon: Pokemon;
  level: number;
  types: TypeId[];
  stats: Stats; // recalculadas al nivel del combate
  hp: number;
  stages: Partial<Record<StatKey, number>>; // subidas y bajadas temporales, de -6 a +6
}

/** Número al azar entre 0 (incluido) y 1 (excluido). Se pasa como parámetro para poder probar con valores fijos. */
export type Rng = () => number;

/** Generador con semilla: la misma semilla da siempre la misma secuencia. */
export function seededRng(seed: number): Rng {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createFighter(pokemon: Pokemon, level = BATTLE_LEVEL): Fighter {
  const species = SPECIES[pokemon.species];
  // Mismas estadísticas base, IVs, EVs y naturaleza; solo cambia el nivel. Sin datos de especie, se usan las guardadas.
  const stats = species
    ? calcStats({ base: species.base, ivs: pokemon.ivs, evs: pokemon.evs, level, nature: pokemon.nature })
    : pokemon.stats;
  return { pokemon, level: species ? level : pokemon.level, types: species?.types ?? [], stats, hp: stats.hp, stages: {} };
}

// En 3ª generación un ataque es físico o especial según su TIPO, no según el movimiento.
const PHYSICAL: TypeId[] = ["normal", "fighting", "flying", "poison", "ground", "rock", "bug", "ghost", "steel"];
export const isPhysical = (type: TypeId) => PHYSICAL.includes(type);

/** Multiplicador de un nivel de subida o bajada: +1 = ×1,5 · +2 = ×2 · -1 = ×2/3 … */
export function stageMultiplier(stage: number): number {
  const s = Math.min(6, Math.max(-6, stage));
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}

/** Estadística de un luchador con sus subidas y bajadas aplicadas. */
export const effectiveStat = (fighter: Fighter, key: StatKey) =>
  Math.floor(fighter.stats[key] * stageMultiplier(fighter.stages[key] ?? 0));

export interface DamageInput {
  level: number;
  power: number;
  attack: number; // Ataque o At. Esp. del atacante
  defense: number; // Defensa o Def. Esp. del defensor
  stab: boolean; // el atacante es del mismo tipo que el movimiento (×1,5)
  effectiveness: number; // 0, 0.25, 0.5, 1, 2 o 4
  critical: boolean; // ×2
  roll: number; // factor aleatorio: un entero de 85 a 100
  spread?: boolean; // ataque de área que alcanza a varios (×0,5, ajuste de equilibrio del rancho)
}

/**
 * Fórmula de daño de la 3ª generación. El juego trabaja con enteros: tras cada paso se redondea hacia abajo.
 *   base = ((2·Nivel/5 + 2) · Potencia · Ataque / Defensa) / 50, y luego + 2
 *   daño = base · crítico · STAB · efectividad · aleatorio/100
 */
export function calcDamage(d: DamageInput): number {
  if (d.effectiveness === 0) return 0;
  let damage = Math.floor(Math.floor((Math.floor((2 * d.level) / 5) + 2) * d.power * d.attack / d.defense) / 50);
  if (d.spread) damage = Math.floor(damage / 2);
  damage += 2;
  if (d.critical) damage *= 2;
  if (d.stab) damage = Math.floor(damage * 1.5);
  damage = Math.floor(damage * d.effectiveness);
  damage = Math.floor((damage * d.roll) / 100);
  return Math.max(1, damage); // si le afecta, un golpe siempre quita al menos 1 PS
}

export interface AttackResult {
  hit: boolean;
  damage: number;
  critical: boolean;
  effectiveness: number;
}

/** Resuelve un ataque: tira los dados (acierto, crítico y factor aleatorio, en ese orden) y calcula el daño. */
export function resolveAttack(attacker: Fighter, defender: Fighter, move: Move, rng: Rng, spread = false): AttackResult {
  const effectiveness = effectivenessAgainst(move.type, defender.types);
  if (move.accuracy !== null && rng() * 100 >= move.accuracy) return { hit: false, damage: 0, critical: false, effectiveness };
  const critical = rng() < (move.highCrit ? 1 / 8 : 1 / 16);
  const roll = 85 + Math.floor(rng() * 16);
  const physical = isPhysical(move.type);
  const damage = calcDamage({
    level: attacker.level,
    power: move.power,
    attack: effectiveStat(attacker, physical ? "atk" : "spa"),
    defense: effectiveStat(defender, physical ? "def" : "spd"),
    stab: attacker.types.includes(move.type),
    effectiveness,
    critical,
    roll,
    spread,
  });
  return { hit: true, damage, critical, effectiveness };
}
