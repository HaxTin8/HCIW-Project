/**
 * Database dei TEMPLATE di carte.
 * L'"id" e il testo che deve contenere il QR code stampato sulla carta.
 *
 * Per "nascondere" il QR nel design:
 * - usa un QR artistico con logo/immagine al centro
 * - stampa il QR in basso a destra come "sigillo" della carta
 * - usa i colori della carta per i moduli del QR (mantieni buon contrasto)
 */
const ELEMENTS = {
  FIRE: { id: 'FIRE', name: 'Braci', emoji: '🔥', color: '#DD4B50', weakTo: ['WATER', 'LIGHT'], strongVs: ['NATURE', 'SHADOW'] },
  WATER: { id: 'WATER', name: 'Goccia', emoji: '💧', color: '#498AE2', weakTo: ['NATURE', 'SHADOW'], strongVs: ['FIRE', 'THUNDER'] },
  NATURE: { id: 'NATURE', name: 'Germoglio', emoji: '🌿', color: '#97B481', weakTo: ['FIRE', 'THUNDER'], strongVs: ['WATER', 'LIGHT'] },
  LIGHT: { id: 'LIGHT', name: 'Raggio', emoji: '☀️', color: '#ECE64E', weakTo: ['NATURE', 'FIRE'], strongVs: ['SHADOW', 'THUNDER'] },
  SHADOW: { id: 'SHADOW', name: 'Eclissi', emoji: '🌑', color: '#8380BC', weakTo: ['FIRE', 'LIGHT'], strongVs: ['WATER', 'NATURE'] },
  THUNDER: { id: 'THUNDER', name: 'Saetta', emoji: '⚡', color: '#ECBA4E', weakTo: ['WATER', 'LIGHT'], strongVs: ['NATURE', 'SHADOW'] }
};

const CARD_TEMPLATES = [
    { id: 'ROSSO', name: 'Braci', element: 'FIRE', power: 3, animation: 'pulse', description: 'Le Braci scaldano e illuminano. E\' forte contro Germoglio e Eclissi, ma va usato con cura.' },
    { id: 'BLU', name: 'Goccia', element: 'WATER', power: 3, animation: 'waves', description: 'La Goccia aiuta la vita a crescere. E\' forte contro Braci e Saetta.' },
    { id: 'VERDE', name: 'Germoglio', element: 'NATURE', power: 3, animation: 'leaves', description: 'Il Germoglio cresce con pazienza. E\' forte contro Goccia e Raggio.' },
    { id: 'GIALLO', name: 'Raggio', element: 'LIGHT', power: 3, animation: 'sunburst', description: 'Il Raggio mostra la strada. E\' forte contro Eclissi e Saetta.' },
    { id: 'VIOLA', name: 'Eclissi', element: 'SHADOW', power: 3, animation: 'bats', description: 'L\'Eclissi invita a osservare con calma. E\' forte contro Goccia e Germoglio.' },
    { id: 'NERO', name: 'Saetta', element: 'THUNDER', power: 3, animation: 'notes', description: 'La Saetta arriva veloce e potente. E\' forte contro Germoglio e Eclissi.' }
  ];

const TEMPLATE_MAP = Object.fromEntries(CARD_TEMPLATES.map(c => [c.id, c]));
const SPECIAL_IDS = ['RESTART'];

let _uidCounter = 0;

  /**
   * Crea una carta "istanza" a partire da un template.
   */
function createCard(templateId, bonusPower = 0) {
    const template = TEMPLATE_MAP[templateId];
    if (!template) return null;
    const elem = ELEMENTS[template.element];
    _uidCounter++;
    return {
      uid: templateId + '_' + _uidCounter,
      templateId: template.id,
      name: template.name,
      element: template.element,
      power: template.power + bonusPower,
      color: elem.color,
      emoji: elem.emoji,
      animation: template.animation,
      description: template.description
    };
  }

  /**
   * Determina il risultato di uno scontro.
   * Ritorna: 'win', 'lose', 'draw'
   * Opzioni: halfElementBonus (boolean), ignoreWeakness (boolean)
   */
function resolveCombat(playerCard, enemyCard, options = {}) {
    const pElem = ELEMENTS[playerCard.element];
    const eElem = ELEMENTS[enemyCard.element];

    let playerPower = playerCard.power;
    let enemyPower = enemyCard.power;
    const elemBonus = options.halfElementBonus ? 1 : 3;

    if (pElem.strongVs.includes(enemyCard.element)) {
      playerPower += elemBonus;
    } else if (pElem.weakTo.includes(enemyCard.element) && !options.ignoreWeakness) {
      playerPower -= elemBonus;
    }

    if (eElem.strongVs.includes(playerCard.element) && !options.ignoreWeakness) {
      enemyPower += elemBonus;
    } else if (eElem.weakTo.includes(playerCard.element)) {
      enemyPower -= elemBonus;
    }

    if (playerPower > enemyPower) return 'win';
    if (playerPower < enemyPower) return 'lose';
    return 'draw';
  }

  /**
   * Restituisce il moltiplicatore di vantaggio elemento.
   * 1 = vantaggio, -1 = svantaggio, 0 = neutrale
   */
function elementAdvantage(attackerElement, defenderElement) {
    const elem = ELEMENTS[attackerElement];
    if (elem.strongVs.includes(defenderElement)) return 1;
    if (elem.weakTo.includes(defenderElement)) return -1;
    return 0;
  }

if (typeof window !== 'undefined') {
  Object.assign(window, {
    ELEMENTS,
    CARD_TEMPLATES,
    TEMPLATE_MAP,
    SPECIAL_IDS,
    createCard,
    resolveCombat,
    elementAdvantage
  });
}

export {
  ELEMENTS,
  CARD_TEMPLATES,
  TEMPLATE_MAP,
  SPECIAL_IDS,
  createCard,
  resolveCombat,
  elementAdvantage
};
