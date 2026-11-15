// Genera data/mock-save.json calculando las estadísticas con la fórmula real.
// Uso: npm run gen:mock
import { writeFileSync } from "node:fs";
import { SaveSchema, type Pokemon, type Save } from "../src/data/schema.ts";
import { SPECIES } from "../src/data/species.ts";
import { STAT_KEYS, calcStats, type Nature, type Stats } from "../src/data/stats.ts";

const six = (hp: number, atk: number, def: number, spa: number, spd: number, spe: number): Stats =>
  ({ hp, atk, def, spa, spd, spe });

type MoveSpec = [name: string, pp: number, ppMax: number];

interface Spec {
  species: number;
  nickname: string;
  level: number;
  nature: Nature;
  gender: Pokemon["gender"];
  ability: string;
  item: string | null;
  ivs: Stats;
  evs: Stats;
  moves: MoveSpec[];
  friendship: number;
  shiny?: boolean;
  status?: Pokemon["status"];
}

function build(p: Spec): Pokemon {
  return {
    species: p.species,
    nickname: p.nickname,
    level: p.level,
    nature: p.nature,
    shiny: p.shiny ?? false,
    gender: p.gender,
    ability: p.ability,
    item: p.item,
    stats: calcStats({ base: SPECIES[p.species].base, ivs: p.ivs, evs: p.evs, level: p.level, nature: p.nature }),
    ivs: p.ivs,
    evs: p.evs,
    moves: p.moves.map(([name, pp, ppMax]) => ({ name, pp, ppMax })),
    friendship: p.friendship,
    status: p.status ?? "none",
  };
}

const party: Spec[] = [
  {
    species: 6, nickname: "Ascuas", level: 62, nature: "modest", gender: "male",
    ability: "Mar Llamas", item: "Carbón",
    ivs: six(27, 9, 18, 31, 22, 25), evs: six(40, 0, 12, 252, 6, 200),
    moves: [["Lanzallamas", 11, 15], ["Vuelo", 15, 15], ["Garra Dragón", 15, 15], ["Terremoto", 8, 10]],
    friendship: 255,
  },
  {
    species: 25, nickname: "Chispa", level: 48, nature: "jolly", gender: "female",
    ability: "Elec. Estática", item: "Bola Luminosa",
    ivs: six(20, 28, 11, 17, 14, 31), evs: six(24, 180, 0, 60, 0, 240),
    moves: [["Rayo", 12, 15], ["Ataque Rápido", 30, 30], ["Onda Trueno", 18, 20], ["Cola Férrea", 15, 15]],
    friendship: 230,
  },
  {
    species: 143, nickname: "Gordi", level: 57, nature: "adamant", gender: "male",
    ability: "Sebo", item: "Restos",
    ivs: six(30, 26, 21, 4, 24, 8), evs: six(180, 220, 60, 0, 50, 0),
    moves: [["Golpe Cuerpo", 15, 15], ["Descanso", 9, 10], ["Terremoto", 10, 10], ["Bola Sombra", 13, 15]],
    friendship: 180, status: "sleep",
  },
  {
    species: 130, nickname: "Rojo", level: 55, nature: "lonely", gender: "male",
    ability: "Intimidación", item: "Agua Mística",
    ivs: six(23, 31, 15, 12, 19, 27), evs: six(60, 252, 0, 20, 0, 170),
    moves: [["Surf", 15, 15], ["Danza Dragón", 17, 20], ["Terremoto", 10, 10], ["Hidrobomba", 3, 5]],
    friendship: 140, shiny: true,
  },
  {
    species: 65, nickname: "Cucharas", level: 54, nature: "timid", gender: "male",
    ability: "Sincronía", item: "Cuchara Torcida",
    ivs: six(14, 3, 17, 30, 25, 31), evs: six(10, 0, 0, 248, 0, 252),
    moves: [["Psíquico", 7, 10], ["Paz Mental", 20, 20], ["Recuperación", 16, 20], ["Puño Fuego", 15, 15]],
    friendship: 120,
  },
  {
    species: 131, nickname: "Nessie", level: 52, nature: "calm", gender: "female",
    ability: "Absor. Agua", item: null,
    ivs: six(29, 13, 22, 24, 28, 10), evs: six(200, 0, 80, 120, 100, 0),
    moves: [["Rayo Hielo", 10, 10], ["Surf", 12, 15], ["Rayo Confuso", 10, 10], ["Canto", 15, 15]],
    friendship: 200,
  },
];

