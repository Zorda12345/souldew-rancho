// RetroAchievements (añadido del fork souldew-rancho): la cuenta del jugador, sus logros recientes y su progreso en el
// juego al que está jugando, leídos con la API web de RetroAchievements (https://api-docs.retroachievements.org).
//
// La API pide el nombre de usuario y la clave de API web del jugador en cada petición. La clave es personal: se guarda
// en su propio archivo de la carpeta de datos (retroachievements.json, junto a config.json; en desarrollo en runs/,
// que git ignora) y solo este módulo la lee. La página pregunta al servidor local y el servidor a RetroAchievements:
// la clave nunca llega a la página, a una run, a un registro ni a un mensaje de error (las URL que la llevan no se
// escriben en ningún sitio). Las imágenes (avatar, insignias, iconos) se sirven desde aquí con caché: /retroach/...
import { readFileSync, mkdirSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { DATA_DIR, DEV, APP_ROOT } from './paths.mjs';
import { writeFileAtomic } from './fsutil.mjs';

export const RA_API_URL = 'https://retroachievements.org/API';
export const RA_MEDIA_URL = 'https://media.retroachievements.org';

/** Dirección de la API: SOULDEW_RA_URL solo si es https o http de este ordenador (para los tests con una API falsa). */
export function raBase(env = process.env) {
  const v = env.SOULDEW_RA_URL;
  if (v) {
    try {
      const u = new URL(v);
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
      if (u.protocol === 'https:' || (u.protocol === 'http:' && local)) return u.origin + u.pathname.replace(/\/+$/, '');
    } catch {
      // no es una URL: la de verdad
    }
  }
  return RA_API_URL;
}

export const raFile = () => join(DEV ? join(APP_ROOT, 'runs') : DATA_DIR, 'retroachievements.json');

/** Nombres de RetroAchievements: letras, números y guion bajo. La clave web: letras y números. */
const USER = /^[A-Za-z0-9_]{2,32}$/;
const KEY = /^[A-Za-z0-9]{16,64}$/;
export const validUser = (u) => typeof u === 'string' && USER.test(u);
export const validKey = (k) => typeof k === 'string' && KEY.test(k);

function readState() {
  try {
    const s = JSON.parse(readFileSync(raFile(), 'utf8'));
    return s && typeof s === 'object' && !Array.isArray(s) ? s : {};
  } catch {
    return {};
  }
}

function writeState(s) {
  const file = raFile();
  mkdirSync(dirname(file), { recursive: true });
  writeFileAtomic(file, JSON.stringify(s, null, 2));
  try {
    chmodSync(file, 0o600); // solo este usuario (en Windows la carpeta del perfil ya es privada)
  } catch {
    // sistema de archivos sin permisos
  }
}

const account = (s = readState()) => (validUser(s.user) && validKey(s.key) ? { user: s.user, key: s.key } : null);

/** Lo que puede saber la página: si hay cuenta y su nombre. Nunca la clave. */
export function publicState(s = readState()) {
  const a = account(s);
  return { linked: !!a, user: a ? a.user : null };
}

// ---- peticiones -------------------------------------------------------------------------------------------------

/**
 * Una petición a la API. Devuelve { status, body } (status 0 = sin respuesta: red, DNS, tiempo agotado).
 * No sigue redirecciones (la clave no puede acabar en otro sitio) y no escribe la URL en ningún mensaje.
 */
async function raFetch(endpoint, params, { fetchImpl = fetch, env = process.env, timeout = 15000 } = {}) {
  const url = `${raBase(env)}/${endpoint}.php?${new URLSearchParams(params)}`;
  let r;
  try {
    r = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(timeout), headers: { Accept: 'application/json' } });
  } catch {
    return { status: 0, body: null };
  }
  let body = null;
  try {
    body = await r.json();
  } catch {
    // una página de error, no JSON
  }
  return { status: r.status, body };
}

/** Qué significa una respuesta mala para la página: 'offline', 'key' (clave o usuario rechazados), 'rate' o 'server'. */
export function errorOf(status) {
  if (status === 0) return 'offline';
  if (status === 401 || status === 403) return 'key';
  if (status === 429) return 'rate';
  return 'server';
}

// ---- datos de la API -> forma compacta ----------------------------------------------------------------------------

const text = (v, max = 300) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Ruta de una imagen de RetroAchievements ("/UserPic/Nombre.png", "/Badge/12345.png", "/Images/012345.png") como
 * dirección de este servidor ("/retroach/Badge/12345.png"), o null si no tiene esa forma.
 */
