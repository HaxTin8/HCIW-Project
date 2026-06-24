/* =========================================================
   DECK OF SHADOWS — frontend p5.js, input solo da webcam QR
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

// Slot fisico virtuale: il giocatore mostra una carta, poi la rimuove per giocarla
var slotCard = null;
var slotFrames = 0;
var slotEmptyFrames = 0;
var slotLocked = false;
const SLOT_EMPTY_THRESHOLD = 8;      // frame senza QR prima di giocare la carta rimossa
const SLOT_AUTOPLAY_THRESHOLD = 120; // frame con la stessa carta ferma -> gioca automaticamente

function setup() {
  const container = select('#canvas-container');
  const canvas = createCanvas(900, 600);
  canvas.parent(container);

  hiddenCanvas = createGraphics(320, 240);
  hiddenCanvas.pixelDensity(1);

  statusEl = select('#status');
  game = new Game();

  const qrToggle = select('#qr-toggle');
  if (qrToggle) {
    qrToggle.changed(() => {
      qrEnabled = qrToggle.checked();
      logToStatus(qrEnabled ? 'Riconoscimento QR attivato.' : 'Riconoscimento QR disattivato.');
    });
  }

  setupWebcam();
  logToStatus('Mostra una carta alla webcam per iniziare.');
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
  background(22, 33, 62);

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
      drawEndScreen('GAME OVER', '#e74c3c', 'Mostra una carta per ricominciare.');
      break;
    case GAME_STATE.VICTORY:
      drawEndScreen('VITTORIA!', '#2ecc71', 'Mostra una carta per una nuova run.');
      break;
  }
}

/* =========================================================
   SCHERMATE
   ========================================================= */

function drawIdle() {
  drawDecorations();
  drawWebcamPreview();
  drawWebcamOverlay();

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(42);
  textStyle(BOLD);
  text('⚔️ Deck of Shadows ⚔️', width / 2, height / 2 - 80);

  textStyle(NORMAL);
  textSize(18);
  fill(200);
  text('Solitario a carte con riconoscimento QR.', width / 2, height / 2 - 20);

  if (webcamState === 'active') {
    const t = millis() / 1000;
    const pulse = sin(t * 3) * 5;
    fill('#e94560');
    textSize(20);
    text('📷 Mostra una carta alla webcam per iniziare', width / 2, height / 2 + 40 + pulse);
  }

  idleHintTimer++;

  if (qrEnabled && webcamState === 'active' && video && video.width > 0 && frameCount % 10 === 0) {
    readQR();
  }
}

function drawPlaying() {
  drawDecorations();
  drawHUD();
  if (game.enemy) drawEnemy();
  drawSlot();
  drawWebcamPreview();
  drawWebcamOverlay();
  drawLog();

  if (qrEnabled && webcamState === 'active' && video && video.width > 0 && frameCount % 10 === 0) {
    readQR();
  }

  updateSlot();
}

