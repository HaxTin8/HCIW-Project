import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DEBUG_MODE = process.argv.includes('--debug');
const API_PORT = Number(process.env.PORT || process.env.APP_PORT || 3000);
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

function startProcess(label, command, args, env) {
  const child = spawn(command, args, {
    cwd: ROOT,
    env,
    stdio: 'inherit'
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    if (code && code !== 0) {
      console.error(`[${label}] terminato con codice ${code}`);
      shutdown(code);
    }
  });

  return child;
}

const children = [];

function shutdown(exitCode = 0) {
  while (children.length > 0) {
    const child = children.pop();
    if (child && !child.killed) {
      child.kill('SIGTERM');
    }
  }
  process.exit(exitCode);
}

if (!fs.existsSync(viteBin)) {
  console.error('Vite non risulta installato. Esegui "npm install" e poi riprova con "npm run dev".');
  process.exit(1);
}

buildStories();

const backendEnv = {
  ...process.env,
  PORT: String(API_PORT),
  APP_PORT: String(API_PORT),
  SKIP_STORY_BUILD: '1'
};

const viteEnv = {
  ...process.env,
  VITE_API_TARGET: process.env.VITE_API_TARGET || `http://127.0.0.1:${API_PORT}`
};

children.push(startProcess('backend', process.execPath, [path.join(ROOT, 'scripts', 'dev-server.js'), ...(DEBUG_MODE ? ['--debug'] : [])], backendEnv));
children.push(startProcess('vite', process.execPath, [viteBin, '--host', '0.0.0.0', '--port', String(VITE_PORT)], viteEnv));

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log(`Specula Elementae in sviluppo: http://localhost:${VITE_PORT}`);
console.log(`API locale: http://localhost:${API_PORT}`);
console.log(`Gioco: http://localhost:${VITE_PORT}${DEBUG_MODE ? '/?debug=1' : ''}`);
console.log(`Studio voci: http://localhost:${VITE_PORT}/family-voice.html`);
console.log(`Carte da stampare: http://localhost:${VITE_PORT}/print.html`);
