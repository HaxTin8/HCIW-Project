/* =========================================================
   SPECULA ELEMENTAE — frontend p5.js, input solo da webcam QR
   Versione no-WIMP: il giocatore gestisce fisicamente le carte.
   ========================================================= */

import { ELEMENTS, TEMPLATE_MAP, createCard } from './cards.js';
import { Game, GAME_STATE } from './game.js';
import { audio } from './audio.js';
import { familyVoice } from './family-voice.js';
import { tts } from './tts.js';
import { StoryEngine } from './stories/story-engine.js';

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
var webcamMessage = 'Sto preparando la fotocamera...';

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
var ttsToggle;
var ttsRepeatBtn;
var ttsProviderSelect;
var ttsProviderStatus;
var ttsGameplayVoiceSelect;
var ttsStoryVoiceSelect;
var helpPanel;
var debugPanel;
var debugMode = false;
var currentFacingMode = 'environment';
var isSwitchingCamera = false;
var magicFont;
var elementImages = {};
var heartImage = null;
var heroImages = {};
var heroIntroStart = 0;
const HERO_APPEAR = ['fire', 'water', 'river', 'towers', 'mountains'];
const HERO_ZORDER = ['mountains', 'towers', 'river', 'water', 'fire'];
const HERO_LAYOUT = {
  mountains: { x: 55, y: 18, w: 240 },
  towers: { x: 0, y: 88, w: 226 },
  river: { x: 22, y: 185, w: 252 },
  water: { x: -32, y: 230, w: 248 },
  fire: { x: 108, y: 268, w: 214 }
};

function preload() {
  magicFont = loadFont('fonts/magic-school.ttf');

  heroImages.fire = loadImage('assets/hero/fire.png');
  heroImages.water = loadImage('assets/hero/water.png');
  heroImages.river = loadImage('assets/hero/river.png');
  heroImages.towers = loadImage('assets/hero/towers.png');
  heroImages.mountains = loadImage('assets/hero/mountains.png');

  elementImages.FIRE = loadImage('assets/elements/fire.png');
  elementImages.WATER = loadImage('assets/elements/water.png');
  elementImages.NATURE = loadImage('assets/elements/nature.png');
  elementImages.LIGHT = loadImage('assets/elements/light.png');
  elementImages.SHADOW = loadImage('assets/elements/shadow.png');
  elementImages.THUNDER = loadImage('assets/elements/thunder.png');
  heartImage = loadImage('assets/elements/heart-life.png');
}

function makeBgTransparent(img) {
  if (!img) return;
  img.loadPixels();
  const pixels = img.pixels;
  if (!pixels || pixels.length === 0 || pixels[3] === 0) return;

  const r0 = pixels[0];
  const g0 = pixels[1];
  const b0 = pixels[2];

  for (let i = 0; i < pixels.length; i += 4) {
    const dr = pixels[i] - r0;
    const dg = pixels[i + 1] - g0;
    const db = pixels[i + 2] - b0;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);

    if (distance < 14) {
      pixels[i + 3] = 0;
    } else if (distance < 26) {
      pixels[i + 3] = Math.round(((distance - 14) / 12) * 255);
    }
  }

  img.updatePixels();
}

function getCanvasSize() {
  const container = select('#canvas-container');
  const availableWidth = (container && container.elt ? container.elt.clientWidth : windowWidth - 40);
  const cw = min(availableWidth, 900);

  if (isMobile()) {
    const viewportH = windowHeight || window.innerHeight || 740;
    const desiredH = min(max(cw * 1.18, 460), viewportH * 0.72);
    return { width: cw, height: desiredH };
  }

  return { width: cw, height: cw * (600 / 900) };
}

function detectDebugMode() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search || '');
  return params.get('debug') === '1';
}

function populateProviderSelect(selectEl, providerState) {
  if (!selectEl || !selectEl.elt || !providerState) return;

  const current = providerState.preferredProvider || 'auto';
  const options = [
    `<option value="auto"${current === 'auto' ? ' selected' : ''}>Automatico</option>`,
    `<option value="piper"${current === 'piper' ? ' selected' : ''}>Piper server</option>`,
    `<option value="browser"${current === 'browser' ? ' selected' : ''}>Browser</option>`
  ];

  selectEl.html(options.join(''));
}

