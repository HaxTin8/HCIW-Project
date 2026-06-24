const assert = require('assert');
const { Game, GAME_STATE } = require('../game.js');

console.log('Running test-game.js...');

// Test: stato iniziale
const g1 = new Game();
assert.strictEqual(g1.state, GAME_STATE.IDLE);
assert.strictEqual(g1.hp, 3);
assert.strictEqual(g1.round, 0);
assert.strictEqual(g1.cardsPerRound, 3);

// Test: start
const state = g1.start();
assert.strictEqual(state, GAME_STATE.PLAYING);
assert.strictEqual(g1.enemies.length, 3);
assert.strictEqual(g1.currentEnemyIndex, 0);
assert(g1.currentEnemy, 'dovrebbe esserci un nemico corrente');

// Test: handleQR in idle avvia la partita
const g2 = new Game();
g2.handleQR('ROSSO');
assert.strictEqual(g2.state, GAME_STATE.PLAYING);
assert.strictEqual(g2.enemies.length, 3);

// Test: handleQR restart
const g3 = new Game();
g3.start();
g3.hp = 0;
g3.state = GAME_STATE.GAME_OVER;
g3.handleQR('RESTART');
assert.strictEqual(g3.state, GAME_STATE.PLAYING);
assert.strictEqual(g3.hp, 3);

// Test: giocare una carta valida
const g4 = new Game({ cardsPerRound: 2 });
g4.start();
const event = g4.playCard('ROSSO');
assert(event, 'playCard dovrebbe restituire un risultato');
assert(event.card, 'dovrebbe esserci una carta giocata');
assert.strictEqual(event.card.templateId, 'ROSSO');
assert(['win', 'lose', 'draw'].includes(event.result));

// Con 2 carte a round, dopo la prima il round continua
if (g4.cardsPerRound > 1) {
  assert.strictEqual(event.roundContinues, true);
  assert.strictEqual(g4.state, GAME_STATE.PLAYING);
  assert.strictEqual(g4.currentEnemyIndex, 1);
}

// Test: giocare una carta non valida
const g5 = new Game();
g5.start();
const invalid = g5.playCard('INESISTENTE');
assert.strictEqual(invalid, null);
assert.strictEqual(g5.state, GAME_STATE.PLAYING);

// Test: completare un round con 1 carta per round e vincere
const g6 = new Game({ cardsPerRound: 1, roundsToWin: 1 });
g6.start();
const { CARD_TEMPLATES, resolveCombat, createCard } = require('../cards.js');
let winningId = null;
for (const template of CARD_TEMPLATES) {
  const card = createCard(template.id);
  if (resolveCombat(card, g6.currentEnemy) === 'win') {
    winningId = template.id;
    break;
  }
}
assert(winningId, 'dovrebbe esistere una carta vincente');
const winEvent = g6.playCard(winningId);
assert.strictEqual(winEvent.roundContinues, false);
assert.strictEqual(g6.state, GAME_STATE.ROUND_RESULT);
assert.strictEqual(g6.lastResult, 'win');
g6.endRound();
assert.strictEqual(g6.state, GAME_STATE.VICTORY);

// Test: completare un round con 1 carta per round e perdere
const g7 = new Game({ cardsPerRound: 1, startingHp: 1 });
g7.start();
let losingId = null;
for (const template of CARD_TEMPLATES) {
  const card = createCard(template.id);
  if (resolveCombat(card, g7.currentEnemy) === 'lose') {
    losingId = template.id;
    break;
  }
}
assert(losingId, 'dovrebbe esistere una carta perdente');
g7.playCard(losingId);
g7.endRound();
assert.strictEqual(g7.state, GAME_STATE.GAME_OVER);
assert.strictEqual(g7.hp, 0);

// Test: completare un round con 3 carte
const g8 = new Game({ cardsPerRound: 3 });
g8.start();
for (let i = 0; i < 3; i++) {
  assert.strictEqual(g8.state, GAME_STATE.PLAYING);
  g8.playCard('ROSSO');
}
assert.strictEqual(g8.state, GAME_STATE.ROUND_RESULT);

// Test: pareggio, i nemici restano
const g9 = new Game({ cardsPerRound: 1 });
g9.start();
let drawingId = null;
for (const template of CARD_TEMPLATES) {
  const card = createCard(template.id);
  if (resolveCombat(card, g9.currentEnemy) === 'draw') {
    drawingId = template.id;
    break;
  }
}
if (drawingId) {
  const oldEnemyUid = g9.currentEnemy.uid;
  g9.playCard(drawingId);
  g9.endRound();
  assert.strictEqual(g9.state, GAME_STATE.PLAYING);
  assert.strictEqual(g9.currentEnemy.uid, oldEnemyUid, 'i nemici dovrebbero restare dopo pareggio');
}

// Test: snapshot
const snap = g1.snapshot();
assert.strictEqual(snap.state, GAME_STATE.PLAYING);
assert.strictEqual(snap.hp, 3);
assert.strictEqual(snap.enemiesCount, 3);
assert(snap.enemy);

console.log('✅ test-game.js passati');