export function mediaPath(p) {
  const m = typeof p === 'string' && p.match(/^\/(UserPic|Badge|Images)\/([A-Za-z0-9_-]{1,64}\.png)$/);
  return m ? `/retroach/${m[1]}/${m[2]}` : null;
}

/** Fechas de la API ("2023-12-27 16:04:50", en UTC) a ISO. */
export function isoDate(v) {
  if (typeof v !== 'string' || !v) return null;
  const s = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v) ? `${v.replace(' ', 'T')}Z` : v;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function profileOf(b) {
  return {
    user: text(b?.User, 64),
    avatar: mediaPath(b?.UserPic),
    points: num(b?.TotalPoints),
    softcorePoints: num(b?.TotalSoftcorePoints),
    truePoints: num(b?.TotalTruePoints),
    richPresence: text(b?.RichPresenceMsg),
    lastGameId: num(b?.LastGameID) || null,
    memberSince: isoDate(b?.MemberSince),
    motto: text(b?.Motto, 120),
  };
}

export function recentOf(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((a) => ({
      id: num(a?.AchievementID),
      title: text(a?.Title, 120),
      description: text(a?.Description),
      points: num(a?.Points),
      badge: mediaPath(a?.BadgeURL) ?? mediaPath(`/Badge/${a?.BadgeName}.png`),
      hardcore: num(a?.HardcoreMode) === 1,
      date: isoDate(a?.Date),
      game: { id: num(a?.GameID), title: text(a?.GameTitle, 120), icon: mediaPath(a?.GameIcon), console: text(a?.ConsoleName, 60) },
    }))
    .filter((a) => a.id > 0)
    .sort((x, y) => String(y.date).localeCompare(String(x.date)));
}

/** Los Pokémon de la saga principal (no Pinball, Ranger, Mundo Misterioso…), para destacarlos. */
const SPINOFF = /pinball|ranger|mystery dungeon|puzzle|trozei|dash|link|rumble|snap|stadium|colosseum|xd|trading card|conquest|picross|channel|mini/i;
export const isMainPokemon = (title) => /pok[eé]mon/i.test(title) && !SPINOFF.test(title);

export function gameOf(b) {
  if (!b || typeof b !== 'object' || !num(b.ID)) return null;
  const achievements = Object.values(b.Achievements && typeof b.Achievements === 'object' ? b.Achievements : {})
    .map((a) => ({
      id: num(a?.ID),
      title: text(a?.Title, 120),
      description: text(a?.Description),
      points: num(a?.Points),
      badge: mediaPath(`/Badge/${a?.BadgeName}.png`),
      type: text(a?.type, 20) || null,
      order: num(a?.DisplayOrder),
      earned: isoDate(a?.DateEarned),
      earnedHardcore: isoDate(a?.DateEarnedHardcore),
    }))
    .filter((a) => a.id > 0)
    .sort((x, y) => x.order - y.order || x.id - y.id);
  const title = text(b.Title, 120);
  return {
    id: num(b.ID),
    title,
    console: text(b.ConsoleName, 60),
    icon: mediaPath(b.ImageIcon),
    mainPokemon: isMainPokemon(title),
    total: num(b.NumAchievements) || achievements.length,
    earned: num(b.NumAwardedToUser),
    earnedHardcore: num(b.NumAwardedToUserHardcore),
    achievements,
  };
}

// ---- caché: no más de una petición por minuto y tipo (la API limita el ritmo) ------------------------------------

export const CACHE_MS = 60_000;
const cache = new Map(); // clave -> { at, promise }

function cached(key, load, now = Date.now()) {
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return hit.promise;
  const promise = load();
  cache.set(key, { at: now, promise });
  // un fallo no se guarda: la siguiente vez se vuelve a preguntar
  promise.then((r) => { if (!r.ok) cache.delete(key); }, () => cache.delete(key));
  return promise;
}

export function clearCache() {
  cache.clear();
}

async function load(endpoint, params, map, opts) {
  const a = account();
  if (!a) return { ok: false, error: 'notLinked' };
  const { status, body } = await raFetch(endpoint, { ...params, u: a.user, y: a.key }, opts);
  if (status !== 200) return { ok: false, error: errorOf(status) };
  return { ok: true, data: map(body) };
}

// ---- lo que usan las rutas ----------------------------------------------------------------------------------------

/**
 * Conecta la cuenta: comprueba usuario y clave con una petición de perfil y solo entonces los guarda.
 * { ok: true, user } o { ok: false, error: 'input' | 'key' | 'user' | 'offline' | 'rate' | 'server' }.
 */
