import { describe, expect, it } from "vitest";
import mock from "../../data/mock-save.json";
import { MOVES, attackTypes } from "../data/moves.ts";
import { SaveSchema } from "../data/schema.ts";
import {
  BATTLE_LEVEL, calcDamage, createFighter, effectiveStat, isPhysical, resolveAttack, seededRng, stageMultiplier,
  type DamageInput, type Fighter,
} from "./damage.ts";

const save = SaveSchema.parse(mock);
const everyone = [...save.party, ...save.boxes.flatMap((b) => b.pokemon)];

// Caso base calculado a mano: nivel 50, potencia 95, ataque 150, defensa 100.
//   2·50/5 + 2 = 22 → 22·95·150/100 = 3135 → 3135/50 = 62 → 62 + 2 = 64
const base: DamageInput = { level: 50, power: 95, attack: 150, defense: 100, stab: false, effectiveness: 1, critical: false, roll: 100 };

describe("calcDamage (fórmula de 3ª generación)", () => {
  it("da el daño base calculado a mano", () => {
    expect(calcDamage(base)).toBe(64);
  });

  it("aplica el factor aleatorio de 85 a 100", () => {
    expect(calcDamage({ ...base, roll: 85 })).toBe(54); // 64·85/100 = 54,4
    expect(calcDamage({ ...base, roll: 92 })).toBe(58); // 58,88
  });

  it("aplica STAB (×1,5), crítico (×2) y efectividad", () => {
    expect(calcDamage({ ...base, stab: true })).toBe(96);
    expect(calcDamage({ ...base, critical: true })).toBe(128);
    expect(calcDamage({ ...base, effectiveness: 2 })).toBe(128);
    expect(calcDamage({ ...base, effectiveness: 4 })).toBe(256);
    expect(calcDamage({ ...base, effectiveness: 0.5 })).toBe(32);
    expect(calcDamage({ ...base, effectiveness: 0.25 })).toBe(16);
  });

  it("combina todos los multiplicadores redondeando hacia abajo en cada paso", () => {
    // 64 → crítico 128 → STAB 192 → muy eficaz 384 → aleatorio 85 %: 326,4
    expect(calcDamage({ ...base, stab: true, critical: true, effectiveness: 2, roll: 85 })).toBe(326);
  });

  it("una inmunidad anula el daño y un golpe que afecta quita al menos 1 PS", () => {
    expect(calcDamage({ ...base, effectiveness: 0, critical: true, stab: true })).toBe(0);
    expect(calcDamage({ ...base, power: 20, attack: 5, defense: 250, effectiveness: 0.25, roll: 85 })).toBe(1);
  });

  it("un ataque de área que alcanza a varios hace la mitad (antes de sumar 2)", () => {
    expect(calcDamage({ ...base, spread: true })).toBe(33); // 62/2 = 31 → 31 + 2
  });

  it("más ataque hace más daño y más defensa, menos", () => {
    expect(calcDamage({ ...base, attack: 300 })).toBeGreaterThan(calcDamage(base));
    expect(calcDamage({ ...base, defense: 200 })).toBeLessThan(calcDamage(base));
  });
});

describe("físico o especial según el tipo", () => {
  it("sigue el reparto de la 3ª generación", () => {
    expect(["normal", "fighting", "flying", "poison", "ground", "rock", "bug", "ghost", "steel"].every((t) => isPhysical(t as never))).toBe(true);
    expect(["fire", "water", "grass", "electric", "psychic", "ice", "dragon", "dark"].some((t) => isPhysical(t as never))).toBe(false);
  });
});

describe("subidas y bajadas de estadísticas", () => {
  it("usa los multiplicadores del juego", () => {
    expect(stageMultiplier(0)).toBe(1);
    expect(stageMultiplier(1)).toBe(1.5);
    expect(stageMultiplier(2)).toBe(2);
    expect(stageMultiplier(6)).toBe(4);
    expect(stageMultiplier(-1)).toBeCloseTo(2 / 3);
    expect(stageMultiplier(-6)).toBe(0.25);
    expect(stageMultiplier(9)).toBe(4); // nunca pasa de +6
  });
});

describe("createFighter", () => {
  const ascuas = createFighter(save.party[0]); // Charizard modesto: IVs 27/9/18/31/22/25, EVs 40/0/12/252/6/200

  it("recalcula las estadísticas a nivel 50 con la fórmula real", () => {
    expect(ascuas.level).toBe(BATTLE_LEVEL);
    expect(ascuas.stats.hp).toBe(156); // (156+27+10)·50/100 = 96 → + 50 + 10
    expect(ascuas.stats.spa).toBe(177); // (218+31+63)·50/100 = 156 → +5 = 161 → ·1,1
    expect(ascuas.stats.atk).toBe(83); // (168+9+0)·50/100 = 88 → +5 = 93 → ·0,9
    expect(ascuas.hp).toBe(ascuas.stats.hp);
    expect(ascuas.types).toEqual(["fire", "flying"]);
  });

  it("no toca los datos de la partida", () => {
    expect(save.party[0].level).toBe(62);
    expect(save.party[0].stats.hp).toBe(191);
  });

  it("aplica las subidas al leer una estadística", () => {
    const boosted: Fighter = { ...ascuas, stages: { spa: 2, atk: -1 } };
    expect(effectiveStat(boosted, "spa")).toBe(354);
    expect(effectiveStat(boosted, "atk")).toBe(55); // 83·2/3 = 55,3
    expect(effectiveStat(boosted, "spe")).toBe(ascuas.stats.spe);
  });
});

