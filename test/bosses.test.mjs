// Bosses of the run (fork souldew-rancho): web/lib/bosses.mjs – the rival's team by the starter the player chose, the
// next boss and a win in the shared log.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// web/lib/run.mjs imports browser paths (/shared/…): map them onto the project folder.
const ROOT = new URL('../', import.meta.url).href;
registerHooks({
  resolve(spec, ctx, next) {
    return spec.startsWith('/shared/') ? next(ROOT + spec.slice(1), ctx) : next(spec, ctx);
  },
});
const { RunDoc } = await import('../web/lib/doc.mjs');
const R = await import('../web/lib/run.mjs');
const B = await import('../web/lib/bosses.mjs');

const PAIR = { id: 'run1', game: { code: 'IREO', system: 'nds' }, players: { p1: { name: 'Tim' }, p2: { name: 'Robin' } } };
const SOLO = { ...PAIR, mode: 'nuzlocke', players: { p1: { name: 'Lou' } } };
function mkDoc() {
  const d = new RunDoc('t');
  d.by = 'a';
  d._persistSoon = () => {};
  return d;
}
const mon = (id, level) => ({ id, forme: 0, name: `#${id}`, level, item: null, moves: ['Placaje'], defaultMoves: true });
const rival = (n, v, id, level) => ({ kind: 'rival', number: n, variant: v, tag: `RIVAL${n}-${v}`, name: 'Entrenador Rival', level, team: [mon(id, level)] });
const DATA = {
  starters: [495, 498, 501],
  list: [
    rival(1, 0, 498, 5), rival(1, 1, 501, 5), rival(1, 2, 495, 5),
    { kind: 'gym', number: 1, variant: null, tag: 'GYM1-LEADER', name: 'Líder Cheren', level: 13, team: [mon(504, 11), mon(506, 13)] },
    { kind: 'champion', number: 0, variant: null, tag: 'CHAMPION', name: 'Campeona Iris', level: 59, team: [mon(612, 59)] },
  ],
};
// evolution families as the run data tells them (Tepig → Pignite)
const RD = { familyRoot: (id) => ({ 499: 498 })[id] || id };

test('the option is off unless set', () => {
  assert.equal(B.bossesOn(R.rules(mkDoc(), PAIR)), false);
  const d = mkDoc();
  d.set('rules', { bosses: true });
  assert.equal(B.bossesOn(R.rules(d, PAIR)), true);
});

test('the rival comes once per battle, with the team of the starter the player chose', () => {
  const d = mkDoc();
  d.set('rbosses:p1', DATA);
  // starter unknown: one entry per battle, flagged so the view asks
  let list = B.bossesOf(d, RD, 'p1');
  assert.deepEqual(list.map((b) => [b.key, b.unknownRival]), [['RIVAL1', true], ['GYM1-LEADER', false], ['CHAMPION', false]]);
  // the starter catch tells it – also after it evolved (Pignite is Tepig's family: starter 2 → variant 1)
  d.set('enc:starter:p1', { species: 499, outcome: 'caught' });
  list = B.bossesOf(d, RD, 'p1');
  assert.equal(list[0].tag, 'RIVAL1-1');
  assert.equal(list[0].team[0].id, 501);
  // the player's own pick wins
  d.set('rbstarter:p1', 2);
  assert.equal(B.bossesOf(d, RD, 'p1')[0].tag, 'RIVAL1-2');
  // another player's list is their own
  assert.deepEqual(B.bossesOf(d, RD, 'p2'), []);
});

test('defeating the next boss: kept per player, logged as "X defeated Y", undone', () => {
  const d = mkDoc();
  d.set('rbosses:p1', DATA);
  d.set('rbosses:p2', DATA);
  d.set('rbstarter:p1', 0);
  const first = B.nextBoss(B.bossesOf(d, RD, 'p1'));
  assert.equal(first.key, 'RIVAL1');
  B.defeatBoss(d, PAIR, 'p1', first);
  assert.equal(B.nextBoss(B.bossesOf(d, RD, 'p1')).tag, 'GYM1-LEADER');
  assert.equal(B.nextBoss(B.bossesOf(d, RD, 'p2')).key, 'RIVAL1', 'the partner still has to beat theirs');
  const [f] = R.feedList(d);
  assert.deepEqual([f.type, f.slot, f.text], ['boss', 'p1', 'defeated Entrenador Rival (battle 1)']);
  B.undoBoss(d, 'p1', first);
  assert.equal(B.nextBoss(B.bossesOf(d, RD, 'p1')).key, 'RIVAL1');

  const s = mkDoc();
  s.set('rbosses:p1', DATA);
  B.defeatBoss(s, SOLO, 'p1', B.bossesOf(s, RD, 'p1')[1]);
  assert.equal(R.feedList(s)[0].text, 'Defeated Líder Cheren');
});

test('all bosses beaten: no next one', () => {
  const d = mkDoc();
  d.set('rbosses:p1', DATA);
  d.set('rbstarter:p1', 1);
  for (const b of B.bossesOf(d, RD, 'p1')) B.defeatBoss(d, PAIR, 'p1', b);
  assert.equal(B.nextBoss(B.bossesOf(d, RD, 'p1')), null);
});