export async function link({ user, key } = {}, opts = {}) {
  if (!validUser(user) || !validKey(key)) return { ok: false, error: 'input' };
  const { status, body } = await raFetch('API_GetUserProfile', { u: user, y: key }, opts);
  if (status !== 200) return { ok: false, error: status === 404 ? 'user' : errorOf(status) };
  const profile = profileOf(body);
  if (!profile.user) return { ok: false, error: 'user' };
  // el nombre tal como lo escribe RetroAchievements (mayúsculas incluidas); `seen` se olvida: con otra cuenta el
  // vigilante vuelve a tomar como punto de partida lo que ya hay, sin avisar de logros viejos
  const s = readState();
  delete s.seen;
  writeState({ ...s, user: validUser(profile.user) ? profile.user : user, key });
  clearCache();
  return { ok: true, ...publicState() };
}

export function unlink() {
  const s = readState();
  delete s.user;
  delete s.key;
  delete s.seen;
  writeState(s);
  clearCache();
  return { ok: true, ...publicState() };
}

/**
 * Todo lo que enseña la pestaña de logros: perfil, logros de la última semana y el progreso en el último juego.
 * { ok: true, user, profile, recent, game } o { ok: false, error }.
 */
export async function summary(opts = {}) {
  const a = account();
  if (!a) return { ok: false, error: 'notLinked' };
  const profile = await cached(`profile|${a.user}`, () => load('API_GetUserProfile', {}, profileOf, opts));
  if (!profile.ok) return profile;
  const recent = await cached(`recent|${a.user}`, () => load('API_GetUserRecentAchievements', { m: 7 * 24 * 60 }, recentOf, opts));
  const gameId = profile.data.lastGameId;
  const game = gameId ? await cached(`game|${a.user}|${gameId}`, () => load('API_GetGameInfoAndUserProgress', { g: gameId }, gameOf, opts)) : null;
  return {
    ok: true,
    user: a.user,
    profile: profile.data,
    recent: recent.ok ? recent.data : [],
    game: game?.ok ? game.data : null,
  };
}

// ---- vigilante: avisa de los logros nuevos mientras la app está abierta -------------------------------------------

export const SEEN_KEEP = 300; // ids de logros recordados (los más nuevos)

/**
 * Qué logros de `recent` (el más nuevo primero) son nuevos frente a `seen` (ids ya conocidos). Sin `seen` (primera
 * vez con esta cuenta) no hay nada nuevo: lo que ya había es el punto de partida. `fresh` va del más viejo al más nuevo.
 */
export function newUnlocks(recent, seen) {
  const ids = recent.map((a) => a.id);
  if (!Array.isArray(seen)) return { fresh: [], seen: ids.slice(0, SEEN_KEEP) };
  const known = new Set(seen);
  const fresh = recent.filter((a) => !known.has(a.id)).reverse();
  return { fresh, seen: [...new Set([...ids, ...seen])].slice(0, SEEN_KEEP) };
}

/**
 * Cada `interval` ms, si hay cuenta y alguien escuchando (`listening()`: páginas abiertas con /api/events), pide los
 * logros recientes (la misma caché que el resumen) y emite `retroach` con los nuevos. Los errores se callan: la
 * pestaña ya los enseña.
 */
export function createWatcher({ emit, listening = () => true, interval = CACHE_MS, opts = {} }) {
  let timer = null;
  let busy = false;
  async function check() {
    const a = account();
    if (!a || busy || !listening()) return [];
    busy = true;
    try {
      const r = await cached(`recent|${a.user}`, () => load('API_GetUserRecentAchievements', { m: 7 * 24 * 60 }, recentOf, opts));
      if (!r.ok) return [];
      const s = readState();
      if (s.user !== a.user) return []; // se desconectó o cambió de cuenta mientras tanto
      const { fresh, seen } = newUnlocks(r.data, s.seen);
      writeState({ ...s, seen });
      if (fresh.length) emit('retroach', { user: a.user, unlocks: fresh.slice(-5) });
      return fresh;
    } finally {
      busy = false;
    }
  }
  return {
    check,
    start() {
      if (!timer) timer = setInterval(() => { check().catch(() => {}); }, interval);
      timer.unref?.();
    },
    stop() {
      clearInterval(timer);
      timer = null;
    },
  };
}

/** Dirección de una imagen en RetroAchievements a partir de la ruta de /retroach/..., o null si no es válida. */
export function mediaUrl(path) {
  const m = typeof path === 'string' && path.match(/^\/retroach\/(UserPic|Badge|Images)\/([A-Za-z0-9_-]{1,64}\.png)$/);
  return m ? { url: `${RA_MEDIA_URL}/${m[1]}/${m[2]}`, file: join(m[1], m[2]) } : null;
}
