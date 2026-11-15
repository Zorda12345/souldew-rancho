// RetroAchievements (fork souldew-rancho): las funciones puras que traducen la API y el servidor local contra una API
// falsa (nunca la real): conectar, resumen, caché, errores, imágenes y que la clave nunca llega a la página ni a un
// registro.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';

const DATA = mkdtempSync(join(tmpdir(), 'souldew-ra-'));
process.env.SLS_DATA_DIR = DATA;

const ra = await import('../server/lib/retroach.mjs');

// una clave de mentira generada aquí (el test de secretos no debe ver ninguna en el repositorio)
const KEY = 'k'.repeat(32);
const USER = 'Ulises_RA';

// ---- funciones puras ---------------------------------------------------------------------------------------------

test('dirección de la API: la real, salvo una de prueba https o de este ordenador', () => {
  assert.equal(ra.raBase({}), ra.RA_API_URL);
  assert.equal(ra.raBase({ SOULDEW_RA_URL: 'http://127.0.0.1:5555/API/' }), 'http://127.0.0.1:5555/API');
  assert.equal(ra.raBase({ SOULDEW_RA_URL: 'http://evil.example' }), ra.RA_API_URL, 'nada de http a otro servidor');
  assert.equal(ra.raBase({ SOULDEW_RA_URL: 'tonterías' }), ra.RA_API_URL);
});

test('usuario y clave: solo con la forma que admite RetroAchievements', () => {
  assert.ok(ra.validUser('Ulises_RA'));
  assert.ok(!ra.validUser('a'));
  assert.ok(!ra.validUser('con espacio'));
  assert.ok(!ra.validUser('../x'));
  assert.ok(ra.validKey(KEY));
  assert.ok(!ra.validKey('corta'));
  assert.ok(!ra.validKey(`${KEY}&u=otro`));
});

test('imágenes: solo avatar, insignias e iconos, como rutas de este servidor', () => {
  assert.equal(ra.mediaPath('/UserPic/Ulises_RA.png'), '/retroach/UserPic/Ulises_RA.png');
  assert.equal(ra.mediaPath('/Badge/108302.png'), '/retroach/Badge/108302.png');
  assert.equal(ra.mediaPath('/Images/028399.png'), '/retroach/Images/028399.png');
  assert.equal(ra.mediaPath('/Badge/../../x.png'), null);
  assert.equal(ra.mediaPath('https://evil.example/a.png'), null);
  assert.deepEqual(ra.mediaUrl('/retroach/Badge/108302.png'), { url: `${ra.RA_MEDIA_URL}/Badge/108302.png`, file: join('Badge', '108302.png') });
  assert.equal(ra.mediaUrl('/retroach/Other/1.png'), null);
  assert.equal(ra.mediaUrl('/retroach/Badge/a.png.exe'), null);
});

test('fechas de la API (UTC sin zona) a ISO', () => {
  assert.equal(ra.isoDate('2023-12-27 16:04:50'), '2023-12-27T16:04:50.000Z');
  assert.equal(ra.isoDate('2024-04-23T21:28:49+00:00'), '2024-04-23T21:28:49.000Z');
  assert.equal(ra.isoDate('no'), null);
  assert.equal(ra.isoDate(null), null);
});

test('saga principal de Pokémon frente a los derivados', () => {
  for (const t of ['Pokémon Platinum Version', 'Pokemon HeartGold Version', 'Pokémon Black Version 2', 'Pokémon White Version'])
    assert.ok(ra.isMainPokemon(t), t);
  for (const t of ['Pokemon Pinball mini', 'Pokémon Ranger', 'Pokémon Mystery Dungeon: Explorers of Sky', 'Sonic the Hedgehog'])
    assert.ok(!ra.isMainPokemon(t), t);
});

