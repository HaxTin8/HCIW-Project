/* =========================================================
   DECK OF SHADOWS — frontend p5.js, input solo da webcam QR
   Versione no-WIMP: il giocatore gestisce fisicamente le carte.
   ========================================================= */

var video;
var hiddenCanvas;
var qrEnabled = true;
var statusEl;
var game;
var storyEngine;
var prevGameState = null;

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

var cameraSection;
var cameraBtn;
var switchCameraBtn;
var currentFacingMode = 'environment';
var isSwitchingCamera = false;

function setup() {
  const container = select('#canvas-container');
  const cw = min((container.elt ? container.elt.clientWidth : windowWidth - 40), 900);
  const h = cw * (600 / 900);
  const canvas = createCanvas(cw, h);
  canvas.parent(container);

  hiddenCanvas = createGraphics(320, 240);
  hiddenCanvas.pixelDensity(1);

  statusEl = select('#status');
  game = new Game();
  storyEngine = new StoryEngine();
  storyEngine.loadIndex().catch(() => {});

  const qrToggle = select('#qr-toggle');
  if (qrToggle) {
    qrToggle.changed(() => {
      qrEnabled = qrToggle.checked();
      logToStatus(qrEnabled ? 'Riconoscimento QR attivato.' : 'Riconoscimento QR disattivato.');
    });
  }

  cameraBtn = select('#camera-btn');
  switchCameraBtn = select('#switch-camera-btn');

  if (cameraBtn) {
    cameraBtn.mousePressed(() => {
      if (cameraBtn) cameraBtn.style('display', 'none');
      setupWebcam();
    });
  }

  if (switchCameraBtn) {
    switchCameraBtn.mousePressed(switchCamera);
  }

  if (!isMobile()) {
    setupWebcam();
  } else {
    webcamState = 'waiting';
    webcamMessage = 'Tocca il pulsante per attivare la fotocamera.';
    updateCameraButton();
  }
  logToStatus('Mostra una carta alla webcam per iniziare.');
}

function windowResized() {
  const container = select('#canvas-container');
  const cw = min((container.elt ? container.elt.clientWidth : windowWidth - 40), 900);
  resizeCanvas(cw, cw * (600 / 900));
}

function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function updateCameraButton() {
  if (!cameraBtn || !switchCameraBtn) return;
  if (webcamState === 'active') {
    cameraBtn.style('display', 'none');
    if (isMobile()) {
      switchCameraBtn.style('display', 'block');
    } else {
      switchCameraBtn.style('display', 'none');
    }
  } else if (webcamState === 'waiting' || webcamState === 'denied' || webcamState === 'error' || webcamState === 'unsupported') {
    if (isMobile()) {
      cameraBtn.style('display', 'block');
    } else {
      cameraBtn.style('display', 'none');
    }
    switchCameraBtn.style('display', 'none');
  } else {
    cameraBtn.style('display', 'none');
    switchCameraBtn.style('display', 'none');
  }
}

function switchCamera() {
  if (!isMobile() || isSwitchingCamera) return;
  isSwitchingCamera = true;
  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
  console.log('[Webcam] Cambio fotocamera:', currentFacingMode);
  webcamState = 'loading';
  webcamMessage = 'Cambio fotocamera...';
  updateCameraButton();
  setTimeout(() => {
    setupWebcam();
    setTimeout(() => { isSwitchingCamera = false; }, 2000);
  }, 400);
}

function setupWebcam() {
  console.log('[Webcam] setupWebcam avviato');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    webcamState = 'unsupported';
    webcamMessage = 'Questo browser non supporta la fotocamera. Prova Chrome, Edge o Safari.';
    console.error('[Webcam]', webcamMessage);
    logToStatus(webcamMessage);
    updateCameraButton();
    return;
  }

  webcamState = 'loading';
  webcamMessage = 'Richiesta accesso fotocamera...';

  const constraints = {
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30 }
    },
    audio: false
  };

  if (isMobile()) {
    constraints.video.facingMode = { ideal: currentFacingMode };
  }

  tryCreateCapture(constraints, 1);
  updateCameraButton();
}

