// De una run de souldew a los datos del rancho. souldew da su estado en su API de stream (/api/v1, ver
// docs/STREAM_API.md): especie, mote, nivel, estado, objeto, shiny y si sigue vivo; NO da naturaleza, IVs, EVs,
// habilidad, sexo, amistad ni movimientos. Esos Pokémon se marcan como `estimated` (ver schema.ts).
import { z } from "zod";
import { SaveSchema, type Pokemon, type Save } from "./schema.ts";
import { SPECIES } from "./species.ts";
import { calcStats } from "./stats.ts";

// Solo las partes del estado que usamos; lo demás se ignora (la API solo añade campos dentro de la v1).
const Mon = z.object({
  species: z.number().int(),
  name: z.string().nullish(),
  nickname: z.string().nullish(),
  level: z.number().int().nullish(),
  status: z.string().nullish(),
  item: z.object({ name: z.string().nullish() }).nullish(),
  shiny: z.boolean().nullish(),
  egg: z.boolean().nullish(),
  dead: z.boolean().nullish(),
  inParty: z.boolean().nullish(),
  area: z.string().nullish(),
});
type Mon = z.infer<typeof Mon>;
const Result = z.object({ outcome: z.string().nullish(), species: z.number().int().nullish(), name: z.string().nullish(), level: z.number().int().nullish(), nickname: z.string().nullish(), shiny: z.boolean().nullish() });

export const StateSchema = z.object({
  run: z.object({ id: z.string(), name: z.string(), gen: z.number().int().nullish() }),
  players: z.array(z.object({ slot: z.string(), name: z.string(), color: z.string().nullish(), party: z.array(Mon).default([]) })),
  links: z.array(z.object({ area: z.string(), state: z.string(), members: z.record(z.string(), Mon.nullable()) })).default([]),
  graveyard: z.array(z.object({ area: z.string(), members: z.record(z.string(), Mon.nullable()) })).default([]),
  encounters: z.array(z.object({ area: z.string(), state: z.string(), results: z.record(z.string(), Result.nullable()) })).default([]),
});
export type SouldewState = z.infer<typeof StateSchema>;

const STATUS: Record<string, Pokemon["status"]> = { slp: "sleep", psn: "poison", tox: "badPoison", brn: "burn", frz: "freeze", par: "paralysis" };
const NEUTRAL = { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 }; // IVs medios: solo para calcular
const ZERO = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const BOX_SIZE = 30;

/** Un Pokémon de souldew con lo que se sabe; lo demás, neutro y marcado como estimado. `null` si no se puede usar. */
export function toPokemon(m: Partial<Mon> & { species: number }): Pokemon | null {
  const species = SPECIES[m.species];
  if (!species || m.egg) return null;
  const level = Math.min(100, Math.max(1, m.level ?? 5));
  const nickname = (m.nickname || m.name || species.name).slice(0, 10);
  return {
    species: m.species,
    nickname,
    level,
    nature: "hardy",
    shiny: !!m.shiny,
    gender: "genderless",
    ability: "?",
    item: m.item?.name || null,
    stats: calcStats({ base: species.base, ivs: NEUTRAL, evs: ZERO, level, nature: "hardy" }),
    ivs: NEUTRAL,
    evs: ZERO,
    moves: [],
    friendship: 70,
    status: STATUS[m.status ?? ""] ?? "none",
    estimated: true,
  };
}

const usable = (list: (Pokemon | null)[]) => list.filter((p): p is Pokemon => p !== null).slice(0, BOX_SIZE);

/**
 * Los Pokémon de un jugador repartidos como en el rancho:
 *  - equipo: su equipo (en vivo si el juego está abierto; si no, el del tablero);
 *  - «Caja»: sus capturas vivas que no van en el equipo;
 *  - «Parejas»: los Pokémon de los demás jugadores enlazados con los suyos (vivos);
 *  - «Caídos»: los del cementerio, de todos los jugadores.
 */
export function saveFromState(state: SouldewState, slot: string): Save {
  const me = state.players.find((p) => p.slot === slot) ?? state.players[0];
  const mine = me?.slot ?? slot;
  const party = (me?.party ?? []).filter((m) => !m.dead);
  const inParty = new Set(party.map((m) => m.area).filter(Boolean));

  const box = state.encounters
    .filter((e) => e.state !== "dead" && !inParty.has(e.area))
    .map((e) => e.results[mine])
    .filter((r) => r?.outcome === "caught" && r.species)
    .map((r) => toPokemon({ species: r!.species!, name: r!.name, nickname: r!.nickname, level: r!.level, shiny: r!.shiny }));

  const partners = state.links
    .filter((l) => l.state === "alive")
    .flatMap((l) => Object.entries(l.members).filter(([s, m]) => s !== mine && m && !m.dead).map(([, m]) => toPokemon(m!)));

  const fallen = state.graveyard.flatMap((g) => Object.values(g.members).filter((m): m is Mon => !!m).map(toPokemon));

  return SaveSchema.parse({
    schemaVersion: 1,
    trainer: { name: (me?.name || "Jugador").slice(0, 7), id: 0 },
    party: usable(party.map(toPokemon)).slice(0, 6),
    boxes: [
      { name: "Caja", pokemon: usable(box) },
      { name: "Parejas", pokemon: usable(partners) },
      { name: "Caídos", pokemon: usable(fallen) },
    ],
  });
}
