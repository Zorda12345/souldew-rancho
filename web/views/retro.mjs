// RetroAchievements (añadido del fork souldew-rancho): la cuenta del jugador en retroachievements.org, sus logros de
// la última semana y su progreso en el juego al que está jugando. Todo pasa por el servidor local
// (server/lib/retroach.mjs), que es el único que conoce la clave de API: la página solo la envía al conectar.
import { html, useState, useEffect } from '/vendor/htm-preact.mjs';
import { openExternal } from '../lib/ui.mjs';
import { Icon } from '../lib/icons.mjs';
import { t, ago, currentLang } from '../lib/i18n.mjs';
import { api } from '../lib/api.mjs';

const RA_SITE = 'https://retroachievements.org';
const KEYS_PAGE = 'https://retroachievements.org/settings';
const REFRESH_MS = 60_000; // lo mismo que guarda la caché del servidor

const errorText = (code) => ({
  input: t('retro.errInput', 'Check the user name and the key: the key has only letters and digits.'),
  key: t('retro.errKey', 'RetroAchievements did not accept that key. Copy it again from your settings there.'),
  user: t('retro.errUser', 'There is no RetroAchievements user with that name.'),
  offline: t('retro.errOffline', 'RetroAchievements can’t be reached. Check your internet connection.'),
  rate: t('retro.errRate', 'Too many requests to RetroAchievements. Wait a minute and try again.'),
  server: t('retro.errServer', 'RetroAchievements answered with an error. Try again later.'),
}[code] || t('retro.errServer', 'RetroAchievements answered with an error. Try again later.'));

const fmt = (n) => Number(n || 0).toLocaleString(currentLang());
const when = (iso) => (iso ? ago(Date.parse(iso)) : '');

function Connect({ onLinked }) {
  const [user, setUser] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.post('/api/retroach/link', { user: user.trim(), key: key.trim() });
      if (r.ok) {
        setKey('');
        onLinked();
      } else setError(errorText(r.error));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return html`<form class="panel ra-connect" onSubmit=${submit}>
    <h2>${t('retro.connectTitle', 'Connect your account')}</h2>
    <ol class="ra-steps muted">
      <li>${t('retro.step1', 'Sign in at retroachievements.org and open your settings.')}
        <button type="button" class="btn small ghost" onClick=${() => openExternal(KEYS_PAGE)}><${Icon} name="external" size=${12} />${t('retro.openSettings', 'Open settings')}</button></li>
      <li>${t('retro.step2', 'Under “Keys”, copy your web API key.')}</li>
      <li>${t('retro.step3', 'Paste it here with your user name.')}</li>
    </ol>
    <label class="ra-field"><span>${t('retro.user', 'User name')}</span>
      <input type="text" value=${user} onInput=${(e) => setUser(e.target.value)} autocomplete="username" spellcheck="false" maxlength="32" required /></label>
    <label class="ra-field"><span>${t('retro.key', 'Web API key')}</span>
      <input type="password" value=${key} onInput=${(e) => setKey(e.target.value)} autocomplete="off" spellcheck="false" maxlength="64" required /></label>
    <p class="small faint">${t('retro.keyNote', 'The key stays on this computer: only the souldew server uses it to ask RetroAchievements. It never goes into a run or a shared file.')}</p>
    ${error && html`<p class="ra-error" role="alert">${error}</p>`}
    <div><button class="btn primary" type="submit" disabled=${busy || !user.trim() || !key.trim()}>${busy ? t('retro.checking', 'Checking …') : t('retro.connect', 'Connect')}</button></div>
  </form>`;
}

function Account({ s, onUnlink, onRefresh, busy }) {
  const p = s.profile;
  return html`<section class="panel ra-account">
    ${p.avatar ? html`<img class="ra-avatar" src=${p.avatar} alt="" width="64" height="64" />` : html`<span class="ra-avatar"></span>`}
    <div class="ra-who">
      <h2>${p.user}</h2>
      ${p.richPresence ? html`<p class="ra-presence">${p.richPresence}</p>` : html`<p class="faint small">${t('retro.noPresence', 'Not playing right now.')}</p>`}
    </div>
    <dl class="ra-points">
      <div><dt>${t('retro.points', 'points')}</dt><dd class="num">${fmt(p.points)}</dd></div>
      ${p.softcorePoints > 0 && html`<div><dt>${t('retro.softcore', 'softcore')}</dt><dd class="num">${fmt(p.softcorePoints)}</dd></div>`}
    </dl>
    <div class="ra-actions">
      <button class="btn small ghost" onClick=${() => openExternal(`${RA_SITE}/user/${encodeURIComponent(p.user)}`)}><${Icon} name="external" size=${12} />${t('retro.profile', 'Profile')}</button>
      <button class="btn small ghost" onClick=${onRefresh} disabled=${busy}>${t('retro.refresh', 'Refresh')}</button>
      <button class="btn small ghost" onClick=${onUnlink}>${t('retro.disconnect', 'Disconnect')}</button>
    </div>
  </section>`;
}

