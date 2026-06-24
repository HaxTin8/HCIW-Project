/**
 * Text-to-Speech manager con Web Speech API.
 * Legge ad alta voce gli eventi di gioco per un'esperienza no-WIMP.
 */

(function (global) {
  class TTSManager {
    constructor() {
      this.enabled = true;
      this.queue = [];
      this.speaking = false;
      this.onIdleCallback = null;
    }

    setEnabled(value) {
      this.enabled = value;
      if (!value && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        this.queue = [];
        this.speaking = false;
      }
    }

    isSpeaking() {
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

    speak(text, priority = false) {
      if (!this.enabled) return;
      if (!text) return;
      if (!('speechSynthesis' in window)) {
        console.warn('Web Speech API non supportata.');
        return;
      }

      try {
        if (priority) {
          window.speechSynthesis.cancel();
          this.queue = [];
          this.speaking = false;
        }

        this.queue.push(text);
        this._processQueue();
      } catch (e) {
        console.warn('TTS speak error:', e);
      }
    }

    _processQueue() {
      if (this.speaking || this.queue.length === 0) {
        this._checkIdle();
        return;
      }

      const text = this.queue.shift();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'it-IT';
      utter.rate = 1.15;
      utter.pitch = 1;

      utter.onend = () => {
        this.speaking = false;
        this._processQueue();
        this._checkIdle();
      };

      utter.onerror = (e) => {
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          console.warn('TTS error:', e.error);
        }
        this.speaking = false;
        this._processQueue();
        this._checkIdle();
      };

      this.speaking = true;
      window.speechSynthesis.speak(utter);
    }

    cancel() {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      this.queue = [];
      this.speaking = false;
      this.onIdleCallback = null;
    }
  }

  const tts = new TTSManager();

  global.TTSManager = TTSManager;
  global.tts = tts;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TTSManager, tts };
  }
})(typeof window !== 'undefined' ? window : global);
