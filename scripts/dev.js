import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DEBUG_MODE = process.argv.includes('--debug');
const VITE_PORT = Number(process.env.VITE_PORT || 5173);
const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

function buildStories() {
  const build = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-stories.js')], {
    cwd: ROOT,
    stdio: 'inherit'
  });

  if (build.status !== 0) {
    process.exit(build.status || 1);
  }
}

if (!fs.existsSync(viteBin)) {
  console.error('Vite non risulta installato. Esegui "npm install" e poi riprova con "npm run dev".');
  process.exit(1);
}

buildStories();

const viteEnv = {
  ...process.env,
  VITE_ENABLE_DEBUG: process.env.VITE_ENABLE_DEBUG || (DEBUG_MODE ? '1' : '0')
};

console.log(`Specula Elementae in sviluppo: http://localhost:${VITE_PORT}`);
console.log(`Gioco: http://localhost:${VITE_PORT}`);
if (viteEnv.VITE_ENABLE_DEBUG === '1' || viteEnv.VITE_ENABLE_DEBUG === 'true') {
  console.log('Debug rapido frontend attivo tramite VITE_ENABLE_DEBUG.');
}
console.log(`Studio voci: http://localhost:${VITE_PORT}/family-voice.html`);
console.log(`Carte da stampare: http://localhost:${VITE_PORT}/print.html`);
console.log('API locali montate direttamente su Vite in sviluppo.');

const viteProcess = spawnSync(process.execPath, [viteBin, '--host', '0.0.0.0', '--port', String(VITE_PORT)], {
  cwd: ROOT,
  env: viteEnv,
  stdio: 'inherit'
});

process.exit(viteProcess.status || 0);
