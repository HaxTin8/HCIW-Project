/**
 * Database dei TEMPLATE di carte.
 * L'"id" e il testo che deve contenere il QR code stampato sulla carta.
 *
 * Per "nascondere" il QR nel design:
 * - usa un QR artistico con logo/immagine al centro
 * - stampa il QR in basso a destra come "sigillo" della carta
 * - usa i colori della carta per i moduli del QR (mantieni buon contrasto)
 */

(function (global) {
  const ELEMENTS = {
    FIRE: { id: 'FIRE', name: 'Fuoco', emoji: '🔥', color: '#b5482f', weakTo: ['WATER', 'LIGHT'], strongVs: ['NATURE', 'SHADOW'] },
    WATER: { id: 'WATER', name: 'Acqua', emoji: '💧', color: '#3d7691', weakTo: ['NATURE', 'SHADOW'], strongVs: ['FIRE', 'THUNDER'] },
    NATURE: { id: 'NATURE', name: 'Natura', emoji: '🌿', color: '#2f8562', weakTo: ['FIRE', 'THUNDER'], strongVs: ['WATER', 'LIGHT'] },
    LIGHT: { id: 'LIGHT', name: 'Luce', emoji: '☀️', color: '#d8b25a', weakTo: ['NATURE', 'FIRE'], strongVs: ['SHADOW', 'THUNDER'] },
    SHADOW: { id: 'SHADOW', name: 'Ombra', emoji: '🌑', color: '#6a5a8f', weakTo: ['FIRE', 'LIGHT'], strongVs: ['WATER', 'NATURE'] },
    THUNDER: { id: 'THUNDER', name: 'Tuono', emoji: '⚡', color: '#c2892c', weakTo: ['WATER', 'LIGHT'], strongVs: ['NATURE', 'SHADOW'] }
  };

  const CARD_TEMPLATES = [
    { id: 'ROSSO', name: 'Braci', element: 'FIRE', power: 3, animation: 'pulse', description: 'Fuoco base, utile contro Natura e Ombra.' },
    { id: 'BLU', name: 'Goccia', element: 'WATER', power: 3, animation: 'waves', description: 'Acqua base, utile contro Fuoco e Tuono.' },
    { id: 'VERDE', name: 'Germoglio', element: 'NATURE', power: 3, animation: 'leaves', description: 'Natura base, utile contro Acqua e Luce.' },
    { id: 'GIALLO', name: 'Raggio', element: 'LIGHT', power: 3, animation: 'sunburst', description: 'Luce base, utile contro Ombra e Tuono.' },
    { id: 'VIOLA', name: 'Eclissi', element: 'SHADOW', power: 3, animation: 'bats', description: 'Ombra base, utile contro Acqua e Natura.' },
    { id: 'NERO', name: 'Saetta', element: 'THUNDER', power: 3, animation: 'notes', description: 'Tuono base, utile contro Natura e Ombra.' }
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
   */
  function resolveCombat(playerCard, enemyCard) {
    const pElem = ELEMENTS[playerCard.element];
    const eElem = ELEMENTS[enemyCard.element];

    let playerPower = playerCard.power;
    let enemyPower = enemyCard.power;

    if (pElem.strongVs.includes(enemyCard.element)) {
      playerPower += 3;
    } else if (pElem.weakTo.includes(enemyCard.element)) {
      playerPower -= 3;
    }

    if (eElem.strongVs.includes(playerCard.element)) {
      enemyPower += 3;
    } else if (eElem.weakTo.includes(playerCard.element)) {
      enemyPower -= 3;
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

  global.ELEMENTS = ELEMENTS;
  global.CARD_TEMPLATES = CARD_TEMPLATES;
  global.TEMPLATE_MAP = TEMPLATE_MAP;
  global.SPECIAL_IDS = SPECIAL_IDS;
  global.createCard = createCard;
  global.resolveCombat = resolveCombat;
  global.elementAdvantage = elementAdvantage;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      ELEMENTS,
      CARD_TEMPLATES,
      TEMPLATE_MAP,
      SPECIAL_IDS,
      createCard,
      resolveCombat,
      elementAdvantage
    };
  }
})(typeof window !== 'undefined' ? window : global);
