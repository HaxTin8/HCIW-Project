/**
 * Logica di gioco pura, testabile in Node.js.
 * Versione no-WIMP con round multi-carta: computer e utente giocano
 * piu carte a round.
 */

(function (global) {
  const Cards = typeof require !== 'undefined' ? require('./cards.js') : global;

  const CARD_TEMPLATES = Cards.CARD_TEMPLATES;
  const TEMPLATE_MAP = Cards.TEMPLATE_MAP;
  const createCard = Cards.createCard;
  const resolveCombat = Cards.resolveCombat;

  const GAME_STATE = {
    IDLE: 'idle',
    PLAYING: 'playing',
    ROUND_RESULT: 'round_result',
    GAME_OVER: 'game_over',
    VICTORY: 'victory'
  };

  class Game {
    constructor(options = {}) {
      this.roundsToWin = options.roundsToWin ?? 8;
      this.cardsPerRound = options.cardsPerRound ?? 3;
      this.startingHp = options.startingHp ?? 3;
      this.reset();
    }

    reset() {
      this.state = GAME_STATE.IDLE;
      this.hp = this.startingHp;
      this.round = 0;
      this.enemies = [];
      this.currentEnemyIndex = 0;
      this.roundResults = [];
      this.lastResult = null;
      this.lastPlayedCard = null;
      this.logs = [];
    }

    start(seedTemplateId = null) {
      this.reset();
      this.state = GAME_STATE.PLAYING;
      this.log('Partita iniziata. Mostra una carta nello slot per giocare.');
      if (seedTemplateId && TEMPLATE_MAP[seedTemplateId]) {
        this.log(`Seme rilevato: ${seedTemplateId}.`);
      }
      this.spawnEnemies();
      return this.state;
    }

    restart() {
      return this.start();
    }

    spawnEnemies() {
      this.round++;
      this.enemies = [];
      this.currentEnemyIndex = 0;
      this.roundResults = [];
      for (let i = 0; i < this.cardsPerRound; i++) {
        const template = CARD_TEMPLATES[Math.floor(Math.random() * CARD_TEMPLATES.length)];
        const bonus = Math.floor(this.round / 2);
        this.enemies.push(createCard(template.id, bonus));
      }
      const names = this.enemies.map(e => `${e.name}(${e.power})`).join(', ');
      this.log(`Round ${this.round}: appare ${this.enemies.length} nemici: ${names}.`);
      return this.enemies;
    }

    get currentEnemy() {
      return this.enemies[this.currentEnemyIndex] || null;
    }

    /**
     * Il giocatore gioca una carta mostrandone il QR alla webcam.
     * La carta combatte contro il nemico corrente del round.
     */
    playCard(templateId) {
      if (this.state !== GAME_STATE.PLAYING) {
        this.log('Non puoi giocare ora.');
        return null;
      }
      if (!this.currentEnemy) {
        this.log('Nessun nemico attivo.');
        return null;
      }

      const card = createCard(templateId);
      if (!card) {
        this.log(`Carta ${templateId} non riconosciuta.`);
        return null;
      }

      this.lastPlayedCard = card;
      const result = resolveCombat(card, this.currentEnemy);
      this.lastResult = result;
      this.roundResults.push(result);

      const enemyName = this.currentEnemy.name;
      this.log(`Hai giocato ${card.name} contro ${enemyName}: ${result}.`);

      if (this.currentEnemyIndex < this.enemies.length - 1) {
        // Il round continua con il prossimo nemico
        this.currentEnemyIndex++;
        return { card, result, roundContinues: true };
      }

      // Fine round: calcola il risultato complessivo
      this.state = GAME_STATE.ROUND_RESULT;
      const wins = this.roundResults.filter(r => r === 'win').length;
      const losses = this.roundResults.filter(r => r === 'lose').length;

      if (wins > losses) {
        this.lastResult = 'win';
        this.log(`Round vinto! ${wins} vittorie, ${losses} sconfitte.`);
      } else if (losses > wins) {
        this.lastResult = 'lose';
        this.hp--;
        this.log(`Round perso! ${wins} vittorie, ${losses} sconfitte. Perdi 1 HP.`);
      } else {
        this.lastResult = 'draw';
        this.log(`Round in pareggio! ${wins} vittorie, ${losses} sconfitte.`);
      }

      return { card, result, roundContinues: false };
    }

    endRound() {
      if (this.state !== GAME_STATE.ROUND_RESULT) return this.state;

      if (this.lastResult === 'win') {
        if (this.round >= this.roundsToWin) {
          this.state = GAME_STATE.VICTORY;
          this.log('Hai vinto!');
          return this.state;
        }
        this.spawnEnemies();
      } else if (this.lastResult === 'lose') {
        if (this.hp <= 0) {
          this.state = GAME_STATE.GAME_OVER;
          this.log('Game over.');
          return this.state;
        }
        // I nemici restano finché non vengono sconfitti
      } else {
        // Pareggio: nemici restano
      }

      this.state = GAME_STATE.PLAYING;
      this.log('Mostra la prossima carta.');
      return this.state;
    }

    /**
     * Punto unico di ingresso per gli eventi QR.
     */
    handleQR(qrData) {
      const id = String(qrData).trim().toUpperCase();

      if (id === 'RESTART') {
        this.start();
        return { action: 'restart', state: this.state };
      }

      if (this.state === GAME_STATE.IDLE ||
          this.state === GAME_STATE.GAME_OVER ||
          this.state === GAME_STATE.VICTORY) {
        if (TEMPLATE_MAP[id]) {
          this.start(id);
          return { action: 'start', state: this.state };
        }
        this.log(`QR ${id} non riconosciuto.`);
        return { action: 'unknown', state: this.state };
      }

      if (this.state === GAME_STATE.PLAYING) {
        const playResult = this.playCard(id);
        return { action: 'play', ...playResult, state: this.state };
      }

      return { action: 'none', state: this.state };
    }

    log(message) {
      this.logs.push(message);
    }

    snapshot() {
      return {
        state: this.state,
        hp: this.hp,
        round: this.round,
        enemiesCount: this.enemies.length,
        currentEnemyIndex: this.currentEnemyIndex,
        enemy: this.currentEnemy ? { name: this.currentEnemy.name, element: this.currentEnemy.element, power: this.currentEnemy.power } : null
      };
    }
  }

  global.Game = Game;
  global.GAME_STATE = GAME_STATE;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Game, GAME_STATE };
  }
})(typeof window !== 'undefined' ? window : global);
