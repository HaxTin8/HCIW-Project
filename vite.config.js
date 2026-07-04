import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;
const DIST = path.resolve(ROOT, 'dist');
const WATCH_TARGETS = [
  'index.html',
  'family-voice.html',
  'print.html',
  'print.js',
  'style.css',
  'app-env.js',
  'audio.js',
  'cards.js',
  'family-voice.js',
  'game.js',
  'sketch.js',
  'stories',
  'tts.js',
  'assets',
  'fonts'
].map((target) => path.resolve(ROOT, target));

const LEGACY_COPY_TARGETS = [
  'assets',
  'fonts',
  'stories/generated'
];

function isWatchedFile(file) {
  const resolvedFile = path.resolve(file);
  return WATCH_TARGETS.some((target) => resolvedFile === target || resolvedFile.startsWith(`${target}${path.sep}`));
}

function legacyFullReloadPlugin() {
  return {
    name: 'specula-legacy-full-reload',
    configureServer(server) {
      server.watcher.add(WATCH_TARGETS);
      server.watcher.on('change', (file) => {
        if (isWatchedFile(file)) {
          server.ws.send({ type: 'full-reload', path: '*' });
        }
      });
    }
  };
}

function copyLegacyRuntimePlugin() {
  return {
    name: 'specula-copy-legacy-runtime',
    closeBundle() {
      for (const target of LEGACY_COPY_TARGETS) {
        const source = path.resolve(ROOT, target);
        const destination = path.resolve(DIST, target);
        if (!fs.existsSync(source)) {
          continue;
        }
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.cpSync(source, destination, { recursive: true });
      }
    }
  };
}

export default defineConfig(() => {
  const apiTarget = process.env.VITE_API_TARGET || `http://127.0.0.1:${process.env.PORT || 3000}`;

  return {
    server: {
      host: '0.0.0.0',
      port: Number(process.env.VITE_PORT || 5173),
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true
        }
      }
    },
    preview: {
      host: '0.0.0.0',
      port: Number(process.env.PREVIEW_PORT || 4173)
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          index: path.resolve(ROOT, 'index.html'),
          familyVoice: path.resolve(ROOT, 'family-voice.html'),
          print: path.resolve(ROOT, 'print.html')
        }
      }
    },
    plugins: [legacyFullReloadPlugin(), copyLegacyRuntimePlugin()]
  };
});
