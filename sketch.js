/* =========================================================
   SPECULA ELEMENTAE — frontend p5.js, input solo da webcam QR
   Versione no-WIMP: il giocatore gestisce fisicamente le carte.
   ========================================================= */

var video;
var hiddenCanvas;
var qrEnabled = true;
var statusEl;
var game;

var resultTimer = 0;
var idleHintTimer = 0;

var particles = [];
var floaters = [];
var lastPlayedCard = null;
var animProgress = 0;
var enemyShake = 0;
var screenFlash = 0;

var webcamState = 'loading';
var webcamMessage = 'Avvio webcam in corso...';
var statusMessage = 'Mostra una carta alla webcam per iniziare.';
var magicFont;

// Responsivity variables
var scaleFactor = 1;
var isCompact = false;

// Element and heart assets
var elementImages = {};
var heartImage;

// Illustrazione hero (schermata idle): livelli composti a sinistra
// del canvas, che appaiono dal basso con dissolvenza in sequenza.
var heroImages = {};
var heroIntroStart = 0;
const HERO_APPEAR = ['fire', 'water', 'river', 'towers', 'mountains']; // ordine di apparizione
const HERO_ZORDER = ['mountains', 'towers', 'river', 'water', 'fire']; // ordine di disegno (dietro -> davanti)
// Impilamento verticale: fiume al centro, torri subito sopra il fiume,
// montagne in cima dietro le torri.
const HERO_LAYOUT = {
  mountains: { x: 90,  y: 20,  w: 280 },
  towers:    { x: 0,   y: 85,  w: 265 },
  river:     { x: 25,  y: 200, w: 295 },
  water:     { x: -45, y: 250, w: 305 },
  fire:      { x: 115, y: 290, w: 285 }
};

// Slot fisici virtuali: il giocatore carica una carta per slot.
// In sequenziale c'e 1 slot; in simultaneo ci sono N slot.
var playerSlots = [];
var slotFrames = [];     // frame con la stessa carta in ogni slot
var slotEmptyFrames = 0; // frame senza QR rilevato
var slotLocked = false;
var slotsFilled = 0;
const SLOT_EMPTY_THRESHOLD = 8;      // frame senza QR prima di giocare la carta rimossa
const SLOT_AUTOPLAY_THRESHOLD = 120; // frame con la stessa carta ferma -> gioca automaticamente

// Animazione multi-slot
var multiSlotAnim = [];  // { card, targetEnemyIndex, progress }
var waitingForTTS = false;

function preload() {
  magicFont = loadFont('fonts/magic-school.ttf');
  heroImages.fire = loadImage('assets/hero/fire.png');
  heroImages.water = loadImage('assets/hero/water.png');
  heroImages.river = loadImage('assets/hero/river.png');
  heroImages.towers = loadImage('assets/hero/towers.png');
  heroImages.mountains = loadImage('assets/hero/mountains.png');

  // Caricamento nuove icone degli elementi e della vita
  elementImages.FIRE = loadImage('assets/elements/fire.png');
  elementImages.WATER = loadImage('assets/elements/water.png');
  elementImages.NATURE = loadImage('assets/elements/nature.png');
  elementImages.LIGHT = loadImage('assets/elements/light.png');
  elementImages.SHADOW = loadImage('assets/elements/shadow.png');
  elementImages.THUNDER = loadImage('assets/elements/thunder.png');
  heartImage = loadImage('assets/elements/heart-life.png');
}

// Rende trasparente lo sfondo uniforme dell'immagine (chroma-key sul
// colore campionato nell'angolo in alto a sinistra), con bordo sfumato.
function makeBgTransparent(img) {
  img.loadPixels();
  const d = img.pixels;
  if (d.length === 0 || d[3] === 0) return; // sfondo già trasparente

  const r0 = d[0], g0 = d[1], b0 = d[2];
  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - r0, dg = d[i + 1] - g0, db = d[i + 2] - b0;
    const distC = Math.sqrt(dr * dr + dg * dg + db * db);
    if (distC < 14) {
      d[i + 3] = 0;
    } else if (distC < 26) {
      d[i + 3] = Math.round(((distC - 14) / 12) * 255);
    }
  }
  img.updatePixels();
}

function updateCanvasDimensions() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  let w = container.clientWidth;
  let h = container.clientHeight;

  if (w <= 0) {
    w = windowWidth < 720 ? windowWidth - 40 : 900;
  }
  if (h <= 0) {
    h = windowHeight < 600 ? windowHeight - 160 : 600;
  }

  isCompact = w < 720;

  if (!isCompact) {
    scaleFactor = min(w / 900, h / 600);
  } else {
    scaleFactor = min(w / 380, h / 520);
  }

  resizeCanvas(w, h);
}

function setup() {
  const container = select('#canvas-container');
  const canvas = createCanvas(100, 100);
  canvas.parent(container);

  updateCanvasDimensions();

  hiddenCanvas = createGraphics(320, 240);
  hiddenCanvas.pixelDensity(1);

  for (const key of Object.keys(heroImages)) {
    heroImages[key].resize(620, 0);
    makeBgTransparent(heroImages[key]);
  }

  statusEl = select('#status');
  game = new Game();

  textFont('Space Grotesk');

  setupWebcam();
  logToStatus('Mostra una carta alla webcam per iniziare.');
}

function windowResized() {
  updateCanvasDimensions();
}

function sx(v){
  return v * scaleFactor;
}

function sy(v){
  return v * scaleFactor;
}

function setupWebcam() {
  console.log('[Webcam] setupWebcam avviato');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    webcamState = 'unsupported';
    webcamMessage = 'Questo browser non supporta la webcam. Prova Chrome, Edge o Firefox.';
    console.error('[Webcam]', webcamMessage);
    logToStatus(webcamMessage);
    return;
  }

  webcamState = 'loading';
  webcamMessage = 'Richiesta accesso webcam...';

  // Constraints di base: nessun facingMode (su Windows spesso problematico),
  // risoluzione standard e framerate stabile.
  const constraints = {
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30 }
    },
    audio: false
  };

  tryCreateCapture(constraints, 1);
}

