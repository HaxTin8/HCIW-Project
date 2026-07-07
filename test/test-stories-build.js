import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStories, compileStory } from '../scripts/build-stories.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Running test-stories-build.js...');

const story = compileStory(path.join(__dirname, '..', 'stories', 'twine', 'story-rosso.twee'));
assert.strictEqual(story.id, 'fuoco-del-destino');
assert.strictEqual(story.title, 'Il Fuoco del Destino');
assert.strictEqual(story.startPassage, 'prologo');
assert.strictEqual(story.passages[0].links[0].target, 'nemici-modificati');

const gameEffectPassage = story.passages.find((passage) => passage.name === 'nemici-modificati');
assert.strictEqual(gameEffectPassage.gameEffects.enemyPowerModifier, -1);
assert.strictEqual(gameEffectPassage.gameEffects.firstRoundOnly, true);

const generatedIndex = buildStories();
assert(generatedIndex.ROSSO, 'ROSSO dovrebbe essere presente nell\'indice generato');
assert.strictEqual(generatedIndex.ROSSO.file, 'stories/generated/story-rosso.json');
assert.strictEqual(generatedIndex.ROSSO.locales.it.file, 'stories/generated/story-rosso.json');
assert.strictEqual(generatedIndex.ROSSO.locales.en.file, 'stories/generated/story-rosso.en.json');

console.log('✅ test-stories-build.js passati');