function drawRoundResult() {
  drawPlaying();

  if (lastPlayedCard) {
    animProgress += 0.04;
    const startX = width / 2;
    const startY = height - 50;
    const endX = width / 2;
    const endY = 120;
    const cx = lerp(startX, endX, animProgress);
    const cy = lerp(startY, endY, easeOutCubic(animProgress));
    const rot = animProgress * TWO_PI;

    push();
    translate(cx, cy);
    rotate(rot);
    drawCardFrame(0, 0, 90, 130, lastPlayedCard.color, lastPlayedCard.emoji, lastPlayedCard.name, lastPlayedCard.power, lastPlayedCard.element);
    pop();

    if (animProgress < 0.8) {
      noStroke();
      fill(red(lastPlayedCard.color), green(lastPlayedCard.color), blue(lastPlayedCard.color), 80);
      ellipse(cx, cy, 40 + animProgress * 60, 40 + animProgress * 60);
    }

    if (animProgress >= 0.8 && animProgress < 1.0) {
      enemyShake = 12;
      if (particles.length < 40) {
        spawnParticles(width / 2, 120, lastPlayedCard.color, 30);
      }
    }
  }

  if (enemyShake > 0) enemyShake *= 0.85;
  if (enemyShake < 0.5) enemyShake = 0;

  fill(0, 0, 0, 160);
  rect(0, 0, width, height);

  textAlign(CENTER, CENTER);
  textSize(56);
  textStyle(BOLD);

  if (game.lastResult === 'win') {
    fill('#2ecc71');
    text('VITTORIA!', width / 2, height / 2 - 30);
    textSize(22);
    fill(255);
    text(`Aggiungi ${game.enemy ? game.enemy.name : 'il nemico'} al tuo mazzo fisico.`, width / 2, height / 2 + 35);
  } else if (game.lastResult === 'lose') {
    fill('#e74c3c');
    text('SCONFITTA', width / 2, height / 2 - 30);
    textSize(22);
    fill(255);
    text('Hai perso 1 HP.', width / 2, height / 2 + 35);
  } else {
    fill('#f1c40f');
    text('PAREGGIO', width / 2, height / 2 - 30);
    textSize(22);
    fill(255);
    text('Nessuno vince questo round.', width / 2, height / 2 + 35);
  }

  resultTimer++;
  if (resultTimer > 140) {
    resultTimer = 0;
    lastPlayedCard = null;
    animProgress = 0;
    slotLocked = false;
    const oldEnemyName = game.enemy ? game.enemy.name : '';
    game.endRound();
    const newMsg = game.logs[game.logs.length - 1];
    logToStatus(newMsg);

    if (game.state === GAME_STATE.PLAYING && game.enemy && game.enemy.name !== oldEnemyName) {
      tts.speak(`Nuovo nemico: ${game.enemy.name}, potere ${game.enemy.power}.`);
    }
  }
}

function drawEndScreen(title, color, subtitle) {
  drawDecorations();
  drawWebcamPreview();
  drawWebcamOverlay();

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(56);
  textStyle(BOLD);
  fill(color);
  text(title, width / 2, height / 2 - 40);

  textStyle(NORMAL);
  textSize(18);
  fill(255);
  const finalSubtitle = webcamState === 'active' ? subtitle : webcamMessage;
  text(finalSubtitle, width / 2, height / 2 + 30);

  if (qrEnabled && webcamState === 'active' && video && video.width > 0 && frameCount % 10 === 0) {
    readQR();
  }
}

/* =========================================================
    GRAFICA DI SUPPORTO
   ========================================================= */

function drawDecorations() {
  stroke(255, 255, 255, 12);
  strokeWeight(1);
  for (let x = 0; x < width; x += 40) line(x, 0, x, height);
  for (let y = 0; y < height; y += 40) line(0, y, width, y);
}

function drawHUD() {
  fill(255);
  textAlign(LEFT, TOP);
  textSize(18);
  textStyle(BOLD);
  text(`HP: ${'❤️'.repeat(max(game.hp, 0))}`, 20, 20);
  text(`Round: ${game.round}/${game.roundsToWin}`, 20, 48);
  textStyle(NORMAL);
}

function drawEnemy() {
  let x = width / 2;
  let y = 150;
  const w = 180;
  const h = 260;

  if (enemyShake > 0) {
    x += random(-enemyShake, enemyShake);
    y += random(-enemyShake, enemyShake);
  }

  push();
  translate(x, y);
  drawCardFrame(0, 0, w, h, game.enemy.color, game.enemy.emoji, game.enemy.name, game.enemy.power, game.enemy.element);
  textSize(14);
  fill(255);
  textAlign(CENTER, TOP);
  text('NEMICO', 0, -h / 2 + 8);
  pop();

  const elem = ELEMENTS[game.enemy.element];
  fill(elem.color);
  noStroke();
  ellipse(x, y - h / 2 - 25, 44, 44);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(24);
  text(elem.emoji, x, y - h / 2 - 25);
}

