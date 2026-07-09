import { t } from './i18n.js';

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
  FIRE: { id: 'FIRE', emoji: '🔥', color: '#DD4B50', weakTo: ['WATER', 'LIGHT'], strongVs: ['NATURE', 'SHADOW'] },
  WATER: { id: 'WATER', emoji: '💧', color: '#498AE2', weakTo: ['NATURE', 'SHADOW'], strongVs: ['FIRE', 'THUNDER'] },
  NATURE: { id: 'NATURE', emoji: '🌿', color: '#97B481', weakTo: ['FIRE', 'THUNDER'], strongVs: ['WATER', 'LIGHT'] },
  LIGHT: { id: 'LIGHT', emoji: '☀️', color: '#ECE64E', weakTo: ['NATURE', 'FIRE'], strongVs: ['SHADOW', 'THUNDER'] },
  SHADOW: { id: 'SHADOW', emoji: '🌑', color: '#8380BC', weakTo: ['FIRE', 'LIGHT'], strongVs: ['WATER', 'NATURE'] },
  THUNDER: { id: 'THUNDER', emoji: '⚡', color: '#ECBA4E', weakTo: ['WATER', 'LIGHT'], strongVs: ['NATURE', 'SHADOW'] }
};

const CARD_TEMPLATES = [
  { id: 'ROSSO', element: 'FIRE', power: 3, animation: 'pulse' },
  { id: 'BLU', element: 'WATER', power: 3,  animation: 'waves' },
  { id: 'VERDE', element: 'NATURE', power: 3,  animation: 'leaves' },
  { id: 'GIALLO', element: 'LIGHT', power: 3,  animation: 'sunburst' },
  { id: 'VIOLA', element: 'SHADOW', power: 3, animation: 'bats' },
  { id: 'NERO', element: 'THUNDER', power: 3,  animation: 'notes' }
];
const TEMPLATE_MAP = Object.fromEntries(CARD_TEMPLATES.map(c => [c.id, c]));
const SPECIAL_IDS = ['RESTART'];

function getLocalizedElementName(elementId, locale = undefined) {
  return t(`cards.elements.${elementId}.name`, {}, locale);
}

function getLocalizedTemplateName(templateId, locale = undefined) {
  return t(`cards.templates.${templateId}.name`, {}, locale);
}

function getLocalizedTemplateDescription(templateId, locale = undefined) {
  return t(`cards.templates.${templateId}.description`, {}, locale);
}

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
      name: getLocalizedTemplateName(template.id),
      element: template.element,
      power: template.power + bonusPower,
      color: elem.color,
      emoji: elem.emoji,
      animation: template.animation,
      description: getLocalizedTemplateDescription(template.id)
    };
  }

  //Return win, lose, draw
function resolveCombat(playerCard, enemyCard, options = {}) {
    const pElem = ELEMENTS[playerCard.element];
    const eElem = ELEMENTS[enemyCard.element];

    let playerPower = playerCard.power;
    let enemyPower = enemyCard.power;
    const playerElemBonus = 3;
    const enemyElemBonus = options.halfElementBonus ? 1 : 3;

    if (pElem.strongVs.includes(enemyCard.element)) {
      playerPower += playerElemBonus;
    } else if (pElem.weakTo.includes(enemyCard.element) && !options.ignoreWeakness) {
      playerPower -= playerElemBonus;
    }

    if (eElem.strongVs.includes(playerCard.element) && !options.ignoreWeakness) {
      enemyPower += enemyElemBonus;
    } else if (eElem.weakTo.includes(playerCard.element)) {
      enemyPower -= enemyElemBonus;
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
    getLocalizedElementName,
    getLocalizedTemplateName,
    getLocalizedTemplateDescription,
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
  getLocalizedElementName,
  getLocalizedTemplateName,
  getLocalizedTemplateDescription,
  createCard,
  resolveCombat,
  elementAdvantage
};
