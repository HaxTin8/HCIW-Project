import assert from 'node:assert';
import {
  CARD_TEMPLATES,
  TEMPLATE_MAP,
  ELEMENTS,
  createCard,
  resolveCombat,
  elementAdvantage
} from '../cards.js';

console.log('Running test-cards.js...');

// Test: createCard genera una carta valida
const fireCard = createCard('ROSSO');
assert(fireCard, 'createCard dovrebbe restituire una carta');
assert.strictEqual(fireCard.templateId, 'ROSSO');
assert.strictEqual(fireCard.element, 'FIRE');
assert.strictEqual(fireCard.power, 3);
assert.strictEqual(fireCard.emoji, '🔥');
assert(fireCard.uid, 'la carta dovrebbe avere un uid');

// Test: createCard con bonus power
const strongFire = createCard('ROSSO', 5);
assert.strictEqual(strongFire.power, 8);

// Test: createCard con id inesistente
assert.strictEqual(createCard('INESISTENTE'), null);

// Test: vantaggio elemento (Fuoco batte Natura)
const fire = createCard('ROSSO');
const nature = createCard('VERDE');
assert.strictEqual(resolveCombat(fire, nature), 'win');
assert.strictEqual(resolveCombat(nature, fire), 'lose');

// Test: svantaggio elemento (Acqua batte Fuoco)
const water = createCard('BLU');
assert.strictEqual(resolveCombat(fire, water), 'lose');
assert.strictEqual(resolveCombat(water, fire), 'win');

// Test: parità di potere con elementi neutri
const neutralWater = createCard('BLU');
const neutralLight = createCard('GIALLO');
// Acqua vs Luce: nessuno ha vantaggio, potere 3 vs 3
assert.strictEqual(resolveCombat(neutralWater, neutralLight), 'draw');

// Test: stesso elemento, potere diverso
const strongWater = createCard('BLU', 2);
const weakWater = createCard('BLU');
assert.strictEqual(resolveCombat(strongWater, weakWater), 'win');

// Test: elementAdvantage
assert.strictEqual(elementAdvantage('FIRE', 'NATURE'), 1);
assert.strictEqual(elementAdvantage('FIRE', 'WATER'), -1);
assert.strictEqual(elementAdvantage('FIRE', 'FIRE'), 0);

// Test: tutti i template hanno elementi validi
for (const t of CARD_TEMPLATES) {
  assert(ELEMENTS[t.element], `${t.id} ha un elemento valido`);
  assert(TEMPLATE_MAP[t.id], `${t.id} è presente nella mappa`);
}

console.log('✅ test-cards.js passati');
