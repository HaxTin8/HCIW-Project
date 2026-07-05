import './app-env.js';
import { CARD_TEMPLATES, ELEMENTS } from './cards.js';

const sheet = document.getElementById('sheet');

function beatsDescription(elementId) {
  const elem = ELEMENTS[elementId];
  const icons = elem.strongVs.map((id) => {
    const name = id.toLowerCase();
    return `<img class="vs-icon" src="assets/elements/${name}.png" alt="${ELEMENTS[id].name}" title="${ELEMENTS[id].name}">`;
  });
  return `<span>${elem.name} batte</span> ${icons[0]} <span>e</span> ${icons[1]}`;
}

function elementIcon(elementId) {
  const name = elementId.toLowerCase();
  return `<img src="assets/elements/${name}.png" alt="${elementId}" style="width: 100%; height: 100%; object-fit: contain;">`;
}

function generateQR(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createImgTag(4);
}

function createCardElement(template) {
  const card = document.createElement('div');
  card.className = 'card';

  const elem = ELEMENTS[template.element];
  const qrImg = generateQR(template.id);

  card.innerHTML = `
    <div class="card-name" style="color: ${elem.color}">${template.name}</div>
    <div class="card-medallion-wrap">
      <div class="card-medallion" style="background-color: ${elem.color}1a">${elementIcon(template.element)}</div>
    </div>
    <div class="card-desc">${beatsDescription(template.element)}</div>
    <div class="card-qr">${qrImg}</div>
  `;
  return card;
}

for (const template of CARD_TEMPLATES) {
  sheet.appendChild(createCardElement(template));
}

const specialCards = [
  { id: 'RESTART', name: 'Ricomincia', emoji: '🔄', desc: 'Ricomincia la partita.', color: '#1C0A0A' }
];

for (const special of specialCards) {
  const card = document.createElement('div');
  card.className = 'card';
  let medallionContent = special.emoji;

  if (special.id === 'RESTART') {
    medallionContent = '<img src="assets/elements/restart.png" alt="Ricomincia" style="width: 80%; height: 80%; object-fit: contain;">';
  }

  card.innerHTML = `
    <div class="card-name" style="color: ${special.color}">${special.name}</div>
    <div class="card-medallion-wrap">
      <div class="card-medallion circle" style="background-color: ${special.color}1a">${medallionContent}</div>
    </div>
    <div class="card-desc">${special.desc}</div>
    <div class="card-qr">${generateQR(special.id)}</div>
  `;
  sheet.appendChild(card);
}
