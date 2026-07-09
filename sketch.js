import { ELEMENTS, TEMPLATE_MAP, createCard, getLocalizedElementName } from './cards.js';
import { Game, GAME_STATE } from './game.js';
import { audio } from './audio.js';
import { speculaEnv } from './app-env.js';
import { familyVoice } from './family-voice.js';
import { getLocale, getLocaleOptions, getMessages, localizeDocument, onLocaleChange, setLocale, t } from './i18n.js';
import { tts } from './tts.js';
import { StoryEngine } from './stories/story-engine.js';
import magicSchoolFontUrl from './fonts/magic-school.ttf?url';
import kiddosFontUrl from './fonts/kiddos.ttf?url';

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
var webcamMessage = t('sketch.webcamPreparing');
var statusMessage = t('sketch.showCard');

// Player load one card at a time
var playerSlots = [];
var slotFrames = [];
var slotEmptyFrames = 0;
var slotLocked = false;
var slotLockFrames = 0;
const SLOT_EMPTY_THRESHOLD = 8;
const SLOT_AUTOPLAY_THRESHOLD = 120;
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
var debugOpenBtn;
var debugCloseBtn;
var familyVoiceEntryLink;
var familyVoiceEntryStatus;
var localeSelect;
var fullscreenBtn;
var debugMode = false;
var currentFacingMode = 'environment';
var isSwitchingCamera = false;
var availableVideoInputs = [];
var activeVideoDeviceId = '';
var magicFont;
var kiddosFont;
var debugDragState = null;
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
var statusMessageKey = 'sketch.showCard';
var statusMessageParams = {};
var webcamMessageKey = 'sketch.webcamPreparing';
var webcamMessageParams = {};
const HERO_APPEAR = ['fire', 'water', 'river', 'towers', 'mountains'];
const HERO_ZORDER = ['mountains', 'towers', 'river', 'water', 'fire'];
const HERO_LAYOUT = {
  mountains: { x: 25, y: -20, w: 340 },
  towers: { x: -40, y: 90, w: 280 },
  river: { x: -15, y: 210, w: 310 },
  water: { x: -80, y: 240, w: 320 },
  fire: { x: 80, y: 300, w: 270 }
};

function preload() {
  magicFont = loadFont(magicSchoolFontUrl);
  kiddosFont = loadFont(kiddosFontUrl);

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
  const parent = document.querySelector('main');

  // Read the available space in the <main> tag
  let availableW = parent ? parent.clientWidth : windowWidth;
  let availableH = parent ? parent.clientHeight : windowHeight;

  // Calculate the usable canvas space
  if (parent) {
    const style = window.getComputedStyle(parent);
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingBottom = parseFloat(style.paddingBottom) || 0;
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const paddingRight = parseFloat(style.paddingRight) || 0;

    availableW = availableW - paddingLeft - paddingRight;
    availableH = availableH - paddingTop - paddingBottom;
  }

  if (availableW <= 0) availableW = windowWidth - 40;
  if (availableH <= 0) availableH = windowHeight - 200;

  const mobileViewport = isMobile() || availableW <= 520;
  isCompact = availableW < 720;

  if (mobileViewport) {
    const mobileWidth = min(availableW, 430);
    const preferredHeight = max(round(mobileWidth * 1.32), 500);
    const mobileHeight = min(availableH, preferredHeight);
    scaleFactor = min(mobileWidth / 380, mobileHeight / 520);
    return { width: mobileWidth, height: mobileHeight };
  }

  const logicalW = 900;
  const logicalH = 600;
  scaleFactor = min(availableW / logicalW, availableH / logicalH);

  return { width: availableW, height: availableH };
}

function sx(v) {
  return v * scaleFactor;
}

function sy(v) {
  return v * scaleFactor;
}

function setStatusMessage(key, params = {}) {
  statusMessageKey = key || '';
  statusMessageParams = params;
  statusMessage = key ? t(key, params) : String(params.message || '');
}

function setWebcamMessage(key, params = {}) {
  webcamMessageKey = key || '';
  webcamMessageParams = params;
  webcamMessage = key ? t(key, params) : String(params.message || '');
}

function refreshLocalizedRuntimeText() {
  if (statusMessageKey) {
    statusMessage = t(statusMessageKey, statusMessageParams);
  }
  if (webcamMessageKey) {
    webcamMessage = t(webcamMessageKey, webcamMessageParams);
  }
}