const box1: Spec[] = [
  {
    species: 133, nickname: "Canela", level: 25, nature: "hardy", gender: "female",
    ability: "Fuga", item: null,
    ivs: six(18, 21, 16, 9, 25, 30), evs: six(12, 30, 8, 0, 4, 26),
    moves: [["Placaje", 35, 35], ["Ataque Arena", 15, 15], ["Mordisco", 25, 25], ["Refuerzo", 20, 20]],
    friendship: 255,
  },
  {
    species: 94, nickname: "Sombra", level: 55, nature: "hasty", gender: "male",
    ability: "Levitación", item: "Hechizo",
    ivs: six(16, 20, 7, 31, 19, 29), evs: six(0, 40, 0, 240, 0, 228),
    moves: [["Bola Sombra", 15, 15], ["Psíquico", 10, 10], ["Hipnosis", 20, 20], ["Rayo", 15, 15]],
    friendship: 90,
  },
  {
    species: 157, nickname: "Volcán", level: 50, nature: "mild", gender: "male",
    ability: "Mar Llamas", item: null,
    ivs: six(25, 14, 10, 28, 20, 23), evs: six(50, 0, 0, 200, 30, 150),
    moves: [["Lanzallamas", 15, 15], ["Rapidez", 20, 20], ["Pantalla Humo", 20, 20], ["Puño Trueno", 15, 15]],
    friendship: 160,
  },
];

const box2: Spec[] = [
  {
    species: 181, nickname: "Faro", level: 45, nature: "quiet", gender: "female",
    ability: "Elec. Estática", item: "Imán",
    ivs: six(31, 8, 24, 26, 21, 5), evs: six(150, 0, 60, 180, 40, 0),
    moves: [["Rayo", 15, 15], ["Onda Trueno", 20, 20], ["Pantalla Luz", 30, 30], ["Puño Fuego", 15, 15]],
    friendship: 170,
  },
  {
    species: 257, nickname: "Kiko", level: 58, nature: "naive", gender: "male",
    ability: "Mar Llamas", item: "Cinturón Negro",
    ivs: six(22, 30, 13, 27, 6, 28), evs: six(0, 200, 0, 100, 0, 210),
    moves: [["Patada Ígnea", 10, 10], ["Gancho Alto", 15, 15], ["Cuchillada", 20, 20], ["Corpulencia", 20, 20]],
    friendship: 210,
  },
  {
    species: 282, nickname: "Lira", level: 52, nature: "bold", gender: "female",
    ability: "Calco", item: null,
    ivs: six(19, 2, 29, 30, 26, 17), evs: six(120, 0, 200, 150, 40, 0),
    moves: [["Psíquico", 10, 10], ["Paz Mental", 20, 20], ["Rayo", 15, 15], ["Hipnosis", 20, 20]],
    friendship: 240,
  },
];