function updateProviderStatus(providerState) {
  if (!ttsProviderStatus || !ttsProviderStatus.elt || !providerState) return;
  ttsProviderStatus.html(providerState.message || 'Sintesi vocale non disponibile.');
  ttsProviderStatus.elt.dataset.provider = providerState.activeProvider || 'none';
}

function populateVoiceSelect(selectEl, catalog, channel) {
  if (!selectEl || !selectEl.elt) return;

  const provider = catalog && catalog.activeProvider ? catalog.activeProvider : 'browser';
  const voices = catalog && Array.isArray(catalog.voices) ? catalog.voices : [];
  const config = tts.getChannelConfig(channel);
  const currentVoiceURI = config
    ? (provider === 'piper' ? config.piperVoice : config.browserVoiceURI)
    : '';
  const autoLabel = provider === 'piper' ? 'Automatica (server)' : 'Automatica (browser)';
  const options = [`<option value="">${autoLabel}</option>`];

  for (const voice of voices) {
    const label = `${voice.name} (${voice.lang || 'n/a'})`;
    const selected = voice.voiceURI === currentVoiceURI ? ' selected' : '';
    options.push(`<option value="${voice.voiceURI}"${selected}>${label}</option>`);
  }

  selectEl.html(options.join(''));
}

function setup() {
  const container = select('#canvas-container');
  const size = getCanvasSize();
  const canvas = createCanvas(size.width, size.height);
  canvas.parent(container);

  hiddenCanvas = createGraphics(320, 240);
  hiddenCanvas.pixelDensity(1);

  for (const key of Object.keys(heroImages)) {
    const img = heroImages[key];
    if (!img) continue;
    img.resize(620, 0);
    makeBgTransparent(img);
  }

  statusEl = select('#status');
  game = new Game();
  storyEngine = new StoryEngine();
  storyEngine.loadIndex().catch(() => {});

  const qrToggle = select('#qr-toggle');
  if (qrToggle) {
    qrToggle.changed(() => {
      qrEnabled = qrToggle.checked();
      logToStatus(qrEnabled ? 'Lettura delle carte attivata.' : 'Lettura delle carte disattivata.');
    });
  }

  cameraBtn = select('#camera-btn');
  switchCameraBtn = select('#switch-camera-btn');
  ttsToggle = select('#tts-toggle');
  ttsRepeatBtn = select('#tts-repeat-btn');
  ttsProviderSelect = select('#tts-provider');
  ttsProviderStatus = select('#tts-provider-status');
  ttsGameplayVoiceSelect = select('#tts-gameplay-voice');
  ttsStoryVoiceSelect = select('#tts-story-voice');
  helpPanel = select('#help-panel');
  debugPanel = select('#debug-panel');
  debugMode = detectDebugMode();

  if (debugMode && debugPanel && debugPanel.elt) {
    debugPanel.elt.open = true;
  }

  const debugButtons = selectAll('.debug-btn');
  if (debugButtons && debugButtons.length > 0) {
    debugButtons.forEach((buttonEl) => {
      buttonEl.mousePressed(() => {
        const debugId = buttonEl.elt.dataset.debugId;
        if (!debugId) return;
        handleQRDetected(debugId);
      });
    });
  }

  if (cameraBtn) {
    cameraBtn.mousePressed(() => {
      tts.prime();
      if (cameraBtn) cameraBtn.style('display', 'none');
      setupWebcam();
    });
  }

  if (switchCameraBtn) {
    switchCameraBtn.mousePressed(switchCamera);
  }

  if (ttsToggle) {
    ttsToggle.changed(() => {
      const enabled = ttsToggle.checked();
      tts.setEnabled(enabled);
      logToStatus(enabled ? 'Voce guida attivata.' : 'Voce guida disattivata.');
    });
  }

  if (ttsRepeatBtn) {
    ttsRepeatBtn.mousePressed(() => {
      tts.prime();
      tts.repeatLast();
    });
  }

  if (ttsProviderSelect) {
    ttsProviderSelect.changed(async () => {
      tts.prime();
      await tts.setPreferredProvider(ttsProviderSelect.value());
      const providerState = tts.getProviderState();
      logToStatus(providerState.message);
    });
  }

  if (ttsGameplayVoiceSelect) {
    ttsGameplayVoiceSelect.changed(() => {
      tts.setChannelVoice('gameplay', ttsGameplayVoiceSelect.value(), tts.getVoiceCatalog().activeProvider);
      logToStatus('Voce guida aggiornata.');
    });
  }

  if (ttsStoryVoiceSelect) {
    ttsStoryVoiceSelect.changed(() => {
      tts.setChannelVoice('story', ttsStoryVoiceSelect.value(), tts.getVoiceCatalog().activeProvider);
      logToStatus('Voce narratore aggiornata.');
    });
  }

  tts.onVoicesChanged((catalog) => {
    populateProviderSelect(ttsProviderSelect, catalog.providerState);
    updateProviderStatus(catalog.providerState);
    populateVoiceSelect(ttsGameplayVoiceSelect, catalog, 'gameplay');
    populateVoiceSelect(ttsStoryVoiceSelect, catalog, 'story');
  });

  tts.onProviderChanged((providerState) => {
    populateProviderSelect(ttsProviderSelect, providerState);
    updateProviderStatus(providerState);
  });

  if (!isMobile()) {
    setupWebcam();
  } else {
    webcamState = 'waiting';
    webcamMessage = 'Tocca il pulsante per attivare la fotocamera.';
    if (helpPanel && helpPanel.elt) {
      helpPanel.elt.open = false;
    }
    updateCameraButton();
  }
  logToStatus(debugMode
    ? 'Modalita debug attiva: usa i pulsanti rapidi per simulare i QR code.'
    : 'Mostra una carta alla webcam per iniziare la tua avventura.');
}

