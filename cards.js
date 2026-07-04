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
    FIRE: { id: 'FIRE', name: 'Fuoco', emoji: '🔥', color: '#e63946', weakTo: ['WATER', 'LIGHT'], strongVs: ['NATURE', 'SHADOW'] },
    WATER: { id: 'WATER', name: 'Acqua', emoji: '💧', color: '#457b9d', weakTo: ['NATURE', 'SHADOW'], strongVs: ['FIRE', 'THUNDER'] },
    NATURE: { id: 'NATURE', name: 'Natura', emoji: '🌿', color: '#2a9d8f', weakTo: ['FIRE', 'THUNDER'], strongVs: ['WATER', 'LIGHT'] },
    LIGHT: { id: 'LIGHT', name: 'Luce', emoji: '☀️', color: '#e9c46a', weakTo: ['NATURE', 'FIRE'], strongVs: ['SHADOW', 'THUNDER'] },
    SHADOW: { id: 'SHADOW', name: 'Ombra', emoji: '🌑', color: '#6c5ce7', weakTo: ['FIRE', 'LIGHT'], strongVs: ['WATER', 'NATURE'] },
    THUNDER: { id: 'THUNDER', name: 'Tuono', emoji: '⚡', color: '#f1c40f', weakTo: ['WATER', 'LIGHT'], strongVs: ['NATURE', 'SHADOW'] }
  };

const CARD_TEMPLATES = [
    { id: 'ROSSO', name: 'Braci', element: 'FIRE', power: 3, animation: 'pulse', description: 'Il fuoco scalda e illumina. E\' forte contro Natura e Ombra, ma va usato con cura.' },
    { id: 'BLU', name: 'Goccia', element: 'WATER', power: 3, animation: 'waves', description: 'L\'acqua aiuta la vita a crescere. E\' forte contro Fuoco e Tuono.' },
    { id: 'VERDE', name: 'Germoglio', element: 'NATURE', power: 3, animation: 'leaves', description: 'La natura cresce con pazienza. E\' forte contro Acqua e Luce.' },
    { id: 'GIALLO', name: 'Raggio', element: 'LIGHT', power: 3, animation: 'sunburst', description: 'La luce mostra la strada. E\' forte contro Ombra e Tuono.' },
    { id: 'VIOLA', name: 'Eclissi', element: 'SHADOW', power: 3, animation: 'bats', description: 'L\'ombra invita a osservare con calma. E\' forte contro Acqua e Natura.' },
    { id: 'NERO', name: 'Saetta', element: 'THUNDER', power: 3, animation: 'notes', description: 'Il tuono arriva veloce e potente. E\' forte contro Natura e Ombra.' }
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
