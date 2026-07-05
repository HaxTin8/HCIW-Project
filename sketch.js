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
import magicSchoolFontUrl from './fonts/magic-school.ttf?url';

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
var statusMessage = 'Mostra una carta alla webcam per iniziare la tua avventura.';

// Slot fisico virtuale: il giocatore carica una carta alla volta.
var playerSlots = [];
var slotFrames = [];     // frame con la stessa carta in ogni slot
var slotEmptyFrames = 0; // frame senza QR rilevato
var slotLocked = false;
var slotLockFrames = 0;
const SLOT_EMPTY_THRESHOLD = 8;      // frame senza QR prima di giocare la carta rimossa
const SLOT_AUTOPLAY_THRESHOLD = 120; // frame con la stessa carta ferma -> gioca automaticamente
const SLOT_LOCK_TIMEOUT = 300;
var scaleFactor = 1;
var isCompact = false;

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
var logBalloonEl;
var settingsModal;
var settingsOpenBtn;
var settingsCloseBtn;
var settingsBackdrop;
var privacyInfoBtn;
var privacyInfoPopover;
var debugMode = false;
var currentFacingMode = 'environment';
var isSwitchingCamera = false;
var magicFont;
var elementImages = {};
var heartImage = null;
var webcamFrameImg = null;
var mapImage = null;
const MAP_ROUND_POINTS = [
  [48, 83], [68, 70], [39, 62], [33, 53],
  [72, 53], [59, 39], [31, 38], [59, 24]
];
var heroImages = {};
var heroIntroStart = 0;
const HERO_APPEAR = ['fire', 'water', 'river', 'towers', 'mountains'];
const HERO_ZORDER = ['mountains', 'towers', 'river', 'water', 'fire'];
const HERO_LAYOUT = {
  mountains: { x: 25, y: 136, w: 240 },
  towers: { x: -30, y: 206, w: 226 },
  river: { x: -8, y: 303, w: 252 },
  water: { x: -62, y: 348, w: 248 },
  fire: { x: 78, y: 386, w: 214 }
};

function preload() {
  magicFont = loadFont(magicSchoolFontUrl);

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
  webcamFrameImg = loadImage('assets/webcam-frame.png');
  mapImage = loadImage('assets/mappa.png');
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
  const container = document.getElementById('canvas-container');

  let w = container ? container.clientWidth : 0;
  let h = container ? container.clientHeight : 0;

  if (w <= 0) {
    w = windowWidth < 720 ? windowWidth - 40 : 900;
  }

  if (h <= 0) {
    h = windowHeight < 600 ? windowHeight - 160 : 600;
  }

  isCompact = w < 720;
  scaleFactor = !isCompact ? min(w / 900, h / 600) : min(w / 380, h / 520);

  return { width: w, height: h };
}

function sx(v) {
  return v * scaleFactor;
}