describe("resolveAttack", () => {
  const dummy = (types: Fighter["types"], stats: Partial<Fighter["stats"]> = {}): Fighter => ({
    pokemon: save.party[0], level: 50, types, hp: 200, stages: {},
    stats: { hp: 200, atk: 100, def: 100, spa: 150, spd: 100, spe: 100, ...stats },
  });
  // Dados trucados: devuelve los valores dados, en orden (acierto, crítico, factor aleatorio).
  const dice = (...values: number[]) => () => values.shift() ?? 0.5;

  it("falla si el dado de acierto supera la precisión", () => {
    const result = resolveAttack(dummy(["fire"]), dummy(["normal"]), MOVES["Hidrobomba"], dice(0.85)); // precisión 80
    expect(result).toMatchObject({ hit: false, damage: 0 });
  });

  it("los movimientos que nunca fallan no tiran el dado de acierto", () => {
    const result = resolveAttack(dummy(["normal"]), dummy(["normal"]), MOVES["Rapidez"], dice(0.99, 0.99));
    expect(result.hit).toBe(true);
    expect(result.critical).toBe(false);
  });

  it("usa At. Esp. contra Def. Esp. en un ataque de fuego, con STAB y efectividad", () => {
    // Lanzallamas (95) de un tipo fuego con At. Esp. 150 contra un tipo planta con Def. Esp. 100:
    // base 64 → STAB 96 → muy eficaz 192 → dado 0,999 = factor 100
    const result = resolveAttack(dummy(["fire"]), dummy(["grass"]), MOVES["Lanzallamas"], dice(0, 0.5, 0.999));
    expect(result).toEqual({ hit: true, damage: 192, critical: false, effectiveness: 2 });
  });

  it("usa Ataque contra Defensa en un ataque de tierra y respeta la inmunidad de los voladores", () => {
    const attacker = dummy(["ground"], { atk: 150 });
    expect(resolveAttack(attacker, dummy(["electric"]), MOVES["Terremoto"], dice(0, 0.5, 0.999)).damage).toBe(204); // 68 → 102 → 204
    expect(resolveAttack(attacker, dummy(["fire", "flying"]), MOVES["Terremoto"], dice(0, 0.5, 0.999))).toMatchObject({ hit: true, damage: 0, effectiveness: 0 });
  });

  it("un dado de crítico bajo dobla el daño, y los de alto índice lo consiguen el doble de veces", () => {
    const normal = resolveAttack(dummy(["water"]), dummy(["water"]), MOVES["Golpe Cuerpo"], dice(0, 0.07, 0.999));
    const sharp = resolveAttack(dummy(["water"]), dummy(["water"]), MOVES["Cuchillada"], dice(0, 0.07, 0.999));
    expect(normal.critical).toBe(false); // 0,07 no baja de 1/16
    expect(sharp.critical).toBe(true); // pero sí de 1/8
  });

  it("con la misma semilla el resultado se repite", () => {
    const run = () => resolveAttack(dummy(["fire"]), dummy(["grass"]), MOVES["Lanzallamas"], seededRng(1234));
    expect(run()).toEqual(run());
  });
});

describe("tabla de movimientos", () => {
  it("conoce todos los movimientos del archivo de prueba", () => {
    const unknown = [...new Set(everyone.flatMap((p) => p.moves.map((m) => m.name)))].filter((name) => !MOVES[name]);
    expect(unknown).toEqual([]);
  });

  it("tiene valores coherentes", () => {
    for (const [name, move] of Object.entries(MOVES)) {
      expect(move.power, name).toBeGreaterThanOrEqual(0);
      if (move.accuracy !== null) expect(move.accuracy, name).toBeGreaterThan(0);
      if (move.power === 0) expect(move.area ?? false, name).toBe(false);
    }
  });

  it("solo cuenta como ataques los movimientos que hacen daño", () => {
    expect(attackTypes(["Lanzallamas", "Danza Espada", "Terremoto", "No Existe"])).toEqual(["fire", "ground"]);
  });

  it("todo Pokémon del archivo tiene al menos un ataque con el que pelear", () => {
    const helpless = everyone.filter((p) => attackTypes(p.moves.map((m) => m.name)).length === 0).map((p) => p.nickname);
    expect(helpless).toEqual([]);
  });
});