const PROFILE = {
  User: USER, ULID: '00003EMFWR7XB8SDPEHB3K56ZQ', UserPic: `/UserPic/${USER}.png`, MemberSince: '2021-12-20 03:13:20',
  RichPresenceMsg: 'Platino | En Pueblo Hojaverde', LastGameID: 39076, TotalPoints: 1234, TotalSoftcorePoints: 50,
  TotalTruePoints: 4321, Motto: 'Hola',
};
const RECENT = [
  { Date: '2026-11-14 10:00:00', HardcoreMode: 1, AchievementID: 2, Title: 'Medalla Carbón', Description: 'Gana a Roco', BadgeName: '200', Points: 10, GameTitle: 'Pokémon Platinum Version', GameIcon: '/Images/000001.png', GameID: 39076, ConsoleName: 'Nintendo DS', BadgeURL: '/Badge/200.png' },
  { Date: '2026-11-15 12:00:00', HardcoreMode: 0, AchievementID: 3, Title: 'Medalla Bosque', Description: 'Gana a Gardenia', BadgeName: '300', Points: 10, GameTitle: 'Pokémon Platinum Version', GameIcon: '/Images/000001.png', GameID: 39076, ConsoleName: 'Nintendo DS', BadgeURL: '/Badge/300.png' },
];
const GAME = {
  ID: 39076, Title: 'Pokémon Platinum Version', ConsoleName: 'Nintendo DS', ImageIcon: '/Images/000001.png', NumAchievements: 3,
  NumAwardedToUser: 2, NumAwardedToUserHardcore: 1,
  Achievements: {
    3: { ID: 3, Title: 'Medalla Bosque', Description: 'Gana a Gardenia', Points: 10, BadgeName: '300', DisplayOrder: 2, type: 'progression', DateEarned: '2026-11-15 12:00:00' },
    2: { ID: 2, Title: 'Medalla Carbón', Description: 'Gana a Roco', Points: 10, BadgeName: '200', DisplayOrder: 1, type: 'progression', DateEarned: '2026-11-14 10:00:00', DateEarnedHardcore: '2026-11-14 10:00:00' },
    4: { ID: 4, Title: 'Campeón', Description: 'Gana a Cintia', Points: 50, BadgeName: '400', DisplayOrder: 3, type: 'win_condition' },
  },
};

test('perfil, logros recientes (el más nuevo primero) y progreso del juego en forma compacta', () => {
  const p = ra.profileOf(PROFILE);
  assert.equal(p.user, USER);
  assert.equal(p.avatar, `/retroach/UserPic/${USER}.png`);
  assert.equal(p.points, 1234);
  assert.equal(p.lastGameId, 39076);
  assert.equal(p.richPresence, 'Platino | En Pueblo Hojaverde');
  assert.equal(p.memberSince, '2021-12-20T03:13:20.000Z');

  const r = ra.recentOf(RECENT);
  assert.deepEqual(r.map((a) => a.id), [3, 2]);
  assert.equal(r[0].badge, '/retroach/Badge/300.png');
  assert.equal(r[0].hardcore, false);
  assert.equal(r[1].hardcore, true);
  assert.equal(r[0].game.title, 'Pokémon Platinum Version');
  assert.deepEqual(ra.recentOf(null), []);

  const g = ra.gameOf(GAME);
  assert.equal(g.mainPokemon, true);
  assert.equal(g.total, 3);
  assert.equal(g.earned, 2);
  assert.deepEqual(g.achievements.map((a) => a.id), [2, 3, 4], 'en el orden del juego');
  assert.equal(g.achievements[0].earnedHardcore, '2026-11-14T10:00:00.000Z');
  assert.equal(g.achievements[2].earned, null);
  assert.equal(ra.gameOf(null), null);
});

test('textos de la API: sin caracteres de control y con tope de longitud', () => {
  const p = ra.profileOf({ ...PROFILE, RichPresenceMsg: `a\u0000b${'x'.repeat(1000)}` });
  assert.ok(!p.richPresence.includes('\u0000'));
  assert.ok(p.richPresence.length <= 300);
});

test('errores de la API para la página', () => {
  assert.equal(ra.errorOf(0), 'offline');
  assert.equal(ra.errorOf(401), 'key');
  assert.equal(ra.errorOf(429), 'rate');
  assert.equal(ra.errorOf(500), 'server');
});

// ---- servidor local contra una API falsa ---------------------------------------------------------------------------

let api; // la API falsa
let app; // souldew
let base;
const calls = []; // peticiones que recibió la API falsa
const seen = []; // todo lo que respondió souldew a la página
const logs = [];
const realConsole = { log: console.log, warn: console.warn, error: console.error };