function windowResized() {
  const size = getCanvasSize();
  resizeCanvas(size.width, size.height);
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
  tts.prime();
  isSwitchingCamera = true;
  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
  console.log('[Webcam] Cambio fotocamera:', currentFacingMode);
  webcamState = 'loading';
  webcamMessage = 'Sto cambiando fotocamera...';
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
    webcamMessage = 'Questo browser non supporta bene la fotocamera. Prova Chrome, Edge o Safari.';
    console.error('[Webcam]', webcamMessage);
    logToStatus(webcamMessage);
    updateCameraButton();
    return;
  }

  webcamState = 'loading';
  webcamMessage = 'Sto chiedendo il permesso per usare la fotocamera...';

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
            logToStatus('Fotocamera attiva. Mostra una carta per iniziare la tua avventura.');
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
      logToStatus('Fotocamera attiva. Mostra una carta per iniziare la tua avventura.');
      updateCameraButton();
      return;
    }

    console.warn(`[Webcam] Video nero o non attivo al tentativo ${attempt}`);
    if (attempt < 3) {
      webcamMessage = `Tentativo fotocamera ${attempt + 1}/3...`;
      tryFallbackDevice(attempt + 1);
    } else {
      webcamState = 'error';
      webcamMessage = 'Non riesco ad attivare la fotocamera. Tocca il pulsante per riprovare.';
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
          webcamMessage = 'Non trovo una fotocamera. Collegane una e ricarica.';
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
        webcamMessage = 'Non ho trovato una fotocamera funzionante.';
        logToStatus(webcamMessage);
        updateCameraButton();
      }
    })
    .catch(err => {
      console.error('[Webcam] enumerateDevices error:', err);
      webcamState = 'error';
      webcamMessage = 'C\'e stato un problema mentre cercavo le fotocamere.';
      logToStatus(webcamMessage);
      updateCameraButton();
    });
}

function draw() {
  drawCanvasBackground();
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
      drawEndScreen('AVVENTURA FINITA', '#e74c3c', 'Mostra una carta per ricominciare.');
      break;
    case GAME_STATE.VICTORY:
      drawEndScreen('BRAVISSIMO!', '#2ecc71', 'Mostra una carta per una nuova avventura.');
      break;
  }
}

/* =========================================================
   SCHERMATE
   ========================================================= */

