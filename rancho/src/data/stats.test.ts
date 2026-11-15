import { describe, expect, it } from "vitest";
import mock from "../../data/mock-save.json";
import { SaveSchema } from "./schema.ts";
import { SPECIES } from "./species.ts";
import { NATURES, calcStats, natureEffect, type Stats } from "./stats.ts";

const six = (hp: number, atk: number, def: number, spa: number, spd: number, spe: number): Stats =>
  ({ hp, atk, def, spa, spd, spe });
const all = (n: number) => six(n, n, n, n, n, n);

describe("calcStats (fórmula de 3ª generación)", () => {
  it("reproduce el ejemplo de referencia de Bulbapedia (Garchomp nv. 78 Firme)", () => {
    const stats = calcStats({
      base: six(108, 130, 95, 80, 85, 102),
      ivs: six(24, 12, 30, 16, 23, 5),
      evs: six(74, 190, 91, 48, 84, 23),
      level: 78,
      nature: "adamant",
    });
    expect(stats).toEqual(six(289, 278, 193, 135, 171, 171));
  });

  it("a nivel 100 con IVs 31 y sin EVs da los valores conocidos de Charizard", () => {
    const stats = calcStats({ base: SPECIES[6].base, ivs: all(31), evs: all(0), level: 100, nature: "hardy" });
    expect(stats).toEqual(six(297, 204, 192, 254, 206, 236));
  });

  it("la naturaleza sube un 10 % una estadística y baja un 10 % otra, sin tocar los PS", () => {
    const input = { base: all(100), ivs: all(31), evs: all(0), level: 100 };
    const neutral = calcStats({ ...input, nature: "hardy" });
    const modest = calcStats({ ...input, nature: "modest" }); // +At. Esp., -Ataque
    expect(neutral.spa).toBe(236);
    expect(modest.spa).toBe(259); // floor(236 · 1,1)
    expect(modest.atk).toBe(212); // floor(236 · 0,9)
    expect(modest.hp).toBe(neutral.hp);
    expect(modest.def).toBe(neutral.def);
  });

  it("los EVs solo cuentan de 4 en 4", () => {
    const input = { base: all(80), ivs: all(0), level: 100, nature: "hardy" as const };
    expect(calcStats({ ...input, evs: all(3) })).toEqual(calcStats({ ...input, evs: all(0) }));
    expect(calcStats({ ...input, evs: all(4) }).atk).toBe(calcStats({ ...input, evs: all(0) }).atk + 1);
  });

  it("Shedinja (PS base 1) siempre tiene 1 PS", () => {
    const stats = calcStats({ base: six(1, 90, 45, 30, 30, 40), ivs: all(31), evs: all(252 / 3), level: 100, nature: "hardy" });
    expect(stats.hp).toBe(1);
  });
});

describe("natureEffect", () => {
  it("hay 5 naturalezas neutras y 20 con efecto", () => {
    const neutral = NATURES.filter((n) => natureEffect(n).up === null);
    expect(neutral).toEqual(["hardy", "docile", "serious", "bashful", "quirky"]);
  });

  it("conoce los efectos de naturalezas típicas", () => {
    expect(natureEffect("adamant")).toEqual({ up: "atk", down: "spa" });
    expect(natureEffect("timid")).toEqual({ up: "spe", down: "atk" });
    expect(natureEffect("bold")).toEqual({ up: "def", down: "atk" });
    expect(natureEffect("calm")).toEqual({ up: "spd", down: "atk" });
  });
});

describe("data/mock-save.json", () => {
  const save = SaveSchema.parse(mock); // lanza un error si no cumple el contrato
  const everyone = [...save.party, ...save.boxes.flatMap((b) => b.pokemon)];

  it("tiene 6 en el equipo, 4 cajas de 4 a 12 Pokémon y al menos 2 shiny", () => {
    expect(save.party).toHaveLength(6);
    expect(save.boxes).toHaveLength(4);
    for (const box of save.boxes) {
      expect(box.pokemon.length, box.name).toBeGreaterThanOrEqual(4);
      expect(box.pokemon.length, box.name).toBeLessThanOrEqual(12);
    }
    expect(everyone.filter((p) => p.shiny).length).toBeGreaterThanOrEqual(2);
  });

  it("las estadísticas guardadas coinciden con la fórmula", () => {
    for (const p of everyone) {
      const expected = calcStats({ base: SPECIES[p.species].base, ivs: p.ivs, evs: p.evs, level: p.level, nature: p.nature });
      expect(p.stats, p.nickname).toEqual(expected);
    }
  });
});