function detectDebugMode() {
  return Boolean(speculaEnv.enableDebug);
}

function populateProviderSelect(selectEl, providerState) {
  if (!selectEl || !selectEl.elt || !providerState) return;

  const current = providerState.preferredProvider || 'auto';
  const options = [
    `<option value="auto"${current === 'auto' ? ' selected' : ''}>${t('gamePage.ttsProviderAuto')}</option>`,
    `<option value="piper"${current === 'piper' ? ' selected' : ''}>${t('gamePage.ttsProviderPiper')}</option>`,
    `<option value="browser"${current === 'browser' ? ' selected' : ''}>${t('gamePage.ttsProviderBrowser')}</option>`
  ];

  selectEl.html(options.join(''));
}

function updateProviderStatus(providerState) {
  if (!ttsProviderStatus || !ttsProviderStatus.elt || !providerState) return;
  ttsProviderStatus.html(providerState.message || t('tts.providerUnavailable'));
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
  const autoLabel = provider === 'piper' ? t('tts.autoServer') : t('tts.autoBrowser');
  const options = [`<option value="">${autoLabel}</option>`];

  for (const voice of voices) {
    const label = `${voice.name} (${voice.lang || 'n/a'})`;
    const selected = voice.voiceURI === currentVoiceURI ? ' selected' : '';
    options.push(`<option value="${voice.voiceURI}"${selected}>${label}</option>`);
  }

  selectEl.html(options.join(''));
  const resolvedValue = voices.some((voice) => voice.voiceURI === currentVoiceURI)
    ? currentVoiceURI
    : '';
  selectEl.elt.value = resolvedValue;
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
  storyEngine.loadIndex().catch(() => { });

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
  debugOpenBtn = select('#debug-open-btn');
  debugCloseBtn = select('#debug-close-btn');
  familyVoiceEntryLink = select('#family-voice-entry-link');
  familyVoiceEntryStatus = select('#family-voice-entry-status');
  localeSelect = select('#locale-select');
  fullscreenBtn = select('#fullscreen-btn');
  debugMode = detectDebugMode();

  if (debugOpenBtn && debugOpenBtn.elt) {
    debugOpenBtn.elt.hidden = !debugMode;
  }

  if (debugMode && debugPanel && debugPanel.elt) {
    debugPanel.elt.hidden = false;
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

  if (debugOpenBtn) {
    debugOpenBtn.mousePressed((event) => {
      if (event && event.stopPropagation) event.stopPropagation();
      toggleDebugPanel();
    });
  }

  if (debugCloseBtn) {
    debugCloseBtn.mousePressed(() => {
      closeDebugPanel();
    });
  }

  setupDebugDragging();

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeSettingsModal();
        closePrivacyInfoPopover();
        closeDebugPanel();
      }
    });
    document.addEventListener('fullscreenchange', updateFullscreenButtonLabel);
    document.addEventListener('webkitfullscreenchange', updateFullscreenButtonLabel);
    window.addEventListener('family-voice-session-changed', updateFamilyVoiceSettingsState);
    window.addEventListener('click', (event) => {
      if (!privacyInfoPopover || !privacyInfoPopover.elt || privacyInfoPopover.elt.hidden) return;
      const clickedButton = privacyInfoBtn && privacyInfoBtn.elt && privacyInfoBtn.elt.contains(event.target);
      const clickedPopover = privacyInfoPopover.elt.contains(event.target);
      if (!clickedButton && !clickedPopover) closePrivacyInfoPopover();
    });
  }

  if (familyVoiceEntryLink && familyVoiceEntryLink.elt) {
    familyVoiceEntryLink.elt.addEventListener('click', () => {
      updateFamilyVoiceSettingsState();
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

  if (fullscreenBtn) {
    fullscreenBtn.mousePressed(toggleFullscreenMode);
  }

  refreshAvailableCameras();
  if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === 'function') {
    navigator.mediaDevices.addEventListener('devicechange', refreshAvailableCameras);
  }

  if (ttsToggle) {
    ttsToggle.changed(() => {
      const enabled = ttsToggle.checked();
      tts.setEnabled(enabled);
      logToStatus(t(enabled ? 'sketch.guideVoiceEnabled' : 'sketch.guideVoiceDisabled'));
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
      logToStatus(t('sketch.guideVoiceUpdated'));
    });
  }

  if (ttsStoryVoiceSelect) {
    ttsStoryVoiceSelect.changed(() => {
      tts.setChannelVoice('story', ttsStoryVoiceSelect.value(), tts.getVoiceCatalog().activeProvider);
      logToStatus(t('sketch.storyVoiceUpdated'));
    });
  }

  setupLocaleControls();
  localizeDocument();
  onLocaleChange(() => {
    localizeDocument();
    setupLocaleControls();
    updateFullscreenButtonLabel();
    refreshLocalizedRuntimeText();
    updateFamilyVoiceSettingsState();
    const providerState = tts.getProviderState();
    populateProviderSelect(ttsProviderSelect, providerState);
    updateProviderStatus(providerState);
    const catalog = tts.getVoiceCatalog();
    populateVoiceSelect(ttsGameplayVoiceSelect, catalog, 'gameplay');
    populateVoiceSelect(ttsStoryVoiceSelect, catalog, 'story');
  });

  tts.onVoicesChanged((catalog) => {
    populateProviderSelect(ttsProviderSelect, catalog.providerState);
    updateProviderStatus(catalog.providerState);
    populateVoiceSelect(ttsGameplayVoiceSelect, catalog, 'gameplay');
    populateVoiceSelect(ttsStoryVoiceSelect, catalog, 'story');
  });

  tts.onProviderChanged((providerState) => {
    populateProviderSelect(ttsProviderSelect, providerState);
    updateProviderStatus(providerState);
    const catalog = tts.getVoiceCatalog();
    populateVoiceSelect(ttsGameplayVoiceSelect, catalog, 'gameplay');
    populateVoiceSelect(ttsStoryVoiceSelect, catalog, 'story');
  });

  updateFamilyVoiceSettingsState();
  updateFullscreenButtonLabel();

  if (!isMobile()) {
    setupWebcam();
  } else {
    webcamState = 'waiting';
    setWebcamMessage('gamePage.cameraActivate');
    if (helpPanel && helpPanel.elt) {
      helpPanel.elt.open = false;
    }
    updateCameraButton();
  }
  setStatusMessage(debugMode ? 'sketch.debugEnabled' : 'sketch.showCard');
  logToStatus(statusMessage);

  const loadingOverlay = select('#loading-overlay');
  if (loadingOverlay && loadingOverlay.elt) {
    loadingOverlay.elt.classList.add('is-hidden');
  }
}

function windowResized() {
  const size = getCanvasSize();
  resizeCanvas(size.width, size.height);
}

function openSettingsModal() {
  if (!settingsModal || !settingsModal.elt) return;
  updateFamilyVoiceSettingsState();
  settingsModal.elt.hidden = false;
  document.body.classList.add('settings-modal-open');
}

function closeSettingsModal() {
  if (!settingsModal || !settingsModal.elt) return;
  settingsModal.elt.hidden = true;
  document.body.classList.remove('settings-modal-open');
}

function toggleDebugPanel() {
  if (!debugPanel || !debugPanel.elt) return;
  debugPanel.elt.hidden = !debugPanel.elt.hidden;
}

function closeDebugPanel() {
  if (!debugPanel || !debugPanel.elt) return;
  debugPanel.elt.hidden = true;
}

function setupDebugDragging() {
  if (!debugPanel || !debugPanel.elt) return;
  const handle = debugPanel.elt.querySelector('.debug-floating-topbar');
  if (!handle) return;

  const onPointerMove = (event) => {
    if (!debugDragState || !debugPanel || !debugPanel.elt) return;
    const nextLeft = event.clientX - debugDragState.offsetX;
    const nextTop = event.clientY - debugDragState.offsetY;
    const maxLeft = Math.max(8, window.innerWidth - debugPanel.elt.offsetWidth - 8);
    const maxTop = Math.max(8, window.innerHeight - debugPanel.elt.offsetHeight - 8);
    debugPanel.elt.style.left = `${Math.min(Math.max(8, nextLeft), maxLeft)}px`;
    debugPanel.elt.style.top = `${Math.min(Math.max(8, nextTop), maxTop)}px`;
    debugPanel.elt.style.right = 'auto';
    debugPanel.elt.style.bottom = 'auto';
  };

  const stopDragging = () => {
    debugDragState = null;
    document.body.classList.remove('debug-dragging');
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', stopDragging);
  };

  handle.addEventListener('pointerdown', (event) => {
    if (event.target && event.target.closest('button')) return;
    if (window.innerWidth <= 767) return;
    const rect = debugPanel.elt.getBoundingClientRect();
    debugDragState = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    debugPanel.elt.style.left = `${rect.left}px`;
    debugPanel.elt.style.top = `${rect.top}px`;
    debugPanel.elt.style.right = 'auto';
    debugPanel.elt.style.bottom = 'auto';
    document.body.classList.add('debug-dragging');
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDragging);
  });
}