function drawIdle() {
  drawHeroArt();
  drawDecorations();
  drawWebcamPreview();
  drawWebcamOverlay();

  fill('#2b2318');
  textAlign(CENTER, CENTER);
  textFont(magicFont || 'Space Grotesk');
  textSize(isCompactMobileLayout() ? 34 : 42);
  textStyle(NORMAL);
  text('Specula Elementae', width / 2, height / 2 - 86);

  textFont('Hanken Grotesk');
  textSize(18);
  fill('#5a4a34');
  text('Gioca, ascolta e scopri i segreti degli elementi.', width / 2, height / 2 - 20);

  if (webcamState === 'active') {
    const t = millis() / 1000;
    const pulse = sin(t * 3) * 5;
    fill('#b0842f');
    textSize(20);
    text('📷 Mostra una carta alla webcam per iniziare', width / 2, height / 2 + 40 + pulse);
  }

  textFont('Space Grotesk');

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
  text(game.lastResult === 'win' ? 'Hai superato la prova.' : game.lastResult === 'lose' ? 'Perdi un cuore, ma puoi imparare dal round.' : 'Osserva meglio gli elementi per il prossimo turno.', width / 2, height / 2 + 30);

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
        tts.speak(getEnemyAnnouncement(game.currentEnemy), { channel: 'gameplay' });
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
  stroke(152, 126, 76, 18);
  strokeWeight(1);
  for (let x = 0; x < width; x += 40) line(x, 0, x, height);
  for (let y = 0; y < height; y += 40) line(0, y, width, y);
}

function drawHeroArt() {
  if (heroIntroStart === 0) heroIntroStart = millis();
  if (isCompactMobileLayout()) return;

  push();
  for (const key of HERO_ZORDER) {
    const img = heroImages[key];
    if (!img || !img.width) continue;
    const idx = HERO_APPEAR.indexOf(key);
    const progress = constrain((millis() - heroIntroStart - idx * 450) / 850, 0, 1);
    if (progress <= 0) continue;
    const eased = easeOutCubic(progress);
    const layer = HERO_LAYOUT[key];
    tint(255, 210 * eased);
    image(img, layer.x, layer.y + (1 - eased) * 60, layer.w, layer.w);
  }
  pop();
}

function isCompactMobileLayout() {
  return isMobile() || width <= 520;
}

function getCanvasLayout() {
  const compact = isCompactMobileLayout();

  if (!compact) {
    return {
      compact,
      hudX: 20,
      hudY: 20,
      hudHintWidth: 360,
      hudFont: 18,
      hudSmallFont: 13,
      modeFont: 14,
      enemyCardW: 140,
      enemyCardH: 200,
      enemyGap: 30,
      enemyY: 160,
      enemyBadgeOffsetY: 22,
      slotCardW: 100,
      slotCardH: 145,
      slotGap: 20,
      slotsY: height - 145 / 2 - 40,
      previewW: 160,
      previewH: 120,
      previewX: width - 160 - 20,
      previewY: 20,
      logX: 20,
      logY: height - 150,
      logW: 320,
      logH: 110,
      logFont: 12,
      logItems: 5,
      overlayW: 420,
      overlayH: 140,
      overlayY: height / 2 + 60,
      ttsPauseY: height - 210
    };
  }

  const previewW = min(118, width * 0.31);
  const previewH = round(previewW * 0.75);
  const hudX = 14;
  const hudY = 16;
  const previewX = width - previewW - 14;
  const topReserved = max(previewH + 34, 112);
  const enemyCardW = game && game.playMode === 'simultaneous' ? 82 : 112;
  const enemyCardH = game && game.playMode === 'simultaneous' ? 118 : 154;
  const slotCardW = game && game.playMode === 'simultaneous' ? 72 : 84;
  const slotCardH = game && game.playMode === 'simultaneous' ? 102 : 118;
  const logH = 72;
  const bottomSafe = 18;
  const slotsY = height - slotCardH / 2 - logH - bottomSafe - 14;

  return {
    compact,
    hudX,
    hudY,
    hudHintWidth: width - hudX * 2,
    hudFont: 14,
    hudSmallFont: 11,
    modeFont: 11,
    enemyCardW,
    enemyCardH,
    enemyGap: game && game.playMode === 'simultaneous' ? 10 : 18,
    enemyY: topReserved + enemyCardH / 2 + 16,
    enemyBadgeOffsetY: 16,
    slotCardW,
    slotCardH,
    slotGap: game && game.playMode === 'simultaneous' ? 8 : 12,
    slotsY,
    previewW,
    previewH,
    previewX,
    previewY: 14,
    logX: 14,
    logY: height - logH - bottomSafe,
    logW: width - 28,
    logH,
    logFont: 11,
    logItems: 2,
    overlayW: min(width - 28, 360),
    overlayH: 120,
    overlayY: height / 2 + 20,
    ttsPauseY: height - 140
  };
}

