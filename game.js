/**
 * Game logic
 * 1 enemy, 1 card for round.
 */

import { CARD_TEMPLATES, TEMPLATE_MAP, createCard, resolveCombat } from './cards.js';

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

    get cardsPerRound() {
      return 1;
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

  /**Sequential mode*/
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

    playCard(templateId) {
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
      } else {
        // draw with the enemies
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
        if (!TEMPLATE_MAP[id]) {
          this.log(`Carta non riconosciuta: ${id}.`);
          return { action: 'unknown', state: this.state };
        }
        const res = this.playCardSequential(id);
        return { action: 'play', ...res, state: this.state };
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

if (typeof window !== 'undefined') {
  Object.assign(window, { Game, GAME_STATE });
}

export { Game, GAME_STATE };
