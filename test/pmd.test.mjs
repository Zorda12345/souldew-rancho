// Fork: rutas de los sprites de Mundo Misterioso del rancho (server/lib/pmd.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pmdUrl, PMD_URL } from '../server/lib/pmd.mjs';

test('pmdUrl: forma normal y shiny', () => {
  assert.deepEqual(pmdUrl('/rancho/pmd/390/Walk-Anim.png'), { url: `${PMD_URL}/0390/Walk-Anim.png`, file: '390/Walk-Anim.png' });
  assert.deepEqual(pmdUrl('/rancho/pmd/390/shiny/AnimData.xml'), { url: `${PMD_URL}/0390/0000/0001/AnimData.xml`, file: '390-shiny/AnimData.xml' });
});

test('pmdUrl: rechaza rutas raras', () => {
  for (const p of ['/rancho/pmd/0/Walk-Anim.png', '/rancho/pmd/2000/Walk-Anim.png', '/rancho/pmd/390/../x.png',
    '/rancho/pmd/390/credits.txt', '/rancho/pmd/390/walk-Anim.png', '/rancho/sprites/390/Walk-Anim.png', '/rancho/pmd/abc/AnimData.xml']) {
    assert.equal(pmdUrl(p), null, p);
  }
});