function drawHUD() {
  const layout = getCanvasLayout();

  fill('#2b2318');
  textAlign(LEFT, TOP);
  textSize(layout.hudFont);
  textStyle(BOLD);
  if (heartImage && heartImage.width > 0) {
    text('Cuori:', layout.hudX, layout.hudY);
    const labelWidth = textWidth('Cuori:');
    const heartSize = layout.compact ? 18 : 22;
    const heartY = layout.hudY - 2;
    for (let i = 0; i < max(game.hp, 0); i++) {
      image(heartImage, layout.hudX + labelWidth + 10 + i * (heartSize + 4), heartY, heartSize, heartSize);
    }
  } else {
    text(`Cuori: ${'❤️'.repeat(max(game.hp, 0))}`, layout.hudX, layout.hudY);
  }
  fill('#5a4a34');
  text(`Round: ${game.round}/${game.roundsToWin}`, layout.hudX, layout.hudY + (layout.compact ? 24 : 28));
  if (game.enemies.length > 0) {
    text(`Carta avversaria: ${game.currentEnemyIndex + 1}/${game.enemies.length}`, layout.hudX, layout.hudY + (layout.compact ? 48 : 56));
  }
  textStyle(NORMAL);

  const enemy = game.currentEnemy;
  if (enemy) {
    fill('#5a4a34');
    textSize(layout.hudSmallFont);
    text(getEnemyHint(enemy), layout.hudX, layout.hudY + (layout.compact ? 72 : 84), layout.hudHintWidth, layout.compact ? 32 : 48);
  }

  // Indicatore modalità
  const modeLabel = game.playMode === 'simultaneous' ? 'SFIDA MULTIPLA' : 'UNA CARTA ALLA VOLTA';
  fill(game.playMode === 'simultaneous' ? '#d19725' : '#498AE2');
  textAlign(RIGHT, TOP);
  textSize(layout.modeFont);
  textStyle(BOLD);
  if (!layout.compact) {
    text(modeLabel, width - 20, layout.hudY);
  }
  textStyle(NORMAL);
}

function drawEnemies() {
  const layout = getCanvasLayout();
  const n = game.enemies.length;
  if (n === 0) return;

  const cardW = layout.enemyCardW;
  const cardH = layout.enemyCardH;
  const gap = layout.enemyGap;
  const totalW = n * cardW + (n - 1) * gap;
  const startX = (width - totalW) / 2 + cardW / 2;
  const y = layout.enemyY;

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

    textSize(layout.compact ? 10 : 12);
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
    const badgeSize = layout.compact ? 28 : 36;
    push();
    translate(x, y - cardH / 2 - layout.enemyBadgeOffsetY);
    fill('#ffffff');
    stroke(elem.color);
    strokeWeight(2);
    ellipse(0, 0, badgeSize, badgeSize);
    noStroke();
    drawElementImage(enemy.element, badgeSize * 0.72, elem.color);
    pop();
  }
}

function drawCardFrame(x, y, w, h, color, emoji, name, power, element) {
  const compact = isCompactMobileLayout();
  push();
  translate(x, y);

  noStroke();
  fill(0, 0, 0, 80);
  rect(-w / 2 + 4, -h / 2 + 4, w, h, 10);

  stroke('#cdbb90');
  strokeWeight(2);
  fill('#f2e9d5');
  rect(-w / 2, -h / 2, w, h, 10);

  noFill();
  stroke(111, 95, 69, 60);
  strokeWeight(1);
  rect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 8);

  noStroke();
  fill(color);
  rect(-w / 2 + 4, -h / 2 + 4, w - 8, 28, 6);

  fill(textColorForBg(color));
  textAlign(CENTER, CENTER);
  textSize(compact ? 11 : 13);
  textStyle(BOLD);
  text(name, 0, -h / 2 + 18);
  textStyle(NORMAL);

  push();
  translate(0, 8);
  drawElementImage(element, min(w, h) * 0.62, color);
  pop();

  fill('#6f5f45');
  textSize(compact ? 16 : 20);
  textStyle(BOLD);
  text(power, 0, 45);
  textStyle(NORMAL);

  fill(color);
  textSize(compact ? 9 : 11);
  text(ELEMENTS[element].name, 0, h / 2 - 18);

  pop();
}