function tryCreateCapture(constraints, attempt) {
  console.log(`[Webcam] Tentativo ${attempt}`, constraints);

  if (video) {
    try {
      video.stop();
    } catch (e) {
      console.warn('[Webcam] Errore stop video precedente:', e);
    }
    video = null;
  }

  try {
    video = createCapture(constraints, (stream) => {
      console.log('[Webcam] createCapture callback:', stream ? 'stream ricevuto' : 'no stream');
      if (video) {
        video.size(320, 240);
        video.hide();
        if (video.elt) {
          video.elt.setAttribute('playsinline', '');
          video.elt.setAttribute('muted', '');
          video.elt.play().catch(e => console.warn('[Webcam] Autoplay bloccato:', e));
        }
      }
    });
  } catch (e) {
    console.error('[Webcam] Errore createCapture:', e);
    tryFallbackDevice(attempt + 1);
    return;
  }

  // Timeout per verificare se il video è effettivamente attivo
  setTimeout(() => {
    if (webcamState === 'active') return;

    if (video && video.width > 0 && video.height > 0) {
      console.log('[Webcam] Video attivo, dimensioni:', video.width, video.height);
      webcamState = 'active';
      webcamMessage = 'Webcam attiva.';
      logToStatus('Webcam attiva. Mostra una carta per iniziare.');
      return;
    }

    console.warn(`[Webcam] Video nero o non attivo al tentativo ${attempt}`);
    if (attempt < 3) {
      webcamMessage = `Tentativo webcam ${attempt + 1}/3...`;
      tryFallbackDevice(attempt + 1);
    } else {
      webcamState = 'error';
      webcamMessage = 'Impossibile attivare la webcam. Prova a cambiare dispositivo nelle impostazioni del browser.';
      logToStatus(webcamMessage);
    }
  }, 2500);
}

function tryFallbackDevice(attempt) {
  navigator.mediaDevices.enumerateDevices()
    .then(devices => {
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      console.log('[Webcam] Dispositivi trovati:', videoDevices.map(d => d.label || 'senza nome'));

      if (videoDevices.length === 0) {
        webcamState = 'error';
        webcamMessage = 'Nessuna webcam trovata. Collegane una e ricarica.';
        logToStatus(webcamMessage);
        return;
      }

      if (attempt <= videoDevices.length) {
        // Prova i dispositivi in ordine inverso: su Windows la webcam fisica
        // è spesso l'ultima, mentre le prime possono essere virtuali.
        const index = videoDevices.length - attempt;
        const deviceId = videoDevices[index].deviceId;
        console.log(`[Webcam] Provo dispositivo ${index}:`, videoDevices[index].label || 'senza nome');

        const constraints = {
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 }
          },
          audio: false
        };
        tryCreateCapture(constraints, attempt);
      } else {
        webcamState = 'error';
        webcamMessage = 'Nessuna webcam funzionante trovata.';
        logToStatus(webcamMessage);
      }
    })
    .catch(err => {
      console.error('[Webcam] enumerateDevices error:', err);
      webcamState = 'error';
      webcamMessage = 'Errore nell\'elenco delle webcam.';
      logToStatus(webcamMessage);
    });
}

function draw() {
  drawCanvasBackground();
  textFont('Space Grotesk');
  waitingForTTS = tts.isSpeaking();

  if (screenFlash > 0) {
    noStroke();
    fill(screenFlash.color[0], screenFlash.color[1], screenFlash.color[2], screenFlash.alpha);
    rect(0, 0, width, height);
    screenFlash.alpha -= 8;
    if (screenFlash.alpha <= 0) screenFlash = 0;
  }

  updateParticles();
  drawParticles();
  updateFloaters();
  drawFloaters();

  switch (game.state) {
    case GAME_STATE.IDLE:
      drawIdle();
      break;
    case GAME_STATE.PLAYING:
      drawPlaying();
      break;
    case GAME_STATE.ROUND_RESULT:
      drawRoundResult();
      break;
    case GAME_STATE.GAME_OVER:
      drawEndScreen('GAME OVER', '#DD4B50', 'Mostra una carta per ricominciare.');
      break;
    case GAME_STATE.VICTORY:
      drawEndScreen('VITTORIA!', '#ECBA4E', 'Mostra una carta per una nuova run.');
      break;
  }
}

/* =========================================================
   SCHERMATE
   ========================================================= */

function drawIdle() {
  drawHeroArt();
  drawWebcamPreview();
  drawWebcamOverlay();
  drawHelpPanel();

  if (isCompact) {
    // Layout a colonna singola centratissimo per mobile
    const tx = sx(20);
    const tw = width - sx(40);

    fill('#2b2318');
    textAlign(CENTER, TOP);
    textFont(magicFont);
    textSize(36 * scaleFactor);
    text('Specula Elementae', width / 2, sy(30));
    textFont('Space Grotesk');

    textSize(14 * scaleFactor);
    fill('#5a4a34');
    textFont('Hanken Grotesk');
    text('Solitario a carte con riconoscimento QR.', tx, sy(80), tw);

    if (webcamState === 'active') {
      const t = millis() / 1000;
      const pulse = sin(t * 3) * sx(4);
      fill('#b0842f');
      textSize(14 * scaleFactor);
      text('📷 Mostra una carta alla webcam per iniziare', tx, sy(130) + pulse, tw);
    }
    textFont('Space Grotesk');

    drawQrToggleButton();

    // Mostra il messaggio di stato sotto il preview webcam su mobile
    fill('#2b2318');
    textAlign(CENTER, TOP);
    textSize(11 * scaleFactor);
    textFont('Hanken Grotesk');
    text(statusMessage, tx, height - sy(55), tw);
    textFont('Space Grotesk');
  } else {
    // Layout standard a 3 colonne per desktop
    const tx = sx(460);
    const tw = sx(250);

    fill('#2b2318');
    textAlign(CENTER, TOP);
    textFont(magicFont);
    textSize(40 * scaleFactor);
    text('Specula Elementae', tx, sy(120), tw);
    textFont('Space Grotesk');

    textSize(15 * scaleFactor);
    fill('#5a4a34');
    textFont('Hanken Grotesk');
    text('Solitario a carte con riconoscimento QR.', tx, sy(235), tw);

    if (webcamState === 'active') {
      const t = millis() / 1000;
      const pulse = sin(t * 3) * sx(4);
      fill('#b0842f');
      textSize(16 * scaleFactor);
      text('📷 Mostra una carta alla webcam per iniziare', tx, sy(300) + pulse, tw);
    }
    textFont('Space Grotesk');

    drawQrToggleButton();
  }

  idleHintTimer++;

  if (qrEnabled && webcamState === 'active' && video && video.width > 0 && frameCount % 10 === 0) {
    readQR();
  }
}

