import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPromptCatalog } from '../server/prompt-catalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function run() {
  const catalog = buildPromptCatalog(ROOT);
  const englishCatalog = buildPromptCatalog(ROOT, { locale: 'en' });

  assert.ok(catalog.groups.length >= 2, 'Il catalogo deve includere gameplay e storie');
  assert.ok(catalog.promptMap['game.start'], 'Il prompt di inizio partita deve esistere');
  assert.ok(catalog.promptMap['game.card.ROSSO'], 'Il prompt della carta rossa deve esistere');
  assert.ok(catalog.promptMap['game.enemy.ROSSO'], 'Il prompt del nemico rosso deve esistere');

  const storyPrompt = Object.keys(catalog.promptMap).find((key) => key.startsWith('story.'));
  assert.ok(storyPrompt, 'Deve esistere almeno un prompt narrativo');
  assert.strictEqual(englishCatalog.promptMap['game.start'].script, 'The adventure begins.');
  assert.strictEqual(englishCatalog.promptMap['story.fuoco-del-destino.prologo'].script, 'Ember warms your hands like a kind little campfire. Fire can give light and warmth, but you must be careful when you use it.');

  console.log('✅ test-prompt-catalog.js passati');
}

run();
