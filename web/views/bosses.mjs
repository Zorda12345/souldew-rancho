// Bosses of the run (fork souldew-rancho, web/lib/bosses.mjs): the next boss of a player (play view and the board's
// live tab) and the "Bosses" tab with every boss – the ones still to come folded shut as spoilers.
import { html, useState, useEffect } from '/vendor/htm-preact.mjs';
import { useApp, Sprite } from '../lib/ui.mjs';
import { t, ago } from '../lib/i18n.mjs';
import { speciesName } from '../lib/data.mjs';
import { rules as getRules, players as getPlayers, slotsOf } from '../lib/run.mjs';
import { useStreamer } from '../lib/streamer.mjs';
import {
  bossesOn, bossesOf, nextBoss, bossTitle, defeatBoss, undoBoss, syncBosses, bossData, starterChoice, BOSS_KIND_LABELS,
} from '../lib/bosses.mjs';

/** Gen 4 ROMs name their Pokémon in capitals ("CHIMCHAR"): the app's own name, else the ROM's in title case. */
const monName = (p) => (p.forme === 0 && speciesName(p.id)) || p.name.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());

/** Asks the server for the bosses while the rule is on (once per run and player). */
function useBossSync() {
  const { doc, manifest } = useApp();
  const on = !!doc && bossesOn(getRules(doc, manifest));
  useEffect(() => {
    if (on) syncBosses(doc, manifest);
  }, [on, doc, manifest?.id]);
  return on;
}

function BossTeam({ team, gen }) {
  return html`<ul class="boss-team">${team.map((p) => html`<li class="boss-mon">
    <${Sprite} id=${p.id} size=${40} gen=${gen} alt="" />
    <div class="boss-mon-text">
      <p><b>${monName(p)}</b> <span class="boss-lv">${t('bosses.level', 'Lv {lv}', { lv: p.level })}</span></p>
      ${p.item && html`<span class="boss-item">${p.item}</span>`}
      <ul class="boss-moves">${p.moves.length ? p.moves.map((m) => html`<li>${m}</li>`) : html`<li class="none">${t('bosses.noMoves', 'Moves unknown')}</li>`}</ul>
    </div></li>`)}</ul>`;
}

const KindChip = ({ boss }) => html`<span class=${`chip boss-kind ${boss.kind}`}>${BOSS_KIND_LABELS()[boss.kind]}</span>`;

/** "Defeated" with a second click to confirm (a win goes to everyone's log). */
function DefeatButton({ slot, boss, small }) {
  const { doc, manifest } = useApp();
  const [ask, setAsk] = useState(false);
  useEffect(() => setAsk(false), [boss.key]);
  if (!ask) return html`<button class=${`btn ${small ? 'small' : 'small primary'}`} onClick=${() => setAsk(true)}>${t('bosses.defeated', 'Defeated')}</button>`;
  return html`<span class="row boss-confirm" role="group">
    <span class="small">${t('bosses.confirm', 'Defeated {boss}?', { boss: bossTitle(boss) })}</span>
    <button class="btn small primary" onClick=${() => { setAsk(false); defeatBoss(doc, manifest, slot, boss); }}>${t('bosses.confirmYes', 'Yes, defeated')}</button>
    <button class="btn small ghost" onClick=${() => setAsk(false)}>${t('common.cancel', 'Cancel')}</button></span>`;
}

