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
      this.voices = [];
      this.selectedVoice = null;
      this.lastSpoken = '';
      this.initialized = false;

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        this._loadVoices();
        if ('onvoiceschanged' in window.speechSynthesis) {
          window.speechSynthesis.onvoiceschanged = () => this._loadVoices();
        }
      }
    }

    setEnabled(value) {
      this.enabled = value;
      if (!value && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        this.queue = [];
        this.speaking = false;
      }
    }

    prime() {
      if (!('speechSynthesis' in window)) return;
      this._loadVoices();
      this.initialized = true;
    }

    _loadVoices() {
      if (!('speechSynthesis' in window)) return;
      this.voices = window.speechSynthesis.getVoices() || [];
      this.selectedVoice = this._pickBestVoice(this.voices);
    }

    _pickBestVoice(voices) {
      if (!voices || voices.length === 0) return null;

      const italianVoices = voices.filter((voice) => voice.lang && voice.lang.toLowerCase().startsWith('it'));
      if (italianVoices.length === 0) return voices[0];

      const premiumMatch = italianVoices.find((voice) => /google|eloquence|federica|alice|elsa|premium|natural/i.test(voice.name));
      return premiumMatch || italianVoices[0];
    }

    _splitText(text) {
      const normalized = String(text).replace(/\s+/g, ' ').trim();
      if (!normalized) return [];
      if (normalized.length <= 140) return [normalized];

      const parts = normalized.match(/[^.!?;]+[.!?;]?/g) || [normalized];
      const chunks = [];
      let current = '';

      for (const part of parts) {
        const candidate = current ? `${current} ${part}`.trim() : part.trim();
        if (candidate.length <= 140) {
          current = candidate;
        } else {
          if (current) chunks.push(current);
          if (part.length <= 140) {
            current = part.trim();
          } else {
            const words = part.trim().split(' ');
            let sentenceChunk = '';
            for (const word of words) {
              const nextChunk = sentenceChunk ? `${sentenceChunk} ${word}` : word;
              if (nextChunk.length > 140) {
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
        this.prime();

        if (priority) {
          window.speechSynthesis.cancel();
          this.queue = [];
          this.speaking = false;
        }

        this.lastSpoken = String(text).trim();
        const chunks = this._splitText(text);
        this.queue.push(...chunks);
        this._processQueue();
      } catch (e) {
        console.warn('TTS speak error:', e);
      }
    }

    repeatLast() {
      if (!this.lastSpoken) return;
      this.speak(this.lastSpoken, true);
    }

    _processQueue() {
      if (this.speaking || this.queue.length === 0) {
        this._checkIdle();
        return;
      }

      const text = this.queue.shift();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'it-IT';
      utter.rate = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 1 : 1.08;
      utter.pitch = 1.02;
      utter.volume = 1;

      if (this.selectedVoice) {
        utter.voice = this.selectedVoice;
        utter.lang = this.selectedVoice.lang || 'it-IT';
      }

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