function updateFamilyVoiceSettingsState() {
  const authenticated = Boolean(
    familyVoice
    && typeof familyVoice.isAuthenticated === 'function'
    && familyVoice.isAuthenticated()
  );

  if (familyVoiceEntryStatus && familyVoiceEntryStatus.elt) {
    familyVoiceEntryStatus.elt.textContent = authenticated
      ? t('sketch.familyVoiceAccessActive')
      : t('gamePage.familyVoiceStatus');
  }

  if (familyVoiceEntryLink && familyVoiceEntryLink.elt) {
    familyVoiceEntryLink.elt.textContent = authenticated ? t('sketch.openStudio') : t('gamePage.familyVoiceLink');
    familyVoiceEntryLink.elt.dataset.state = authenticated ? 'ready' : 'locked';
  }
}

function setupLocaleControls() {
  if (!localeSelect || !localeSelect.elt) return;
  localeSelect.html(getLocaleOptions()
    .map((option) => `<option value="${option.value}">${option.label}</option>`)
    .join(''));
  localeSelect.elt.value = getLocale();
  if (localeSelect.elt.dataset.bound === 'true') return;
  localeSelect.elt.addEventListener('change', () => {
    setLocale(localeSelect.value());
  });
  localeSelect.elt.dataset.bound = 'true';
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

async function refreshAvailableCameras() {
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.enumerateDevices !== 'function') {
    availableVideoInputs = [];
    updateCameraButton();
    return [];
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    availableVideoInputs = devices.filter((device) => device.kind === 'videoinput');

    if (activeVideoDeviceId && !availableVideoInputs.some((device) => device.deviceId === activeVideoDeviceId)) {
      activeVideoDeviceId = '';
    }

    updateCameraButton();
    return availableVideoInputs;
  } catch (error) {
    console.warn('[Webcam] enumerateDevices non disponibile:', error);
    availableVideoInputs = [];
    updateCameraButton();
    return [];
  }
}

