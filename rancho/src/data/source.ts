// De dónde salen los Pokémon del rancho: la run actual de souldew (su API de stream, mismo servidor) o,
// si no hay ninguna o no se puede leer, los datos de prueba de Rojo Fuego.
import mock from "../../data/mock-save.json";
import { SaveSchema, type Save } from "./schema.ts";
import { StateSchema, saveFromState } from "./souldew.ts";

export interface Source {
  save: Save;
  /** Para separar lo guardado en el navegador (reyes, escenarios) de cada run. */
  id: string;
  /** Qué se está viendo, para el aviso de la interfaz. */
  label: string;
  /** Jugadores de la run (para elegir de quién son los Pokémon) y el elegido. */
  players: { slot: string; name: string }[];
  slot: string | null;
  /** Imagen fija para las especies sin sprite de Mundo Misterioso descargado (clave "25" o "25/shiny"). */
  spriteFallback?: (key: string) => string;
}

const PLAYER_KEY = "rancho.jugador";

export function rememberPlayer(slot: string): void {
  try {
    localStorage.setItem(PLAYER_KEY, slot);
  } catch {
    // Sin almacenamiento: se usará el primero.
  }
}

function savedPlayer(): string | null {
  try {
    return localStorage.getItem(PLAYER_KEY);
  } catch {
    return null;
  }
}

const mockSource = (label: string): Source => ({ save: SaveSchema.parse(mock), id: "prueba", label, players: [], slot: null });

export async function loadSource(): Promise<Source> {
  try {
    const res = await fetch("/api/v1/runs/current?lang=es");
    if (res.status === 404) return mockSource("Datos de prueba: aún no hay ninguna partida en souldew.");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const state = StateSchema.parse(await res.json());
    const players = state.players.map((p) => ({ slot: p.slot, name: p.name }));
    const wanted = savedPlayer();
    const slot = players.some((p) => p.slot === wanted) ? wanted! : (players[0]?.slot ?? "p1");
    const gen = Math.min(5, Math.max(1, state.run.gen ?? 4));
    return {
      save: saveFromState(state, slot),
      id: state.run.id,
      label: `Run «${state.run.name}» de souldew`,
      players,
      slot,
      // Los sprites de juego que sirve souldew (/api/v1/sprites, mismo origen): los de la generación de la run.
      spriteFallback: (key) => {
        const [species, shiny] = key.split("/");
        return `/api/v1/sprites/gen${gen}/front${shiny ? "-shiny" : ""}/${species}.png`;
      },
    };
  } catch (e) {
    console.warn("No se pudo leer la run de souldew; se usan los datos de prueba.", e);
    return mockSource("Datos de prueba: no se pudo leer la partida de souldew.");
  }
}