// Compone i livelli dell'illustrazione a sinistra del canvas; ogni
// livello appare in sequenza salendo dal basso con dissolvenza.
function drawHeroArt() {
  if (heroIntroStart === 0) heroIntroStart = millis();

  push();
  // Centratura orizzontale dinamica per mobile, spostando l'offset x
  const xOffset = isCompact ? (width / 2 - sx(130)) : 0;
  const yOffset = isCompact ? (height - sy(420)) : 0;
  const opacityMultiplier = isCompact ? 0.25 : 1.0; // Sfondo soft su mobile

  for (const key of HERO_ZORDER) {
    const img = heroImages[key];
    if (!img || img.width === 0) continue;

    const idx = HERO_APPEAR.indexOf(key);
    const p = constrain((millis() - heroIntroStart - idx * 550) / 900, 0, 1);
    if (p <= 0) continue;

    const e = easeOutCubic(p);
    const L = HERO_LAYOUT[key];
    tint(255, 255 * e * opacityMultiplier);
    image(
        img,
        sx(L.x) + xOffset,
        sy(L.y) + yOffset + sy((1 - e) * 70),
        sx(L.w),
        sx(L.w)
    );
  }
  pop();
}

function drawPlaying() {
  drawHUD();
  drawEnemies();
  drawSlots();
  drawWebcamPreview();
  drawWebcamOverlay();
  drawHelpPanel();
  drawLog();

  // Testo di stato principale sempre centrato a mezza altezza su mobile
  if (isCompact) {
    fill('#2b2318');
    textAlign(CENTER, CENTER);
    textSize(13 * scaleFactor);
    textFont('Hanken Grotesk');
    text(statusMessage, sx(20), sy(300), width - sx(40));
    textFont('Space Grotesk');
  }

  if (!waitingForTTS && qrEnabled && webcamState === 'active' && video && video.width > 0 && frameCount % 10 === 0) {
    readQR();
  }

  if (!waitingForTTS) {
    updateSlots();
  }
  updateMultiSlotAnim();

  if (waitingForTTS) {
    drawTTSPause();
  }
}

function drawRoundResult() {
  drawPlaying();

  // Animazione sequenziale della carta verso il nemico
  if (lastPlayedCard && game.playMode === 'sequential') {
    animProgress += 0.04;
    const cx = lerp(width / 2, width / 2, animProgress);
    const cy = lerp(height - sy(50), sy(120), easeOutCubic(animProgress));

    push();
    translate(cx, cy);
    rotate(animProgress * TWO_PI);
    drawCardFrame(0, 0, sx(90), sy(130), lastPlayedCard.color, lastPlayedCard.emoji, lastPlayedCard.name, lastPlayedCard.power, lastPlayedCard.element);
    pop();

    if (animProgress >= 0.8 && animProgress < 1.0) {
      enemyShake = 12;
      spawnParticles(width / 2, sy(120), lastPlayedCard.color, 30);
    }
  }

  if (enemyShake > 0) enemyShake *= 0.85;
  if (enemyShake < 0.5) enemyShake = 0;

  fill(16, 11, 6, 180);
  noStroke();
  rect(0, 0, width, height);

  textAlign(CENTER, CENTER);
  textSize(56 * scaleFactor);
  textStyle(BOLD);

  if (game.lastResult === 'win') {
    fill('#8fe0b3');
    text('ROUND VINTO!', width / 2, height / 2 - sy(30));
  } else if (game.lastResult === 'lose') {
    fill('#f0a394');
    text('ROUND PERSO', width / 2, height / 2 - sy(30));
  } else {
    fill('#e8ce8f');
    text('PAREGGIO', width / 2, height / 2 - sy(30));
  }

  textStyle(NORMAL);
  textFont('Hanken Grotesk');
  textSize(18 * scaleFactor);
  fill('#e9dcc0');
  text(game.lastResult === 'win' ? 'Prendi i nemici.' : game.lastResult === 'lose' ? '-1 HP.' : 'Nessun vantaggio.', width / 2, height / 2 + sy(30));
  textFont('Space Grotesk');

  resultTimer++;
  if (resultTimer > 90 && !tts.isSpeaking()) {
    resultTimer = 0;
    lastPlayedCard = null;
    animProgress = 0;
    multiSlotAnim = [];
    slotLocked = false;
    const oldRound = game.round;
    game.endRound();
    const newMsg = game.logs[game.logs.length - 1];
    logToStatus(newMsg);

    if (game.state === GAME_STATE.PLAYING && game.currentEnemy) {
      resetSlots();
      if (game.round !== oldRound) {
        tts.speak(`${game.currentEnemy.name}.`);
      }
    }
  }
}

function drawEndScreen(title, color, subtitle) {
  drawWebcamPreview();
  drawWebcamOverlay();
  drawHelpPanel();

  textAlign(CENTER, CENTER);
  textSize(56 * scaleFactor);
  textStyle(BOLD);
  fill(color);
  text(title, width / 2, height / 2 - sy(40));

  textStyle(NORMAL);
  textFont('Hanken Grotesk');
  textSize(18 * scaleFactor);
  fill('#5a4a34');
  const finalSubtitle = webcamState === 'active' ? subtitle : webcamMessage;
  text(finalSubtitle, width / 2, height / 2 + sy(30));
  textFont('Space Grotesk');

  if (qrEnabled && webcamState === 'active' && video && video.width > 0 && frameCount % 10 === 0) {
    readQR();
  }
}

/* =========================================================
    GRAFICA DI SUPPORTO
   ========================================================= */