function updateCameraButton() {
  if (!cameraBtn || !switchCameraBtn) return;
  const hasMultipleCameras = availableVideoInputs.length > 1;

  if (switchCameraBtn.elt) {
    switchCameraBtn.elt.disabled = isSwitchingCamera || !hasMultipleCameras || webcamState === 'loading';
  }

  if (webcamState === 'active') {
    cameraBtn.style('display', 'none');
  } else if (webcamState === 'waiting' || webcamState === 'denied' || webcamState === 'error' || webcamState === 'unsupported') {
    if (isMobile()) {
      cameraBtn.style('display', 'block');
    } else {
      cameraBtn.style('display', 'none');
    }
  } else {
    cameraBtn.style('display', 'none');
  }
}

function isFullscreenActive() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

function updateFullscreenButtonLabel() {
  if (!fullscreenBtn || !fullscreenBtn.elt) return;
  fullscreenBtn.elt.textContent = isFullscreenActive()
    ? t('gamePage.fullscreenExit')
    : t('gamePage.fullscreenEnter');
}

async function toggleFullscreenMode() {
  const root = document.documentElement;

  try {
    if (isFullscreenActive()) {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
      return;
    }

    if (root.requestFullscreen) {
      await root.requestFullscreen();
    } else if (root.webkitRequestFullscreen) {
      root.webkitRequestFullscreen();
    }
  } catch (error) {
    console.warn('[Fullscreen] Operazione non riuscita:', error);
  } finally {
    updateFullscreenButtonLabel();
  }
}