function drawWebcamPreview() {
  const layout = getCanvasLayout();
  const pw = layout.previewW;
  const ph = layout.previewH;
  const px = layout.previewX;
  const py = layout.previewY;

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
  stroke(isReady ? (qrEnabled ? '#7ca35e' : '#b77b52') : '#d3a03e');
  strokeWeight(2);
  noFill();
  rect(px, py, pw, ph, 8);

  fill('#5a4a34');
  noStroke();
  textAlign(CENTER, TOP);
  textSize(layout.compact ? 10 : 11);
  if (isReady) {
    text(qrEnabled ? 'Carte: lettura attiva' : 'Carte: lettura in pausa', px + pw / 2, py + ph + 6);
  } else {
    text(webcamMessage, px + pw / 2, py + ph + 6);
  }
}

function drawWebcamOverlay() {
  if (webcamState === 'active') return;

  const layout = getCanvasLayout();
  const overlayW = layout.overlayW;
  const overlayH = layout.overlayH;
  const x = width / 2 - overlayW / 2;
  const y = layout.overlayY;

  fill(255, 252, 245, 240);
  stroke('#d9ccb3');
  strokeWeight(1);
  rect(x, y, overlayW, overlayH, 14);

  fill('#7c5a1f');
  textAlign(CENTER, CENTER);
  textSize(layout.compact ? 16 : 18);
  textStyle(BOLD);
  text('📷 Webcam', width / 2, y + 30);
  textStyle(NORMAL);

  fill('#5a4a34');
  textSize(layout.compact ? 12 : 14);
  text(webcamMessage, width / 2, y + 75);

  if (webcamState === 'denied' || webcamState === 'error' || webcamState === 'unsupported') {
    textSize(12);
    fill('#c56b57');
    text('Concedi il permesso e premi F5 per ricaricare.', width / 2, y + 105);
  }
}

function drawLog() {
  const layout = getCanvasLayout();
  const x = layout.logX;
  const y = layout.logY;
  const w = layout.logW;
  const h = layout.logH;

  fill(255, 252, 245, 232);
  stroke('#d9ccb3');
  strokeWeight(1);
  rect(x, y, w, h, 8);

  noStroke();
  fill('#5a4a34');
  textAlign(LEFT, TOP);
  textSize(layout.logFont);
  const visible = game.logs.slice(-layout.logItems);
  for (let i = 0; i < visible.length; i++) {
    text('• ' + visible[i], x + 10, y + 10 + i * (layout.compact ? 18 : 20), w - 20, layout.compact ? 16 : 18);
  }
}

function getStrongAgainstText(elementId) {
  const element = ELEMENTS[elementId];
  if (!element || !element.strongVs || element.strongVs.length === 0) return '';
  return element.strongVs.map((id) => ELEMENTS[id].name).join(' e ');
}

function getWeakAgainstText(elementId) {
  const element = ELEMENTS[elementId];
  if (!element || !element.weakTo || element.weakTo.length === 0) return '';
  return element.weakTo.map((id) => ELEMENTS[id].name).join(' e ');
}

function getEnemyHint(enemy) {
  const strongChoices = getWeakAgainstText(enemy.element);
  const elementName = ELEMENTS[enemy.element].name;
  return `Suggerimento: contro ${enemy.name} di ${elementName}, prova ${strongChoices}.`;
}

function getCardLearningLine(card) {
  const strongChoices = getStrongAgainstText(card.element);
  return `${card.name}: ${ELEMENTS[card.element].name}. Utile contro ${strongChoices}.`;
}

function getEnemyAnnouncement(enemy) {
  return `${enemy.name}, forza ${enemy.power}. ${getEnemyHint(enemy)}`;
}

function getCardPromptKey(card, requiresRemoval = false) {
  if (!card || !card.templateId) return '';
  return requiresRemoval ? `game.card.${card.templateId}.remove` : `game.card.${card.templateId}`;
}

function getStoryPromptKey(passageName) {
  if (!storyEngine || typeof storyEngine.getPromptKeyForPassage !== 'function') return '';
  return storyEngine.getPromptKeyForPassage(passageName);
}

function drawCanvasBackground() {
  background('#f1f6fc');
}