function tryCreateCapture(constraints, attempt) {
  console.log(`[Webcam] Tentativo ${attempt}`, constraints);

  if (video) {
    if (video.elt && video.elt.srcObject) {
      video.elt.srcObject.getTracks().forEach(track => track.stop());
    }
    video.remove();
    video = null;
  }

  try {
    video = createCapture(constraints, (stream) => {
      console.log('[Webcam] createCapture callback:', stream ? 'stream ricevuto' : 'no stream');
      if (video && video.elt) {
        video.elt.setAttribute('playsinline', '');
        video.elt.setAttribute('webkit-playsinline', 'true');
        video.elt.setAttribute('muted', '');
        video.elt.setAttribute('autoplay', '');

        // Proprietà DOM necessarie per iOS Safari
        video.elt.playsInline = true;
        video.elt.muted = true;
        video.elt.autoplay = true;

        video.size(320, 240);
        video.hide();

        function setActive() {
          console.log('[Webcam] Video attivo, dimensioni:', video.elt.videoWidth, video.elt.videoHeight);
          if (webcamState !== 'active') {
            webcamState = 'active';
            webcamMessage = 'Fotocamera attiva.';
            logToStatus('Fotocamera attiva. Mostra una carta per iniziare.');
            updateCameraButton();
          }
        }

        if (video.elt.readyState >= 2) {
          console.log('[Webcam] Video già pronto al callback');
          setActive();
        } else {
          // Aspetta il canplay per passare ad active senza fidarsi solo del timeout
          video.elt.addEventListener('canplay', () => {
            console.log('[Webcam] Evento canplay ricevuto');
            if (webcamState !== 'active') {
              setActive();
            }
          }, { once: true });
        }

        video.elt.play().catch(e => console.warn('[Webcam] Autoplay bloccato:', e));
      }
    });
  } catch (e) {
    console.error('[Webcam] Errore createCapture:', e);
    tryFallbackDevice(attempt + 1);
    return;
  }

  const timeoutMs = isMobile() ? 15000 : 4000;
  setTimeout(() => {
    if (webcamState === 'active') return;

    const isPlaying = video && video.elt && video.elt.readyState >= 2 && video.elt.videoWidth > 0;
    if (isPlaying) {
      console.log('[Webcam] Video attivo, dimensioni:', video.elt.videoWidth, video.elt.videoHeight);
      webcamState = 'active';
      webcamMessage = 'Fotocamera attiva.';
      logToStatus('Fotocamera attiva. Mostra una carta per iniziare.');
      updateCameraButton();
      return;
    }

    console.warn(`[Webcam] Video nero o non attivo al tentativo ${attempt}`);
    if (attempt < 3) {
      webcamMessage = `Tentativo fotocamera ${attempt + 1}/3...`;
      tryFallbackDevice(attempt + 1);
    } else {
      webcamState = 'error';
      webcamMessage = 'Impossibile attivare la fotocamera. Tocca il pulsante per riprovare.';
      logToStatus(webcamMessage);
      updateCameraButton();
    }
  }, timeoutMs);
}

function tryFallbackDevice(attempt) {
  navigator.mediaDevices.enumerateDevices()
    .then(devices => {
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      console.log('[Webcam] Dispositivi trovati:', videoDevices.map(d => d.label || 'senza nome'));

      if (videoDevices.length === 0) {
        if (isMobile() && attempt === 1) {
          const mobileConstraints = {
            video: {
              facingMode: { exact: 'user' },
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 30 }
            },
            audio: false
          };
          tryCreateCapture(mobileConstraints, attempt + 1);
        } else {
          webcamState = 'error';
          webcamMessage = 'Nessuna fotocamera trovata. Collegane una e ricarica.';
          logToStatus(webcamMessage);
          updateCameraButton();
        }
        return;
      }

      if (attempt <= videoDevices.length) {
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
        webcamMessage = 'Nessuna fotocamera funzionante trovata.';
        logToStatus(webcamMessage);
        updateCameraButton();
      }
    })
    .catch(err => {
      console.error('[Webcam] enumerateDevices error:', err);
      webcamState = 'error';
      webcamMessage = 'Errore nell\'elenco delle fotocamere.';
      logToStatus(webcamMessage);
      updateCameraButton();
    });
}