function switchCamera() {
  if (isSwitchingCamera || availableVideoInputs.length <= 1) return;
  tts.prime();
  isSwitchingCamera = true;

  const currentIndex = availableVideoInputs.findIndex((device) => device.deviceId === activeVideoDeviceId);
  const nextIndex = currentIndex >= 0
    ? (currentIndex + 1) % availableVideoInputs.length
    : 0;
  const nextDevice = availableVideoInputs[nextIndex];

  if (nextDevice && nextDevice.deviceId) {
    activeVideoDeviceId = nextDevice.deviceId;
    console.log('[Webcam] Cambio fotocamera:', nextDevice.label || nextDevice.deviceId);
  } else if (isMobile()) {
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    console.log('[Webcam] Cambio fotocamera via facingMode:', currentFacingMode);
  }

  webcamState = 'loading';
  setWebcamMessage('sketch.webcamChanging');
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
    setWebcamMessage('sketch.webcamUnsupported');
    console.error('[Webcam]', webcamMessage);
    setStatusMessage(webcamMessageKey, webcamMessageParams);
    logToStatus(statusMessage);
    updateCameraButton();
    return;
  }

  webcamState = 'loading';
  setWebcamMessage('sketch.webcamRequestingPermission');

  const constraints = {
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30 }
    },
    audio: false
  };

  if (activeVideoDeviceId) {
    constraints.video.deviceId = { exact: activeVideoDeviceId };
  } else if (isMobile()) {
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

        video.elt.playsInline = true;
        video.elt.muted = true;
        video.elt.autoplay = true;

        video.size(320, 240);
        video.hide();

        function setActive() {
          console.log('[Webcam] Video attivo, dimensioni:', video.elt.videoWidth, video.elt.videoHeight);
          if (webcamState !== 'active') {
            webcamState = 'active';
            const exactDeviceId = constraints
              && constraints.video
              && constraints.video.deviceId
              && constraints.video.deviceId.exact;
            if (exactDeviceId) {
              activeVideoDeviceId = exactDeviceId;
            }
            setWebcamMessage('sketch.webcamActive');
            setStatusMessage('sketch.webcamActiveStatus');
            logToStatus(statusMessage);
            refreshAvailableCameras();
            updateCameraButton();
          }
        }

        if (video.elt.readyState >= 2) {
          console.log('[Webcam] Video già pronto al callback');
          setActive();
        } else {
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
      setWebcamMessage('sketch.webcamActive');
      setStatusMessage('sketch.webcamActiveStatus');
      logToStatus(statusMessage);
      updateCameraButton();
      return;
    }

    console.warn(`[Webcam] Video nero o non attivo al tentativo ${attempt}`);
    if (attempt < 3) {
      setWebcamMessage('sketch.webcamAttempt', { attempt: attempt + 1 });
      tryFallbackDevice(attempt + 1);
    } else {
      webcamState = 'error';
      setWebcamMessage('sketch.webcamRetry');
      setStatusMessage(webcamMessageKey, webcamMessageParams);
      logToStatus(statusMessage);
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
          setWebcamMessage('sketch.webcamNotFound');
          setStatusMessage(webcamMessageKey, webcamMessageParams);
          logToStatus(statusMessage);
          updateCameraButton();
        }
        return;
      }

      if (attempt <= videoDevices.length) {
        const index = videoDevices.length - attempt;
        const deviceId = videoDevices[index].deviceId;
        console.log(`[Webcam] Provo dispositivo ${index}:`, videoDevices[index].label || 'senza nome');
        activeVideoDeviceId = deviceId;

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
        setWebcamMessage('sketch.webcamNotWorking');
        setStatusMessage(webcamMessageKey, webcamMessageParams);
        logToStatus(statusMessage);
        updateCameraButton();
      }
    })
    .catch(err => {
      console.error('[Webcam] enumerateDevices error:', err);
      webcamState = 'error';
      setWebcamMessage('sketch.webcamSearchError');
      setStatusMessage(webcamMessageKey, webcamMessageParams);
      logToStatus(statusMessage);
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

  // Narrative epilogue on the final state
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
      drawEndScreen(t('sketch.gameOverTitle'), '#e74c3c', t('sketch.gameOverSubtitle'));
      break;
    case GAME_STATE.VICTORY:
      drawEndScreen(t('sketch.victoryTitle'), '#2ecc71', t('sketch.victorySubtitle'));
      break;
  }

  updateLogBalloon();
}

//Screens