function textColorForBg(hex) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#2b2318' : '#fdf6e6';
}

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
    drawElementGlyph(element, size * 0.8, fallbackColor);
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
  const layout = getCanvasLayout();
  const n = game.cardsPerRound;
  const cardW = layout.slotCardW;
  const cardH = layout.slotCardH;
  const gap = layout.slotGap;
  const totalW = n * cardW + (n - 1) * gap;
  const startX = (width - totalW) / 2 + cardW / 2;
  const y = layout.slotsY;

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
      textSize(layout.compact ? 11 : 13);
      text('SLOT', 0, -5);
      textSize(layout.compact ? 9 : 10);
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
    tts.speak(`${getCardLearningLine(card)} Togli la carta.`, {
      channel: 'gameplay',
      promptKey: getCardPromptKey(card, true)
    });
    logToStatus(`${card.name} nello slot. ${getCardLearningLine(card)}`);
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
      tts.speak(getCardLearningLine(card), {
        channel: 'gameplay',
        promptKey: getCardPromptKey(card, false)
      });
      logToStatus(`${card.name} nello slot ${i + 1}. ${getCardLearningLine(card)}`);
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
      tts.speak(getEnemyAnnouncement(game.currentEnemy), { channel: 'gameplay' });
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
  tts.speak(`Hai fatto ${wins} vittorie e ${losses} sconfitte in questo round.`, { channel: 'gameplay' });

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
  const layout = getCanvasLayout();
  fill(0, 0, 0, 100);
  noStroke();
  rect(0, 0, width, height);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(layout.compact ? 16 : 18);
  text('🔊 Ascolta...', width / 2, layout.ttsPauseY);
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
  tts.prime();

  // Gestione start/restart/mode: questi non passano dallo slot
  if (id === 'RESTART' || id === 'SEQUENZIALE' || id === 'SIMULTANEO' ||
      game.state === GAME_STATE.IDLE ||
      game.state === GAME_STATE.GAME_OVER ||
      game.state === GAME_STATE.VICTORY) {
    const event = game.handleQR(id);

    if (event.action === 'start' || event.action === 'restart') {
      audio.playStart();
      tts.speak('Inizia l\'avventura.', {
        priority: true,
        channel: 'gameplay',
        promptKey: 'game.start'
      });
      lastPlayedCard = null;
      animProgress = 0;
      multiSlotAnim = [];
      resetSlots();
      if (game.currentEnemy) {
        tts.speak(getEnemyAnnouncement(game.currentEnemy), { channel: 'gameplay' });
      }
      logToStatus(event.action === 'start' ? 'Avventura iniziata.' : 'Nuova avventura.');

      if (event.action === 'start' && id && TEMPLATE_MAP[id]) {
        storyEngine.selectStory(id).then(() => {
          const text = storyEngine.getOpeningText();
          if (text) {
            tts.speak(text, {
              channel: 'story',
              promptKey: getStoryPromptKey()
            });
          }
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
      tts.speak(event.mode === 'simultaneous' ? 'Modalita sfida multipla.' : 'Modalita una carta alla volta.', {
        priority: true,
        channel: 'gameplay',
        promptKey: event.mode === 'simultaneous' ? 'game.mode.simultaneous' : 'game.mode.sequential'
      });
      logToStatus(event.mode === 'simultaneous' ? 'Modalita\' sfida multipla.' : 'Modalita\' una carta alla volta.');
      if (game.state === GAME_STATE.PLAYING) {
        resetSlots();
        multiSlotAnim = [];
        lastPlayedCard = null;
        animProgress = 0;
        if (game.currentEnemy) {
          const enemyNames = game.enemies.map(e => `${e.name} forza ${e.power}`).join(', ');
          tts.speak(enemyNames, { channel: 'gameplay' });
          logToStatus(`Carte avversarie: ${enemyNames}`);
        }
      }
    } else if (event.action === 'unknown') {
      logToStatus(`Non riconosco questa carta: ${id}.`);
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
    if (eventPassage.text) {
      tts.speak(eventPassage.text, {
        channel: 'story',
        promptKey: getStoryPromptKey(eventPassage.name)
      });
    }
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
    tts.speak(passage.text, {
      channel: 'story',
      promptKey: getStoryPromptKey(passage.name)
    });
  }
}

if (typeof window !== 'undefined') {
  window.preload = preload;
  window.setup = setup;
  window.draw = draw;
  window.windowResized = windowResized;
  window.familyVoice = familyVoice;
}
