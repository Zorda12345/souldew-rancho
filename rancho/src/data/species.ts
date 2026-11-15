// Datos de especie: tipos y estadísticas base (valores de la 3ª generación). De momento solo las del mock;
// el lector de .sav necesitará la tabla completa de 386.
import type { Stats } from "./stats.ts";
import type { TypeId } from "./types.ts";

export interface Species {
  name: string;
  types: TypeId[]; // uno o dos, los de la 3ª generación
  base: Stats;
}

const s = (name: string, types: TypeId[], hp: number, atk: number, def: number, spa: number, spd: number, spe: number): Species =>
  ({ name, types, base: { hp, atk, def, spa, spd, spe } });

export const SPECIES: Record<number, Species> = {
  3: s("Venusaur", ["grass", "poison"], 80, 82, 83, 100, 100, 80),
  6: s("Charizard", ["fire", "flying"], 78, 84, 78, 109, 85, 100),
  9: s("Blastoise", ["water"], 79, 83, 100, 85, 105, 78),
  25: s("Pikachu", ["electric"], 35, 55, 30, 50, 40, 90),
  59: s("Arcanine", ["fire"], 90, 110, 80, 100, 80, 95),
  65: s("Alakazam", ["psychic"], 55, 50, 45, 135, 85, 120),
  94: s("Gengar", ["ghost", "poison"], 60, 65, 60, 130, 75, 110),
  121: s("Starmie", ["water", "psychic"], 60, 75, 85, 100, 85, 115),
  130: s("Gyarados", ["water", "flying"], 95, 125, 79, 60, 100, 81),
  131: s("Lapras", ["water", "ice"], 130, 85, 80, 85, 95, 60),
  133: s("Eevee", ["normal"], 55, 55, 50, 45, 65, 55),
  134: s("Vaporeon", ["water"], 130, 65, 60, 110, 95, 65),
  143: s("Snorlax", ["normal"], 160, 110, 65, 65, 110, 30),
  144: s("Articuno", ["ice", "flying"], 90, 85, 100, 95, 125, 85),
  149: s("Dragonite", ["dragon", "flying"], 91, 134, 95, 100, 100, 80),
  150: s("Mewtwo", ["psychic"], 106, 110, 90, 154, 90, 130),
  157: s("Typhlosion", ["fire"], 78, 84, 78, 109, 85, 100),
  160: s("Feraligatr", ["water"], 85, 105, 100, 79, 83, 78),
  181: s("Ampharos", ["electric"], 90, 75, 75, 115, 90, 55),
  197: s("Umbreon", ["dark"], 95, 65, 110, 60, 130, 65),
  212: s("Scizor", ["bug", "steel"], 70, 130, 100, 55, 80, 65),
  245: s("Suicune", ["water"], 100, 75, 115, 90, 115, 85),
  249: s("Lugia", ["psychic", "flying"], 106, 90, 130, 90, 154, 110),
  254: s("Sceptile", ["grass"], 70, 85, 65, 105, 85, 120),
  257: s("Blaziken", ["fire", "fighting"], 80, 120, 70, 110, 70, 80),
  260: s("Swampert", ["water", "ground"], 100, 110, 90, 85, 90, 60),
  282: s("Gardevoir", ["psychic"], 68, 65, 65, 125, 115, 80),
  330: s("Flygon", ["ground", "dragon"], 80, 100, 80, 80, 80, 100),
  350: s("Milotic", ["water"], 95, 60, 79, 100, 125, 81),
  359: s("Absol", ["dark"], 65, 130, 60, 75, 60, 75),
  376: s("Metagross", ["steel", "psychic"], 80, 135, 130, 95, 90, 70),
  384: s("Rayquaza", ["dragon", "flying"], 105, 150, 90, 150, 90, 95),
};
