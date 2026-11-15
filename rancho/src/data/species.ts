// Datos de especie: nombre, tipos y estadísticas base de las 649 especies de 1ª a 5ª gen, con los valores de la
// 5ª gen (para la 3ª son los mismos salvo detalles). Generado con `npm run rancho:species` (scripts/build-species.ts).
import data from "./species-data.json";
import type { Stats } from "./stats.ts";
import type { TypeId } from "./types.ts";

export interface Species {
  name: string;
  types: TypeId[]; // uno o dos
  base: Stats;
}

type Row = [dex: number, name: string, types: string[], base: number[]];

export const SPECIES: Record<number, Species> = Object.fromEntries(
  (data as Row[]).map(([dex, name, types, [hp, atk, def, spa, spd, spe]]) => [
    dex,
    { name, types: types as TypeId[], base: { hp, atk, def, spa, spd, spe } },
  ]),
);
