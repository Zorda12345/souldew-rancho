import { describe, expect, it } from "vitest";
import { TYPE_IDS, effectiveness, effectivenessAgainst } from "./types.ts";

describe("tabla de efectividades de 3ª generación", () => {
  it("tiene 17 tipos y no incluye hada", () => {
    expect(TYPE_IDS).toHaveLength(17);
    expect(TYPE_IDS).not.toContain("fairy");
  });

  it("conoce los triángulos básicos", () => {
    expect(effectiveness("fire", "grass")).toBe(2);
    expect(effectiveness("grass", "water")).toBe(2);
    expect(effectiveness("water", "fire")).toBe(2);
    expect(effectiveness("fire", "water")).toBe(0.5);
    expect(effectiveness("water", "grass")).toBe(0.5);
    expect(effectiveness("grass", "fire")).toBe(0.5);
    expect(effectiveness("normal", "normal")).toBe(1);
  });

  it("tiene exactamente las 7 inmunidades de la generación", () => {
    const immunities = TYPE_IDS.flatMap((a) => TYPE_IDS.filter((d) => effectiveness(a, d) === 0).map((d) => `${a}>${d}`));
    expect(immunities.sort()).toEqual(
      ["electric>ground", "fighting>ghost", "ghost>normal", "ground>flying", "normal>ghost", "poison>steel", "psychic>dark"].sort(),
    );
  });

  it("usa las reglas propias de 3ª gen: el acero resiste fantasma y siniestro", () => {
    expect(effectiveness("ghost", "steel")).toBe(0.5);
    expect(effectiveness("dark", "steel")).toBe(0.5);
  });

  it("usa las reglas de 2ª gen en adelante para veneno y bicho", () => {
    expect(effectiveness("poison", "bug")).toBe(1);
    expect(effectiveness("bug", "poison")).toBe(0.5);
    expect(effectiveness("ice", "fire")).toBe(0.5);
  });

  it("el dragón solo es débil a hielo y dragón, y el acero resiste dragón", () => {
    const weakTo = TYPE_IDS.filter((a) => effectiveness(a, "dragon") === 2);
    expect(weakTo.sort()).toEqual(["dragon", "ice"]);
    expect(effectiveness("dragon", "steel")).toBe(0.5);
  });

  it("multiplica los dos tipos del defensor", () => {
    expect(effectivenessAgainst("rock", ["fire", "flying"])).toBe(4); // Charizard
    expect(effectivenessAgainst("ground", ["fire", "flying"])).toBe(0); // la inmunidad manda
    expect(effectivenessAgainst("grass", ["water", "ground"])).toBe(4); // Swampert
    expect(effectivenessAgainst("ice", ["dragon", "flying"])).toBe(4); // Dragonite
    expect(effectivenessAgainst("fire", ["bug", "steel"])).toBe(4); // Scizor
    expect(effectivenessAgainst("electric", ["water", "flying"])).toBe(4); // Gyarados
    expect(effectivenessAgainst("fighting", ["ghost", "poison"])).toBe(0); // Gengar
    expect(effectivenessAgainst("ice", ["water", "ice"])).toBe(0.25); // Lapras
    expect(effectivenessAgainst("fire", ["water"])).toBe(0.5);
  });
});