function drawIdle() {
  drawHeroArt();
  drawWebcamPreview();
  drawWebcamOverlay();
  drawHelpPanel();

  if (isCompact) {
    const tx = sx(20);
    const tw = width - sx(40);
    const centerX = width / 2;
    const titleY = sy(20);
    const titleLeading = 70 * scaleFactor;
    const shiftX = sx(40);
    textFont(magicFont || 'Space Grotesk');
    textSize(68 * scaleFactor);

    const textW = textWidth('Elementae') + shiftX;
    const gradStartX = centerX - textW / 2;
    const gradEndX = centerX + textW / 2;
    const gradCenterY = titleY + titleLeading / 2;

    const grad = drawingContext.createLinearGradient(gradStartX, gradCenterY, gradEndX, gradCenterY);
    grad.addColorStop(0, '#DD4B50');   // Fuoco
    grad.addColorStop(0.2, '#ECBA4E');  // Tuono
    grad.addColorStop(0.4, '#ECE64E');  // Luce
    grad.addColorStop(0.6, '#97B481');  // Natura
    grad.addColorStop(0.8, '#498AE2');  // Acqua
    grad.addColorStop(1, '#8380BC');    // Ombra

    drawingContext.fillStyle = grad;
    textAlign(LEFT, TOP);
    text('Speculae', centerX - textW / 2, titleY);
    text('Elementae', centerX - textW / 2 + shiftX, titleY + titleLeading);

    textSize(16 * scaleFactor);
    textLeading(19 * scaleFactor);
    fill('#5a4a34');
    textFont(kiddosFont || 'Space Grotesk');
    textAlign(CENTER, TOP);
    text(t('sketch.introSubtitle'), tx, sy(195), tw);

    if (webcamState === 'active') {
      const time = millis() / 1000;
      const pulse = sin(time * 3) * sx(4);
      fill('#498AE2');
      textFont('Beachday');
      textSize(24 * scaleFactor);
      textLeading(30 * scaleFactor);
      textAlign(CENTER, TOP);
      text(t('sketch.introPrompt'), tx, sy(245) + pulse, tw);
    }

    fill('#2b2318');
    textAlign(CENTER, TOP);
    textSize(11 * scaleFactor);
    textFont('Nunito');
    text(statusMessage, tx, height - sy(55), tw);
  } else {
    const tx = sx(380);
    const tw = sx(380);
    const titleX = sx(370);
    const titleY = sy(60);
    const titleLeading = 110 * scaleFactor;
    const shiftX = sx(75);
    textFont(magicFont || 'Space Grotesk');
    textSize(110 * scaleFactor);

    const textW = textWidth('Elementae') + shiftX;
    const gradStartX = titleX;
    const gradEndX = titleX + textW;
    const gradCenterY = titleY + titleLeading;
    const grad = drawingContext.createLinearGradient(gradStartX, gradCenterY, gradEndX, gradCenterY);
    grad.addColorStop(0, '#DD4B50');   // Fuoco
    grad.addColorStop(0.2, '#ECBA4E');  // Tuono
    grad.addColorStop(0.4, '#ECE64E');  // Luce
    grad.addColorStop(0.6, '#97B481');  // Natura
    grad.addColorStop(0.8, '#498AE2');  // Acqua
    grad.addColorStop(1, '#8380BC');    // Ombra

    drawingContext.fillStyle = grad;
    textAlign(LEFT, TOP);
    text('Speculae', titleX, titleY);
    text('Elementae', titleX + shiftX, titleY + titleLeading);

    textSize(20 * scaleFactor);
    textLeading(24 * scaleFactor);
    fill('#5a4a34');
    textFont(kiddosFont || 'Space Grotesk');
    textAlign(CENTER, TOP);
    text(t('sketch.introSubtitle'), tx, sy(330), tw);

    if (webcamState === 'active') {
      const time = millis() / 1000;
      const pulse = sin(time * 3) * sx(4);
      fill('#498AE2');
      textFont('Beachday');
      textSize(26 * scaleFactor);
      textLeading(36 * scaleFactor);
      textAlign(CENTER, TOP);
      text(t('sketch.introPrompt'), tx, sy(400) + pulse, tw);
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
    text(t('sketch.roundWon'), width / 2, height / 2 - 30);
  } else if (game.lastResult === 'lose') {
    fill('#e74c3c');
    text(t('sketch.roundLost'), width / 2, height / 2 - 30);
  } else {
    fill('#8380BC');
    text(t('sketch.roundDraw'), width / 2, height / 2 - 30);
  }

  textStyle(NORMAL);
  textSize(18);
  fill(255);
  text(game.lastResult === 'win' ? t('sketch.roundWonBody') : game.lastResult === 'lose' ? t('sketch.roundLostBody') : t('sketch.roundDrawBody'), width / 2, height / 2 + 30);

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
        tts.speak(getEnemyAnnouncement(game.currentEnemy), {
          channel: 'gameplay',
          promptKey: getEnemyPromptKey(game.currentEnemy)
        });
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
  fill(0);
  const finalSubtitle = webcamState === 'active' ? subtitle : webcamMessage;
  text(finalSubtitle, width / 2, height / 2 + 30);

  if (qrEnabled && webcamState === 'active' && video && video.elt && video.elt.readyState >= 2 && video.elt.videoWidth > 0 && frameCount % 10 === 0) {
    readQR();
  }
}

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
      enemyCardW: 180,
      enemyCardH: 258,
      enemyGap: 34,
      enemyY: 180,
      enemyBadgeOffsetY: 22,
      slotCardW: 130,
      slotCardH: 188,
      slotGap: 20,
      slotsY: height - 188 / 2 - 40,
      previewW: sx(160),
      previewH: sy(120),
      previewX: width - sx(160) - sx(90),
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
    text(t('sketch.hearts'), layout.hudX, layout.hudY);
    const labelWidth = textWidth(t('sketch.hearts'));
    const heartSize = layout.compact ? 18 : 22;
    const heartY = layout.hudY - 2;
    for (let i = 0; i < max(game.hp, 0); i++) {
      image(heartImage, layout.hudX + labelWidth + 10 + i * (heartSize + 4), heartY, heartSize, heartSize);
    }
  } else {
    text(`${t('sketch.hearts')} ${'❤️'.repeat(max(game.hp, 0))}`, layout.hudX, layout.hudY);
  }
  fill('#000000');
  text(t('sketch.roundCounter', { current: game.round, total: game.roundsToWin }), layout.hudX, layout.hudY + (layout.compact ? 24 : 28));
  if (game.enemies.length > 0) {
    text(t('sketch.enemyCounter', { current: game.currentEnemyIndex + 1, total: game.enemies.length }), layout.hudX, layout.hudY + (layout.compact ? 48 : 56));
  }
  textStyle(NORMAL);

  const enemy = game.currentEnemy;
  if (enemy) {
    fill('#000000');
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
  textSize(compact ? 13 : 19);
  textStyle(BOLD);
  text(name, 0, -h / 2 + 18);
  textStyle(NORMAL);

  const medY = 8;
  const medR = min(w, h) * 0.36;

  push();
  translate(0, medY);
  drawElementImage(element, medR * 1.9, color);
  pop();

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
  const hint = isProblem ? t('sketch.webcamPermissionHint') : null;
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
  text(t('sketch.webcamLabel'), tx, hint ? y + sy(22) : icoY - sy(8));
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
  text(t('sketch.howToPlay'), px + padX, py + sy(12));
  textStyle(NORMAL);

  const lines = getMessages().sketch.howToPlayLines || [];

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
  text(t('sketch.statusLabel'), px + padX, cursorY);
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

  const mw = sx(190);
  const mh = mapImage && mapImage.width > 0 ? mw * (mapImage.height / mapImage.width) : mw * 1.333;
  const cx = width * 0.14;
  const cy = height * 0.45;

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
    let dotR = sx(8);

    if (r < game.round) {
      dotColor = '#97B481';
      dotTextColor = '#ffffff';
    } else if (r === game.round) {
      dotColor = '#498AE2';
      dotTextColor = '#ffffff';
      dotR = sx(9.5);
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
    textSize(sx(7.5));
    textStyle(BOLD);
    text(r, px, py);
    textStyle(NORMAL);
  }

  pop();
}

