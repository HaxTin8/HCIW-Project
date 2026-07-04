import assert from 'node:assert';
import { Game, GAME_STATE } from '../game.js';
import { CARD_TEMPLATES, resolveCombat, createCard } from '../cards.js';

console.log('Running test-game.js...');

// Test: stato iniziale (default sequenziale)
const g1 = new Game();
assert.strictEqual(g1.state, GAME_STATE.IDLE);
assert.strictEqual(g1.hp, 3);
assert.strictEqual(g1.round, 0);
assert.strictEqual(g1.playMode, 'sequential');
assert.strictEqual(g1.cardsPerRound, 1);

// Test: start sequenziale
const state = g1.start();
assert.strictEqual(state, GAME_STATE.PLAYING);
assert.strictEqual(g1.enemies.length, 1);
assert(g1.currentEnemy, 'dovrebbe esserci un nemico');

// Test: start simultaneo
const gSim = new Game({ playMode: 'simultaneous' });
gSim.start();
assert.strictEqual(gSim.enemies.length, 3);
assert.strictEqual(gSim.cardsPerRound, 3);

// Test: handleQR in idle avvia la partita
const g2 = new Game();
g2.handleQR('ROSSO');
assert.strictEqual(g2.state, GAME_STATE.PLAYING);
assert.strictEqual(g2.enemies.length, 1);

// Test: handleQR restart
const g3 = new Game();
g3.start();
g3.hp = 0;
g3.state = GAME_STATE.GAME_OVER;
g3.handleQR('RESTART');
assert.strictEqual(g3.state, GAME_STATE.PLAYING);
assert.strictEqual(g3.hp, 3);

// Test: giocare una carta in sequenziale
const g4 = new Game();
g4.start();
const event = g4.playCardSequential('ROSSO');
assert(event, 'playCardSequential dovrebbe restituire un risultato');
assert(event.card, 'dovrebbe esserci una carta giocata');
assert.strictEqual(event.card.templateId, 'ROSSO');
assert(['win', 'lose', 'draw'].includes(event.result));
assert.strictEqual(g4.state, GAME_STATE.ROUND_RESULT);

// Test: giocare una carta non valida
const g5 = new Game();
g5.start();
const invalid = g5.playCardSequential('INESISTENTE');
assert.strictEqual(invalid, null);
assert.strictEqual(g5.state, GAME_STATE.PLAYING);

// Test: modalità simultanea con 3 carte
const g6 = new Game({ playMode: 'simultaneous' });
g6.start();
const ids = g6.enemies.map(enemy => {
  for (const template of CARD_TEMPLATES) {
    const card = createCard(template.id);
    if (resolveCombat(card, enemy) === 'win') {
      return template.id;
    }
  }
  return CARD_TEMPLATES[0].id;
});
const allEvent = g6.playAllCards(ids);
assert(allEvent, 'playAllCards dovrebbe restituire un risultato');
assert.strictEqual(allEvent.results.length, 3);
assert.strictEqual(g6.state, GAME_STATE.ROUND_RESULT);

// Test: simulazione vittoria in sequenziale
const g7 = new Game({ roundsToWin: 1 });
g7.start();
let winningId = null;
for (const template of CARD_TEMPLATES) {
  const card = createCard(template.id);
  if (resolveCombat(card, g7.currentEnemy) === 'win') {
    winningId = template.id;
    break;
  }
}
assert(winningId);
g7.playCardSequential(winningId);
g7.endRound();
assert.strictEqual(g7.state, GAME_STATE.VICTORY);

// Test: simulazione sconfitta in sequenziale
const g8 = new Game({ startingHp: 1 });
g8.start();
let losingId = null;
for (const template of CARD_TEMPLATES) {
  const card = createCard(template.id);
  if (resolveCombat(card, g8.currentEnemy) === 'lose') {
    losingId = template.id;
    break;
  }
}
assert(losingId);
g8.playCardSequential(losingId);
g8.endRound();
assert.strictEqual(g8.state, GAME_STATE.GAME_OVER);
assert.strictEqual(g8.hp, 0);

// Test: cambio modalità
const g9 = new Game();
g9.start();
assert.strictEqual(g9.cardsPerRound, 1);
g9.handleQR('SIMULTANEO');
assert.strictEqual(g9.playMode, 'simultaneous');
assert.strictEqual(g9.cardsPerRound, 3);

// Test: cambio modalità durante PLAYING rigenera i nemici correttamente
const g10 = new Game({ playMode: 'sequential' });
g10.start();
assert.strictEqual(g10.enemies.length, 1);
g10.handleQR('SIMULTANEO');
assert.strictEqual(g10.playMode, 'simultaneous');
assert.strictEqual(g10.enemies.length, 3);
assert.strictEqual(g10.currentEnemyIndex, 0);
g10.handleQR('SEQUENZIALE');
assert.strictEqual(g10.playMode, 'sequential');
assert.strictEqual(g10.enemies.length, 1);
assert.strictEqual(g10.currentEnemyIndex, 0);

// Test: snapshot
const snap = g1.snapshot();
assert.strictEqual(snap.state, GAME_STATE.PLAYING);
assert.strictEqual(snap.hp, 3);
assert.strictEqual(snap.enemiesCount, 1);
assert(snap.enemy);

console.log('✅ test-game.js passati');