function drawHUD() {
  fill('#2b2318');
  textAlign(LEFT, TOP);
  textSize(18 * scaleFactor);
  textStyle(BOLD);

  // Disegna l'icona del cuore se disponibile, altrimenti fai il fallback al testo emoji
  if (heartImage && heartImage.width > 0) {
    text('HP: ', sx(20), sy(20));
    const hpLabelWidth = textWidth('HP: ');
    const heartSize = sx(20);
    const heartY = sy(20) - sy(1);
    for (let i = 0; i < max(game.hp, 0); i++) {
      const heartX = sx(20) + hpLabelWidth + i * (heartSize + sx(4));
      image(heartImage, heartX, heartY, heartSize, heartSize);
    }
  } else {
    text(`HP: ${'❤️'.repeat(max(game.hp, 0))}`, sx(20), sy(20));
  }

  fill('#5a4a34');
  textSize(11 * scaleFactor);
  textStyle(NORMAL);
  text(`Round: ${game.round}/${game.roundsToWin}`, sx(20), sy(50));
  if (game.enemies.length > 0) {
    text(`Nemico: ${game.currentEnemyIndex + 1}/${game.enemies.length}`, sx(20), sy(66));
  }

  // Indicatore modalità
  const modeLabel = game.playMode === 'simultaneous' ? 'SIMULTANEO' : 'SEQUENZIALE';
  fill(game.playMode === 'simultaneous' ? '#ECBA4E' : '#498AE2');
  textAlign(RIGHT, TOP);
  textSize(11 * scaleFactor);
  textStyle(BOLD);
  text(modeLabel, width - sx(20), sy(20));
  textStyle(NORMAL);
}

function drawEnemies() {
  const n = game.enemies.length;
  if (n === 0) return;

  let cardW = sx(140);
  let cardH = sy(200);
  let gap = sx(30);

  // Ridimensionamento responsivo se le carte superano lo spazio a disposizione
  const maxTotalW = width - sx(40);
  const baseTotalW = n * cardW + (n - 1) * gap;
  if (baseTotalW > maxTotalW) {
    const scale = maxTotalW / baseTotalW;
    cardW *= scale;
    cardH *= scale;
    gap *= scale;
  }

  const totalW = n * cardW + (n - 1) * gap;
  const startX = (width - totalW) / 2 + cardW / 2;
  const y = isCompact ? sy(180) : sy(160);

  for (let i = 0; i < n; i++) {
    const enemy = game.enemies[i];
    let x = startX + i * (cardW + gap);

    if (enemyShake > 0 && i === game.currentEnemyIndex && game.playMode === 'sequential') {
      x += random(-enemyShake * scaleFactor, enemyShake * scaleFactor);
    }

    // In modalita simultanea, evidenzia il nemico corrispondente allo slot attivo
    const isActive = game.playMode === 'sequential' ? i === game.currentEnemyIndex : true;

    push();
    translate(x, y);
    drawCardFrame(0, 0, cardW, cardH, enemy.color, enemy.emoji, enemy.name, enemy.power, enemy.element);

    textSize(10 * scaleFactor);
    fill('#5a4a34');
    textAlign(CENTER, TOP);
    text(`NEMICO ${i + 1}`, 0, -cardH / 2 - sy(20));

    if (!isActive) {
      fill(16, 11, 6, 130);
      noStroke();
      rect(-cardW / 2, -cardH / 2, cardW, cardH, sx(10));
    }
    pop();
  }
}

// Disegna un'icona vettoriale semplice per ogni elemento (stessa geometria
// del design board), centrata in (0,0) dentro un riquadro `size` x `size`.
function drawElementGlyph(element, size, glyphColor) {
  const s = size / 100;
  noStroke();
  fill(glyphColor);

  push();
  translate(-50 * s, -50 * s);

  if (element === 'FIRE') {
    triangle(50 * s, 18 * s, 84 * s, 84 * s, 16 * s, 84 * s);
  } else if (element === 'WATER') {
    triangle(16 * s, 24 * s, 84 * s, 24 * s, 50 * s, 88 * s);
  } else if (element === 'NATURE') {
    quad(50 * s, 12 * s, 86 * s, 50 * s, 50 * s, 88 * s, 14 * s, 50 * s);
  } else if (element === 'LIGHT') {
    ellipse(50 * s, 50 * s, 34 * s, 34 * s);
    stroke(glyphColor);
    strokeWeight(6 * s);
    strokeCap(ROUND);
    line(50 * s, 10 * s, 50 * s, 24 * s);
    line(50 * s, 76 * s, 50 * s, 90 * s);
    line(10 * s, 50 * s, 24 * s, 50 * s);
    line(76 * s, 50 * s, 90 * s, 50 * s);
    line(22 * s, 22 * s, 32 * s, 32 * s);
    line(68 * s, 68 * s, 78 * s, 78 * s);
    line(78 * s, 22 * s, 68 * s, 32 * s);
    line(32 * s, 68 * s, 22 * s, 78 * s);
    noStroke();
  } else if (element === 'SHADOW') {
    ellipse(50 * s, 50 * s, 68 * s, 68 * s);
    fill('#fbf6e8');
    ellipse(64 * s, 44 * s, 52 * s, 52 * s);
  } else if (element === 'THUNDER') {
    beginShape();
    vertex(58 * s, 10 * s);
    vertex(28 * s, 54 * s);
    vertex(47 * s, 54 * s);
    vertex(42 * s, 92 * s);
    vertex(76 * s, 44 * s);
    vertex(55 * s, 44 * s);
    endShape(CLOSE);
  }

  pop();
}

// Disegna l'icona dell'elemento caricata come immagine, con fallback vettoriale
function drawElementImage(element, size, fallbackColor) {
  const img = elementImages[element];
  if (img && img.width > 0) {
    push();
    imageMode(CENTER);
    let w = size;
    let h = size;
    if (img.width > img.height) {
      h = size * (img.height / img.width);
    } else if (img.height > img.width) {
      w = size * (img.width / img.height);
    }
    image(img, 0, 0, w, h);
    pop();
  } else {
    // Ridimensiona leggermente per far corrispondere le dimensioni del fallback vettoriale
    drawElementGlyph(element, size * 0.8, fallbackColor);
  }
}