function getStrongAgainstText(elementId) {
  const element = ELEMENTS[elementId];
  if (!element || !element.strongVs || element.strongVs.length === 0) return '';
  return element.strongVs.map((id) => getLocalizedElementName(id)).join(' e ');
}

function getWeakAgainstText(elementId) {
  const element = ELEMENTS[elementId];
  if (!element || !element.weakTo || element.weakTo.length === 0) return '';
  return element.weakTo.map((id) => getLocalizedElementName(id)).join(' e ');
}

function getEnemyHint(enemy) {
  const strongChoices = getWeakAgainstText(enemy.element);
  return t('sketch.enemyHint', { enemy: enemy.name, choices: strongChoices });
}

function getCardLearningLine(card) {
  return `${getLocalizedElementName(card.element)}.`;
}

function getEnemyAnnouncement(enemy) {
  return `${enemy.name}.`;
}

function getEnemyPromptKey(enemy) {
  if (!enemy || !enemy.templateId) return '';
  return `game.enemy.${enemy.templateId}`;
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

// Fills the (rounded) shape with a linear gradient that rotates over
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

// Draws a blurred glow + a rotating sharp border
// and the actual content of the box should be drawn ON TOP
function drawHoloFrame(x, y, w, h, r) {
  const angle = (millis() / 16000) * TWO_PI;
  const glowPad = sx(4);
  const borderPad = sx(1.2);

  paintHoloGradient(x - glowPad, y - glowPad, w + glowPad * 2, h + glowPad * 2, r + glowPad, angle, sx(6));
  paintHoloGradient(x - borderPad, y - borderPad, w + borderPad * 2, h + borderPad * 2, r + borderPad, angle, 0);
}

// Card Slots
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

    if (!card) {
      noFill();
      stroke('#498AE2');
      strokeWeight(3);
      drawingContext.setLineDash([8, 5]);
      rect(-cardW / 2, -cardH / 2, cardW, cardH, 10);
      drawingContext.setLineDash([]);
    }

    if (card) {
      drawCardFrame(0, 0, cardW - 8, cardH - 8, card.color, card.emoji, card.name, card.power, card.element);
    } else {
      noStroke();
      fill('#2d62a3');
      textAlign(CENTER, CENTER);
      textFont('Beachday');
      textSize(layout.compact ? 16 : 22);
      textLeading(layout.compact ? 19 : 26);
      text(t('sketch.playerCardSlot'), 0, 0);
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
  tts.speak(t('sketch.cardInSingleSlot', { line: getCardLearningLine(card) }), {
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
      tts.speak(getEnemyAnnouncement(game.currentEnemy), {
        channel: 'gameplay',
        promptKey: getEnemyPromptKey(game.currentEnemy)
      });
    }
  });
}

