/**
 * Logica di gioco pura, testabile in Node.js.
 * Versione no-WIMP con due modalita:
 * - sequenziale: 1 nemico, 1 carta per round
 * - simultanea: N nemici, N carte caricate una alla volta, scontro simultaneo
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
      this.simultaneousCards = options.simultaneousCards ?? 3;
      this.startingHp = options.startingHp ?? 3;
      this.playMode = options.playMode ?? 'sequential'; // 'sequential' | 'simultaneous'
      this.reset();
    }

    get cardsPerRound() {
      return this.playMode === 'simultaneous' ? this.simultaneousCards : 1;
    }

    reset() {
      this.state = GAME_STATE.IDLE;
      this.hp = this.startingHp;
      this.round = 0;
      this.enemies = [];
      this.currentEnemyIndex = 0;
      this.lastResult = null;
      this.lastPlayedCards = [];
      this.lastRoundResults = [];
      this.logs = [];
      this.resetStoryEffects();
    }

    resetStoryEffects() {
      delete this._storyNextCardBonus;
      delete this._storyAllCardsBonus;
      delete this._storyHpPenaltyOnLoss;
      delete this._storyDrawAsWin;
      delete this._storyHalfElement;
      delete this._storyIgnoreWeakness;
      // enemyPowerModifier gestito in regenerateEnemiesForCurrentRound
    }

    start(seedTemplateId = null) {
      this.reset();
      this.state = GAME_STATE.PLAYING;
      this.log('Inizia l\'avventura.');
      if (seedTemplateId && TEMPLATE_MAP[seedTemplateId]) {
        this.log(`Carta iniziale: ${seedTemplateId}.`);
      }
      this.spawnEnemies();
      return this.state;
    }

    restart() {
      return this.start();
    }

    spawnEnemies() {
      this.round++;
      return this.regenerateEnemiesForCurrentRound();
    }

    regenerateEnemiesForCurrentRound() {
      this.enemies = [];
      this.currentEnemyIndex = 0;
      this.lastRoundResults = [];
      for (let i = 0; i < this.cardsPerRound; i++) {
        const template = CARD_TEMPLATES[Math.floor(Math.random() * CARD_TEMPLATES.length)];
        let bonus = Math.floor(this.round / 2);
        if (this._storyEnemyPowerMod) {
          bonus += this._storyEnemyPowerMod;
        }
        this.enemies.push(createCard(template.id, bonus));
      }
      if (this._storyEnemyPowerModFirstRound) {
        delete this._storyEnemyPowerMod;
        delete this._storyEnemyPowerModFirstRound;
      }
      return this.enemies;
    }

    get currentEnemy() {
      return this.enemies[this.currentEnemyIndex] || null;
    }

    /**
     * Modalita sequenziale: gioca una carta contro il nemico corrente.
     */
    playCardSequential(templateId) {
      if (this.state !== GAME_STATE.PLAYING || !this.currentEnemy) return null;

      let bonusPower = 0;
      if (this._storyNextCardBonus) {
        bonusPower += this._storyNextCardBonus;
        delete this._storyNextCardBonus;
      }
      if (this._storyAllCardsBonus) {
        bonusPower += this._storyAllCardsBonus;
      }
      const card = createCard(templateId, bonusPower);
      if (!card) return null;

      const combatOptions = {
        halfElementBonus: this._storyHalfElement,
        ignoreWeakness: this._storyIgnoreWeakness
      };
      let result = resolveCombat(card, this.currentEnemy, combatOptions);
      if (result === 'draw' && this._storyDrawAsWin) result = 'win';
      this.lastPlayedCards = [card];
      this.lastRoundResults = [result];

      if (result === 'win') {
        this.lastResult = 'win';
        this.log(`${card.name} batte ${this.currentEnemy.name}.`);
        this.state = GAME_STATE.ROUND_RESULT;
      } else if (result === 'lose') {
        this.lastResult = 'lose';
        this.hp--;
        if (this._storyHpPenaltyOnLoss) {
          this.hp -= this._storyHpPenaltyOnLoss;
        }
        this.log(`${card.name} perde contro ${this.currentEnemy.name}.`);
        this.state = GAME_STATE.ROUND_RESULT;
      } else {
        this.lastResult = 'draw';
        this.log(`${card.name} pareggia con ${this.currentEnemy.name}.`);
        this.state = GAME_STATE.ROUND_RESULT;
      }

      return { card, result };
    }

    /**
     * Modalita simultanea: gioca tutte le carte contro tutti i nemici.
     */
    playAllCards(templateIds) {
      if (this.state !== GAME_STATE.PLAYING) return null;
      if (templateIds.length !== this.cardsPerRound) return null;

      this.lastPlayedCards = [];
      this.lastRoundResults = [];
      for (let i = 0; i < this.cardsPerRound; i++) {
        let bonusPower = 0;
        if (i === 0 && this._storyNextCardBonus) {
          bonusPower += this._storyNextCardBonus;
        }
        if (this._storyAllCardsBonus) {
          bonusPower += this._storyAllCardsBonus;
        }
        const card = createCard(templateIds[i], bonusPower);
        const combatOptions = {
          halfElementBonus: this._storyHalfElement,
          ignoreWeakness: this._storyIgnoreWeakness
        };
        let result = resolveCombat(card, this.enemies[i], combatOptions);
        if (result === 'draw' && this._storyDrawAsWin) result = 'win';
        this.lastPlayedCards.push(card);
        this.lastRoundResults.push(result);
      }
      delete this._storyNextCardBonus;

      const wins = this.lastRoundResults.filter(r => r === 'win').length;
      const losses = this.lastRoundResults.filter(r => r === 'lose').length;

      if (wins > losses) {
        this.lastResult = 'win';
        this.log(`Round vinto: ${wins}-${losses}.`);
      } else if (losses > wins) {
        this.lastResult = 'lose';
        this.hp--;
        if (this._storyHpPenaltyOnLoss) {
          this.hp -= this._storyHpPenaltyOnLoss;
        }
        this.log(`Round perso: ${wins}-${losses}.`);
      } else {
        this.lastResult = 'draw';
        this.log(`Pareggio: ${wins}-${losses}.`);
      }

      this.state = GAME_STATE.ROUND_RESULT;
      return { results: this.lastRoundResults, lastResult: this.lastResult };
    }

    playCard(templateId) {
      if (this.playMode === 'simultaneous') {
        // Nella modalita simultanea, playCard gioca una singola carta
        // solo se e l'ultima mancante; altrimenti viene gestito dallo sketch.
        return null;
      }
      return this.playCardSequential(templateId);
    }

    endRound() {
      if (this.state !== GAME_STATE.ROUND_RESULT) return this.state;

      if (this.lastResult === 'win') {
        if (this.round >= this.roundsToWin) {
          this.state = GAME_STATE.VICTORY;
          this.log('Hai completato l\'avventura!');
          return this.state;
        }
        this.spawnEnemies();
      } else if (this.lastResult === 'lose') {
        if (this.hp <= 0) {
          this.state = GAME_STATE.GAME_OVER;
          this.log('L\'avventura si ferma qui, ma puoi riprovare.');
          return this.state;
        }
        // Nemici restano
      } else {
        // Pareggio: nemici restano
      }

      this.resetStoryEffects();
      this.state = GAME_STATE.PLAYING;
      this.log('Si riparte.');
      return this.state;
    }

    handleQR(qrData) {
      const id = String(qrData).trim().toUpperCase();

      if (id === 'RESTART') {
        this.start();
        return { action: 'restart', state: this.state };
      }

      if (id === 'SEQUENZIALE') {
        this.playMode = 'sequential';
        this.resetStoryEffects();
        if (this.state === GAME_STATE.PLAYING) {
          this.regenerateEnemiesForCurrentRound();
        }
        this.log('Modalita\' tranquilla: una carta alla volta.');
        return { action: 'mode', mode: 'sequential', state: this.state };
      }

      if (id === 'SIMULTANEO') {
        this.playMode = 'simultaneous';
        this.resetStoryEffects();
        if (this.state === GAME_STATE.PLAYING) {
          this.regenerateEnemiesForCurrentRound();
        }
        this.log('Modalita\' sfida: piu\' carte nello stesso round.');
        return { action: 'mode', mode: 'simultaneous', state: this.state };
      }

      if (this.state === GAME_STATE.IDLE ||
          this.state === GAME_STATE.GAME_OVER ||
          this.state === GAME_STATE.VICTORY) {
        if (TEMPLATE_MAP[id]) {
          this.start(id);
          return { action: 'start', state: this.state };
        }
        this.log(`Carta non riconosciuta: ${id}.`);
        return { action: 'unknown', state: this.state };
      }

      if (this.state === GAME_STATE.PLAYING) {
        if (this.playMode === 'sequential') {
          const res = this.playCardSequential(id);
          return { action: 'play', ...res, state: this.state };
        }
        return { action: 'card', templateId: id, state: this.state };
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
        playMode: this.playMode,
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
