/**
 * Text-to-Speech manager con supporto a:
 * - Web Speech API del browser
 * - backend Piper via /api/tts
 * - canali separati per gameplay e narrazione
 */

import { speculaEnv } from './app-env.js';

const STORAGE_KEY = 'specula-elementae-tts-settings';
const LEGACY_STORAGE_KEY = 'deck-of-shadows-tts-settings';

function resolveApiUrl(pathname) {
  const baseUrl = typeof speculaEnv.apiBaseUrl === 'string' ? speculaEnv.apiBaseUrl : '';
  return `${baseUrl}${pathname}`;
}

  class TTSManager {
    constructor() {
      this.enabled = true;
      this.queue = [];
      this.speaking = false;
      this.onIdleCallback = null;
      this.lastSpoken = null;
      this.initialized = false;

      this.browserVoices = [];
      this.piperVoices = [];
      this.voiceListeners = [];
      this.providerListeners = [];

      this.preferredProvider = 'auto';
      this.activeProvider = 'none';
      this.audioElement = null;
      this.currentAudioUrl = null;
      this.currentAbortController = null;
      this.currentSpeechToken = 0;
      this.currentSpeechStartedAt = 0;
      this.currentSpeechSafetyTimer = null;
      this.piperAvailable = false;
      this.piperCheckedAt = 0;

      this.channels = {
        gameplay: {
          label: 'Voce guida',
          browserVoiceURI: '',
          piperVoice: '',
          rateDesktop: 1.08,
          rateMobile: 1.0,
          pitch: 1.04,
          volume: 1
        },
        story: {
          label: 'Voce narratore',
          browserVoiceURI: '',
          piperVoice: '',
          rateDesktop: 0.96,
          rateMobile: 0.92,
          pitch: 0.96,
          volume: 1
        }
      };

      this._loadPreferences();

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        this._loadBrowserVoices();
        if ('onvoiceschanged' in window.speechSynthesis) {
          window.speechSynthesis.onvoiceschanged = () => this._loadBrowserVoices();
        }
      }

      this.refreshProviders();
    }

    _loadPreferences() {
      if (typeof window === 'undefined' || !window.localStorage) return;

      try {
        const raw = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(LEGACY_STORAGE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.preferredProvider === 'string') {
          this.preferredProvider = parsed.preferredProvider;
        }

        if (parsed && parsed.channels) {
          for (const channelName of Object.keys(this.channels)) {
            const savedChannel = parsed.channels[channelName];
            if (!savedChannel) continue;
            if (typeof savedChannel.browserVoiceURI === 'string') {
              this.channels[channelName].browserVoiceURI = savedChannel.browserVoiceURI;
            }
            if (typeof savedChannel.piperVoice === 'string') {
              this.channels[channelName].piperVoice = savedChannel.piperVoice;
            }
          }
        }
      } catch (error) {
        console.warn('Impossibile leggere le preferenze TTS:', error);
      }
    }

    _savePreferences() {
      if (typeof window === 'undefined' || !window.localStorage) return;

      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
          preferredProvider: this.preferredProvider,
          channels: {
            gameplay: {
              browserVoiceURI: this.channels.gameplay.browserVoiceURI,
              piperVoice: this.channels.gameplay.piperVoice
            },
            story: {
              browserVoiceURI: this.channels.story.browserVoiceURI,
              piperVoice: this.channels.story.piperVoice
            }
          }
        }));
      } catch (error) {
        console.warn('Impossibile salvare le preferenze TTS:', error);
      }
    }

    setEnabled(value) {
      this.enabled = value;
      if (!value) {
        this.cancel();
      }
    }

    prime() {
      this.initialized = true;
      if (this._hasBrowserSupport()) {
        this._loadBrowserVoices();
      }
      this.refreshProviders();
    }

    async refreshProviders(force = false) {
      if (force || Date.now() - this.piperCheckedAt > 15000) {
        await this._refreshPiperVoices();
      }

      this._loadBrowserVoices();
      this._resolveActiveProvider();
      this._notifyProviderChanged();
      this._notifyVoicesChanged();
    }

    onVoicesChanged(callback) {
      if (typeof callback !== 'function') return;
      this.voiceListeners.push(callback);
      callback(this.getVoiceCatalog());
    }

    onProviderChanged(callback) {
      if (typeof callback !== 'function') return;
      this.providerListeners.push(callback);
      callback(this.getProviderState());
    }

    _notifyVoicesChanged() {
      const catalog = this.getVoiceCatalog();
      for (const callback of this.voiceListeners) {
        callback(catalog);
      }
    }

    _notifyProviderChanged() {
      const state = this.getProviderState();
      for (const callback of this.providerListeners) {
        callback(state);
      }
    }

    _hasBrowserSupport() {
      return typeof window !== 'undefined' && 'speechSynthesis' in window;
    }

    _hasPiperSupport() {
      return typeof window !== 'undefined' && typeof window.fetch === 'function';
    }

    _loadBrowserVoices() {
      if (!this._hasBrowserSupport()) return;
      this.browserVoices = window.speechSynthesis.getVoices() || [];
      this._applyDefaultVoices();
    }

    async _refreshPiperVoices() {
      this.piperCheckedAt = Date.now();

      if (!this._hasPiperSupport()) {
        this.piperAvailable = false;
        this.piperVoices = [];
        return;
      }

      try {
        const response = await fetch(resolveApiUrl('/api/tts/voices'), {
          method: 'GET',
          headers: {
            Accept: 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        this.piperVoices = this._normalizePiperVoices(payload);
        this.piperAvailable = true;
        this._applyDefaultVoices();
      } catch (error) {
        this.piperAvailable = false;
        this.piperVoices = [];
        console.warn('Piper non raggiungibile, uso il fallback browser:', error);
      }
    }

    _normalizePiperVoices(payload) {
      if (!payload) return [];

      const normalized = [];
      const pushVoice = (voiceId, meta = {}) => {
        if (!voiceId) return;
        const lang = meta.lang || meta.language || meta.languageCode || (meta.language && meta.language.code) || '';
        const name = meta.name || meta.displayName || voiceId;
        normalized.push({
          voiceURI: voiceId,
          name,
          lang,
          default: false
        });
      };

      if (Array.isArray(payload)) {
        for (const item of payload) {
          if (typeof item === 'string') {
            pushVoice(item);
          } else if (item && typeof item === 'object') {
            pushVoice(item.voice || item.id || item.name || item.voiceURI, item);
          }
        }
      } else if (typeof payload === 'object') {
        for (const [voiceId, meta] of Object.entries(payload)) {
          if (meta && typeof meta === 'object') {
            const resolvedLang = meta.language && typeof meta.language === 'object'
              ? meta.language.code || meta.language.name || ''
              : meta.language || meta.lang || '';
            pushVoice(voiceId, {
              ...meta,
              lang: resolvedLang
            });
          } else {
            pushVoice(voiceId);
          }
        }
      }

      normalized.sort((a, b) => {
        const langA = (a.lang || '').toLowerCase();
        const langB = (b.lang || '').toLowerCase();
        if (langA !== langB) return langA.localeCompare(langB);
        return a.name.localeCompare(b.name);
      });

      return normalized;
    }

    _applyDefaultVoices() {
      const autoGameplayBrowser = this._pickBestVoice(this.browserVoices, 'gameplay');
      const autoStoryBrowser = this._pickBestVoice(this.browserVoices, 'story');
      const autoGameplayPiper = this._pickBestVoice(this.piperVoices, 'gameplay');
      const autoStoryPiper = this._pickBestVoice(this.piperVoices, 'story');

      if (!this.channels.gameplay.browserVoiceURI && autoGameplayBrowser) {
        this.channels.gameplay.browserVoiceURI = autoGameplayBrowser.voiceURI;
      }
      if (!this.channels.story.browserVoiceURI && autoStoryBrowser) {
        this.channels.story.browserVoiceURI = autoStoryBrowser.voiceURI;
      }
      if (!this.channels.gameplay.piperVoice && autoGameplayPiper) {
        this.channels.gameplay.piperVoice = autoGameplayPiper.voiceURI;
      }
      if (!this.channels.story.piperVoice && autoStoryPiper) {
        this.channels.story.piperVoice = autoStoryPiper.voiceURI;
      }
    }

    _pickBestVoice(voices, channel) {
      if (!voices || voices.length === 0) return null;

      const italianVoices = voices.filter((voice) => voice.lang && String(voice.lang).toLowerCase().startsWith('it'));
      const pool = italianVoices.length > 0 ? italianVoices : voices;

      if (channel === 'story') {
        const warmNarrator = pool.find((voice) => /alice|elsa|federica|paola|natural|premium/i.test(voice.name));
        return warmNarrator || pool[0];
      }

      const clearGuide = pool.find((voice) => /google|eloquence|luca|riccardo|natural|premium/i.test(voice.name));
      return clearGuide || pool[0];
    }

    _resolveActiveProvider() {
      const browserAvailable = this.browserVoices.length > 0;
      const piperAvailable = this.piperAvailable;

      if (this.preferredProvider === 'piper') {
        this.activeProvider = piperAvailable ? 'piper' : browserAvailable ? 'browser' : 'none';
        return;
      }

      if (this.preferredProvider === 'browser') {
        this.activeProvider = browserAvailable ? 'browser' : piperAvailable ? 'piper' : 'none';
        return;
      }

      this.activeProvider = piperAvailable ? 'piper' : browserAvailable ? 'browser' : 'none';
    }

    getProviderState() {
      const browserAvailable = this.browserVoices.length > 0;
      const piperAvailable = this.piperAvailable;
      let message = 'Sintesi vocale non disponibile.';

      if (this.activeProvider === 'piper' && this.preferredProvider === 'auto') {
        message = 'Provider attivo: Piper server.';
      } else if (this.activeProvider === 'piper' && this.preferredProvider === 'piper') {
        message = 'Provider attivo: Piper server.';
      } else if (this.activeProvider === 'browser' && this.preferredProvider === 'browser') {
        message = 'Provider attivo: voci del browser.';
      } else if (this.activeProvider === 'browser' && this.preferredProvider === 'auto') {
        message = piperAvailable
          ? 'Provider attivo: voci del browser.'
          : 'Piper non raggiungibile, uso le voci del browser.';
      } else if (this.activeProvider === 'browser' && this.preferredProvider === 'piper') {
        message = 'Piper non raggiungibile, fallback sulle voci del browser.';
      } else if (this.activeProvider === 'piper' && this.preferredProvider === 'browser') {
        message = 'Voci browser non disponibili, fallback su Piper.';
      }

      return {
        preferredProvider: this.preferredProvider,
        activeProvider: this.activeProvider,
        available: {
          browser: browserAvailable,
          piper: piperAvailable
        },
        message
      };
    }

    getVoiceCatalog() {
      const provider = this.activeProvider === 'none' ? 'browser' : this.activeProvider;
      return {
        providerState: this.getProviderState(),
        activeProvider: provider,
        voices: this.getVoices(provider)
      };
    }

    getVoices(provider = null) {
      const resolvedProvider = provider || this.activeProvider;
      if (resolvedProvider === 'piper') {
        return this.piperVoices.map((voice) => ({ ...voice }));
      }
      return this.browserVoices.map((voice) => ({
        voiceURI: voice.voiceURI,
        name: voice.name,
        lang: voice.lang,
        default: voice.default
      }));
    }

    getChannelConfig(channel) {
      if (!this.channels[channel]) return null;
      return { ...this.channels[channel] };
    }

    async setPreferredProvider(provider) {
      this.preferredProvider = ['auto', 'browser', 'piper'].includes(provider) ? provider : 'auto';
      this._savePreferences();
      await this.refreshProviders(true);
    }

    setChannelVoice(channel, voiceId, provider = null) {
      const config = this.channels[channel];
      if (!config) return;

      const resolvedProvider = provider || this.activeProvider || 'browser';
      if (resolvedProvider === 'piper') {
        config.piperVoice = voiceId || '';
      } else {
        config.browserVoiceURI = voiceId || '';
      }

      this._savePreferences();
      this._notifyVoicesChanged();
    }

    _splitText(text) {
      const normalized = String(text).replace(/\s+/g, ' ').trim();
      if (!normalized) return [];
      if (normalized.length <= 220) return [normalized];

      const parts = normalized.match(/[^.!?;]+[.!?;]?/g) || [normalized];
      const chunks = [];
      let current = '';

      for (const part of parts) {
        const candidate = current ? `${current} ${part}`.trim() : part.trim();
        if (candidate.length <= 220) {
          current = candidate;
        } else {
          if (current) chunks.push(current);
          if (part.length <= 220) {
            current = part.trim();
          } else {
            const words = part.trim().split(' ');
            let sentenceChunk = '';
            for (const word of words) {
              const nextChunk = sentenceChunk ? `${sentenceChunk} ${word}` : word;
              if (nextChunk.length > 220) {
                if (sentenceChunk) chunks.push(sentenceChunk);
                sentenceChunk = word;
              } else {
                sentenceChunk = nextChunk;
              }
            }
            current = sentenceChunk;
          }
        }
      }

      if (current) chunks.push(current);
      return chunks;
    }

    isSpeaking() {
      if (this.speaking && this.currentSpeechStartedAt > 0) {
        const elapsed = Date.now() - this.currentSpeechStartedAt;
        if (elapsed > 10000) {
          this._forceSpeechRecovery('stale_speaking_state');
        }
      }
      return this.speaking || this.queue.length > 0;
    }

    onIdle(callback) {
      if (!this.isSpeaking()) {
        callback();
        return;
      }
      this.onIdleCallback = callback;
    }

    _checkIdle() {
      if (!this.isSpeaking() && this.onIdleCallback) {
        const cb = this.onIdleCallback;
        this.onIdleCallback = null;
        cb();
      }
    }

    _normalizeSpeakOptions(priorityOrOptions, maybeOptions) {
      if (typeof priorityOrOptions === 'object' && priorityOrOptions !== null) {
        return {
          priority: Boolean(priorityOrOptions.priority),
          channel: priorityOrOptions.channel || 'gameplay',
          promptKey: priorityOrOptions.promptKey || ''
        };
      }

      if (typeof maybeOptions === 'object' && maybeOptions !== null) {
        return {
          priority: Boolean(priorityOrOptions),
          channel: maybeOptions.channel || 'gameplay',
          promptKey: maybeOptions.promptKey || ''
        };
      }

      return {
        priority: Boolean(priorityOrOptions),
        channel: 'gameplay',
        promptKey: ''
      };
    }

    speak(text, priorityOrOptions = false, maybeOptions = null) {
      if (!this.enabled || !text) return;

      try {
        this.prime();
        const options = this._normalizeSpeakOptions(priorityOrOptions, maybeOptions);

        if (options.priority) {
          this.cancel();
        }

        this.lastSpoken = {
          text: String(text).trim(),
          channel: options.channel,
          promptKey: options.promptKey || ''
        };

        const chunks = options.promptKey
          ? [{
            text: String(text).trim(),
            channel: options.channel,
            promptKey: options.promptKey
          }]
          : this._splitText(text).map((chunk) => ({
            text: chunk,
            channel: options.channel,
            promptKey: ''
          }));
        this.queue.push(...chunks);
        this._processQueue();
      } catch (error) {
        console.warn('TTS speak error:', error);
      }
    }

    repeatLast() {
      if (!this.lastSpoken) return;
      this.speak(this.lastSpoken.text, {
        priority: true,
        channel: this.lastSpoken.channel,
        promptKey: this.lastSpoken.promptKey
      });
    }

    _resolveBrowserVoice(channel) {
      const channelConfig = this.channels[channel] || this.channels.gameplay;
      const chosen = this.browserVoices.find((voice) => voice.voiceURI === channelConfig.browserVoiceURI);
      if (chosen) return chosen;
      return this._pickBestVoice(this.browserVoices, channel);
    }

    _resolvePiperVoice(channel) {
      const channelConfig = this.channels[channel] || this.channels.gameplay;
      const chosen = this.piperVoices.find((voice) => voice.voiceURI === channelConfig.piperVoice);
      if (chosen) return chosen;
      return this._pickBestVoice(this.piperVoices, channel);
    }

    _getChannelRate(channel) {
      const channelConfig = this.channels[channel] || this.channels.gameplay;
      return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
        ? channelConfig.rateMobile
        : channelConfig.rateDesktop;
    }

    _processQueue() {
      if (this.speaking || this.queue.length === 0) {
        this._checkIdle();
        return;
      }

      this._resolveActiveProvider();
      const item = this.queue.shift();
      const provider = this.activeProvider;

      if (provider === 'none') {
        console.warn('Nessun provider TTS disponibile.');
        this._checkIdle();
        return;
      }

      this.speaking = true;

      const token = ++this.currentSpeechToken;
      this.currentSpeechStartedAt = Date.now();
      this._armSpeechSafetyTimer(token);

      this._speakItem(item, provider)
        .then(() => {
          this._finalizeSpeech(token);
        })
        .catch((error) => {
          if (token !== this.currentSpeechToken) {
            return;
          }

          if (error && error.name === 'AbortError') {
            this._finalizeSpeech(token);
            return;
          }

          if (provider === 'piper' && this.browserVoices.length > 0) {
            console.warn('Piper non disponibile durante la sintesi, fallback browser:', error);
            this.piperAvailable = false;
            this._resolveActiveProvider();
            this._notifyProviderChanged();
            this._notifyVoicesChanged();
            this._speakItem(item, 'browser')
              .then(() => this._finalizeSpeech(token))
              .catch((fallbackError) => {
                if (token !== this.currentSpeechToken) {
                  return;
                }
                console.warn('Errore anche nel fallback browser:', fallbackError);
                this._finalizeSpeech(token);
              });
            return;
          }

          console.warn('Errore TTS:', error);
          this._finalizeSpeech(token);
        });
    }

    _finalizeSpeech(token) {
      if (token !== this.currentSpeechToken) {
        return;
      }
      this.speaking = false;
      this.currentSpeechStartedAt = 0;
      this._clearSpeechSafetyTimer();
      this.currentAbortController = null;
      this._cleanupAudioUrl();
      this._processQueue();
      this._checkIdle();
    }

    _armSpeechSafetyTimer(token) {
      this._clearSpeechSafetyTimer();
      this.currentSpeechSafetyTimer = window.setTimeout(() => {
        if (token !== this.currentSpeechToken || !this.speaking) {
          return;
        }
        this._forceSpeechRecovery('safety_timeout');
      }, 8000);
    }

    _clearSpeechSafetyTimer() {
      if (this.currentSpeechSafetyTimer) {
        window.clearTimeout(this.currentSpeechSafetyTimer);
        this.currentSpeechSafetyTimer = null;
      }
    }

    _forceSpeechRecovery(reason) {
      console.warn(`[TTS] Recupero forzato: ${reason}`);

      if (this.currentAbortController) {
        this.currentAbortController.abort();
      }

      if (this.audioElement) {
        this.audioElement.pause();
        this.audioElement.removeAttribute('src');
        this.audioElement.load();
      }

      this.currentSpeechToken += 1;
      this.speaking = false;
      this.currentSpeechStartedAt = 0;
      this._clearSpeechSafetyTimer();
      this.currentAbortController = null;
      this._cleanupAudioUrl();
      this._processQueue();
      this._checkIdle();
    }

    _speakItem(item, provider) {
      if (item.promptKey) {
        return this._speakWithFamilyVoice(item.promptKey)
          .catch((error) => {
            console.warn('Registrazione di famiglia non disponibile, fallback TTS:', error);
            return false;
          })
          .then((handled) => {
            if (handled) return;
            if (provider === 'piper') {
              return this._speakWithPiper(item.text, item.channel || 'gameplay');
            }
            return this._speakWithBrowser(item.text, item.channel || 'gameplay');
          });
      }

      if (provider === 'piper') {
        return this._speakWithPiper(item.text, item.channel || 'gameplay');
      }

      return this._speakWithBrowser(item.text, item.channel || 'gameplay');
    }

    async _speakWithFamilyVoice(promptKey) {
      if (typeof window === 'undefined' || !window.familyVoice || typeof window.familyVoice.fetchRecordingObjectUrl !== 'function') {
        return false;
      }

      if (!window.familyVoice.isEnabled() || !window.familyVoice.hasRecording(promptKey)) {
        return false;
      }

      const objectUrl = await window.familyVoice.fetchRecordingObjectUrl(promptKey);
      if (!objectUrl) {
        return false;
      }

      await this._playAudioUrl(objectUrl, false);
      return true;
    }

    _speakWithBrowser(text, channel) {
      if (!this._hasBrowserSupport()) {
        return Promise.reject(new Error('Web Speech API non supportata.'));
      }

      return new Promise((resolve, reject) => {
        const channelConfig = this.channels[channel] || this.channels.gameplay;
        const utter = new SpeechSynthesisUtterance(text);
        const voice = this._resolveBrowserVoice(channel);

        utter.lang = voice ? (voice.lang || 'it-IT') : 'it-IT';
        utter.rate = this._getChannelRate(channel);
        utter.pitch = channelConfig.pitch;
        utter.volume = channelConfig.volume;

        if (voice) {
          utter.voice = voice;
        }

        utter.onend = () => resolve();
        utter.onerror = (event) => {
          if (event.error === 'canceled' || event.error === 'interrupted') {
            resolve();
            return;
          }
          reject(new Error(event.error || 'browser_tts_error'));
        };

        window.speechSynthesis.speak(utter);
      });
    }

    async _speakWithPiper(text, channel) {
      const voice = this._resolvePiperVoice(channel);
      const payload = {
        text,
        length_scale: Number((1 / this._getChannelRate(channel)).toFixed(2))
      };

      if (voice && voice.voiceURI) {
        payload.voice = voice.voiceURI;
      }

      this.currentAbortController = new AbortController();
      const response = await this._postToPiper(payload);

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      this.currentAudioUrl = objectUrl;

      return this._playAudioUrl(objectUrl, true);
    }

    _playAudioUrl(objectUrl, revokeOnEnd) {
      if (revokeOnEnd) {
        this.currentAudioUrl = objectUrl;
      }

      return new Promise((resolve, reject) => {
        const audio = this._getAudioElement();
        audio.src = objectUrl;
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error('piper_audio_error'));
        audio.onpause = () => {
          if (!this.speaking && this.queue.length === 0) {
            resolve();
          }
        };

        const playPromise = audio.play();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise.catch((error) => reject(error));
        }
      });
    }

    async _postToPiper(payload) {
      const endpoints = [
        '/api/tts/synthesize',
        '/api/tts/'
      ];

      let lastError = null;

      for (const endpoint of endpoints) {
        const response = await fetch(resolveApiUrl(endpoint), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'audio/wav'
          },
          body: JSON.stringify(payload),
          signal: this.currentAbortController.signal
        });

        if (response.ok) {
          return response;
        }

        if (response.status !== 404 && response.status !== 405) {
          throw new Error(`Piper HTTP ${response.status}`);
        }

        lastError = new Error(`Piper HTTP ${response.status} on ${endpoint}`);
      }

      throw lastError || new Error('Piper HTTP error');
    }

    _getAudioElement() {
      if (!this.audioElement) {
        this.audioElement = new Audio();
        this.audioElement.preload = 'auto';
      }
      return this.audioElement;
    }

    _cleanupAudioUrl() {
      if (this.currentAudioUrl) {
        URL.revokeObjectURL(this.currentAudioUrl);
        this.currentAudioUrl = null;
      }
    }

    cancel() {
      if (this._hasBrowserSupport()) {
        window.speechSynthesis.cancel();
      }

      if (this.currentAbortController) {
        this.currentAbortController.abort();
      }

      this.currentSpeechToken += 1;
      this.currentSpeechStartedAt = 0;
      this._clearSpeechSafetyTimer();

      if (this.audioElement) {
        this.audioElement.pause();
        this.audioElement.removeAttribute('src');
        this.audioElement.load();
      }

      this._cleanupAudioUrl();
      this.queue = [];
      this.speaking = false;
      this.onIdleCallback = null;
    }
  }

const tts = new TTSManager();

if (typeof window !== 'undefined') {
  Object.assign(window, { TTSManager, tts });
}

export { TTSManager, tts };