function drawTTSPause() {
  const layout = getCanvasLayout();
  fill(0, 0, 0, 140);
  noStroke();
  rect(0, 0, width, height);

  fill(255);
  textAlign(CENTER, CENTER);
  textFont('Beachday');
  textSize(layout.compact ? 28 : 42);
  text(t('sketch.listening'), width / 2, height * 0.42);
}

// QR reader
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

  if (id === 'RESTART' ||
    game.state === GAME_STATE.IDLE ||
    game.state === GAME_STATE.GAME_OVER ||
    game.state === GAME_STATE.VICTORY) {
    const event = game.handleQR(id);

    if (event.action === 'start' || event.action === 'restart') {
      audio.playStart();
      tts.speak(t('game.startAdventure'), {
        priority: true,
        channel: 'gameplay',
        promptKey: 'game.start'
      });
      lastPlayedCard = null;
      animProgress = 0;
      resetSlots();
      logToStatus(event.action === 'start' ? t('sketch.adventureStarted') : t('sketch.adventureRestarted'));

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
          setTimeout(() => {
            if (game.currentEnemy) {
              tts.speak(getEnemyAnnouncement(game.currentEnemy), {
                channel: 'gameplay',
                promptKey: getEnemyPromptKey(game.currentEnemy)
              });
            }
          }, 500)
        });
      } else {
        storyEngine.reset();
      }
      return;
    } else if (event.action === 'unknown') {
      logToStatus(t('sketch.unrecognizedCard', { id }));
    }
    return;
  }

  if (game.state !== GAME_STATE.PLAYING || slotLocked) return;

  if (!TEMPLATE_MAP[id]) return;

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

// UI DOM
function logToStatus(message) {
  if (message !== statusMessage) {
    statusMessageKey = '';
    statusMessageParams = {};
  }
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

//Utility
function lighten(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// Story Engine
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
