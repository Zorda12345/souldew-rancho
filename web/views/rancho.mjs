// The ranch: a separate little app (rancho/, built to web/rancho/ with `npm run rancho:build`) where the
// Pokémon of a save stroll around a meadow. It runs in an iframe so its PixiJS canvas and its styles stay
// apart from the rest of the app. For now it shows the ranch's own sample data (rancho/data/mock-save.json).
import { html } from '/vendor/htm-preact.mjs';
import { t } from '../lib/i18n.mjs';

export function RanchView() {
  return html`<div class="rancho-view">
    <div class="topbar">
      <h1>${t('rancho.title', 'Ranch')}</h1>
      <p class="small muted">${t('rancho.intro', 'Your Pokémon strolling around the meadow. Click one to see its card. Sample data for now.')}</p>
    </div>
    <iframe class="rancho-frame" src="/rancho/index.html" title=${t('rancho.frame', 'Pokémon ranch')}></iframe>
  </div>`;
}