function drawCardFrame(x, y, w, h, cardColor, emoji, name, power, element) {
  push();
  translate(x, y);

  noStroke();
  fill(0, 0, 0, 70);
  rect(-w / 2 + sx(4), -h / 2 + sx(4), w, h, sx(10));

  stroke('#cdbb90');
  strokeWeight(sx(2));
  fill('#f2e9d5');
  rect(-w / 2, -h / 2, w, h, sx(10));

  noFill();
  stroke(111, 95, 69, 60);
  strokeWeight(sx(1));
  rect(-w / 2 + sx(5), -h / 2 + sx(5), w - sx(10), h - sx(10), sx(8));

  noStroke();
  fill(cardColor);
  rect(-w / 2 + sx(4), -h / 2 + sx(4), w - sx(8), sy(28), sx(6), sx(6), 0, 0);

  fill(textColorForBg(cardColor));
  textAlign(CENTER, CENTER);
  textSize(13 * scaleFactor);
  textStyle(BOLD);
  text(name, 0, -h / 2 + sy(18));
  textStyle(NORMAL);

  const medR = min(w, h) * 0.32;

  push();
  translate(0, sy(4));
  drawElementImage(element, medR * 2.1, cardColor);
  pop();

  fill('#6f5f45');
  textSize(11 * scaleFactor);
  text(ELEMENTS[element].name, 0, h / 2 - sy(18));

  pop();
}

// Bottone arrotondato per attivare/disattivare il riconoscimento QR,
// mostrato in idle sotto il prompt "Mostra una carta alla webcam".
function getQrToggleButtonBounds() {
  if (game.state !== GAME_STATE.IDLE) return null;
  const w = sx(150), h = sy(44);
  if (isCompact) {
    return { x: width / 2 - w / 2, y: sy(175), w: w, h: h };
  } else {
    return { x: sx(585) - w / 2, y: sy(388), w: w, h: h };
  }
}

function isInsideQrToggleButton(b) {
  return mouseX >= b.x && mouseX <= b.x + b.w && mouseY >= b.y && mouseY <= b.y + b.h;
}

function drawQrToggleButton() {
  const b = getQrToggleButtonBounds();
  if (!b) return;

  const hovering = isInsideQrToggleButton(b);
  cursor(hovering ? HAND : ARROW);

  const ctx = drawingContext;
  const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
  if (qrEnabled) {
    grad.addColorStop(0, hovering ? '#F3C562' : '#ECBA4E');
    grad.addColorStop(1, hovering ? '#DCA42C' : '#CA9424');
  } else {
    grad.addColorStop(0, hovering ? '#a4a29b' : '#8a7a58');
    grad.addColorStop(1, hovering ? '#6d6a60' : '#5a4a34');
  }

  ctx.save();
  noStroke();
  ctx.fillStyle = grad;
  rect(b.x, b.y, b.w, b.h, sx(12));
  ctx.restore();

  fill(qrEnabled ? '#2b2318' : '#f4eddb');
  textAlign(CENTER, CENTER);
  textSize(13 * scaleFactor);
  textStyle(BOLD);
  text(qrEnabled ? 'QR attivo' : 'QR spento', b.x + b.w / 2, b.y + b.h / 2);
  textStyle(NORMAL);
}

function mousePressed() {
  const b = getQrToggleButtonBounds();
  if (b && isInsideQrToggleButton(b)) {
    qrEnabled = !qrEnabled;
    logToStatus(qrEnabled ? 'Riconoscimento QR attivato.' : 'Riconoscimento QR disattivato.');
  }
}

function drawWebcamPreview() {
  let pw, ph, px, py;

  if (isCompact) {
    if (game.state === GAME_STATE.IDLE) {
      pw = sx(160);
      ph = sy(120);
      px = width / 2 - pw / 2;
      py = sy(240);
    } else {
      pw = sx(100);
      ph = sy(75);
      px = width - pw - sx(15);
      py = sy(15);
    }
  } else {
    pw = sx(160);
    ph = sy(120);
    px = width - pw - sx(20);
    py = sy(20);
  }

  push();
  translate(px + pw, py);
  scale(-1, 1);
  if (video && video.width > 0 && video.elt.readyState >= 2) {
    image(video, 0, 0, pw, ph);
  } else {
    fill(0);
    rect(0, 0, pw, ph);
  }
  pop();

  const isReady = webcamState === 'active' && video && video.width > 0;

  fill('#5a4a34');
  noStroke();
  textFont('Hanken Grotesk');
  textAlign(CENTER, TOP);
  textSize(11 * scaleFactor);
  if (isReady) {
    text(qrEnabled ? 'QR attivo' : 'QR spento', px + pw / 2, py + ph + sy(6));
  } else {
    text(webcamMessage, px + pw / 2, py + ph + sy(6));
  }
  textFont('Space Grotesk');
}

function drawWebcamOverlay() {
  if (webcamState === 'active') return;

  const isProblem = webcamState === 'denied' || webcamState === 'error' || webcamState === 'unsupported';
  const accent = isProblem ? '#DD4B50' : '#498AE2';
  const hint = isProblem ? 'Concedi il permesso e premi F5 per ricaricare.' : null;

  const alertW = isCompact ? width - sx(30) : sx(440);
  const alertH = hint ? sy(88) : sy(64);
  const x = width / 2 - alertW / 2;
  const y = height - alertH - sy(24);
  const r = sx(14);

  // Corpo dell'alert (card chiara con accento a sinistra)
  noStroke();
  fill('#ffffff');
  rect(x, y, alertW, alertH, r);
  fill(accent);
  rect(x, y, sx(6), alertH, r, 0, 0, r);

  // Pallino con emoji webcam / warning
  const icoX = x + sx(34);
  const icoY = y + alertH / 2;
  fill(accent);
  const dot = sx(28);
  ellipse(icoX, icoY, dot, dot);
  fill('#ffffff');
  textAlign(CENTER, CENTER);
  textSize(15 * scaleFactor);
  text(isProblem ? '!' : '📷', icoX, icoY);

  // Testi
  const tx = x + sx(58);
  const tw = alertW - sx(70);
  textAlign(LEFT, CENTER);

  textFont('Space Grotesk');
  textStyle(BOLD);
  fill('#2b2318');
  textSize(13 * scaleFactor);
  const titleY = hint ? y + sy(22) : icoY - sy(8);
  text('Webcam', tx, titleY);
  textStyle(NORMAL);

  textFont('Hanken Grotesk');
  fill('#5a4a34');
  textSize(12 * scaleFactor);
  const msgY = hint ? y + sy(40) : icoY + sy(9);
  text(webcamMessage, tx, msgY, tw);

  if (hint) {
    fill(accent);
    textSize(11 * scaleFactor);
    text(hint, tx, y + sy(62), tw);
  }
  textFont('Space Grotesk');
}

