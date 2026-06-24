const assert = require('assert');
const { Game, GAME_STATE } = require('../game.js');

console.log('Running test-game.js...');

// Test: stato iniziale
const g1 = new Game();
assert.strictEqual(g1.state, GAME_STATE.IDLE);
assert.strictEqual(g1.hp, 3);
assert.strictEqual(g1.round, 0);

// Test: start
const state = g1.start();
assert.strictEqual(state, GAME_STATE.PLAYING);
assert(g1.enemy, 'dovrebbe esserci un nemico');
assert.strictEqual(g1.round, 1);

// Test: handleQR in idle avvia la partita
const g2 = new Game();
g2.handleQR('ROSSO');
assert.strictEqual(g2.state, GAME_STATE.PLAYING);
assert(g2.enemy);

// Test: handleQR restart
const g3 = new Game();
g3.start();
g3.hp = 0;
g3.state = GAME_STATE.GAME_OVER;
g3.handleQR('RESTART');
assert.strictEqual(g3.state, GAME_STATE.PLAYING);
assert.strictEqual(g3.hp, 3);

// Test: giocare una carta valida
const g4 = new Game();
g4.start();
const event = g4.playCard('ROSSO');
assert(event, 'playCard dovrebbe restituire un risultato');
assert(event.card, 'dovrebbe esserci una carta giocata');
assert.strictEqual(event.card.templateId, 'ROSSO');
assert(['win', 'lose', 'draw'].includes(event.result));
assert.strictEqual(g4.state, GAME_STATE.ROUND_RESULT);

// Test: giocare una carta non valida
const g5 = new Game();
g5.start();
const invalid = g5.playCard('INESISTENTE');
assert.strictEqual(invalid, null);
assert.strictEqual(g5.state, GAME_STATE.PLAYING);

// Test: simulazione vittoria in un round
const g6 = new Game({ roundsToWin: 1 });
g6.start();
// Trova una carta che batte il nemico
let winningId = null;
const { CARD_TEMPLATES, resolveCombat, createCard } = require('../cards.js');
for (const template of CARD_TEMPLATES) {
  const card = createCard(template.id);
  if (resolveCombat(card, g6.enemy) === 'win') {
    winningId = template.id;
    break;
  }
}
assert(winningId, 'dovrebbe esistere una carta vincente');
g6.playCard(winningId);
g6.endRound();
assert.strictEqual(g6.state, GAME_STATE.VICTORY);

// Test: simulazione sconfitta/game over
const g7 = new Game({ startingHp: 1 });
g7.start();
let losingId = null;
for (const template of CARD_TEMPLATES) {
  const card = createCard(template.id);
  if (resolveCombat(card, g7.enemy) === 'lose') {
    losingId = template.id;
    break;
  }
}
assert(losingId, 'dovrebbe esistere una carta perdente');
g7.playCard(losingId);
g7.endRound();
assert.strictEqual(g7.state, GAME_STATE.GAME_OVER);
assert.strictEqual(g7.hp, 0);

// Test: pareggio, il nemico resta
const g8 = new Game();
g8.start();
let drawingId = null;
for (const template of CARD_TEMPLATES) {
  const card = createCard(template.id);
  if (resolveCombat(card, g8.enemy) === 'draw') {
    drawingId = template.id;
    break;
  }
}
if (drawingId) {
  const oldEnemy = g8.enemy;
  g8.playCard(drawingId);
  g8.endRound();
  assert.strictEqual(g8.state, GAME_STATE.PLAYING);
  assert.strictEqual(g8.enemy.uid, oldEnemy.uid, 'il nemico dovrebbe restare dopo pareggio');
}

// Test: snapshot
const snap = g1.snapshot();
assert.strictEqual(snap.state, GAME_STATE.PLAYING);
assert.strictEqual(snap.hp, 3);
assert(snap.enemy);

console.log('✅ test-game.js passati');