function drawCardFrame(x, y, w, h, color, emoji, name, power, element) {
  push();
  translate(x, y);

  noStroke();
  fill(0, 0, 0, 80);
  rect(-w / 2 + 4, -h / 2 + 4, w, h, 10);

  stroke(255, 255, 255, 60);
  strokeWeight(2);
  fill(20, 25, 45);
  rect(-w / 2, -h / 2, w, h, 10);

  noStroke();
  fill(color);
  rect(-w / 2 + 4, -h / 2 + 4, w - 8, 28, 6);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(13);
  textStyle(BOLD);
  text(name, 0, -h / 2 + 18);
  textStyle(NORMAL);

  textSize(48);
  text(emoji, 0, -5);

  fill(255);
  textSize(20);
  textStyle(BOLD);
  text(power, 0, 45);
  textStyle(NORMAL);

  fill(color);
  textSize(11);
  text(ELEMENTS[element].name, 0, h / 2 - 18);

  pop();
}

function drawWebcamPreview() {
  const pw = 160;
  const ph = 120;
  const px = width - pw - 20;
  const py = 20;

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
  stroke(isReady ? (qrEnabled ? '#2ecc71' : '#e74c3c') : '#f1c40f');
  strokeWeight(2);
  noFill();
  rect(px, py, pw, ph, 8);

  fill(255);
  noStroke();
  textAlign(CENTER, TOP);
  textSize(11);
  if (isReady) {
    text(qrEnabled ? 'QR attivo' : 'QR spento', px + pw / 2, py + ph + 6);
  } else {
    text(webcamMessage, px + pw / 2, py + ph + 6);
  }
}

function drawWebcamOverlay() {
  if (webcamState === 'active') return;

  const overlayW = 420;
  const overlayH = 140;
  const x = width / 2 - overlayW / 2;
  const y = height / 2 + 60;

  fill(0, 0, 0, 200);
  noStroke();
  rect(x, y, overlayW, overlayH, 12);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(18);
  textStyle(BOLD);
  text('📷 Webcam', width / 2, y + 30);
  textStyle(NORMAL);

  fill(220);
  textSize(14);
  text(webcamMessage, width / 2, y + 75);

  if (webcamState === 'denied' || webcamState === 'error' || webcamState === 'unsupported') {
    textSize(12);
    fill('#e94560');
    text('Concedi il permesso e premi F5 per ricaricare.', width / 2, y + 105);
  }
}

