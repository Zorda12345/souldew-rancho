// Bosses of the run (fork souldew-rancho): rival, gym leaders, Elite Four and champion of each player's game, read from
// their ROM by the bridge (server/lib/bosses.mjs). Switched on by the rule `bosses` (off unless set).
//
// Doc keys (shared with the other players, so everyone sees everyone's bosses):
//   rbosses:<slot>        { starters: [dex ids], list: [boss] } – copied in by the computer that has the slot's ROM
//   rbwin:<slot>:<key>    { at } – the player beat that boss (null again when undone)
//   rbstarter:<slot>      0 | 1 | 2 – which starter the player chose, when the catches don't tell
// A boss: { kind: 'rival'|'gym'|'elite'|'champion', number, variant, tag, name, level, team: [{ id, forme, name, level,
// item, moves, defaultMoves }] }. The rival comes three times per battle (variant = the starter the PLAYER chose).
import { api } from './api.mjs';
import { t } from './i18n.mjs';
import { encounter, feed, feedText, msg, slotsOf, isNuzlocke } from './run.mjs';

export const bossesOn = (rules) => rules?.bosses === true;

export const BOSS_KIND_LABELS = () => ({
  rival: t('bosses.kindRival', 'Rival'),
  gym: t('bosses.kindGym', 'Gym Leader'),
  elite: t('bosses.kindElite', 'Elite Four'),
  champion: t('bosses.kindChampion', 'Champion'),
});

/** The same boss for every variant: the rival's battles count by number, the rest by UPR's tag. */
export const bossKey = (b) => (b.kind === 'rival' ? `RIVAL${b.number}` : b.tag);

/** What the bridge read for `slot`, or null. */
export const bossData = (doc, slot) => doc?.get(`rbosses:${slot}`, null) || null;

/**
 * Which starter (0-2) `slot` chose: their own pick, else the starter area's catch – the same evolution family as one of
 * the game's three starters. null when unknown.
 */
export function starterChoice(doc, rd, slot) {
  const own = doc.get(`rbstarter:${slot}`, null);
  if (own === 0 || own === 1 || own === 2) return own;
  const starters = bossData(doc, slot)?.starters || [];
  const caught = encounter(doc, 'starter', slot)?.species;
  if (!caught || starters.length !== 3) return null;
  const root = (id) => (rd?.familyRoot ? rd.familyRoot(id, slot) : id);
  const i = starters.findIndex((s) => s === caught || root(s) === root(caught));
  return i >= 0 ? i : null;
}

/**
 * `slot`'s bosses in the order they come: [{ ...boss, key, defeatedAt, unknownRival }]. With the starter unknown, a
 * rival battle is one entry flagged `unknownRival` (its team depends on the choice).
 */
export function bossesOf(doc, rd, slot) {
  const data = bossData(doc, slot);
  if (!data?.list?.length) return [];
  const choice = starterChoice(doc, rd, slot);
  const out = [];
  const seen = new Set();
  for (const b of data.list) {
    const key = bossKey(b);
    if (b.kind === 'rival') {
      if (choice !== null ? b.variant !== choice : seen.has(key)) continue;
    }
    seen.add(key);
    const win = doc.get(`rbwin:${slot}:${key}`, null);
    out.push({ ...b, key, defeatedAt: win?.at || null, unknownRival: b.kind === 'rival' && choice === null });
  }
  return out;
}

export const nextBoss = (list) => list.find((b) => !b.defeatedAt) || null;

/** The boss's name as shown: the rival's name doesn't say which battle it is. */
export const bossTitle = (b) => (b.kind === 'rival' ? t('bosses.rivalBattle', '{name} (battle {n})', { name: b.name, n: b.number }) : b.name);

/** `slot` beat `boss`: kept in the doc and written to the run's log ("X defeated Y"). */
export function defeatBoss(doc, manifest, slot, boss) {
  doc.set(`rbwin:${slot}:${boss.key}`, { at: Date.now() });
  const name = bossTitle(boss);
  const entry = {
    type: 'boss', slot,
    msg: isNuzlocke(manifest) ? msg('feed.bossDefeatedSolo', 'Defeated {boss}', { boss: name }) : msg('feed.bossDefeated', 'defeated {boss}', { boss: name }),
  };
  feed(doc, { ...entry, text: feedText(doc, manifest, entry) });
}

export function undoBoss(doc, slot, boss) {
  doc.set(`rbwin:${slot}:${boss.key}`, null);
}

const asked = new Set();

/**
 * Copies each player's bosses into the doc once this computer can read them (the server reads the slot's ROM, which
 * only the computer that built it has). Runs while the rule is on; asks the server once per run and player.
 */
export function syncBosses(doc, manifest) {
  if (!doc || !manifest?.id) return;
  for (const slot of slotsOf(manifest)) {
    const id = `${manifest.id}/${slot}`;
    if (bossData(doc, slot) || asked.has(id)) continue;
    asked.add(id);
    api.get(`/api/runs/${manifest.id}/bosses/${slot}`)
      .then((res) => {
        if (res?.bosses?.length && !bossData(doc, slot)) doc.set(`rbosses:${slot}`, { starters: res.starters || [], list: res.bosses });
      })
      .catch(() => asked.delete(id));
  }
}
