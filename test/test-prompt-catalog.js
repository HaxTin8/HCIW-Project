import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPromptCatalog } from '../server/prompt-catalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function run() {
  const catalog = buildPromptCatalog(ROOT);

  assert.ok(catalog.groups.length >= 2, 'Il catalogo deve includere gameplay e storie');
  assert.ok(catalog.promptMap['game.start'], 'Il prompt di inizio partita deve esistere');
  assert.ok(catalog.promptMap['game.card.ROSSO'], 'Il prompt della carta rossa deve esistere');

  const storyPrompt = Object.keys(catalog.promptMap).find((key) => key.startsWith('story.'));
  assert.ok(storyPrompt, 'Deve esistere almeno un prompt narrativo');

  console.log('✅ test-prompt-catalog.js passati');
}

run();
