/**
 * Logica di gioco pura, testabile in Node.js.
 * Versione no-WIMP: il giocatore gestisce fisicamente le proprie carte.
 * Il computer non traccia mano, mazzo o cimitero del giocatore.
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
      this.startingHp = options.startingHp ?? 3;
      this.reset();
    }

    reset() {
      this.state = GAME_STATE.IDLE;
      this.hp = this.startingHp;
      this.round = 0;
      this.enemy = null;
      this.lastResult = null;
      this.lastPlayedCard = null;
      this.logs = [];
    }

    start(seedTemplateId = null) {
      this.reset();
      this.state = GAME_STATE.PLAYING;
      this.log('Partita iniziata. Mostra una carta alla webcam per giocarla.');
      if (seedTemplateId && TEMPLATE_MAP[seedTemplateId]) {
        this.log(`Seme rilevato: ${seedTemplateId}.`);
      }
      this.spawnEnemy();
      return this.state;
    }

    restart() {
      return this.start();
    }

    spawnEnemy() {
      this.round++;
      const template = CARD_TEMPLATES[Math.floor(Math.random() * CARD_TEMPLATES.length)];
      const bonus = Math.floor(this.round / 2);
      this.enemy = createCard(template.id, bonus);
      this.log(`Round ${this.round}: appare ${this.enemy.name} (potere ${this.enemy.power}).`);
      return this.enemy;
    }

    /**
     * Il giocatore gioca una carta mostrandone il QR alla webcam.
     * Non c'è più controllo "in mano": il giocatore gestisce fisicamente le carte.
     */
    playCard(templateId) {
      if (this.state !== GAME_STATE.PLAYING) {
        this.log('Non puoi giocare ora.');
        return null;
      }
      if (!this.enemy) {
        this.log('Nessun nemico attivo.');
        return null;
      }

      const card = createCard(templateId);
      if (!card) {
        this.log(`Carta ${templateId} non riconosciuta.`);
        return null;
      }

      this.lastPlayedCard = card;
      const result = resolveCombat(card, this.enemy);
      this.lastResult = result;
      this.state = GAME_STATE.ROUND_RESULT;

      if (result === 'win') {
        this.log(`Hai giocato ${card.name}: vittoria! Aggiungi ${this.enemy.name} al tuo mazzo fisico.`);
      } else if (result === 'lose') {
        this.hp--;
        this.log(`Hai giocato ${card.name}: sconfitta. Perdi 1 HP.`);
      } else {
        this.log(`Hai giocato ${card.name}: pareggio.`);
      }

      return { card, result };
    }

    endRound() {
      if (this.state !== GAME_STATE.ROUND_RESULT) return this.state;

      if (this.lastResult === 'win') {
        if (this.round >= this.roundsToWin) {
          this.state = GAME_STATE.VICTORY;
          this.log('Hai vinto!');
          return this.state;
        }
        this.spawnEnemy();
      } else if (this.lastResult === 'lose') {
        if (this.hp <= 0) {
          this.state = GAME_STATE.GAME_OVER;
          this.log('Game over.');
          return this.state;
        }
        // Il nemico resta finché non viene sconfitto
      } else {
        // Pareggio: nemico resta
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
        enemy: this.enemy ? { name: this.enemy.name, element: this.enemy.element, power: this.enemy.power } : null
      };
    }
  }

  global.Game = Game;
  global.GAME_STATE = GAME_STATE;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Game, GAME_STATE };
  }
})(typeof window !== 'undefined' ? window : global);