function draw() {
  background(22, 33, 62);
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

  // Epilogo narrativo su cambio stato finale
  if (prevGameState !== game.state) {
    if (game.state === GAME_STATE.VICTORY) {
      speakStoryEnding(true);
    } else if (game.state === GAME_STATE.GAME_OVER) {
      speakStoryEnding(false);
    }
    prevGameState = game.state;
  }

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

  if (qrEnabled && webcamState === 'active' && video && video.elt && video.elt.readyState >= 2 && video.elt.videoWidth > 0 && frameCount % 10 === 0) {
    readQR();
  }
}

function drawPlaying() {
  drawDecorations();
  drawHUD();
  drawEnemies();
  drawSlots();
  drawWebcamPreview();
  drawWebcamOverlay();
  drawLog();

  if (!waitingForTTS && qrEnabled && webcamState === 'active' && video && video.elt && video.elt.readyState >= 2 && video.elt.videoWidth > 0 && frameCount % 10 === 0) {
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
    const cy = lerp(height - 50, 120, easeOutCubic(animProgress));

    push();
    translate(cx, cy);
    rotate(animProgress * TWO_PI);
    drawCardFrame(0, 0, 90, 130, lastPlayedCard.color, lastPlayedCard.emoji, lastPlayedCard.name, lastPlayedCard.power, lastPlayedCard.element);
    pop();

    if (animProgress >= 0.8 && animProgress < 1.0) {
      enemyShake = 12;
      spawnParticles(width / 2, 120, lastPlayedCard.color, 30);
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
    text('ROUND VINTO!', width / 2, height / 2 - 30);
  } else if (game.lastResult === 'lose') {
    fill('#e74c3c');
    text('ROUND PERSO', width / 2, height / 2 - 30);
  } else {
    fill('#f1c40f');
    text('PAREGGIO', width / 2, height / 2 - 30);
  }

  textStyle(NORMAL);
  textSize(18);
  fill(255);
  text(game.lastResult === 'win' ? 'Prendi i nemici.' : game.lastResult === 'lose' ? '-1 HP.' : 'Nessun vantaggio.', width / 2, height / 2 + 30);

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
      checkStoryEvents();
      if (game.round !== oldRound) {
        tts.speak(`${game.currentEnemy.name} ${game.currentEnemy.power}.`);
      }
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

  if (qrEnabled && webcamState === 'active' && video && video.elt && video.elt.readyState >= 2 && video.elt.videoWidth > 0 && frameCount % 10 === 0) {
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
  if (game.enemies.length > 0) {
    text(`Nemico: ${game.currentEnemyIndex + 1}/${game.enemies.length}`, 20, 76);
  }
  textStyle(NORMAL);

  // Indicatore modalità
  const modeLabel = game.playMode === 'simultaneous' ? 'SIMULTANEO' : 'SEQUENZIALE';
  fill(game.playMode === 'simultaneous' ? '#e94560' : '#3498db');
  textAlign(RIGHT, TOP);
  textSize(14);
  textStyle(BOLD);
  text(modeLabel, width - 20, 20);
  textStyle(NORMAL);
}

function drawEnemies() {
  const n = game.enemies.length;
  if (n === 0) return;

  const cardW = 140;
  const cardH = 200;
  const gap = 30;
  const totalW = n * cardW + (n - 1) * gap;
  const startX = (width - totalW) / 2 + cardW / 2;
  const y = 160;

  for (let i = 0; i < n; i++) {
    const enemy = game.enemies[i];
    let x = startX + i * (cardW + gap);

    if (enemyShake > 0 && i === game.currentEnemyIndex && game.playMode === 'sequential') {
      x += random(-enemyShake, enemyShake);
    }

    // In modalita simultanea, evidenzia il nemico corrispondente allo slot attivo
    const isActive = game.playMode === 'sequential' ? i === game.currentEnemyIndex : true;

    push();
    translate(x, y);
    drawCardFrame(0, 0, cardW, cardH, enemy.color, enemy.emoji, enemy.name, enemy.power, enemy.element);

    textSize(12);
    fill(255);
    textAlign(CENTER, TOP);
    text(`NEMICO ${i + 1}`, 0, -cardH / 2 + 8);

    if (!isActive) {
      fill(0, 0, 0, 100);
      noStroke();
      rect(-cardW / 2, -cardH / 2, cardW, cardH, 10);
    }
    pop();

    const elem = ELEMENTS[enemy.element];
    fill(elem.color);
    noStroke();
    ellipse(x, y - cardH / 2 - 22, 36, 36);
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(18);
    text(elem.emoji, x, y - cardH / 2 - 22);
  }
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
  if (currentFacingMode === 'user') {
    translate(px + pw, py);
    scale(-1, 1);
  } else {
    translate(px, py);
  }
  if (video && video.elt && video.elt.readyState >= 2 && video.elt.videoWidth > 0) {
    image(video, 0, 0, pw, ph);
  } else {
    fill(0);
    rect(0, 0, pw, ph);
  }
  pop();

  const isReady = webcamState === 'active' && video && video.elt && video.elt.readyState >= 2 && video.elt.videoWidth > 0;
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
  const cardW = 100;
  const cardH = 145;
  const gap = 20;
  const totalW = n * cardW + (n - 1) * gap;
  const startX = (width - totalW) / 2 + cardW / 2;
  const y = height - cardH / 2 - 40;

  for (let i = 0; i < n; i++) {
    const sx = startX + i * (cardW + gap);
    const card = playerSlots[i];
    const isNext = !slotLocked && !card;

    push();
    translate(sx, y);

    noFill();
    stroke(255, 255, 255, card ? 180 : isNext ? 100 : 50);
    strokeWeight(3);
    drawingContext.setLineDash(card ? [] : [8, 5]);
    rect(-cardW / 2, -cardH / 2, cardW, cardH, 10);
    drawingContext.setLineDash([]);

    if (card) {
      drawCardFrame(0, 0, cardW - 8, cardH - 8, card.color, card.emoji, card.name, card.power, card.element);
    } else if (isNext) {
      fill(255, 255, 255, 80);
      textAlign(CENTER, CENTER);
      textSize(13);
      text('SLOT', 0, -5);
      textSize(10);
      fill(255, 255, 255, 120);
      text(`${i + 1}`, 0, 12);
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
    spawnFloater('VITTORIA', width / 2, 120, '#2ecc71');
  } else if (event.result === 'lose') {
    audio.playLose();
    spawnFloater('SCONFITTA', width / 2, 120, '#e74c3c');
  } else {
    audio.playDraw();
    spawnFloater('PAREGGIO', width / 2, 120, '#f1c40f');
  }

  tts.onIdle(() => {
    slotLocked = false;
    lastPlayedCard = null;
    animProgress = 0;

    if (game.state === GAME_STATE.PLAYING && game.currentEnemy) {
      tts.speak(`${game.currentEnemy.name} ${game.currentEnemy.power}.`);
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
      screenFlash = { color: [46, 204, 113], alpha: 120 };
      spawnFloater('+ NEMICI', width / 2, 120, '#2ecc71');
    } else if (event.lastResult === 'lose') {
      screenFlash = { color: [231, 76, 60], alpha: 120 };
      spawnFloater('-1 HP', width / 2, 120, '#e74c3c');
    } else {
      screenFlash = { color: [241, 196, 15], alpha: 100 };
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
  const enemyCardW = 140;
  const gap = 30;
  const totalW = n * enemyCardW + (n - 1) * gap;
  const startX = (width - totalW) / 2 + enemyCardW / 2;
  const enemyY = 160;
  const startY = height - 40;

  for (const anim of multiSlotAnim) {
    const cx = lerp(startX + anim.enemyIndex * (enemyCardW + gap), startX + anim.enemyIndex * (enemyCardW + gap), anim.progress);
    const cy = lerp(startY, enemyY, easeOutCubic(anim.progress));

    push();
    translate(cx, cy);
    rotate(anim.progress * TWO_PI);
    drawCardFrame(0, 0, 80, 115, anim.card.color, anim.card.emoji, anim.card.name, anim.card.power, anim.card.element);
    pop();
  }
}

function drawTTSPause() {
  fill(0, 0, 0, 100);
  noStroke();
  rect(0, 0, width, height);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(18);
  text('🔊 Ascolta...', width / 2, height - 210);
}

/* =========================================================
    RICONOSCIMENTO QR
   ========================================================= */

function readQR() {
  hiddenCanvas.push();
  if (currentFacingMode === 'user') {
    hiddenCanvas.translate(hiddenCanvas.width, 0);
    hiddenCanvas.scale(-1, 1);
  }
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
        tts.speak(`${game.currentEnemy.name} ${game.currentEnemy.power}.`);
      }
      logToStatus(event.action === 'start' ? 'Partita iniziata.' : 'Nuova partita.');

      if (event.action === 'start' && id && TEMPLATE_MAP[id]) {
        storyEngine.selectStory(id).then(() => {
          const text = storyEngine.getOpeningText();
          if (text) tts.speak(text);
          if (storyEngine.hasNext()) {
            storyEngine.advance();
            const effectsLog = storyEngine.applyGameEffects(game);
            if (effectsLog && effectsLog.length) {
              effectsLog.forEach(msg => {
                game.log(msg);
                logToStatus(msg);
              });
            }
            const passage = storyEngine.getCurrentPassage();
            if (passage && passage.gameEffects && passage.gameEffects.enemyPowerModifier !== undefined) {
              game.regenerateEnemiesForCurrentRound();
            }
          }
        });
      } else {
        storyEngine.reset();
      }
      return;
    } else if (event.action === 'mode') {
      tts.speak(event.mode === 'simultaneous' ? 'Simultaneo.' : 'Sequenziale.', true);
      logToStatus(`Modalità ${event.mode}.`);
      if (game.state === GAME_STATE.PLAYING) {
        resetSlots();
        multiSlotAnim = [];
        lastPlayedCard = null;
        animProgress = 0;
        if (game.currentEnemy) {
          const enemyNames = game.enemies.map(e => `${e.name} ${e.power}`).join(', ');
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

/* =========================================================
    NARRAZIONE / STORY ENGINE
   ========================================================= */

function checkStoryEvents() {
  if (!storyEngine || !storyEngine.hasStory()) return;
  const eventPassage = storyEngine.getEventForRound(game.round);
  if (eventPassage) {
    storyEngine.goToPassage(eventPassage.name);
    if (eventPassage.text) tts.speak(eventPassage.text);
    const effectsLog = storyEngine.applyGameEffects(game);
    if (effectsLog && effectsLog.length) {
      effectsLog.forEach(msg => {
        game.log(msg);
        logToStatus(msg);
      });
    }
    if (eventPassage.gameEffects && eventPassage.gameEffects.enemyPowerModifier !== undefined) {
      game.regenerateEnemiesForCurrentRound();
    }
  }
}

function speakStoryEnding(victory) {
  if (!storyEngine || !storyEngine.hasStory()) return;
  const passage = storyEngine.getEnding(victory);
  if (passage && passage.text) {
    tts.speak(passage.text);
  }
}
