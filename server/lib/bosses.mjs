// Bosses of a run (fork souldew-rancho): the rival, gym leaders, Elite Four and champion of one player's game, read from
// the ROM by the bridge (tools/upr-bridge/SoulLinkBridge.java, exportBosses). A run built since the bridge exports them
// has them in `<slot>.data.json`; for an older run (or one without the randomizer) the bridge's `bosses` command reads
// the run's ROM once and the result is kept as `<slot>.bosses.json` next to it. 3DS games are left out (loading one
// takes minutes and UPR doesn't tag their trainers the same way).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { safeJoin, realInside } from './fsutil.mjs';
import { readManifest, runDir } from './build.mjs';
import { runBridge } from './toolchain.mjs';

const pending = new Map();

const readJson = (p) => {
  try {
    return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
  } catch {
    return null;
  }
};

/** { starters: [dex ids] | null, bosses: [...] } of `slot`'s game, or null when this computer can't tell (no ROM here). */
export async function runBosses(runId, slot, { bridge = runBridge } = {}) {
  const dir = runDir(runId);
  const data = readJson(join(dir, `${slot}.data.json`));
  if (Array.isArray(data?.bosses)) return { starters: data.starters || null, bosses: data.bosses };
  const cacheFile = join(dir, `${slot}.bosses.json`);
  const cached = readJson(cacheFile);
  if (Array.isArray(cached?.bosses)) return { starters: data?.starters || cached.starters || null, bosses: cached.bosses };

  const manifest = readManifest(runId);
  const name = manifest?.outputs?.[slot]?.rom;
  if (!name || manifest?.game?.system === '3ds') return null;
  const rom = safeJoin(dir, name);
  if (!rom || !existsSync(rom) || !realInside(rom, dir)) return null;
  const key = `${runId}/${slot}`;
  if (!pending.has(key)) {
    pending.set(key, bridge(['bosses', rom, cacheFile], { timeoutMs: 120000 })
      .then(() => readJson(cacheFile))
      .catch(() => null)
      .finally(() => pending.delete(key)));
  }
  const res = await pending.get(key);
  return Array.isArray(res?.bosses) ? { starters: data?.starters || res.starters || null, bosses: res.bosses } : null;
}