function drawLog() {
  const x = 20;
  const y = height - 150;
  const w = 320;
  const h = 110;

  fill(0, 0, 0, 120);
  rect(x, y, w, h, 8);

  fill(200);
  textAlign(LEFT, TOP);
  textSize(12);
  const visible = game.logs.slice(-5);
  for (let i = 0; i < visible.length; i++) {
    text('• ' + visible[i], x + 10, y + 10 + i * 20);
  }
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

/* =========================================================
    SLOT CARTE
   ========================================================= */

function drawSlot() {
  const sx = width / 2;
  const sy = height - 130;
  const sw = 120;
  const sh = 170;

  push();
  translate(sx, sy);

  // Area slot
  noFill();
  stroke(255, 255, 255, slotCard ? 180 : 60);
  strokeWeight(3);
  drawingContext.setLineDash(slotCard ? [] : [10, 6]);
  rect(-sw / 2, -sh / 2, sw, sh, 12);
  drawingContext.setLineDash([]);

  if (slotCard) {
    // Carta caricata nello slot
    drawCardFrame(0, 0, sw - 10, sh - 10, slotCard.color, slotCard.emoji, slotCard.name, slotCard.power, slotCard.element);

    // Indicatore "togli per giocare"
    noStroke();
    fill(255, 255, 255, 200);
    textAlign(CENTER, CENTER);
    textSize(11);
    textStyle(BOLD);
    text('TOGLI PER GIOCARE', 0, sh / 2 - 14);
    textStyle(NORMAL);
  } else {
    fill(255, 255, 255, 80);
    textAlign(CENTER, CENTER);
    textSize(14);
    text('SLOT', 0, 0);
    textSize(11);
    fill(255, 255, 255, 120);
    text('mostra una carta', 0, 20);
  }

  pop();
}

function updateSlot() {
  if (slotLocked || !slotCard) return;

  // Se la carta è stata rimossa dallo slot (nessun QR per N frame), giocala
  if (slotEmptyFrames >= SLOT_EMPTY_THRESHOLD) {
    playSlotCard();
    return;
  }

  // Se la carta resta nello slot troppo a lungo, gioca automaticamente
  if (slotFrames >= SLOT_AUTOPLAY_THRESHOLD) {
    playSlotCard();
  }
}

function playSlotCard() {
  if (!slotCard || slotLocked) return;
  slotLocked = true;

  const card = slotCard;
  slotCard = null;
  slotFrames = 0;
  slotEmptyFrames = 0;

  const event = game.playCard(card.templateId);
  if (!event || !event.card) {
    slotLocked = false;
    return;
  }

  // Feedback
  audio.playCard();
  lastPlayedCard = card;
  animProgress = 0;

  tts.speak(`Hai giocato ${card.name}.`);

  if (game.lastResult === 'win') {
    setTimeout(() => audio.playWin(), 300);
    screenFlash = { color: [46, 204, 113], alpha: 120 };
    spawnFloater('+ NEMICO', width / 2, 120, '#2ecc71');
    tts.speak('Vittoria! Aggiungi il nemico al tuo mazzo fisico.');
  } else if (game.lastResult === 'lose') {
    setTimeout(() => audio.playLose(), 300);
    screenFlash = { color: [231, 76, 60], alpha: 120 };
    spawnFloater('-1 HP', width / 2, 120, '#e74c3c');
    tts.speak('Sconfitta! Perdi un punto vita.');
  } else {
    setTimeout(() => audio.playDraw(), 300);
    screenFlash = { color: [241, 196, 15], alpha: 100 };
    tts.speak('Pareggio.');
  }
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

  // Gestione start/restart: questi non passano dallo slot
  if (id === 'RESTART' ||
      game.state === GAME_STATE.IDLE ||
      game.state === GAME_STATE.GAME_OVER ||
      game.state === GAME_STATE.VICTORY) {
    const event = game.handleQR(id);

    if (event.action === 'start' || event.action === 'restart') {
      audio.playStart();
      tts.speak('Partita iniziata.', true);
      lastPlayedCard = null;
      animProgress = 0;
      slotCard = null;
      slotFrames = 0;
      slotEmptyFrames = 0;
      slotLocked = false;
      if (game.enemy) {
        tts.speak(`Nemico: ${game.enemy.name}, potere ${game.enemy.power}.`);
      }
      logToStatus(event.action === 'start' ? 'Partita iniziata! Mostra una carta nello slot.' : 'Nuova partita!');
    } else if (event.action === 'unknown') {
      logToStatus(`QR ${id} non riconosciuto.`);
    }
    return;
  }

  // Durante un round result lo slot è bloccato
  if (game.state !== GAME_STATE.PLAYING || slotLocked) return;

  // Solo carte valide possono entrare nello slot
  if (!TEMPLATE_MAP[id]) return;

  if (slotCard && slotCard.templateId === id) {
    slotFrames++;
  } else {
    slotCard = createCard(id);
    slotFrames = 0;
    slotEmptyFrames = 0;
    audio.playCard();
    tts.speak(`${slotCard.name} caricata. Togli la carta per giocarla.`);
    logToStatus(`${slotCard.name} caricata nello slot. Togli la carta per giocarla.`);
  }
}

/* =========================================================
    UI DOM
   ========================================================= */

function logToStatus(message) {
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
