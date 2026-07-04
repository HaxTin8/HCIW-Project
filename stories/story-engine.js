/**
 * Story Engine per Specula Elementae
 *
 * Legge storie Twine compilate in JSON runtime e le integra nel gioco.
 * 
 * Flusso:
 * 1. Carica l'indice generato stories/generated/index.json
 * 2. All'avvio partita, seleziona la storia in base alla prima carta
 * 3. Carica il file JSON della storia
 * 4. Naviga i passaggi: prologo -> eventi mid-game -> epilogo
 * 5. Applica effetti di gioco (bonus/malus) quando indicati
 * 6. Fornisce testo da leggere via TTS
 */

class StoryEngine {
    constructor() {
      this.index = null;          // stories/index.json
      this.currentStory = null;   // storia attiva
      this.currentPassage = null; // passaggio corrente
      this.passageHistory = [];   // passaggi visitati
      this.pendingTTS = [];       // testo in coda per TTS
      this.loaded = false;
    }

    /**
     * Carica l'indice delle storie
     */
    async loadIndex(url = 'stories/generated/index.json') {
      try {
        const res = await fetch(url);
        this.index = await res.json();
        delete this.index._meta;
        this.loaded = true;
        console.log('[StoryEngine] Indice caricato:', Object.keys(this.index));
        return true;
      } catch (e) {
        console.error('[StoryEngine] Errore caricamento indice:', e);
        return false;
      }
    }

    /**
     * Seleziona e carica una storia in base all'ID carta
     */
    async selectStory(cardId) {
      if (!this.loaded) {
        await this.loadIndex();
      }

      const entry = this.index[cardId];
      if (!entry) {
        console.log('[StoryEngine] Nessuna storia per', cardId);
        this.currentStory = null;
        return false;
      }

      try {
        const res = await fetch(entry.file);
        this.currentStory = await res.json();
        this.currentPassage = this.currentStory.startPassage;
        this.passageHistory = [];
        this.pendingTTS = [];
        console.log('[StoryEngine] Storia caricata:', this.currentStory.title);
        return true;
      } catch (e) {
        console.error('[StoryEngine] Errore caricamento storia:', e);
        return false;
      }
    }

    /**
     * Ottiene il passaggio corrente
     */
    getCurrentPassage() {
      if (!this.currentStory) return null;
      return this.currentStory.passages.find(p => p.name === this.currentPassage);
    }

    /**
     * Naviga a un passaggio specifico
     */
    goToPassage(passageName) {
      if (!this.currentStory) return null;
      const passage = this.currentStory.passages.find(p => p.name === passageName);
      if (passage) {
        this.passageHistory.push(this.currentPassage);
        this.currentPassage = passageName;
      }
      return passage;
    }

    /**
     * Ottiene il testo del prologo (primo passaggio + link)
     */
    getOpeningText() {
      const passage = this.getCurrentPassage();
      if (!passage) return null;
      return passage.text;
    }

    /**
     * Verifica se ci sono passaggi successivi da mostrare
     */
    hasNext() {
      const passage = this.getCurrentPassage();
      if (!passage || !passage.links || passage.links.length === 0) {
        return false;
      }
      return true;
    }

    /**
     * Procede al passaggio successivo (primo link)
     */
    advance() {
      const passage = this.getCurrentPassage();
      if (!passage || !passage.links || passage.links.length === 0) {
        return null;
      }
      return this.goToPassage(passage.links[0].target);
    }

    /**
     * Trova eventi narrativi per un round specifico
     */
    getEventForRound(roundNumber) {
      if (!this.currentStory) return null;
      const event = this.currentStory.passages.find(p => {
        if (!p.tags || !p.tags.includes('mid-story')) return false;
        if (!p.gameEffects || !p.gameEffects.roundSpecific) return false;
        return p.gameEffects.roundSpecific === roundNumber;
      });
      return event;
    }

    /**
     * Ottiene l'epilogo in base al risultato
     */
    getEnding(victory) {
      if (!this.currentStory) return null;
      const tag = victory ? 'victory' : 'defeat';
      return this.currentStory.passages.find(p => 
        p.tags && p.tags.includes('ending') && p.tags.includes(tag)
      );
    }

    /**
     * Applica effetti di gioco dal passaggio corrente
     */
    applyGameEffects(game) {
      const passage = this.getCurrentPassage();
      if (!passage || !passage.gameEffects) return null;

      const effects = passage.gameEffects;
      const log = [];

      // Applica effetti
      if (effects.enemyPowerModifier !== undefined) {
        game._storyEnemyPowerMod = (game._storyEnemyPowerMod || 0) + effects.enemyPowerModifier;
        if (effects.firstRoundOnly) {
          game._storyEnemyPowerModFirstRound = true;
        }
        log.push(`Nemici ${effects.enemyPowerModifier > 0 ? '+' : ''}${effects.enemyPowerModifier} potenza`);
      }

      if (effects.hpBonus) {
        game.hp += effects.hpBonus;
        log.push(`+${effects.hpBonus} HP narrativo`);
      }

      if (effects.nextCardPowerBonus) {
        game._storyNextCardBonus = effects.nextCardPowerBonus;
        log.push(`Prossima carta +${effects.nextCardPowerBonus} potenza`);
      }

      if (effects.allCardsPowerBonus) {
        game._storyAllCardsBonus = effects.allCardsPowerBonus;
        log.push(`Tutte le carte +${effects.allCardsPowerBonus} questo round`);
      }

      if (effects.hpPenaltyOnLoss) {
        game._storyHpPenaltyOnLoss = effects.hpPenaltyOnLoss;
        log.push(`-1 HP extra se perdi questo round`);
      }

      if (effects.drawCountsAsWin) {
        game._storyDrawAsWin = true;
        log.push(`Pareggio = vittoria questo round!`);
      }

      if (effects.halfElementBonus) {
        game._storyHalfElement = true;
        log.push(`Bonus elementale dimezzato per i nemici`);
      }

      if (effects.ignoreWeakness) {
        game._storyIgnoreWeakness = true;
        log.push(`Ignori la tua debolezza elementale questo round!`);
      }

      return log;
    }

    /**
     * Resetta gli effetti di storia per il round successivo
     */
    resetRoundEffects(game) {
      delete game._storyNextCardBonus;
      delete game._storyAllCardsBonus;
      delete game._storyHpPenaltyOnLoss;
      delete game._storyDrawAsWin;
      delete game._storyHalfElement;
      delete game._storyIgnoreWeakness;
    }

    /**
     * Verifica se c'e' una storia attiva
     */
    hasStory() {
      return this.currentStory !== null;
    }

    /**
     * Titolo della storia corrente
     */
    getTitle() {
      return this.currentStory ? this.currentStory.title : null;
    }

    getStoryId() {
      return this.currentStory ? this.currentStory.id : null;
    }

    getPromptKeyForPassage(passageName = null) {
      if (!this.currentStory) return '';
      const resolvedPassage = passageName || this.currentPassage;
      if (!resolvedPassage) return '';
      return `story.${this.currentStory.id}.${resolvedPassage}`;
    }

    /**
     * Resetta tutto
     */
    reset() {
      this.currentStory = null;
      this.currentPassage = null;
      this.passageHistory = [];
      this.pendingTTS = [];
    }
  }

if (typeof window !== 'undefined') {
  window.StoryEngine = StoryEngine;
}

export { StoryEngine };