function sy(v) {
  return v * scaleFactor;
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
  logBalloonEl = select('#log-balloon');
  settingsModal = select('#settings-modal');
  settingsOpenBtn = select('#settings-open-btn');
  settingsCloseBtn = select('#settings-close-btn');
  settingsBackdrop = select('#settings-backdrop');
  privacyInfoBtn = select('#privacy-info-btn');
  privacyInfoPopover = select('#privacy-info-popover');
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

  if (settingsOpenBtn) {
    settingsOpenBtn.mousePressed(openSettingsModal);
  }

  if (settingsCloseBtn) {
    settingsCloseBtn.mousePressed(closeSettingsModal);
  }

  if (settingsBackdrop) {
    settingsBackdrop.mousePressed(closeSettingsModal);
  }

  if (privacyInfoBtn) {
    privacyInfoBtn.mousePressed((event) => {
      if (event && event.stopPropagation) event.stopPropagation();
      togglePrivacyInfoPopover();
    });
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeSettingsModal();
        closePrivacyInfoPopover();
      }
    });
    window.addEventListener('click', (event) => {
      if (!privacyInfoPopover || !privacyInfoPopover.elt || privacyInfoPopover.elt.hidden) return;
      const clickedButton = privacyInfoBtn && privacyInfoBtn.elt && privacyInfoBtn.elt.contains(event.target);
      const clickedPopover = privacyInfoPopover.elt.contains(event.target);
      if (!clickedButton && !clickedPopover) closePrivacyInfoPopover();
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

function openSettingsModal() {
  if (!settingsModal || !settingsModal.elt) return;
  settingsModal.elt.hidden = false;
  document.body.classList.add('settings-modal-open');
}

function closeSettingsModal() {
  if (!settingsModal || !settingsModal.elt) return;
  settingsModal.elt.hidden = true;
  document.body.classList.remove('settings-modal-open');
}

function togglePrivacyInfoPopover() {
  if (!privacyInfoPopover || !privacyInfoPopover.elt) return;
  privacyInfoPopover.elt.hidden = !privacyInfoPopover.elt.hidden;
}

function closePrivacyInfoPopover() {
  if (!privacyInfoPopover || !privacyInfoPopover.elt) return;
  privacyInfoPopover.elt.hidden = true;
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

  if (slotLocked) {
    slotLockFrames++;
    if (slotLockFrames > SLOT_LOCK_TIMEOUT) {
      console.warn('[Game] Sblocco automatico degli slot dopo timeout TTS.');
      slotLocked = false;
      slotLockFrames = 0;
      waitingForTTS = false;
      tts.cancel();
    }
  } else {
    slotLockFrames = 0;
  }

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

  updateLogBalloon();
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
    const tx = sx(20);
    const tw = width - sx(40);
    const centerX = width / 2;
    const gradW = 105 * scaleFactor;
    const grad = drawingContext.createLinearGradient(centerX - gradW, sy(24), centerX + gradW, sy(24));
    grad.addColorStop(0, '#DD4B50');   // Fuoco
    grad.addColorStop(0.2, '#ECBA4E');  // Tuono
    grad.addColorStop(0.4, '#ECE64E');  // Luce
    grad.addColorStop(0.6, '#97B481');  // Natura
    grad.addColorStop(0.8, '#498AE2');  // Acqua
    grad.addColorStop(1, '#8380BC');    // Ombra

    textFont(magicFont || 'Space Grotesk');
    textSize(52 * scaleFactor);
    drawingContext.fillStyle = grad;
    textAlign(CENTER, TOP);
    text('Specula Elementae', width / 2, sy(24));

    textSize(13 * scaleFactor);
    fill('#5a4a34');
    textFont('Nunito');
    text('Un solitario alchemico guidato dalla magia della tua webcam.', tx, sy(95), tw);

    if (webcamState === 'active') {
      const t = millis() / 1000;
      const pulse = sin(t * 3) * sx(4);
      fill('#498AE2');
      textFont('Beachday');
      textSize(24 * scaleFactor);
      textLeading(30 * scaleFactor);
      textAlign(CENTER, TOP);
      text('Mostra una carta alla webcam per iniziare', tx, sy(145) + pulse, tw);
    }

    fill('#2b2318');
    textAlign(CENTER, TOP);
    textSize(11 * scaleFactor);
    textFont('Nunito');
    text(statusMessage, tx, height - sy(55), tw);
  } else {
    const tx = sx(380);
    const tw = sx(380);
    const centerX = tx + tw / 2;
    const gradW = sx(135) * scaleFactor;
    const grad = drawingContext.createLinearGradient(centerX - gradW, sy(120), centerX + gradW, sy(120));
    grad.addColorStop(0, '#DD4B50');   // Fuoco
    grad.addColorStop(0.2, '#ECBA4E');  // Tuono
    grad.addColorStop(0.4, '#ECE64E');  // Luce
    grad.addColorStop(0.6, '#97B481');  // Natura
    grad.addColorStop(0.8, '#498AE2');  // Acqua
    grad.addColorStop(1, '#8380BC');    // Ombra

    textFont(magicFont || 'Space Grotesk');
    textSize(70 * scaleFactor);
    drawingContext.fillStyle = grad;
    textAlign(CENTER, TOP);
    text('Specula Elementae', tx, sy(120), tw);

    textSize(14 * scaleFactor);
    fill('#5a4a34');
    textFont('Nunito');
    text('Un solitario alchemico guidato dalla magia della tua webcam.', tx, sy(225), tw);

    if (webcamState === 'active') {
      const t = millis() / 1000;
      const pulse = sin(t * 3) * sx(4);
      fill('#498AE2');
      textFont('Beachday');
      textSize(26 * scaleFactor);
      textLeading(36 * scaleFactor);
      textAlign(CENTER, TOP);
      text('Mostra una carta alla webcam per iniziare', tx, sy(295) + pulse, tw);
    }
  }

  textFont('Beachday');

  idleHintTimer++;

  if (qrEnabled && webcamState === 'active' && video && video.elt && video.elt.readyState >= 2 && video.elt.videoWidth > 0 && frameCount % 10 === 0) {
    readQR();
  }
}

function drawPlaying() {
  drawHUD();
  drawEnemies();
  drawSlots();
  drawWebcamPreview();
  drawWebcamOverlay();
  drawLog();
  drawMapOverlay();
  drawHelpPanel();

  if (isCompact) {
    fill('#2b2318');
    textAlign(CENTER, CENTER);
    textSize(13 * scaleFactor);
    textFont('Nunito');
    text(statusMessage, sx(20), sy(300), width - sx(40));
    textFont('Beachday');
  }

  if (!waitingForTTS && qrEnabled && webcamState === 'active' && video && video.elt && video.elt.readyState >= 2 && video.elt.videoWidth > 0 && frameCount % 10 === 0) {
    readQR();
  }

  if (!waitingForTTS) {
    updateSlots();
  }
  if (waitingForTTS) {
    drawTTSPause();
  }
}

function drawRoundResult() {
  drawPlaying();

  // Animazione sequenziale della carta verso il nemico
  if (lastPlayedCard) {
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
    fill('#8380BC');
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
  drawWebcamPreview();
  drawWebcamOverlay();
  drawHelpPanel();

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

  push();
  const xOffset = isCompact ? (width / 2 - sx(130)) : 0;
  const yOffset = isCompact ? (height - sy(420)) : 0;
  const opacityMultiplier = isCompact ? 0.25 : 1.0;

  for (const key of HERO_ZORDER) {
    const img = heroImages[key];
    if (!img || !img.width) continue;
    const idx = HERO_APPEAR.indexOf(key);
    const progress = constrain((millis() - heroIntroStart - idx * 550) / 900, 0, 1);
    if (progress <= 0) continue;
    const eased = easeOutCubic(progress);
    const layer = HERO_LAYOUT[key];
    tint(255, 255 * eased * opacityMultiplier);
    image(
      img,
      sx(layer.x) + xOffset,
      sy(layer.y) + yOffset + sy((1 - eased) * 70),
      sx(layer.w),
      sx(layer.w)
    );
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
      previewW: sx(160),
      previewH: sy(120),
      previewX: width - sx(160) - sx(20),
      previewY: sy(20),
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

  const previewW = game && game.state === GAME_STATE.IDLE ? sx(160) : sx(100);
  const previewH = game && game.state === GAME_STATE.IDLE ? sy(120) : sy(75);
  const hudX = 14;
  const hudY = 16;
  const previewX = game && game.state === GAME_STATE.IDLE ? width / 2 - previewW / 2 : width - previewW - sx(15);
  const previewY = game && game.state === GAME_STATE.IDLE ? sy(240) : sy(15);
  const topReserved = max(previewH + 34, 112);
  const enemyCardW = 112;
  const enemyCardH = 154;
  const slotCardW = 84;
  const slotCardH = 118;
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
    enemyGap: 18,
    enemyY: topReserved + enemyCardH / 2 + 16,
    enemyBadgeOffsetY: 16,
    slotCardW,
    slotCardH,
    slotGap: 12,
    slotsY,
    previewW,
    previewH,
    previewX,
    previewY,
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

    if (enemyShake > 0 && i === game.currentEnemyIndex) {
      x += random(-enemyShake, enemyShake);
    }

    push();
    translate(x, y);
    drawCardFrame(0, 0, cardW, cardH, enemy.color, enemy.emoji, enemy.name, enemy.power, enemy.element);

    textSize(layout.compact ? 10 : 12);
    fill(255);
    textAlign(CENTER, TOP);
    text(`NEMICO ${i + 1}`, 0, -cardH / 2 + 8);
    pop();
  }
}

function drawCardFrame(x, y, w, h, color, emoji, name, power, element) {
  const compact = isCompactMobileLayout();
  push();
  translate(x, y);

  noStroke();
  fill(0, 0, 0, 40);
  rect(-w / 2 + 3, -h / 2 + 3, w, h, 14);

  stroke('#dce6f2');
  strokeWeight(1);
  fill('#f1f6fc');
  rect(-w / 2, -h / 2, w, h, 14);

  noStroke();
  fill(color);
  textAlign(CENTER, CENTER);
  textSize(compact ? 11 : 13);
  textStyle(BOLD);
  text(name, 0, -h / 2 + 18);
  textStyle(NORMAL);

  const medY = 8;
  const medR = min(w, h) * 0.36;
  const c = colorObj(color);
  fill(c.r, c.g, c.b, 26);
  ellipse(0, medY, medR * 2, medR * 2);

  push();
  translate(0, medY);
  drawElementImage(element, medR * 1.9, color);
  pop();

  fill('#6f5f45');
  textSize(compact ? 16 : 20);
  textStyle(BOLD);
  text(power, 0, compact ? 42 : 45);
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
  translate(px + pw, py);
  scale(-1, 1);
  if (video && video.elt && video.elt.readyState >= 2 && video.elt.videoWidth > 0) {
    image(video, 0, 0, pw, ph);
  } else {
    fill(0);
    rect(0, 0, pw, ph);
  }
  pop();

  const isReady = webcamState === 'active' && video && video.elt && video.elt.readyState >= 2 && video.elt.videoWidth > 0;

  if (webcamFrameImg && webcamFrameImg.width > 0) {
    push();
    drawingContext.shadowColor = isReady ? '#97B481' : '#498AE2';
    drawingContext.shadowBlur = sx(10);
    image(webcamFrameImg, px - sx(4), py - sx(4), pw + sx(8), ph + sx(8));
    pop();
  } else {
    stroke(isReady ? '#97B481' : '#498AE2');
    strokeWeight(sx(2));
    noFill();
    rect(px, py, pw, ph, sx(8));
  }

  if (!isReady) {
    fill('#5a4a34');
    noStroke();
    textFont('Nunito');
    textAlign(CENTER, TOP);
    textSize(11 * scaleFactor);
    text(webcamMessage, px + pw / 2, py + ph + 6);
  }

  textFont('Beachday');
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
  const r = sx(6);

  noStroke();
  fill('#ffffff');
  rect(x, y, alertW, alertH, r);
  fill(accent);
  rect(x, y, sx(6), alertH, r, 0, 0, r);

  const icoX = x + sx(34);
  const icoY = y + alertH / 2;
  fill(accent);
  ellipse(icoX, icoY, sx(28), sx(28));
  fill('#ffffff');
  textAlign(CENTER, CENTER);
  textSize(15 * scaleFactor);
  text(isProblem ? '!' : '📷', icoX, icoY);

  const tx = x + sx(58);
  const tw = alertW - sx(70);
  textAlign(LEFT, CENTER);

  textFont('Beachday');
  textStyle(BOLD);
  fill('#2b2318');
  textSize(13 * scaleFactor);
  text('Webcam', tx, hint ? y + sy(22) : icoY - sy(8));
  textStyle(NORMAL);

  textFont('Nunito');
  fill('#5a4a34');
  textSize(12 * scaleFactor);
  text(webcamMessage, tx, hint ? y + sy(40) : icoY + sy(9), tw);

  if (hint) {
    fill(accent);
    textSize(11 * scaleFactor);
    text(hint, tx, y + sy(62), tw);
  }

  textFont('Beachday');
}

function drawLog() {
  if (isCompact) {
    fill('#5a4a34');
    textFont('Nunito');
    textAlign(CENTER, BOTTOM);
    textSize(11 * scaleFactor);
    const lastLog = game.logs[game.logs.length - 1] || '';
    text(lastLog ? '• ' + lastLog : '', width / 2, height - sy(10));
    textFont('Beachday');
  }
}

function drawHelpPanel() {
  if (isCompact) return;

  const pw = sx(180);
  const px = width - pw - sx(20);
  const ph = sy(360);
  const py = height - ph - sy(20);
  const padX = sx(14);
  const innerW = pw - padX * 2;

  drawHoloFrame(px, py, pw, ph, sx(12));

  noStroke();
  fill('#ffffff');
  stroke('#dce6f2');
  strokeWeight(sx(1));
  rect(px, py, pw, ph, sx(12));

  noStroke();
  textFont('Beachday');
  textStyle(BOLD);
  fill('#498AE2');
  textAlign(LEFT, TOP);
  textSize(16 * scaleFactor);
  text('COME SI GIOCA', px + padX, py + sy(12));
  textStyle(NORMAL);

  const lines = [
    'Le tue carte sono fisiche.',
    'Mostrale alla webcam per giocarle.',
    'Il computer legge e parla.',
    'Se vinci avanzi nella mappa.',
    'Se perdi, -1 HP.',
    'Vinci dopo 8 round.'
  ];

  textFont('Nunito');
  textSize(11 * scaleFactor);
  textLeading(15 * scaleFactor);
  const bulletIndent = sx(16);
  let cursorY = py + sy(44);
  const lineBoxH = sy(32);
  for (const line of lines) {
    fill('#498AE2');
    textAlign(LEFT, TOP);
    text('✤', px + padX, cursorY);
    fill('#2b2318');
    text(line, px + padX + bulletIndent, cursorY, innerW - bulletIndent, lineBoxH);
    cursorY += lineBoxH;
  }

  cursorY += sy(6);
  stroke('#dce6f2');
  strokeWeight(sx(1));
  line(px + padX, cursorY, px + pw - padX, cursorY);
  cursorY += sy(12);

  noStroke();
  textFont('Beachday');
  textStyle(BOLD);
  fill('#498AE2');
  textSize(13 * scaleFactor);
  text('STATO', px + padX, cursorY);
  textStyle(NORMAL);
  cursorY += sy(20);

  textFont('Nunito');
  fill('#5a4a34');
  textSize(11 * scaleFactor);
  textLeading(15 * scaleFactor);
  text(statusMessage, px + padX, cursorY, innerW, py + ph - cursorY - sy(12));

  textFont('Beachday');
}

function updateLogBalloon() {
  if (!logBalloonEl || !logBalloonEl.elt) return;

  const isPlayingState = game.state === GAME_STATE.PLAYING || game.state === GAME_STATE.ROUND_RESULT;
  const shouldBeActive = isPlayingState && !isCompact;

  if (shouldBeActive) {
    logBalloonEl.addClass('active');
    const visible = game.logs.slice(-4);
    const html = visible.map((log) => `<div style="margin-bottom: 6px;">• ${log}</div>`).join('');
    logBalloonEl.html(`<div style="width: 100%;">${html}</div>`);
  } else {
    logBalloonEl.removeClass('active');
  }
}

function drawMapOverlay() {
  const isPlayingState = game.state === GAME_STATE.PLAYING || game.state === GAME_STATE.ROUND_RESULT;
  if (!isPlayingState || isCompactMobileLayout()) return;

  const mw = 210;
  const mh = mapImage && mapImage.width > 0 ? mw * (mapImage.height / mapImage.width) : mw * 1.333;
  const cx = width * 0.22;
  const cy = height / 2;

  push();
  translate(cx - mw / 2, cy - mh / 2);

  noStroke();
  if (mapImage && mapImage.width > 0) {
    image(mapImage, 0, 0, mw, mh);
  } else {
    fill('#f2e9d5');
    rect(0, 0, mw, mh, 12);
  }

  const points = MAP_ROUND_POINTS.map(([px, py]) => [px / 100 * mw, py / 100 * mh]);

  stroke('#e02424');
  strokeWeight(1.3);
  noFill();
  drawingContext.setLineDash([4, 3]);
  const stepsDone = constrain(game.round - 1, 0, points.length - 1);
  for (let i = 0; i < stepsDone; i++) {
    line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
  }
  drawingContext.setLineDash([]);

  for (let r = 1; r <= 8; r++) {
    const [px, py] = points[r - 1];
    let dotColor;
    let dotTextColor;
    let dotR = 10;

    if (r < game.round) {
      dotColor = '#97B481';
      dotTextColor = '#ffffff';
    } else if (r === game.round) {
      dotColor = '#498AE2';
      dotTextColor = '#ffffff';
      dotR = 12;
      const pulse = sin(millis() / 250) * 0.5 + 0.5;
      noStroke();
      fill(73, 138, 226, 90 * pulse);
      ellipse(px, py, dotR * 2 + 12 * pulse, dotR * 2 + 12 * pulse);
    } else {
      dotColor = '#e6dfd1';
      dotTextColor = '#a49784';
    }

    stroke('#5c3e1e');
    strokeWeight(1.5);
    fill(dotColor);
    ellipse(px, py, dotR * 2, dotR * 2);

    noStroke();
    fill(dotTextColor);
    textAlign(CENTER, CENTER);
    textSize(9);
    textStyle(BOLD);
    text(r, px, py);
    textStyle(NORMAL);
  }

  pop();
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
  clear();
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
    EFFETTO "HOLO CARD" — bordo/glow a gradiente rotante,
    stessa idea della carta olografica CSS, coi colori del tema.
   ========================================================= */

const HOLO_COLORS = ['#DD4B50', '#ECBA4E', '#ECE64E', '#97B481', '#498AE2', '#8380BC'];

function drawRoundRectPath(x, y, w, h, r) {
  const ctx = drawingContext;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Riempie la forma (arrotondata) con un gradiente lineare che ruota nel
// tempo, esattamente come "linear-gradient(var(--rotate), ...)" della
// carta holo CSS di riferimento; blurPx>0 per lo strato di glow sfocato.
function paintHoloGradient(x, y, w, h, r, angle, blurPx) {
  const ctx = drawingContext;
  ctx.save();
  if (blurPx) ctx.filter = `blur(${blurPx}px)`;
  drawRoundRectPath(x, y, w, h, r);
  ctx.clip();

  const cx = x + w / 2;
  const cy = y + h / 2;
  const diag = Math.sqrt(w * w + h * h);
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  const grad = ctx.createLinearGradient(-diag / 2, 0, diag / 2, 0);
  const n = HOLO_COLORS.length;
  HOLO_COLORS.forEach((c, i) => grad.addColorStop(i / (n - 1), c));
  ctx.fillStyle = grad;
  ctx.fillRect(-diag, -diag, diag * 2, diag * 2);

  ctx.restore();
}

// Disegna glow sfocato + bordo netto rotante dietro un riquadro (x,y,w,h,r);
// il contenuto vero del riquadro va disegnato SOPRA, subito dopo questa chiamata.
function drawHoloFrame(x, y, w, h, r) {
  const angle = (millis() / 16000) * TWO_PI; // rotazione lenta (16s a giro)
  const glowPad = sx(4);
  const borderPad = sx(1.2);

  paintHoloGradient(x - glowPad, y - glowPad, w + glowPad * 2, h + glowPad * 2, r + glowPad, angle, sx(6));
  paintHoloGradient(x - borderPad, y - borderPad, w + borderPad * 2, h + borderPad * 2, r + borderPad, angle, 0);
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
  slotLocked = false;
  slotLockFrames = 0;
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
  if (slotLocked) return;

  const card = playerSlots[0];
  if (card) {
    if (slotEmptyFrames >= SLOT_EMPTY_THRESHOLD) {
      playSequentialSlot();
    } else if (slotFrames[0] >= SLOT_AUTOPLAY_THRESHOLD) {
      playSequentialSlot();
    }
  }
}

function loadCardIntoSlot(templateId) {
  if (slotLocked) return;

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
    spawnFloater('PAREGGIO', width / 2, 120, '#8380BC');
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

  // Gestione start/restart: questi non passano dallo slot
  if (id === 'RESTART' ||
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
  statusMessage = message;
  if (statusEl) statusEl.html(message);
  if (logBalloonEl) {
    logBalloonEl.html(message);
    if (message) {
      logBalloonEl.addClass('active');
    } else {
      logBalloonEl.removeClass('active');
    }
  }
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