// Card "come si gioca" + stato corrente, disegnata sul canvas sempre
// subito sotto il riquadro della webcam (stesse coordinate x/larghezza).
function drawHelpPanel() {
  if (isCompact) return; // Salta il pannello d'aiuto esteso su mobile per ottimizzare lo spazio

  const pw = sx(160);
  const px = width - pw - sx(20);
  const py = sy(20) + sy(120) + sy(16);
  const ph = sy(340);
  const innerW = pw - sx(20);

  noFill();
  strokeWeight(sx(1));
  fill(244, 237, 219, 235);
  stroke('#cdbb90');
  rect(px, py, pw, ph, sx(10));

  noStroke();
  textFont('Space Grotesk');
  textStyle(BOLD);
  fill('#b0842f');
  textAlign(LEFT, TOP);
  textSize(10 * scaleFactor);
  text('COME SI GIOCA', px + sx(10), py + sy(10));
  textStyle(NORMAL);

  const lines = [
    'Le tue carte sono solo fisiche: il computer non le mostra.',
    'Mostra una carta alla webcam per iniziare o per giocarla.',
    'Il computer legge la carta e annuncia il risultato a voce.',
    'Se vinci, aggiungi il nemico al tuo mazzo fisico.',
    'Se perdi, perdi 1 HP.',
    'Vinci dopo 8 round. A Game Over, mostra una carta per ricominciare.'
  ];

  textFont('Hanken Grotesk');
  fill('#5a4a34');
  textSize(10 * scaleFactor);
  textLeading(13 * scaleFactor);
  let cursorY = py + sy(26);
  const lineBoxH = sy(30);
  for (const line of lines) {
    text('• ' + line, px + sx(10), cursorY, innerW, lineBoxH);
    cursorY += lineBoxH;
  }

  cursorY += sy(4);
  stroke(205, 187, 144, 180);
  strokeWeight(sx(1));
  line(px + sx(10), cursorY, px + pw - sx(10), cursorY);
  cursorY += sy(10);

  noStroke();
  textFont('Space Grotesk');
  textStyle(BOLD);
  fill('#b0842f');
  textSize(10 * scaleFactor);
  text('STATO', px + sx(10), cursorY);
  textStyle(NORMAL);
  cursorY += sy(16);

  textFont('Hanken Grotesk');
  fill('#2b2318');
  textSize(10 * scaleFactor);
  text(statusMessage, px + sx(10), cursorY, innerW, py + ph - cursorY - sy(10));

  textFont('Space Grotesk');
}

function drawLog() {
  if (isCompact) {
    // Draw a single clean line at the bottom center of the canvas on mobile
    fill('#5a4a34');
    textFont('Hanken Grotesk');
    textAlign(CENTER, BOTTOM);
    textSize(11 * scaleFactor);
    const lastLog = game.logs[game.logs.length - 1] || "";
    text(lastLog ? '• ' + lastLog : "", width / 2, height - sy(10));
    textFont('Space Grotesk');
    return;
  }

  const x = sx(20);
  const y = height - sy(150);
  const w = sx(320);
  const h = sy(110);

  noStroke();
  fill(244, 237, 219, 235);
  rect(x, y, w, h, sx(8));

  fill('#5a4a34');
  textFont('Hanken Grotesk');
  textAlign(LEFT, TOP);
  textSize(12 * scaleFactor);
  const visible = game.logs.slice(-5);
  for (let i = 0; i < visible.length; i++) {
    text('• ' + visible[i], x + sx(10), y + sy(10) + i * sy(20));
  }
  textFont('Space Grotesk');
}

/* =========================================================
    PARTICELLE E EFFETTI
   ========================================================= */