function fakeApi() {
  const state = { down: false, limit: false };
  const server = createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    calls.push(u.pathname);
    const json = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (state.limit) return json(429, { message: 'Too Many Attempts.' });
    if (state.down) return json(500, { message: 'error' });
    if (u.searchParams.get('y') !== KEY) return json(401, { message: 'Unauthenticated.' });
    const who = u.searchParams.get('u');
    if (!/^ulises_ra$/i.test(who || '')) return json(404, { message: 'Not Found' });
    if (u.pathname.endsWith('/API_GetUserProfile.php')) return json(200, PROFILE);
    if (u.pathname.endsWith('/API_GetUserRecentAchievements.php')) return json(200, RECENT);
    if (u.pathname.endsWith('/API_GetGameInfoAndUserProgress.php')) return json(200, u.searchParams.get('g') === '39076' ? GAME : {});
    return json(404, {});
  });
  return { server, state };
}

before(async () => {
  api = fakeApi();
  await new Promise((r) => api.server.listen(0, '127.0.0.1', r));
  process.env.SOULDEW_RA_URL = `http://127.0.0.1:${api.server.address().port}/API`;
  for (const k of ['log', 'warn', 'error']) console[k] = (...a) => { logs.push(a.map(String).join(' ')); };
  const { startServer } = await import('../server/app.mjs');
  app = await startServer({ port: 0, background: false });
  base = app.url;
});
after(() => {
  Object.assign(console, realConsole);
  app?.server.close();
  api?.server.close();
  rmSync(DATA, { recursive: true, force: true });
});

async function call(method, path, body) {
  const r = await fetch(`${base}${path}`, {
    method, headers: { 'x-soullink': '1', ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  seen.push(text);
  return { status: r.status, body: JSON.parse(text) };
}

test('servidor: sin cuenta no hay resumen', async () => {
  assert.deepEqual((await call('GET', '/api/retroach')).body, { linked: false, user: null });
  assert.deepEqual((await call('GET', '/api/retroach/summary')).body, { ok: false, error: 'notLinked' });
});

test('servidor: conectar comprueba usuario y clave antes de guardarlos', async () => {
  assert.equal((await call('POST', '/api/retroach/link', { user: 'x', key: KEY })).body.error, 'input');
  assert.equal((await call('POST', '/api/retroach/link', { user: USER, key: 'z'.repeat(32) })).body.error, 'key');
  assert.equal((await call('POST', '/api/retroach/link', { user: 'Otro_User', key: KEY })).body.error, 'user');
  assert.equal((await call('GET', '/api/retroach')).body.linked, false, 'nada guardado tras un fallo');

  const ok = (await call('POST', '/api/retroach/link', { user: 'ulises_ra', key: KEY })).body;
  assert.deepEqual(ok, { ok: true, linked: true, user: USER }, 'con el nombre tal como lo escribe RetroAchievements');
});

test('servidor: resumen con perfil, recientes y juego actual; luego de la caché', async () => {
  const before = calls.length;
  const s = (await call('GET', '/api/retroach/summary')).body;
  assert.equal(s.ok, true);
  assert.equal(s.profile.points, 1234);
  assert.equal(s.recent.length, 2);
  assert.equal(s.game.title, 'Pokémon Platinum Version');
  assert.equal(s.game.earned, 2);
  assert.equal(calls.length - before, 3, 'una petición por dato');

  await call('GET', '/api/retroach/summary');
  assert.equal(calls.length - before, 3, 'el segundo resumen sale de la caché');
});

test('servidor: errores de la API como códigos para la página', async () => {
  ra.clearCache();
  api.state.limit = true;
  assert.deepEqual((await call('GET', '/api/retroach/summary')).body, { ok: false, error: 'rate' });
  api.state.limit = false;
  api.state.down = true;
  assert.deepEqual((await call('GET', '/api/retroach/summary')).body, { ok: false, error: 'server' });
  api.state.down = false;
  assert.equal((await call('GET', '/api/retroach/summary')).body.ok, true, 'un fallo no se queda en la caché');
});

test('servidor: imágenes solo de las tres carpetas de RetroAchievements', async () => {
  assert.equal((await fetch(`${base}/retroach/Other/1.png`)).status !== 200, true);
  assert.equal((await fetch(`${base}/retroach/Badge/..%2F..%2Fx.png`)).status !== 200, true);
});

test('servidor: desconectar borra la clave', async () => {
  assert.deepEqual((await call('DELETE', '/api/retroach/link')).body, { ok: true, linked: false, user: null });
  assert.deepEqual((await call('GET', '/api/retroach/summary')).body, { ok: false, error: 'notLinked' });
});

test('la clave nunca llega a la página ni a un registro', () => {
  for (const t of seen) assert.ok(!t.includes(KEY), 'respuesta a la página');
  for (const l of logs) assert.ok(!l.includes(KEY), 'registro');
});
