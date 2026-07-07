import './app-env.js';
import { CARD_TEMPLATES, ELEMENTS, getLocalizedElementName, getLocalizedTemplateName } from './cards.js';
import { getLocale, getLocaleOptions, localizeDocument, onLocaleChange, setLocale, t } from './i18n.js';

const sheet = document.getElementById('sheet');
const localeSelect = document.getElementById('print-locale-select');
const introEl = document.getElementById('print-intro');
const printBtn = document.getElementById('print-btn');

function beatsDescription(elementId) {
  const elem = ELEMENTS[elementId];
  const icons = elem.strongVs.map((id) => {
    const name = id.toLowerCase();
    const localizedName = getLocalizedElementName(id);
    return `<img class="vs-icon" src="assets/elements/${name}.png" alt="${localizedName}" title="${localizedName}">`;
  });
  const verb = elementId === 'FIRE' ? t('printPage.beatsPlural') : t('printPage.beatsSingle');
  return `<span>${getLocalizedElementName(elementId)} ${verb}</span> ${icons[0]} <span>e</span> ${icons[1]}`;
}

function elementIcon(elementId) {
  const name = elementId.toLowerCase();
  return `<img src="assets/elements/${name}.png" alt="${elementId}" style="width: 100%; height: 100%; object-fit: contain;">`;
}

function generateQR(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const moduleCount = qr.getModuleCount();
  const cellSize = 4;
  const size = moduleCount * cellSize;
  let rects = '';

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!qr.isDark(row, col)) continue;
      rects += `<rect x="${col * cellSize}" y="${row * cellSize}" width="${cellSize}" height="${cellSize}" fill="#111111"/>`;
    }
  }

  return `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-label="QR code ${text}" role="img" xmlns="http://www.w3.org/2000/svg">
      ${rects}
    </svg>
  `;
}

function createCardElement(template) {
  const card = document.createElement('div');
  card.className = 'card';

  const elem = ELEMENTS[template.element];
  const qrImg = generateQR(template.id);

  card.innerHTML = `
    <div class="card-name" style="color: ${elem.color}">${getLocalizedTemplateName(template.id)}</div>
    <div class="card-medallion-wrap">
      <div class="card-medallion">${elementIcon(template.element)}</div>
    </div>
    <div class="card-desc">${beatsDescription(template.element)}</div>
    <div class="card-qr">${qrImg}</div>
  `;
  return card;
}

function createSpecialCardElement() {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-name" style="color: #1C0A0A">${t('printPage.restartName')}</div>
    <div class="card-medallion-wrap">
      <div class="card-medallion circle"><img src="assets/elements/restart.png" alt="${t('printPage.restartName')}" style="width: 80%; height: 80%; object-fit: contain;"></div>
    </div>
    <div class="card-desc">${t('printPage.restartDescription')}</div>
    <div class="card-qr">${generateQR('RESTART')}</div>
  `;
  return card;
}

function renderIntro() {
  if (!introEl) return;
  introEl.innerHTML = t('printPage.intro', { app: '<span data-app-name>Specula Elementae</span>' });
}

function renderSheet() {
  sheet.innerHTML = '';
  for (const template of CARD_TEMPLATES) {
    sheet.appendChild(createCardElement(template));
  }
  sheet.appendChild(createSpecialCardElement());
}

function setupLocaleControls() {
  if (!localeSelect) return;
  localeSelect.innerHTML = getLocaleOptions()
    .map((option) => `<option value="${option.value}">${option.label}</option>`)
    .join('');
  localeSelect.value = getLocale();
  if (localeSelect.dataset.bound === 'true') return;
  localeSelect.addEventListener('change', () => {
    setLocale(localeSelect.value);
  });
  localeSelect.dataset.bound = 'true';
}

function renderPage() {
  localizeDocument();
  setupLocaleControls();
  renderIntro();
  renderSheet();
}

if (printBtn) {
  printBtn.addEventListener('click', () => window.print());
}

onLocaleChange(() => {
  renderPage();
});

renderPage();