function Game({ g }) {
  const pct = g.total ? Math.round((g.earned / g.total) * 100) : 0;
  return html`<section class="panel ra-game" aria-label=${t('retro.currentGame', 'Current game')}>
    <header class="ra-game-head">
      ${g.icon && html`<img src=${g.icon} alt="" width="48" height="48" />`}
      <div>
        <h2>${g.title}</h2>
        <p class="faint small">${g.console}${g.mainPokemon ? html` <span class="ra-tag">${t('retro.mainSeries', 'Main series')}</span>` : ''}</p>
      </div>
      <p class="ra-count"><b class="num">${g.earned}</b><span class="num">/${g.total}</span></p>
    </header>
    <div class="ra-bar" role="progressbar" aria-valuemin="0" aria-valuemax=${g.total} aria-valuenow=${g.earned}
      aria-label=${t('retro.progress', '{n} of {total} achievements', { n: g.earned, total: g.total })}><i style=${`width:${pct}%`}></i></div>
    ${g.earnedHardcore > 0 && html`<p class="small faint">${t('retro.hardcore', '{n} in hardcore mode', { n: g.earnedHardcore })}</p>`}
    ${g.achievements.length > 0 && html`<ul class="ra-wall">${g.achievements.map((a) => html`<li key=${a.id} class=${a.earned ? 'got' : 'locked'}
        title=${`${a.title} (${a.points}) – ${a.description}`}>
        ${a.badge && html`<img src=${a.badge} alt=${a.title} width="40" height="40" loading="lazy" />`}
      </li>`)}</ul>`}
  </section>`;
}

function Recent({ list }) {
  return html`<section class="panel ra-recent">
    <h2>${t('retro.recent', 'This week')}</h2>
    ${list.length === 0 ? html`<p class="faint">${t('retro.noRecent', 'No achievements in the last 7 days. The next one will show up here.')}</p>` : html`
      <ul>${list.map((a) => html`<li key=${a.id}>
        ${a.badge && html`<img src=${a.badge} alt="" width="40" height="40" loading="lazy" />`}
        <div class="ra-ach">
          <b>${a.title}</b>
          <span class="small muted">${a.description}</span>
          <span class="tiny faint">${a.game.title} · ${when(a.date)}${a.hardcore ? ` · ${t('retro.hc', 'hardcore')}` : ''}</span>
        </div>
        <span class="ra-pts num">${a.points}</span>
      </li>`)}</ul>`}
  </section>`;
}

/**
 * Aviso de logro nuevo en cualquier pantalla: la misma placa que los trofeos de souldew (web/trophies.css), en azul.
 * `items`: [{ key, a }] con `a` un logro de /api/retroach (title, description, points, badge, game, hardcore).
 */
export function RetroToasts({ items, dismiss, navigate }) {
  if (!items.length) return null;
  return html`<div class="trophy-toasts ra-toasts" role="status" aria-live="polite">
    ${items.map(({ key, a }) => html`<button type="button" key=${key} class="trophy-toast ra-toast" onClick=${() => { dismiss(key); navigate('retro'); }}>
      <span class="tt-glow" aria-hidden="true"></span>
      ${a.badge ? html`<img class="ra-toast-badge" src=${a.badge} alt="" width="50" height="50" />` : html`<span class="ra-toast-badge"></span>`}
      <span class="tt-text">
        <span class="tt-kicker">${t('retro.unlocked', 'RetroAchievements unlocked')}</span>
        <b>${a.title}</b>
        <span class="tt-desc">${a.description}</span>
        <span class="tt-desc faint">${a.game?.title}${a.hardcore ? ` · ${t('retro.hc', 'hardcore')}` : ''}</span>
      </span>
      <span class="rarity"><span class="num">+${a.points}</span></span>
    </button>`)}
  </div>`;
}

export function RetroView() {
  const [s, setS] = useState(null); // null = cargando
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    try {
      setS(await api.get('/api/retroach/summary'));
    } catch (err) {
      setS({ ok: false, error: 'server', message: err.message });
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    load();
    const id = setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_MS);
    // el servidor avisó de un logro nuevo (web/app.mjs, evento `retroach`)
    window.addEventListener('retroach', load);
    return () => {
      clearInterval(id);
      window.removeEventListener('retroach', load);
    };
  }, []);
  const unlink = async () => {
    await api.del('/api/retroach/link');
    load();
  };

  let body;
  if (!s) body = html`<div class="panel"><span class="faint">${t('retro.loading', 'Asking RetroAchievements …')}</span></div>`;
  else if (!s.ok && s.error === 'notLinked') body = html`<${Connect} onLinked=${load} />`;
  else if (!s.ok) body = html`<div class="panel stack-s">
      <p class="ra-error" role="alert">${s.message || errorText(s.error)}</p>
      <div><button class="btn small" onClick=${load} disabled=${busy}>${t('retro.retry', 'Try again')}</button>
        ${s.error === 'key' && html` <button class="btn small ghost" onClick=${unlink}>${t('retro.disconnect', 'Disconnect')}</button>`}</div>
    </div>`;
  else body = html`<div class="ra-grid">
      <${Account} s=${s} onUnlink=${unlink} onRefresh=${load} busy=${busy} />
      ${s.game ? html`<${Game} g=${s.game} />` : html`<div class="panel faint">${t('retro.noGame', 'Play a game with RetroAchievements and its progress shows up here.')}</div>`}
      <${Recent} list=${s.recent} />
    </div>`;

  return html`<div class="retro-view">
    <div class="topbar">
      <h1>RetroAchievements</h1>
      <p class="small muted">${t('retro.intro', 'Your RetroAchievements account: what you are playing, your progress and your latest achievements.')}</p>
    </div>
    ${body}
  </div>`;
}
