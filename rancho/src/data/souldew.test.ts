import { describe, expect, it } from "vitest";
import { StateSchema, saveFromState, toPokemon } from "./souldew.ts";

// Estado de ejemplo con la forma de GET /api/v1/runs/current (docs/STREAM_API.md), recortado.
const mon = (species: number, extra: Record<string, unknown> = {}) => ({ species, name: null, nickname: null, level: 10, status: "", item: null, shiny: false, egg: false, dead: false, inParty: true, area: null, ...extra });
const state = StateSchema.parse({
  run: { id: "c0ffee02", name: "Ana & Ben", gen: 4 },
  players: [
    { slot: "p1", name: "Ana", party: [mon(17, { nickname: "Pip", level: 18, area: "route-29", status: "brn", item: { name: "Poison Barb" }, shiny: true }), mon(175, { egg: true })] },
    { slot: "p2", name: "Ben", party: [mon(4, { area: "route-29" })] },
  ],
  links: [
    { area: "route-29", state: "alive", members: { p1: mon(17, { nickname: "Pip" }), p2: mon(4, { nickname: "Chispi" }) } },
    { area: "route-30", state: "alive", members: { p1: mon(10, { inParty: false }), p2: mon(13, { nickname: "Bicho" }) } },
  ],
  graveyard: [{ area: "cherrygrove", members: { p1: mon(19, { nickname: "Rata", dead: true }), p2: mon(21, { dead: true }) } }],
  encounters: [
    { area: "route-29", state: "alive", results: { p1: { outcome: "caught", species: 16, level: 5 }, p2: null } },
    { area: "route-30", state: "alive", results: { p1: { outcome: "caught", species: 10, level: 4, nickname: "Oruga" }, p2: { outcome: "caught", species: 13 } } },
    { area: "route-31", state: "waiting", results: { p1: { outcome: "missed" }, p2: null } },
    { area: "cherrygrove", state: "dead", results: { p1: { outcome: "caught", species: 19 }, p2: { outcome: "caught", species: 21 } } },
  ],
  feed: [],
});

describe("de souldew al rancho", () => {
  const save = saveFromState(state, "p1");

  it("el equipo es el del jugador elegido, sin huevos, con lo que da souldew", () => {
    expect(save.trainer.name).toBe("Ana");
    expect(save.party.map((p) => p.nickname)).toEqual(["Pip"]);
    const pip = save.party[0];
    expect(pip).toMatchObject({ species: 17, level: 18, status: "burn", item: "Poison Barb", shiny: true, estimated: true, moves: [] });
  });
  it("Caja: sus capturas vivas fuera del equipo; Parejas: las del otro jugador; Caídos: el cementerio entero", () => {
    expect(save.boxes.map((b) => b.name)).toEqual(["Caja", "Parejas", "Caídos"]);
    expect(save.boxes[0].pokemon.map((p) => p.nickname)).toEqual(["Oruga"]); // la 29 va en el equipo; la 31 falló
    expect(save.boxes[1].pokemon.map((p) => p.nickname)).toEqual(["Chispi", "Bicho"]);
    expect(save.boxes[2].pokemon.map((p) => p.species)).toEqual([19, 21]);
  });
  it("sin mote usa el nombre de la especie, y las estadísticas salen de la especie y el nivel", () => {
    const weedle = toPokemon({ species: 13, level: 50 })!;
    expect(weedle.nickname).toBe("Weedle");
    expect(weedle.stats.spe).toBeGreaterThan(weedle.stats.def); // Weedle es más rápido que resistente
    expect(toPokemon({ species: 999 })).toBeNull(); // fuera de la 5ª gen: no se usa
  });
  it("si el jugador pedido no existe, usa el primero", () => {
    expect(saveFromState(state, "p9").trainer.name).toBe("Ana");
  });
});
