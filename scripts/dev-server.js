import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createAppServer } from '../server/app-server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const DEBUG_MODE = process.argv.includes('--debug');
const SKIP_STORY_BUILD = process.env.SKIP_STORY_BUILD === '1';

function buildStories() {
  const build = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-stories.js')], {
    cwd: ROOT,
    stdio: 'inherit'
  });

  if (build.status !== 0) {
    process.exit(build.status || 1);
  }
}

if (!SKIP_STORY_BUILD) {
  buildStories();
}

const app = createAppServer({
  staticRoot: process.env.APP_STATIC_ROOT || ROOT,
  dataDir: path.join(ROOT, '.local-data'),
  port: PORT,
  piperBaseUrl: process.env.PIPER_BASE_URL || 'http://127.0.0.1:5000'
});

app.server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') {
    console.error(`La porta ${PORT} e' gia' occupata. Prova con PORT=3001 npm run serve`);
    process.exit(1);
  }
});

app.start().then(() => {
  const baseUrl = `http://localhost:${PORT}`;
  console.log(`Specula Elementae pronta su ${baseUrl}`);
  console.log(`Gioco: ${baseUrl}`);
  console.log(`Carte da stampare: ${baseUrl}/print.html`);
  console.log(`Voci di famiglia: ${baseUrl}`);
  if (DEBUG_MODE) {
    console.log('Debug rapido richiesto per il frontend. Avvia Vite con VITE_ENABLE_DEBUG=1 oppure usa npm run debug.');
  }
});
