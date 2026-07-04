import './app-env.js';
import { CARD_TEMPLATES, ELEMENTS } from './cards.js';

const sheet = document.getElementById('sheet');

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
    <div class="card-desc">${template.description}</div>
    <div class="card-qr">${qrImg}</div>
  `;
  return card;
}

for (let i = 0; i < 2; i++) {
  for (const template of CARD_TEMPLATES) {
    sheet.appendChild(createCardElement(template));
  }
}

const specialCards = [
  { id: 'RESTART', name: 'Restart', emoji: '🔄', desc: 'Ricomincia la partita.', color: '#211a11' },
  { id: 'SEQUENZIALE', name: 'Sequenziale', emoji: '1️⃣', desc: 'Un nemico per round.', color: '#498AE2' },
  { id: 'SIMULTANEO', name: 'Simultaneo', emoji: '3️⃣', desc: 'Tre nemici per round.', color: '#ECBA4E' }
];

for (const special of specialCards) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-name" style="color: ${special.color}">${special.name}</div>
    <div class="card-medallion-wrap">
      <div class="card-medallion circle" style="background-color: ${special.color}1a">${special.emoji}</div>
    </div>
    <div class="card-desc">${special.desc}</div>
    <div class="card-qr">${generateQR(special.id)}</div>
  `;
  sheet.appendChild(card);
}
