/**
 * Audio manager using the Web Audio API.
 * Generates procedural sounds: no external files required.
 */
class AudioManager {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.enabled = true;
    }

    init() {
      if (this.ctx) return true;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return false;
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.25;
        this.master.connect(this.ctx.destination);
        return true;
      } catch (e) {
        console.warn('Web Audio API non disponibile:', e);
        return false;
      }
    }

    ensureReady() {
      if (!this.enabled) return false;
      if (!this.ctx) this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return !!this.ctx;
    }

    setEnabled(value) {
      this.enabled = value;
    }

    _tone(freq, type, duration, when, gain = 1) {
      if (!this.ensureReady()) return;
      const t = when ?? this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + duration);
    }

    _noise(duration, when) {
      if (!this.ensureReady()) return;
      const t = when ?? this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + duration);
      noise.connect(g);
      g.connect(this.master);
      noise.start(t);
    }

    playStart() {
      if (!this.ensureReady()) return;
      const t = this.ctx.currentTime;
      this._tone(440, 'sine', 0.4, t, 0.4);
      this._tone(554, 'sine', 0.4, t + 0.15, 0.4);
      this._tone(659, 'sine', 0.6, t + 0.3, 0.5);
    }

    playCard() {
      if (!this.ensureReady()) return;
      const t = this.ctx.currentTime;
      this._tone(600, 'triangle', 0.15, t, 0.3);
      this._tone(900, 'triangle', 0.2, t + 0.08, 0.2);
    }

    playWin() {
      if (!this.ensureReady()) return;
      const t = this.ctx.currentTime;
      this._tone(523, 'sine', 0.2, t, 0.4);
      this._tone(659, 'sine', 0.2, t + 0.15, 0.4);
      this._tone(784, 'sine', 0.3, t + 0.3, 0.5);
      this._tone(1047, 'sine', 0.6, t + 0.5, 0.5);
    }

    playLose() {
      if (!this.ensureReady()) return;
      const t = this.ctx.currentTime;
      this._tone(300, 'sawtooth', 0.3, t, 0.3);
      this._tone(220, 'sawtooth', 0.5, t + 0.25, 0.3);
      this._noise(0.4, t + 0.1);
    }

    playDraw() {
      if (!this.ensureReady()) return;
      const t = this.ctx.currentTime;
      this._tone(440, 'square', 0.2, t, 0.15);
      this._tone(440, 'square', 0.2, t + 0.25, 0.15);
    }

    playStep() {
      if (!this.ensureReady()) return;
      const t = this.ctx.currentTime;
      this._noise(0.05, t);
    }
  }

const audio = new AudioManager();

if (typeof window !== 'undefined') {
  Object.assign(window, { AudioManager, audio });
}

export { AudioManager, audio };
