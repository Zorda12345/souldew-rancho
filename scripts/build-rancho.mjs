// Compila el rancho (rancho/, Vite + TypeScript + PixiJS) a web/rancho/, que el servidor sirve en /rancho/.
// Borra antes lo compilado de la vez anterior (index.html y assets/) pero deja web/rancho/sprites/.
// Uso: npm run rancho:build
import { rmSync } from 'node:fs';
import { execSync } from 'node:child_process';

const out = new URL('../web/rancho/', import.meta.url);
rmSync(new URL('assets/', out), { recursive: true, force: true });
rmSync(new URL('index.html', out), { force: true });
execSync('npx tsc -p rancho && npx vite build --config rancho/vite.config.ts', { stdio: 'inherit' });
