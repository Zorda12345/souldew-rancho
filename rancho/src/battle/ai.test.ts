import { describe, expect, it } from "vitest";
import mock from "../../data/mock-save.json";
import { SaveSchema } from "../data/schema.ts";
import { MOVES } from "../data/moves.ts";
import { createFighter, type Fighter } from "./damage.ts";
import { chooseMove, expectedDamage, pickTarget } from "./ai.ts";

const save = SaveSchema.parse(mock);
const everyone = [...save.party, ...save.boxes.flatMap((b) => b.pokemon)];
const fighter = (nickname: string): Fighter => createFighter(everyone.find((p) => p.nickname === nickname)!);
const never = () => 0.99; // sin la variedad aleatoria

describe("daño esperado", () => {
  it("es 0 contra un tipo inmune y mayor con ventaja de tipo", () => {
    const snorlax = fighter("Gordi");
    expect(expectedDamage(fighter("Presagio"), snorlax, MOVES["Bola Sombra"])).toBe(0); // fantasma contra normal
    const gyarados = fighter("Rojo");
    expect(expectedDamage(fighter("Chispa"), gyarados, MOVES["Rayo"])).toBeGreaterThan(
      expectedDamage(fighter("Chispa"), gyarados, MOVES["Cola Férrea"]),
    );
  });
});

describe("elección de ataque", () => {
  it("usa el ataque eficaz: Rayo contra Gyarados, Lanzallamas contra un planta", () => {
    expect(chooseMove(fighter("Chispa"), fighter("Rojo"), { heals: 0, rng: never }).name).toBe("Rayo");
    expect(chooseMove(fighter("Ascuas"), fighter("Hoja"), { heals: 0, rng: never }).name).toBe("Lanzallamas");
  });
  it("para rematar prefiere un ataque con prioridad", () => {
    const target = fighter("Rojo");
    target.hp = 1;
    expect(chooseMove(fighter("Chispa"), target, { heals: 0, rng: never }).name).toBe("Ataque Rápido");
  });
  it("se cura si va mal… salvo que pueda rematar", () => {
    const alakazam = fighter("Cucharas");
    alakazam.hp = Math.floor(alakazam.stats.hp * 0.3);
    expect(chooseMove(alakazam, fighter("Gordi"), { heals: 0, rng: never }).name).toBe("Recuperación");
    const almostDone = fighter("Gordi");
    almostDone.hp = 1;
    expect(chooseMove(alakazam, almostDone, { heals: 0, rng: never }).name).not.toBe("Recuperación");
    expect(chooseMove(alakazam, fighter("Gordi"), { heals: 2, rng: never }).name).not.toBe("Recuperación");
  });
  it("solo se sube estadísticas cuando compensa (bien de vida y pelea larga)", () => {
    const scizor = fighter("Tijeras");
    expect(chooseMove(scizor, fighter("Gordi"), { heals: 0, rng: never }).name).toBe("Danza Espada");
    scizor.hp = Math.floor(scizor.stats.hp * 0.5);
    expect(chooseMove(scizor, fighter("Gordi"), { heals: 0, rng: never }).name).not.toBe("Danza Espada");
  });
});

describe("elección de rival", () => {
  it("prefiere al que puede debilitar ya", () => {
    const me = fighter("Ascuas");
    const healthy = fighter("Gordi");
    const weak = fighter("Gordi");
    weak.hp = 5;
    expect(pickTarget(me, [{ fighter: healthy, distance: 50, hunters: 0 }, { fighter: weak, distance: 50, hunters: 0 }])).toBe(1);
  });
  it("no se amontonan: entre dos rivales iguales elige el que nadie ataca", () => {
    const me = fighter("Ascuas");
    expect(pickTarget(me, [{ fighter: fighter("Gordi"), distance: 50, hunters: 2 }, { fighter: fighter("Gordi"), distance: 50, hunters: 0 }])).toBe(1);
  });
});
