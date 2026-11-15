import { describe, expect, it } from "vitest";
import { createFighter, type Fighter } from "./damage.ts";
import { DASH, friction, hitstop, knockback, moveSpeed, shake } from "./motion.ts";
import mock from "../../data/mock-save.json";
import { SaveSchema } from "../data/schema.ts";

const save = SaveSchema.parse(mock);
const everyone = [...save.party, ...save.boxes.flatMap((b) => b.pokemon)];
const fighterOf = (species: number): Fighter => createFighter(everyone.find((p) => p.species === species)!);

describe("movimiento por Velocidad base", () => {
  it("los rápidos se mueven más que los lentos, dentro de unos topes", () => {
    const snorlax = moveSpeed(fighterOf(143)); // base 30
    const pikachu = moveSpeed(fighterOf(25)); // base 90
    expect(pikachu).toBeGreaterThan(snorlax);
    expect(snorlax).toBeGreaterThanOrEqual(30);
    expect(pikachu).toBeLessThanOrEqual(82);
  });
  it("una subida de Velocidad se nota", () => {
    const f = fighterOf(25);
    const normal = moveSpeed(f);
    f.stages.spe = 2;
    expect(moveSpeed(f)).toBeGreaterThan(normal);
  });
});

describe("dash", () => {
  it("la recarga es mucho más larga que el propio dash y deja un momento sin atacar", () => {
    expect(DASH.cooldown).toBeGreaterThan(DASH.seconds * 10);
    expect(DASH.recovery).toBeGreaterThan(0);
  });
});

describe("sensación de golpe", () => {
  const weak = { damage: 5, maxHp: 300, effectiveness: 1, critical: false };
  const strong = { damage: 120, maxHp: 300, effectiveness: 2, critical: true };
  it("un golpe fuerte empuja, congela y hace temblar más que uno flojo", () => {
    expect(knockback(strong)).toBeGreaterThan(knockback(weak));
    expect(hitstop(strong)).toBeGreaterThan(hitstop(weak));
    expect(shake(strong)).toBeGreaterThan(shake(weak));
  });
  it("todo tiene tope: nadie sale volando ni la pantalla se vuelve loca", () => {
    const huge = { damage: 9999, maxHp: 10, effectiveness: 4, critical: true };
    expect(knockback(huge)).toBeLessThanOrEqual(170 * 1.25 * 1.2);
    expect(shake(huge)).toBeLessThanOrEqual(4);
    expect(hitstop(huge)).toBeLessThan(0.13);
  });
  it("el empujón se frena solo", () => {
    expect(friction(100, 0.25)).toBeLessThan(15);
  });
});