// --- Pokémon "rápidos": IVs, EVs y PP gastados salen de un generador aleatorio con semilla fija,
// así el archivo es siempre el mismo cada vez que se regenera.
let seed = 20040129;
function rng(): number {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function randomStats(make: () => number): Stats {
  return Object.fromEntries(STAT_KEYS.map((k) => [k, make()])) as Stats;
}

function randomEvs(): Stats {
  const total = 200 + Math.floor(rng() * 311); // entre 200 y 510
  const weights = randomStats(() => rng() ** 2);
  const sum = STAT_KEYS.reduce((a, k) => a + weights[k], 0);
  return Object.fromEntries(
    STAT_KEYS.map((k) => [k, Math.min(252, Math.floor(((weights[k] / sum) * total) / 4) * 4)]),
  ) as Stats;
}

/** moves: "Surf:15|Rayo Hielo:10" (nombre:PP máximos). */
function quick(
  species: number, nickname: string, level: number, nature: Nature, gender: Pokemon["gender"],
  ability: string, item: string | null, moves: string, friendship: number, extra: Partial<Spec> = {},
): Spec {
  return {
    species, nickname, level, nature, gender, ability, item, friendship,
    ivs: randomStats(() => Math.floor(rng() * 32)),
    evs: randomEvs(),
    moves: moves.split("|").map((m): MoveSpec => {
      const [name, max] = m.split(":");
      return [name, Math.max(0, Number(max) - Math.floor(rng() * rng() * 6)), Number(max)];
    }),
    ...extra,
  };
}

const box1More: Spec[] = [
  quick(59, "Brasa", 53, "adamant", "male", "Intimidación", "Carbón", "Lanzallamas:15|Vel. Extrema:5|Triturar:15|Rugido:20", 220, { status: "paralysis" }),
  quick(149, "Draco", 61, "jolly", "female", "Foco Interno", "Colmillo Dragón", "Danza Dragón:20|Golpe Aéreo:20|Terremoto:10|Enfado:15", 150),
];

const boxAgua: Spec[] = [
  quick(9, "Cañón", 56, "bold", "male", "Torrente", "Agua Mística", "Surf:15|Rayo Hielo:10|Giro Rápido:40|Protección:10", 200),
  quick(134, "Gota", 44, "calm", "female", "Absor. Agua", "Restos", "Surf:15|Rayo Hielo:10|Deseo:10|Protección:10", 255),
  quick(121, "Estela", 50, "timid", "genderless", "Cura Natural", null, "Surf:15|Psíquico:10|Rayo:15|Recuperación:20", 110),
  quick(160, "Colmillo", 52, "naughty", "male", "Torrente", null, "Surf:15|Cuchillada:20|Terremoto:10|Triturar:15", 130),
  quick(260, "Fango", 58, "relaxed", "male", "Torrente", "Arena Fina", "Surf:15|Terremoto:10|Rayo Hielo:10|Disparo Lodo:15", 190),
  quick(350, "Sirena", 55, "modest", "female", "Escama Especial", "Restos", "Surf:15|Rayo Hielo:10|Recuperación:20|Hipnosis:20", 240),
];

const boxFavoritos: Spec[] = [
  quick(3, "Brote", 60, "quiet", "male", "Espesura", "Semilla Milagro", "Hoja Afilada:25|Somnífero:15|Drenadoras:10|Terremoto:10", 255),
  quick(197, "Luna", 47, "careful", "female", "Sincronía", "Restos", "Finta:20|Luz Lunar:5|Tóxico:10|Rayo Confuso:10", 255, { shiny: true }),
  quick(212, "Tijeras", 51, "adamant", "male", "Enjambre", null, "Ala de Acero:25|Danza Espada:30|Viento Plata:5|Ataque Rápido:30", 170),
  quick(254, "Hoja", 57, "hasty", "male", "Espesura", null, "Hoja Aguda:15|Garra Dragón:15|Gigadrenado:5|Agilidad:30", 210),
  quick(330, "Libélula", 54, "naive", "female", "Levitación", null, "Terremoto:10|Garra Dragón:15|Vuelo:15|Lanzallamas:15", 180),
  quick(359, "Presagio", 46, "lonely", "female", "Presión", "Garra Rápida", "Cuchillada:20|Danza Espada:30|Bola Sombra:15|Mordisco:25", 70),
  quick(376, "Titán", 63, "brave", "genderless", "Cuerpo Puro", "Cinta Elegida", "Puño Meteoro:10|Terremoto:10|Psíquico:10|Agilidad:30", 160, { shiny: true }),
];

const boxLegendarios: Spec[] = [
  quick(144, "Ventisca", 50, "calm", "genderless", "Presión", null, "Rayo Hielo:10|Ventisca:5|Reflejo:20|Descanso:10", 35),
  quick(150, "Mewtwo", 70, "timid", "genderless", "Presión", "Cuchara Torcida", "Psíquico:10|Paz Mental:20|Recuperación:20|Lanzallamas:15", 0),
  quick(245, "Aurora", 50, "bold", "genderless", "Presión", "Restos", "Surf:15|Paz Mental:20|Rayo Hielo:10|Descanso:10", 60),
  quick(249, "Lugia", 70, "sassy", "genderless", "Presión", null, "Aerochorro:5|Psíquico:10|Recuperación:20|Hidrobomba:5", 0),
  quick(384, "Cielo", 70, "rash", "genderless", "Bucle Aire", "Colmillo Dragón", "Garra Dragón:15|Vuelo:15|Vel. Extrema:5|Terremoto:10", 0),
];

const save: Save = {
  schemaVersion: 1,
  trainer: { name: "ROJO", id: 34521 },
  party: party.map(build),
  boxes: [
    { name: "CAJA 1", pokemon: [...box1, ...box2, ...box1More].map(build) },
    { name: "Agua", pokemon: boxAgua.map(build) },
    { name: "Amigos", pokemon: boxFavoritos.map(build) },
    { name: "Leyendas", pokemon: boxLegendarios.map(build) },
  ],
};

SaveSchema.parse(save); // si algo incumple el contrato, falla aquí con un error claro

const out = new URL("../data/mock-save.json", import.meta.url);
writeFileSync(out, JSON.stringify(save, null, 2) + "\n");
console.log(`OK: ${save.party.length} en el equipo, ${save.boxes.flatMap((b) => b.pokemon).length} en cajas`);
