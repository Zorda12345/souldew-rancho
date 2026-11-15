// Datos de cada movimiento (valores de la 3ª generación), por nombre en español.
// Si un movimiento no aparece aquí, la interfaz lo muestra sin tipo y en combate no se usa: nunca se inventa.
import type { StatKey } from "./stats.ts";
import type { TypeId } from "./types.ts";

export interface Move {
  type: TypeId;
  power: number; // 0 = no hace daño directo (movimiento de estado)
  accuracy: number | null; // porcentaje de acierto; null = nunca falla
  priority?: boolean; // golpea antes aunque sea más lento (Ataque Rápido)
  highCrit?: boolean; // el doble de probabilidad de golpe crítico
  area?: boolean; // alcanza a todos los que estén cerca (Terremoto)
  boost?: Partial<Record<StatKey, number>>; // niveles que sube al usuario
  heal?: number; // fracción de sus PS máximos que recupera el usuario
}

const hit = (type: TypeId, power: number, accuracy: number | null, extra: Partial<Move> = {}): Move =>
  ({ type, power, accuracy, ...extra });
/** Movimiento de estado. En combate solo tienen efecto los que traen boost o heal. */
const status = (type: TypeId, extra: Partial<Move> = {}): Move => ({ type, power: 0, accuracy: null, ...extra });

export const MOVES: Record<string, Move> = {
  // Normal
  "Ataque Rápido": hit("normal", 40, 100, { priority: true }),
  "Vel. Extrema": hit("normal", 80, 100, { priority: true }),
  "Golpe Cuerpo": hit("normal", 85, 100),
  "Placaje": hit("normal", 35, 95),
  "Rapidez": hit("normal", 60, null),
  "Cuchillada": hit("normal", 70, 100, { highCrit: true }),
  "Giro Rápido": hit("normal", 20, 100),
  "Recuperación": status("normal", { heal: 0.5 }),
  "Luz Lunar": status("normal", { heal: 0.5 }),
  "Danza Espada": status("normal", { boost: { atk: 2 } }),
  "Canto": status("normal"),
  "Refuerzo": status("normal"),
  "Pantalla Humo": status("normal"),
  "Rugido": status("normal"),
  "Protección": status("normal"),
  "Deseo": status("normal"),
  // Fuego
  "Lanzallamas": hit("fire", 95, 100),
  "Puño Fuego": hit("fire", 75, 100),
  "Patada Ígnea": hit("fire", 85, 90, { highCrit: true }),
  // Agua
  "Surf": hit("water", 95, 100, { area: true }),
  "Hidrobomba": hit("water", 120, 80),
  // Planta
  "Hoja Afilada": hit("grass", 55, 95, { highCrit: true }),
  "Hoja Aguda": hit("grass", 70, 100, { highCrit: true }),
  "Gigadrenado": hit("grass", 60, 100),
  "Somnífero": status("grass"),
  "Drenadoras": status("grass"),
  // Eléctrico
  "Rayo": hit("electric", 95, 100),
  "Puño Trueno": hit("electric", 75, 100),
  "Onda Trueno": status("electric"),
  // Hielo
  "Rayo Hielo": hit("ice", 95, 100),
  "Ventisca": hit("ice", 120, 70, { area: true }),
  // Lucha
  "Gancho Alto": hit("fighting", 85, 90),
  "Corpulencia": status("fighting", { boost: { atk: 1, def: 1 } }),
  // Veneno
  "Tóxico": status("poison"),
  // Tierra
  "Terremoto": hit("ground", 100, 100, { area: true }),
  "Disparo Lodo": hit("ground", 55, 95),
  "Ataque Arena": status("ground"),
  // Volador
  "Vuelo": hit("flying", 70, 95),
  "Golpe Aéreo": hit("flying", 60, null),
  "Aerochorro": hit("flying", 100, 95, { highCrit: true }),
  // Psíquico
  "Psíquico": hit("psychic", 90, 100),
  "Paz Mental": status("psychic", { boost: { spa: 1, spd: 1 } }),
  "Agilidad": status("psychic", { boost: { spe: 2 } }),
  "Descanso": status("psychic", { heal: 1 }),
  "Hipnosis": status("psychic"),
  "Pantalla Luz": status("psychic"),
  "Reflejo": status("psychic"),
  // Bicho
  "Viento Plata": hit("bug", 60, 100),
  // Fantasma
  "Bola Sombra": hit("ghost", 80, 100),
  "Rayo Confuso": status("ghost"),
  // Dragón
  "Garra Dragón": hit("dragon", 80, 100),
  "Enfado": hit("dragon", 90, 100),
  "Danza Dragón": status("dragon", { boost: { atk: 1, spe: 1 } }),
  // Siniestro
  "Mordisco": hit("dark", 60, 100),
  "Triturar": hit("dark", 80, 100),
  "Finta": hit("dark", 60, null),
  // Acero
  "Cola Férrea": hit("steel", 100, 75),
  "Ala de Acero": hit("steel", 70, 90),
  "Puño Meteoro": hit("steel", 100, 85),
};

export const moveType = (name: string): TypeId | undefined => MOVES[name]?.type;

/** Tipos (sin repetir) de los movimientos que sí hacen daño. Los desconocidos se ignoran. */
export function attackTypes(moveNames: string[]): TypeId[] {
  const types = moveNames.map((name) => MOVES[name]).filter((move) => move !== undefined && move.power > 0).map((move) => move.type);
  return [...new Set(types)];
}
