/**
 * Logica di gioco pura, testabile in Node.js.
 * Non dipende da p5.js ne dal DOM.
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
      this.maxHand = options.maxHand ?? 4;
      this.startingHp = options.startingHp ?? 3;
      this.reset();
    }

    reset() {
      this.state = GAME_STATE.IDLE;
      this.hp = this.startingHp;
      this.round = 0;
      this.deck = [];
      this.hand = [];
      this.discard = [];
      this.enemy = null;
      this.lastResult = null;
      this.logs = [];
    }

    start(seedTemplateId = null) {
      this.reset();

      for (const template of CARD_TEMPLATES) {
        this.deck.push(createCard(template.id));
      }
      if (seedTemplateId && TEMPLATE_MAP[seedTemplateId]) {
        this.deck.push(createCard(seedTemplateId));
        this.log(`Seme rilevato: ${seedTemplateId}.`);
      }

      this.shuffle();
      this.draw(this.maxHand);
      this.spawnEnemy();
      this.state = GAME_STATE.PLAYING;
      this.log('Partita iniziata. Mostra una carta alla webcam.');
      return this.state;
    }

    restart() {
      return this.start();
    }

    shuffle() {
      // Fisher-Yates
      for (let i = this.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
      }
    }

    draw(n) {
      let drawn = 0;
      for (let i = 0; i < n; i++) {
        if (this.hand.length >= this.maxHand) break;
        if (this.deck.length === 0) {
          if (this.discard.length === 0) break;
          this.deck = this.discard.splice(0);
          this.shuffle();
          this.log('Cimitero rimescolato nel mazzo.');
        }
        this.hand.push(this.deck.pop());
        drawn++;
      }
      return drawn;
    }

    spawnEnemy() {
      this.round++;
      const template = CARD_TEMPLATES[Math.floor(Math.random() * CARD_TEMPLATES.length)];
      const bonus = Math.floor(this.round / 2);
      this.enemy = createCard(template.id, bonus);
      this.log(`Round ${this.round}: appare ${this.enemy.name} (potere ${this.enemy.power}).`);
      return this.enemy;
    }

    playCard(templateId) {
      if (this.state !== GAME_STATE.PLAYING) {
        this.log('Non puoi giocare ora.');
        return null;
      }
      if (!this.enemy) {
        this.log('Nessun nemico attivo.');
        return null;
      }

      const idx = this.hand.findIndex(c => c.templateId === templateId);
      if (idx === -1) {
        this.log(`Carta ${templateId} non è in mano.`);
        return null;
      }

      const card = this.hand.splice(idx, 1)[0];
      const result = resolveCombat(card, this.enemy);
      this.lastResult = result;
      this.state = GAME_STATE.ROUND_RESULT;

      if (result === 'win') {
        this.log(`Hai giocato ${card.name}: vittoria! ${this.enemy.name} entra nel mazzo.`);
      } else if (result === 'lose') {
        this.hp--;
        this.discard.push(card);
        this.log(`Hai giocato ${card.name}: sconfitta. Perdi 1 HP.`);
      } else {
        this.discard.push(card);
        this.log(`Hai giocato ${card.name}: pareggio.`);
      }

      return { card, result };
    }

    endRound() {
      if (this.state !== GAME_STATE.ROUND_RESULT) return this.state;

      if (this.lastResult === 'win') {
        this.deck.push(this.enemy);
        if (this.round >= this.roundsToWin) {
          this.state = GAME_STATE.VICTORY;
          this.log('Hai vinto!');
          return this.state;
        }
        this.draw(1);
        this.spawnEnemy();
      } else if (this.lastResult === 'lose') {
        if (this.hp <= 0) {
          this.state = GAME_STATE.GAME_OVER;
          this.log('Game over.');
          return this.state;
        }
        this.draw(1);
        // nemico resta
      } else {
        this.draw(1);
        // nemico resta
      }

      this.state = GAME_STATE.PLAYING;
      this.log('Scegli la prossima carta.');
      return this.state;
    }

    /**
     * Punto unico di ingresso per gli eventi QR.
     * Ritorna un oggetto descrittivo dell'evento:
     * - { action: 'start' | 'restart', state }
     * - { action: 'play', card, result, state }
     * - { action: 'unknown', state }
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
        handSize: this.hand.length,
        deckSize: this.deck.length,
        discardSize: this.discard.length,
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