function spawnParticles(x, y, color, count) {
  const c = colorObj(color);
  for (let i = 0; i < count; i++) {
    const angle = random(TWO_PI);
    const speed = random(2, 8);
    particles.push({
      x: x,
      y: y,
      vx: cos(angle) * speed,
      vy: sin(angle) * speed,
      life: 255,
      r: random(3, 8),
      col: c
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life -= 5;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  noStroke();
  for (const p of particles) {
    fill(p.col.r, p.col.g, p.col.b, p.life);
    ellipse(p.x, p.y, p.r * 2);
  }
}

function spawnFloater(text, x, y, color) {
  const c = colorObj(color);
  floaters.push({ text, x, y, life: 255, col: c });
}

function updateFloaters() {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.y -= 1;
    f.life -= 4;
    if (f.life <= 0) floaters.splice(i, 1);
  }
}

function drawFloaters() {
  textAlign(CENTER, CENTER);
  textSize(20);
  textStyle(BOLD);
  for (const f of floaters) {
    fill(f.col.r, f.col.g, f.col.b, f.life);
    text(f.text, f.x, f.y);
  }
  textStyle(NORMAL);
}

function colorObj(hex) {
  return {
    r: red(hex),
    g: green(hex),
    b: blue(hex)
  };
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function drawCanvasBackground() {
  background('#f1f6fc');
}

function textColorForBg(hex) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#2b2318' : '#fdf6e6';
}

/* =========================================================
    SLOT CARTE
   ========================================================= */

function resetSlots() {
  playerSlots = [];
  slotFrames = [];
  for (let i = 0; i < game.cardsPerRound; i++) {
    playerSlots.push(null);
    slotFrames.push(0);
  }
  slotsFilled = 0;
  slotLocked = false;
  slotEmptyFrames = 0;
}

function drawSlots() {
  const n = game.cardsPerRound;
  let cardW = sx(100);
  let cardH = sy(145);
  let gap = sx(20);

  // Ridimensionamento responsivo se le carte superano lo spazio a disposizione
  const maxTotalW = width - sx(40);
  const baseTotalW = n * cardW + (n - 1) * gap;
  if (baseTotalW > maxTotalW) {
    const scale = maxTotalW / baseTotalW;
    cardW *= scale;
    cardH *= scale;
    gap *= scale;
  }

  const totalW = n * cardW + (n - 1) * gap;
  const startX = (width - totalW) / 2 + cardW / 2;
  const y = height - cardH / 2 - sy(40);

  for (let i = 0; i < n; i++) {
    const sx_coord = startX + i * (cardW + gap);
    const card = playerSlots[i];
    const isNext = !slotLocked && !card;

    push();
    translate(sx_coord, y);

    noFill();
    stroke(111, 95, 69, card ? 220 : isNext ? 160 : 90);
    strokeWeight(sx(3));
    drawingContext.setLineDash(card ? [] : [sx(8), sx(5)]);
    rect(-cardW / 2, -cardH / 2, cardW, cardH, sx(10));
    drawingContext.setLineDash([]);

    if (card) {
      drawCardFrame(0, 0, cardW - sx(8), cardH - sx(8), card.color, card.emoji, card.name, card.power, card.element);
    } else if (isNext) {
      fill(90, 74, 52, 170);
      textAlign(CENTER, CENTER);
      textSize(13 * scaleFactor);
      text('SLOT', 0, -sy(5));
      textSize(10 * scaleFactor);
      fill(90, 74, 52, 210);
      text(`${i + 1}`, 0, sy(12));
    }

    pop();
  }
}

function updateSlots() {
  if (slotLocked || waitingForTTS) return;

  // Modalità sequenziale: slot singolo, togli per giocare
  if (game.playMode === 'sequential') {
    const card = playerSlots[0];
    if (card) {
      if (slotEmptyFrames >= SLOT_EMPTY_THRESHOLD) {
        playSequentialSlot();
      } else if (slotFrames[0] >= SLOT_AUTOPLAY_THRESHOLD) {
        playSequentialSlot();
      }
    }
    return;
  }

  // Modalità simultanea: quando tutti gli slot sono pieni, gioca tutti insieme
  if (slotsFilled === game.cardsPerRound) {
    playAllSlots();
  }
}

function loadCardIntoSlot(templateId) {
  if (slotLocked || waitingForTTS) return;

  if (game.playMode === 'sequential') {
    if (playerSlots[0]) {
      slotFrames[0]++;
      return;
    }
    playerSlots[0] = createCard(templateId);
    slotFrames[0] = 0;
    slotEmptyFrames = 0;
    audio.playCard();
    const card = playerSlots[0];
    tts.speak(`${card.name}. Togli.`);
    logToStatus(`${card.name} nello slot. Togli la carta.`);
    return;
  }

  // Modalità simultanea: primo slot libero
  for (let i = 0; i < game.cardsPerRound; i++) {
    if (!playerSlots[i]) {
      playerSlots[i] = createCard(templateId);
      slotFrames[i] = 0;
      slotEmptyFrames = 0;
      slotsFilled++;
      audio.playCard();
      const card = playerSlots[i];
      tts.speak(`${card.name}.`);
      logToStatus(`${card.name} nello slot ${i + 1}.`);
      return;
    }
  }
}

function playSequentialSlot() {
  if (slotLocked || !playerSlots[0]) return;
  slotLocked = true;

  const card = playerSlots[0];
  playerSlots[0] = null;
  slotFrames[0] = 0;
  slotEmptyFrames = 0;

  const event = game.playCardSequential(card.templateId);
  if (!event || !event.card) {
    slotLocked = false;
    return;
  }

  lastPlayedCard = card;
  animProgress = 0;

  if (event.result === 'win') {
    audio.playWin();
    spawnFloater('VITTORIA', width / 2, sy(120), '#97B481');
  } else if (event.result === 'lose') {
    audio.playLose();
    spawnFloater('SCONFITTA', width / 2, sy(120), '#DD4B50');
  } else {
    audio.playDraw();
    spawnFloater('PAREGGIO', width / 2, sy(120), '#ECBA4E');
  }

  tts.onIdle(() => {
    slotLocked = false;
    lastPlayedCard = null;
    animProgress = 0;

    if (game.state === GAME_STATE.PLAYING && game.currentEnemy) {
      tts.speak(`${game.currentEnemy.name}.`);
    }
  });
}

function playAllSlots() {
  if (slotLocked) return;
  slotLocked = true;

  const ids = playerSlots.map(c => c.templateId);
  const cards = playerSlots.slice();

  // Svuota gli slot
  for (let i = 0; i < game.cardsPerRound; i++) {
    playerSlots[i] = null;
    slotFrames[i] = 0;
  }
  slotsFilled = 0;
  slotEmptyFrames = 0;

  const event = game.playAllCards(ids);
  if (!event) {
    slotLocked = false;
    return;
  }

  // Avvia animazioni di tutte le carte verso i rispettivi nemici
  multiSlotAnim = [];
  for (let i = 0; i < cards.length; i++) {
    multiSlotAnim.push({
      card: cards[i],
      enemyIndex: i,
      progress: 0
    });
  }

  // Feedback sonoro unico
  if (event.lastResult === 'win') audio.playWin();
  else if (event.lastResult === 'lose') audio.playLose();
  else audio.playDraw();

  // TTS breve con risultato
  const wins = event.results.filter(r => r === 'win').length;
  const losses = event.results.filter(r => r === 'lose').length;
  tts.speak(`${wins} a ${losses}.`);

  tts.onIdle(() => {
    multiSlotAnim = [];
    if (event.lastResult === 'win') {
      screenFlash = { color: [151, 180, 129], alpha: 120 };
      spawnFloater('+ NEMICI', width / 2, sy(120), '#97B481');
    } else if (event.lastResult === 'lose') {
      screenFlash = { color: [221, 75, 80], alpha: 120 };
      spawnFloater('-1 HP', width / 2, sy(120), '#DD4B50');
    } else {
      screenFlash = { color: [236, 186, 78], alpha: 100 };
    }
    resultTimer = 0;
    slotLocked = false;
  });
}

function updateMultiSlotAnim() {
  for (const anim of multiSlotAnim) {
    anim.progress += 0.04;
  }

  if (multiSlotAnim.length === 0) return;

  const n = game.cardsPerRound;
  
  // Dimensioni base desktop per i nemici, scalate
  let enemyCardW = sx(140);
  let gap = sx(30);

  // Dimensioni base per gli slot delle carte, scalate
  let slotCardW = sx(100);
  let slotCardH = sy(145);
  let slotGap = sx(20);

  // Applica ridimensionamento responsivo se necessario
  const maxTotalW = width - sx(40);
  const baseEnemyTotalW = n * enemyCardW + (n - 1) * gap;
  if (baseEnemyTotalW > maxTotalW) {
    const scale = maxTotalW / baseEnemyTotalW;
    enemyCardW *= scale;
    gap *= scale;
  }

  const baseSlotTotalW = n * slotCardW + (n - 1) * slotGap;
  if (baseSlotTotalW > maxTotalW) {
    const scale = maxTotalW / baseSlotTotalW;
    slotCardW *= scale;
    slotCardH *= scale;
    slotGap *= scale;
  }

  const enemyTotalW = n * enemyCardW + (n - 1) * gap;
  const enemyStartX = (width - enemyTotalW) / 2 + enemyCardW / 2;
  const enemyY = isCompact ? sy(180) : sy(160);

  const slotTotalW = n * slotCardW + (n - 1) * slotGap;
  const slotStartX = (width - slotTotalW) / 2 + slotCardW / 2;
  const slotY = height - slotCardH / 2 - sy(40);

  for (const anim of multiSlotAnim) {
    const startX = slotStartX + anim.enemyIndex * (slotCardW + slotGap);
    const targetX = enemyStartX + anim.enemyIndex * (enemyCardW + gap);

    const cx = lerp(startX, targetX, anim.progress);
    const cy = lerp(slotY, enemyY, easeOutCubic(anim.progress));

    push();
    translate(cx, cy);
    rotate(anim.progress * TWO_PI);

    // Scala la carta dinamicamente durante l'animazione di transizione
    const currentW = lerp(slotCardW - sx(8), enemyCardW - sx(8), anim.progress);
    const currentH = lerp(slotCardH - sx(8), (enemyCardW * 1.4) - sx(8), anim.progress);

    drawCardFrame(0, 0, currentW, currentH, anim.card.color, anim.card.emoji, anim.card.name, anim.card.power, anim.card.element);
    pop();
  }
}

function drawTTSPause() {
  fill(16, 11, 6, 90);
  noStroke();
  rect(0, 0, width, height);

  fill('#f4ead0');
  textAlign(CENTER, CENTER);
  textSize(18 * scaleFactor);
  text('🔊 Ascolta...', width / 2, height - sy(210));
}

/* =========================================================
    RICONOSCIMENTO QR
   ========================================================= */

function readQR() {
  hiddenCanvas.push();
  hiddenCanvas.translate(hiddenCanvas.width, 0);
  hiddenCanvas.scale(-1, 1);
  hiddenCanvas.image(video, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
  hiddenCanvas.pop();

  hiddenCanvas.loadPixels();
  const code = jsQR(
    hiddenCanvas.pixels,
    hiddenCanvas.width,
    hiddenCanvas.height,
    { inversionAttempts: 'attemptBoth' }
  );

  if (code && code.data) {
    slotEmptyFrames = 0;
    const detectedId = code.data.trim().toUpperCase();
    handleQRDetected(detectedId);
  } else {
    slotEmptyFrames++;
  }
}

function handleQRDetected(id) {
  audio.init();

  // Gestione start/restart/mode: questi non passano dallo slot
  if (id === 'RESTART' || id === 'SEQUENZIALE' || id === 'SIMULTANEO' ||
      game.state === GAME_STATE.IDLE ||
      game.state === GAME_STATE.GAME_OVER ||
      game.state === GAME_STATE.VICTORY) {
    const event = game.handleQR(id);

    if (event.action === 'start' || event.action === 'restart') {
      audio.playStart();
      tts.speak('Via.', true);
      lastPlayedCard = null;
      animProgress = 0;
      multiSlotAnim = [];
      resetSlots();
      if (game.currentEnemy) {
        tts.speak(`${game.currentEnemy.name}.`);
      }
      logToStatus(event.action === 'start' ? 'Partita iniziata.' : 'Nuova partita.');
    } else if (event.action === 'mode') {
      tts.speak(event.mode === 'simultaneous' ? 'Simultaneo.' : 'Sequenziale.', true);
      logToStatus(`Modalità ${event.mode}.`);
      if (game.state === GAME_STATE.PLAYING) {
        resetSlots();
        multiSlotAnim = [];
        lastPlayedCard = null;
        animProgress = 0;
        if (game.currentEnemy) {
          const enemyNames = game.enemies.map(e => e.name).join(', ');
          tts.speak(enemyNames);
          logToStatus(`Nemici: ${enemyNames}`);
        }
      }
    } else if (event.action === 'unknown') {
      logToStatus(`QR ${id}?`);
    }
    return;
  }

  // Durante un round result gli slot sono bloccati
  if (game.state !== GAME_STATE.PLAYING || slotLocked) return;

  // Solo carte valide possono essere giocate
  if (!TEMPLATE_MAP[id]) return;

  // Se la carta è già in uno slot, incrementa il contatore
  let foundInSlot = false;
  for (let i = 0; i < game.cardsPerRound; i++) {
    if (playerSlots[i] && playerSlots[i].templateId === id) {
      slotFrames[i]++;
      foundInSlot = true;
      break;
    }
  }
  if (foundInSlot) return;

  loadCardIntoSlot(id);
}

/* =========================================================
    UI DOM
   ========================================================= */

function logToStatus(message) {
  statusMessage = message;
  if (statusEl) statusEl.html(message);
}

/* =========================================================
    UTILITY
   ========================================================= */

function lighten(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}