/** Which starter did the player pick? Needed for the rival's team when the starter catch doesn't say. */
function StarterPick({ slot }) {
  const { doc, me } = useApp();
  const starters = bossData(doc, slot)?.starters || [];
  if (slot !== me) return html`<p class="small muted">${t('bosses.starterOther', 'The rival’s team depends on the starter this player chose – they can pick it on their computer.')}</p>`;
  return html`<div class="stack-s boss-starter"><p class="small muted">${t('bosses.starterAsk', 'The rival’s team depends on the starter you chose. Which one was it?')}</p>
    <div class="row">${[0, 1, 2].map((i) => html`<button class="btn small ghost" onClick=${() => doc.set(`rbstarter:${slot}`, i)}>
      ${starters[i] ? html`<${Sprite} id=${starters[i]} size=${28} alt="" />${speciesName(starters[i]) || `#${starters[i]}`}` : t('bosses.starterN', 'Starter {n}', { n: i + 1 })}</button>`)}</div></div>`;
}

/** A player's next boss: name, team and "Defeated" (only for that player's own computer). */
export function NextBossCard({ slot, compact }) {
  const { doc, manifest, me, runData } = useApp();
  const names = getPlayers(doc, manifest);
  const list = bossesOf(doc, runData, slot);
  const next = nextBoss(list);
  const done = list.filter((b) => b.defeatedAt).length;
  return html`<article class=${`boss-card ${compact ? 'compact' : ''}`} style=${`--c:var(--${slot})`}>
    <p class="boss-who">${compact ? t('bosses.next', 'Next boss') : names[slot]?.name}${list.length > 0 && html`<span class="boss-count">${done}/${list.length}</span>`}</p>
    ${!list.length ? html`<p class="small muted">${slot === me || bossData(doc, slot) ? t('bosses.none', 'No bosses read from this game yet.') : t('bosses.noneOther', 'Shows up once this player opens the run on their computer.')}</p>`
      : !next ? html`<p class="small">${t('bosses.allDone', 'All bosses defeated!')}</p>`
        : html`<h3 class="boss-name"><${KindChip} boss=${next} /> ${bossTitle(next)} <span class="boss-lv">${t('bosses.upTo', 'up to Lv {lv}', { lv: next.level })}</span></h3>
          ${next.unknownRival ? html`<${StarterPick} slot=${slot} />` : html`<${BossTeam} team=${next.team} gen=${runData.gen} />`}
          ${slot === me && html`<${DefeatButton} slot=${slot} boss=${next} />`}`}
  </article>`;
}

/** The play view: your next boss, under the level cap. */
export function PlayBoss() {
  const { me } = useApp();
  const on = useBossSync();
  if (!on) return null;
  return html`<${NextBossCard} slot=${me} compact />`;
}

/** The board's live tab: everyone's next boss. */
export function BossStrip() {
  const { manifest } = useApp();
  const on = useBossSync();
  if (!on) return null;
  return html`<section class="panel boss-strip">
    <div class="panel-head"><h2>${t('bosses.next', 'Next boss')}</h2></div>
    <div class="boss-cards">${slotsOf(manifest).map((s) => html`<${NextBossCard} slot=${s} />`)}</div>
  </section>`;
}

function BossRow({ slot, boss, isNext, streamer }) {
  const { doc, runData, me } = useApp();
  const head = html`<${KindChip} boss=${boss} /><b>${bossTitle(boss)}</b><span class="boss-lv">${t('bosses.upTo', 'up to Lv {lv}', { lv: boss.level })}</span>`;
  const team = boss.unknownRival ? html`<${StarterPick} slot=${slot} />` : html`<${BossTeam} team=${boss.team} gen=${runData.gen} />`;
  if (boss.defeatedAt) {
    return html`<li class="boss-row done"><details><summary>${head}<span class="boss-state">${t('bosses.defeatedAgo', 'Defeated {when}', { when: ago(boss.defeatedAt) })}</span></summary>
      ${team}${slot === me && html`<button class="btn small ghost" onClick=${() => undoBoss(doc, slot, boss)}>${t('bosses.undo', 'Not defeated after all')}</button>`}</details></li>`;
  }
  if (isNext) {
    return html`<li class="boss-row next"><details open><summary>${head}<span class="boss-state">${t('bosses.nextShort', 'Next')}</span></summary>
      ${team}${slot === me && html`<${DefeatButton} slot=${slot} boss=${boss} small />`}</details></li>`;
  }
  // still to come: shut until opened – and never opened on stream, where viewers would see it
  if (streamer) return html`<li class="boss-row spoiler"><div class="boss-summary">${head}<span class="boss-state">${t('bosses.hiddenStream', 'Hidden in streamer mode')}</span></div></li>`;
  return html`<li class="boss-row spoiler"><details><summary>${head}<span class="boss-state">${t('bosses.spoiler', 'Show team (spoiler)')}</span></summary>${team}</details></li>`;
}

/** The board's "Bosses" tab: every player's bosses, the ones to come as spoilers. */
export function BossesTab() {
  const { doc, manifest, runData } = useApp();
  const on = useBossSync();
  const streamer = useStreamer();
  const names = getPlayers(doc, manifest);
  if (!on) return html`<div class="panel empty-state"><p class="muted">${t('bosses.off', 'Boss info is off. Switch it on in the Rules tab.')}</p></div>`;
  return html`<div class="stack">
    <p class="small muted">${t('bosses.intro', 'Read from each player’s game: team, levels, held items and moves. The bosses still to come are folded shut – open one only if you want the spoiler.')}</p>
    <div class="boss-cols">${slotsOf(manifest).map((slot) => {
      const list = bossesOf(doc, runData, slot);
      const next = nextBoss(list);
      const pick = starterChoice(doc, runData, slot);
      return html`<section class="panel boss-col" style=${`--c:var(--${slot})`}>
        <h3 class="boss-who">${names[slot]?.name}${list.length > 0 && html`<span class="boss-count">${list.filter((b) => b.defeatedAt).length}/${list.length}</span>`}</h3>
        ${!list.length && html`<p class="small muted">${bossData(doc, slot) ? '' : t('bosses.noneOther', 'Shows up once this player opens the run on their computer.')}</p>`}
        ${pick !== null && doc.get(`rbstarter:${slot}`, null) !== null && html`<p class="tiny faint">${t('bosses.starterChosen', 'Rival’s team for starter {n}.', { n: pick + 1 })}
          <button class="btn small ghost" onClick=${() => doc.set(`rbstarter:${slot}`, null)}>${t('bosses.starterChange', 'Change')}</button></p>`}
        <ol class="boss-list">${list.map((b) => html`<${BossRow} slot=${slot} boss=${b} isNext=${b === next} streamer=${streamer} />`)}</ol>
      </section>`;
    })}</div>
  </div>`;
}

/** Rules tab: the switch (off unless set). */
export function BossRule({ value, onChange }) {
  return html`<label class="check"><input type="checkbox" checked=${value === true} onChange=${(e) => onChange(e.target.checked)} />
    <span>${t('bosses.rule', 'Show the game’s bosses')}<span class="hint">${t('bosses.ruleHint', 'Rival, gym leaders, Elite Four and champion with their team and moves, read from each player’s ROM. The next one shows while you play; the rest stay folded as spoilers.')}</span></span></label>`;
}
