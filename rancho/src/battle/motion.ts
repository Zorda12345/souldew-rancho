// Movimiento y "sensación de golpe" de las peleas del rancho: reglas propias (no son del juego),
// separadas de la pantalla para poder probarlas. Las distancias van en píxeles del mundo (480×320).
import { SPECIES } from "../data/species.ts";
import { stageMultiplier, type Fighter } from "./damage.ts";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Dash: un impulso corto. Para que no se abuse de él:
 *  - recarga larga e igual para todos (los rápidos ya se mueven más; no necesitan además más dashes);
 *  - tras el dash hay un momento de recuperación en el que no se puede atacar
 *    (así no sirve para entrar y pegar en el mismo instante).
 */
export const DASH = { multiplier: 3.2, seconds: 0.22, cooldown: 3.6, recovery: 0.35 };

/** Velocidad base de la especie (la de la Pokédex), o una estimación si no hay datos. */
export function baseSpeed(fighter: Fighter): number {
  return SPECIES[fighter.pokemon.species]?.base.spe ?? Math.round(fighter.stats.spe / 2);
}

/**
 * Píxeles por segundo al moverse en combate, según la Velocidad base y sus subidas:
 * Snorlax (30) ≈ 34 px/s, Pikachu (90) ≈ 55, Electrode (140) ≈ 72. Con tope para que nadie cruce el prado de golpe.
 */
export function moveSpeed(fighter: Fighter): number {
  return clamp((24 + baseSpeed(fighter) * 0.34) * stageMultiplier(fighter.stages.spe ?? 0), 30, 82);
}

/** Datos de un golpe que llega, para calcular cuánto se nota. */
export interface HitInfo {
  damage: number;
  maxHp: number;
  effectiveness: number;
  critical: boolean;
}

/** Fuerza del empujón (px/s al empezar; luego se frena solo). Más daño, más retroceso. */
export function knockback(hit: HitInfo): number {
  const share = hit.damage / Math.max(1, hit.maxHp);
  const strong = (hit.effectiveness > 1 ? 1.25 : 1) * (hit.critical ? 1.2 : 1);
  return clamp(55 + 300 * share, 55, 170) * strong;
}

/** Pausa de impacto ("hitstop") en segundos: el instante en que todo se congela al pegar. */
export function hitstop(hit: HitInfo): number {
  const share = hit.damage / Math.max(1, hit.maxHp);
  return 0.045 + Math.min(0.04, share * 0.25) + (hit.effectiveness > 1 || hit.critical ? 0.035 : 0);
}

/** Cuánto tiembla la imagen (píxeles de pantalla). Solo los golpes fuertes se notan de verdad. */
export function shake(hit: HitInfo): number {
  const share = hit.damage / Math.max(1, hit.maxHp);
  return clamp(0.6 + share * 7 + (hit.effectiveness > 1 ? 1 : 0) + (hit.critical ? 0.8 : 0), 0.6, 4);
}

/** Freno del empujón: velocidad que queda tras `dt` segundos (pierde ~90 % en un cuarto de segundo). */
export const friction = (velocity: number, dt: number) => velocity * Math.exp(-9 * dt);
