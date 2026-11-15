// Genera src/data/species-data.json: las 649 especies de 1ª a 5ª gen con nombre en español, tipos y
// estadísticas base TAL COMO ERAN en 5ª gen (antes del tipo hada y de los cambios de la 6ª).
// Fuente: CSV públicos de PokeAPI (github.com/PokeAPI/pokeapi, data/v2/csv). Uso: npm run rancho:species
import { writeFileSync } from "node:fs";

const BASE = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/";
const MAX_DEX = 649;
const SPANISH = 7; // local_language_id del español
const GEN = 5;
const STAT_ORDER = [1, 2, 3, 4, 5, 6]; // hp, atk, def, spa, spd, spe (stat_id de PokeAPI)

async function csv(name: string): Promise<string[][]> {
  const res = await fetch(`${BASE}${name}.csv`);
  if (!res.ok) throw new Error(`No se pudo descargar ${name}.csv (${res.status})`);
  return (await res.text()).trim().split("\n").slice(1).map((line) => line.split(","));
}

const [types, typesNow, typesPast, statsNow, statsPast, names] = await Promise.all([
  csv("types"), csv("pokemon_types"), csv("pokemon_types_past"), csv("pokemon_stats"), csv("pokemon_stats_past"), csv("pokemon_species_names"),
]);
const typeName = new Map(types.map(([id, identifier]) => [id, identifier]));

// Los "_past" guardan valores antiguos con generation_id = ÚLTIMA generación en que valían. Para la 5ª gen vale
// la entrada con la generación más baja que sea >= 5; si no hay ninguna, el valor actual.

// Tipos: pokemon_id,type_id,slot  /  pokemon_id,generation_id,type_id,slot
const nowTypes = new Map<number, string[]>();
for (const [id, type, slot] of typesNow) {
  const list = nowTypes.get(Number(id)) ?? [];
  list[Number(slot) - 1] = typeName.get(type)!;
  nowTypes.set(Number(id), list);
}
const pastTypes = new Map<number, string[]>();
{
  const best = new Map<number, number>();
  for (const [id, gen, type, slot] of typesPast) {
    const g = Number(gen);
    if (g < GEN) continue;
    const prev = best.get(Number(id));
    if (prev !== undefined && prev < g) continue;
    if (prev === undefined || prev > g) pastTypes.set(Number(id), []);
    best.set(Number(id), g);
    pastTypes.get(Number(id))![Number(slot) - 1] = typeName.get(type)!;
  }
}

// Estadísticas: pokemon_id,stat_id,base_stat,effort  /  pokemon_id,generation_id,stat_id,base_stat,effort
const nowStats = new Map<number, Map<number, number>>();
for (const [id, stat, value] of statsNow) {
  const m = nowStats.get(Number(id)) ?? new Map<number, number>();
  m.set(Number(stat), Number(value));
  nowStats.set(Number(id), m);
}
const pastStats = new Map<number, Map<number, number>>();
{
  const best = new Map<number, number>();
  for (const [id, gen, stat, value] of statsPast) {
    const g = Number(gen);
    if (g < GEN) continue;
    const prev = best.get(Number(id));
    if (prev !== undefined && prev < g) continue;
    if (prev === undefined || prev > g) pastStats.set(Number(id), new Map());
    best.set(Number(id), g);
    pastStats.get(Number(id))!.set(Number(stat), Number(value));
  }
}

const spanish = new Map(names.filter((r) => Number(r[1]) === SPANISH).map((r) => [Number(r[0]), r[2]]));

const out: [number, string, string[], number[]][] = [];
for (let dex = 1; dex <= MAX_DEX; dex++) {
  const t = (pastTypes.get(dex) ?? nowTypes.get(dex) ?? []).filter(Boolean);
  const stats = STAT_ORDER.map((s) => pastStats.get(dex)?.get(s) ?? nowStats.get(dex)?.get(s) ?? 0);
  const name = spanish.get(dex);
  if (!name || t.length === 0 || t.includes("fairy") || stats.includes(0)) throw new Error(`Datos incompletos para #${dex}`);
  out.push([dex, name, t, stats]);
}
writeFileSync(new URL("../src/data/species-data.json", import.meta.url), JSON.stringify(out) + "\n");
console.log(`species-data.json: ${out.length} especies`);
