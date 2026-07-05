/**
 * Database of card templates.
 * The "id" is the text to be encoded in the QR code printed on the card.
 *
 * To "hide" the QR code within the design:
 * - use an artistic QR code with a logo or image in the center
 * - print the QR code in the bottom-right corner as a card "seal"
 * - use the card's color scheme for the QR code modules (while maintaining good contrast)
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
  { id: 'ROSSO', name: 'Braci', element: 'FIRE', power: 3, animation: 'pulse', description: 'Le Braci scaldano e danno luce, ma vanno usate con attenzione.' },
  { id: 'BLU', name: 'Goccia', element: 'WATER', power: 3,  animation: 'waves', description: 'La Goccia aiuta le piante a crescere, ma va usata con calma.' },
  { id: 'VERDE', name: 'Germoglio', element: 'NATURE', power: 3,  animation: 'leaves', description: 'Il Germoglio cresce forte, ma solo con tanta pazienza.' },
  { id: 'GIALLO', name: 'Raggio', element: 'LIGHT', power: 3,  animation: 'sunburst', description: 'Il Raggio illumina la strada, ma acceca chi lo guarda troppo da vicino ' },
  { id: 'VIOLA', name: 'Eclissi', element: 'SHADOW', power: 3, animation: 'bats', description: 'L\'Eclissi ti fa fermare e osservare, ma chi resta troppo nell\'ombra rischia di perdersi."' },
  { id: 'NERO', name: 'Saetta', element: 'THUNDER', power: 3,  animation: 'notes', description: 'La Saetta arriva veloce e forte, ma chi la usa senza pensare rischia di perdere il controllo. ' }
];
const TEMPLATE_MAP = Object.fromEntries(CARD_TEMPLATES.map(c => [c.id, c]));
const SPECIAL_IDS = ['RESTART'];

let _uidCounter = 0;

//Create instances from template
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

  //Return win, lose, draw
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

//moltiplicators
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
