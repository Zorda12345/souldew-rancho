// "IA" de las peleas del rancho: reglas que puntúan opciones (no un modelo de lenguaje). Sin pantalla,
// para poder probarlas. Cada decisión se basa en el daño ESPERADO con la fórmula real de 3ª gen.
import { MOVES, type Move } from "../data/moves.ts";
import type { StatKey } from "../data/stats.ts";
import { effectivenessAgainst } from "../data/types.ts";
import { calcDamage, effectiveStat, isPhysical, type Fighter } from "./damage.ts";

export interface Plan { name: string; move: Move }
/** Si no conoce ningún ataque útil, pelea con un golpe básico. */
export const STRUGGLE: Plan = { name: "Forcejeo", move: { type: "normal", power: 40, accuracy: 100 } };

/** Daño medio que haría `move` a `defender`: tirada media, precisión y probabilidad de crítico incluidas. */
export function expectedDamage(attacker: Fighter, defender: Fighter, move: Move, spread = false): number {
  if (move.power === 0) return 0;
  const physical = isPhysical(move.type);
  const base = calcDamage({
    level: attacker.level,
    power: move.power,
    attack: effectiveStat(attacker, physical ? "atk" : "spa"),
    defense: effectiveStat(defender, physical ? "def" : "spd"),
    stab: attacker.types.includes(move.type),
    effectiveness: effectivenessAgainst(move.type, defender.types),
    critical: false,
    roll: 92, // media de 85 a 100
    spread,
  });
  if (effectivenessAgainst(move.type, defender.types) === 0) return 0;
  const crit = move.highCrit ? 1 / 8 : 1 / 16;
  return base * ((move.accuracy ?? 100) / 100) * (1 + crit); // un crítico duplica: de media suma su probabilidad
}

/** Movimientos que conoce y que el rancho sabe usar. */
export function knownMoves(fighter: Fighter): Plan[] {
  return fighter.pokemon.moves.map((m) => ({ name: m.name, move: MOVES[m.name] })).filter((p): p is Plan => p.move !== undefined);
}

/** Su mejor ataque contra ese rival y cuánto haría. */
export function bestAttack(attacker: Fighter, defender: Fighter): { plan: Plan; damage: number } {
  const attacks = knownMoves(attacker).filter((p) => p.move.power > 0);
  let best = { plan: STRUGGLE, damage: expectedDamage(attacker, defender, STRUGGLE.move) };
  for (const plan of attacks) {
    const damage = expectedDamage(attacker, defender, plan.move);
    if (damage > best.damage) best = { plan, damage };
  }
  return best;
}

export interface TargetInfo {
  fighter: Fighter;
  distance: number; // píxeles del mundo
  /** Cuántos compañeros de pelea ya van a por él (para no amontonarse todos sobre el mismo). */
  hunters: number;
}

/**
 * Puntuación de un rival como objetivo. Gana:
 *  - el que más "porcentaje de vida" le puedo quitar por golpe (efectividad de tipos, estadísticas);
 *  - mucho más si lo puedo debilitar ya (rematar);
 *  - el que más daño me hace a mí (amenaza).
 * Pierde un poco por estar lejos y por tener ya a otros encima.
 */
export function scoreTarget(me: Fighter, foe: TargetInfo): number {
  const mine = bestAttack(me, foe.fighter).damage;
  const share = Math.min(1, mine / Math.max(1, foe.fighter.hp));
  const finish = mine >= foe.fighter.hp ? 1.6 : 1;
  const threat = Math.min(1, bestAttack(foe.fighter, me).damage / Math.max(1, me.hp));
  const crowd = 0.8 ** foe.hunters;
  return (share * finish + threat * 0.45) * crowd - foe.distance / 900;
}

/** El índice del mejor objetivo (o -1 si no hay). */
export function pickTarget(me: Fighter, foes: TargetInfo[]): number {
  let best = -1;
  let bestScore = -Infinity;
  foes.forEach((foe, i) => {
    const score = scoreTarget(me, foe);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

export interface MoveContext {
  heals: number; // curas ya usadas (máximo 2 por pelea)
  rng?: () => number;
}

/**
 * Elige qué hacer contra `target`:
 *  1. Rematar si algún ataque lo debilita (prefiriendo los de prioridad, que golpean antes).
 *  2. Curarse si va por debajo del 40 % y no puede rematar.
 *  3. Subirse estadísticas solo si le compensa: va bien de vida, la pelea va para largo y la subida
 *     es de la estadística con la que ataca (o Velocidad).
 *  4. Si no, el ataque de más daño esperado (a veces el segundo, si es casi igual, para no ser predecible).
 */
export function chooseMove(me: Fighter, target: Fighter, ctx: MoveContext): Plan {
  const rng = ctx.rng ?? Math.random;
  const known = knownMoves(me);
  const attacks = known
    .filter((p) => p.move.power > 0)
    .map((plan) => ({ plan, damage: expectedDamage(me, target, plan.move) }))
    .sort((a, b) => b.damage - a.damage);

  const finishers = attacks.filter((a) => a.damage >= target.hp);
  if (finishers.length) return (finishers.find((a) => a.plan.move.priority) ?? finishers[0]).plan;

  const hpShare = me.hp / me.stats.hp;
  const heal = known.find((p) => p.move.heal);
  if (heal && ctx.heals < 2 && hpShare < 0.4) return heal;

  const best = attacks[0];
  const hitsToWin = best ? target.hp / Math.max(1, best.damage) : Infinity;
  const usesPhysical = best ? isPhysical(best.plan.move.type) : true;
  const useful: StatKey[] = [usesPhysical ? "atk" : "spa", "spe"];
  const boost = known.find(
    (p) => p.move.boost && Object.entries(p.move.boost).some(([k, n]) => useful.includes(k as StatKey) && (n ?? 0) > 0 && (me.stages[k as StatKey] ?? 0) < 2),
  );
  if (boost && hpShare > 0.6 && hitsToWin > 3) return boost;

  if (!best) return STRUGGLE;
  const second = attacks[1];
  if (second && second.damage >= best.damage * 0.85 && rng() < 0.25) return second.plan;
  return best.plan;
}
