const assert = require('assert');
const { Game, GAME_STATE } = require('../game.js');

console.log('Running test-game.js...');

// Test: stato iniziale
const g1 = new Game();
assert.strictEqual(g1.state, GAME_STATE.IDLE);
assert.strictEqual(g1.hp, 3);
assert.strictEqual(g1.hand.length, 0);

// Test: start
const state = g1.start();
assert.strictEqual(state, GAME_STATE.PLAYING);
assert.strictEqual(g1.hand.length, g1.maxHand);
assert.strictEqual(g1.deck.length + g1.hand.length, 6);
assert(g1.enemy, 'dovrebbe esserci un nemico');

// Test: handleQR in idle avvia la partita
const g2 = new Game();
g2.handleQR('ROSSO');
assert.strictEqual(g2.state, GAME_STATE.PLAYING);
assert.strictEqual(g2.hand.length, g2.maxHand);

// Test: handleQR restart
const g3 = new Game();
g3.start();
g3.hp = 0;
g3.state = GAME_STATE.GAME_OVER;
g3.handleQR('RESTART');
assert.strictEqual(g3.state, GAME_STATE.PLAYING);
assert.strictEqual(g3.hp, 3);

// Test: giocare una carta non in mano
const g4 = new Game();
g4.start();
const handIds = g4.hand.map(c => c.templateId);
const missingId = ['ROSSO', 'BLU', 'VERDE', 'GIALLO', 'VIOLA', 'NERO'].find(id => !handIds.includes(id));
const result = g4.playCard(missingId);
assert.strictEqual(result, null);
assert.strictEqual(g4.state, GAME_STATE.PLAYING);

// Test: simulazione vittoria
const g5 = new Game({ roundsToWin: 1 });
g5.start();
// Trova una carta che batte il nemico
let winningId = null;
for (const card of g5.hand) {
  if (g5.enemy && require('../cards.js').resolveCombat(card, g5.enemy) === 'win') {
    winningId = card.templateId;
    break;
  }
}
if (winningId) {
  g5.playCard(winningId);
  assert.strictEqual(g5.lastResult, 'win');
  g5.endRound();
  assert.strictEqual(g5.state, GAME_STATE.VICTORY);
}

// Test: simulazione sconfitta/game over
const g6 = new Game({ startingHp: 1 });
g6.start();
// Trova una carta che perde contro il nemico
let losingId = null;
for (const card of g6.hand) {
  if (g6.enemy && require('../cards.js').resolveCombat(card, g6.enemy) === 'lose') {
    losingId = card.templateId;
    break;
  }
}
if (losingId) {
  g6.playCard(losingId);
  assert.strictEqual(g6.lastResult, 'lose');
  g6.endRound();
  assert.strictEqual(g6.state, GAME_STATE.GAME_OVER);
  assert.strictEqual(g6.hp, 0);
}

// Test: draw ricicla il cimitero
const g7 = new Game({ maxHand: 10 });
g7.start();
// svuota il mano nel cimitero
while (g7.hand.length > 0) {
  g7.discard.push(g7.hand.pop());
}
const drawn = g7.draw(6);
assert.strictEqual(drawn, 6);
assert.strictEqual(g7.hand.length, 6);
assert.strictEqual(g7.deck.length, 0);
assert.strictEqual(g7.discard.length, 0);

// Test: snapshot
const snap = g1.snapshot();
assert.strictEqual(snap.state, GAME_STATE.PLAYING);
assert.strictEqual(snap.hp, 3);
assert.strictEqual(snap.handSize, g1.maxHand);
assert(snap.enemy);

console.log('✅ test-game.js passati');
