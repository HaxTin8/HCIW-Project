import { speculaEnv } from './app-env.js';

const TOKEN_KEY = 'specula-elementae-family-voice-token';
const ENABLED_KEY = 'specula-elementae-family-voice-enabled';

function resolveApiUrl(pathname) {
  const baseUrl = typeof speculaEnv.apiBaseUrl === 'string' ? speculaEnv.apiBaseUrl : '';
  return `${baseUrl}${pathname}`;
}

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  class FamilyVoiceManager {
    constructor() {
      this.token = '';
      this.user = null;
      this.library = null;
      this.enabled = true;
      this.objectUrlCache = new Map();
      this.activeRecording = null;
      this.mediaRecorder = null;
      this.mediaStream = null;
      this.recordingChunks = [];
      this.recordingMimeType = 'audio/webm';
      this.selectedPromptId = '';
      this.selectedPrompt = null;
      this.currentFilter = 'all';
      this.isEmbeddedStudio = false;
      this.isHeadless = false;
      this.stageCanvas = null;
      this.stageCtx = null;
      this.studioEl = null;
      this.studioTitleEl = null;
      this.studioDurationEl = null;
      this.studioCopyEl = null;
      this.studioProgressEl = null;
      this.studioStateEl = null;
      this.studioElapsedEl = null;
      this.studioRecordBtn = null;
      this.studioPlayBtn = null;
      this.studioDeleteBtn = null;
      this.studioPositionEl = null;
      this.studioGroupEl = null;
      this.studioCounterEl = null;
      this.prevPromptBtn = null;
      this.nextPromptBtn = null;
      this.filterButtons = [];
      this.stageFrame = 0;
      this.recordingStartedAt = 0;
      this.stageResizeObserver = null;

      this.panel = null;
      this.statusEl = null;
      this.authForm = null;
      this.usernameInput = null;
      this.passwordInput = null;
      this.logoutBtn = null;
      this.refreshBtn = null;
      this.enabledToggle = null;
      this.libraryEl = null;
      this.messageEl = null;

      this._loadState();
    }

    _loadState() {
      if (typeof window === 'undefined' || !window.localStorage) return;
      this.token = window.localStorage.getItem(TOKEN_KEY) || '';
      const savedEnabled = window.localStorage.getItem(ENABLED_KEY);
      this.enabled = savedEnabled === null ? true : savedEnabled === 'true';
    }

    _saveState() {
      if (typeof window === 'undefined' || !window.localStorage) return;
      if (this.token) {
        window.localStorage.setItem(TOKEN_KEY, this.token);
      } else {
        window.localStorage.removeItem(TOKEN_KEY);
      }
      window.localStorage.setItem(ENABLED_KEY, String(this.enabled));
    }

    isEnabled() {
      return this.enabled;
    }

    hasRecording(promptKey) {
      if (!this.enabled || !this.library || !this.user) return false;
      const prompt = this.getPromptById(promptKey);
      return Boolean(prompt && prompt.hasRecording);
    }

    getPromptById(promptKey) {
      if (!this.library) return null;
      for (const group of this.library.groups || []) {
        const prompt = group.prompts.find((item) => item.id === promptKey);
        if (prompt) return prompt;
      }
      return null;
    }

    getRecommendedDuration(prompt) {
      if (!prompt || !prompt.script) return 6;
      const words = String(prompt.script).trim().split(/\s+/).filter(Boolean).length;
      return Math.max(5, Math.min(22, Math.round(words * 0.55)));
    }

    getFilteredPrompts() {
      if (!this.library || !Array.isArray(this.library.groups)) return [];
      const prompts = [];
      for (const group of this.library.groups) {
        for (const prompt of group.prompts || []) {
          if (this.currentFilter === 'story' && !String(prompt.id).startsWith('story.')) {
            continue;
          }
          if (this.currentFilter === 'gameplay' && !String(prompt.id).startsWith('game.')) {
            continue;
          }
          prompts.push({
            ...prompt,
            groupTitle: group.title
          });
        }
      }
      return prompts;
    }

    getSelectedPromptIndex() {
      const prompts = this.getFilteredPrompts();
      return prompts.findIndex((prompt) => prompt.id === this.selectedPromptId);
    }

    selectPrompt(promptId) {
      const prompt = this.getPromptById(promptId);
      if (!prompt) return;
      this.selectedPromptId = promptId;
      this.selectedPrompt = prompt;
      this.render();
      this._startStageLoop();
    }

    selectPromptByOffset(offset) {
      const prompts = this.getFilteredPrompts();
      if (prompts.length === 0) return;
      const currentIndex = this.getSelectedPromptIndex();
      const safeIndex = currentIndex === -1 ? 0 : currentIndex;
      const nextIndex = (safeIndex + offset + prompts.length) % prompts.length;
      this.selectPrompt(prompts[nextIndex].id);
    }

    setFilter(filter) {
      this.currentFilter = ['all', 'gameplay', 'story'].includes(filter) ? filter : 'all';
      const prompts = this.getFilteredPrompts();
      if (prompts.length === 0) {
        this.selectedPromptId = '';
        this.selectedPrompt = null;
      } else if (!prompts.some((prompt) => prompt.id === this.selectedPromptId)) {
        this.selectedPromptId = prompts[0].id;
        this.selectedPrompt = prompts[0];
      }
      this.render();
      this._startStageLoop();
    }

    async fetchRecordingObjectUrl(promptKey) {
      if (!this.hasRecording(promptKey)) return null;

      const cached = this.objectUrlCache.get(promptKey);
      if (cached) return cached;

      const response = await this._request(`/api/family-voice/recordings/${encodeURIComponent(promptKey)}`, {
        method: 'GET',
        headers: {
          Accept: 'audio/*'
        }
      });

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      this.objectUrlCache.set(promptKey, objectUrl);
      return objectUrl;
    }

    async playPrompt(promptKey) {
      const objectUrl = await this.fetchRecordingObjectUrl(promptKey);
      if (!objectUrl) return false;

      const audio = new Audio(objectUrl);
      await audio.play();
      return true;
    }

    init() {
      this.panel = document.getElementById('family-voice-panel');
      this.studioEl = document.getElementById('family-voice-studio');
      this.isHeadless = !this.panel;
      this.isEmbeddedStudio = Boolean(this.studioEl && this.studioEl.dataset && this.studioEl.dataset.embedded === 'true');

      if (this.isHeadless) {
        if (this.token) {
          this.restoreSession();
        }
        return;
      }

      this.statusEl = document.getElementById('family-voice-status');
      this.authForm = document.getElementById('family-voice-auth-form');
      this.usernameInput = document.getElementById('family-voice-username');
      this.passwordInput = document.getElementById('family-voice-password');
      this.logoutBtn = document.getElementById('family-voice-logout');
      this.refreshBtn = document.getElementById('family-voice-refresh');
      this.enabledToggle = document.getElementById('family-voice-enabled');
      this.libraryEl = document.getElementById('family-voice-library');
      this.messageEl = document.getElementById('family-voice-message');
      this.stageCanvas = document.getElementById('family-voice-stage');
      this.stageCtx = this.stageCanvas ? this.stageCanvas.getContext('2d') : null;
      this.studioTitleEl = document.getElementById('family-voice-studio-prompt-title');
      this.studioDurationEl = document.getElementById('family-voice-studio-duration');
      this.studioCopyEl = document.getElementById('family-voice-studio-copy');
      this.studioProgressEl = document.getElementById('family-voice-studio-progress-bar');
      this.studioStateEl = document.getElementById('family-voice-studio-state');
      this.studioElapsedEl = document.getElementById('family-voice-studio-elapsed');
      this.studioRecordBtn = document.getElementById('family-voice-record-main');
      this.studioPlayBtn = document.getElementById('family-voice-play-main');
      this.studioDeleteBtn = document.getElementById('family-voice-delete-main');
      this.studioPositionEl = document.getElementById('family-voice-studio-position');
      this.studioGroupEl = document.getElementById('family-voice-studio-group');
      this.studioCounterEl = document.getElementById('family-voice-studio-counter');
      this.prevPromptBtn = document.getElementById('family-voice-prev-prompt');
      this.nextPromptBtn = document.getElementById('family-voice-next-prompt');
      this.filterButtons = Array.from(document.querySelectorAll('[data-filter]'));
      this.studioCloseBtn = document.getElementById('family-voice-close-studio');

      if (this.enabledToggle) {
        this.enabledToggle.checked = this.enabled;
        this.enabledToggle.addEventListener('change', () => {
          this.enabled = this.enabledToggle.checked;
          this._saveState();
          this.render();
        });
      }

      if (this.authForm) {
        this.authForm.addEventListener('click', (event) => {
          const action = event.target && event.target.dataset ? event.target.dataset.action : '';
          if (!action) return;
          event.preventDefault();
          if (action === 'register') {
            this.register();
          } else if (action === 'login') {
            this.login();
          }
        });
      }

      if (this.logoutBtn) {
        this.logoutBtn.addEventListener('click', () => this.logout());
      }

      if (this.refreshBtn) {
        this.refreshBtn.addEventListener('click', () => this.loadLibrary());
      }

      if (this.libraryEl) {
        this.libraryEl.addEventListener('click', (event) => this._handleLibraryClick(event));
      }

      if (this.studioEl && !this.isEmbeddedStudio) {
        this.studioEl.addEventListener('click', (event) => {
          const action = event.target && event.target.dataset ? event.target.dataset.action : '';
          if (action === 'close-studio') {
            this.closeStudio();
          }
        });
      }

      if (this.studioCloseBtn) {
        this.studioCloseBtn.addEventListener('click', () => this.closeStudio());
      }

      if (this.studioRecordBtn) {
        this.studioRecordBtn.addEventListener('click', () => {
          if (!this.selectedPromptId) return;
          this.toggleRecording(this.selectedPromptId);
        });
      }

      if (this.studioPlayBtn) {
        this.studioPlayBtn.addEventListener('click', () => {
          if (!this.selectedPromptId) return;
          this.playPrompt(this.selectedPromptId).catch((error) => this._setMessage(this._humanizeError(error), true));
        });
      }

      if (this.studioDeleteBtn) {
        this.studioDeleteBtn.addEventListener('click', () => {
          if (!this.selectedPromptId) return;
          this.deletePrompt(this.selectedPromptId);
        });
      }

      if (this.prevPromptBtn) {
        this.prevPromptBtn.addEventListener('click', () => this.selectPromptByOffset(-1));
      }

      if (this.nextPromptBtn) {
        this.nextPromptBtn.addEventListener('click', () => this.selectPromptByOffset(1));
      }

      for (const button of this.filterButtons) {
        button.addEventListener('click', () => this.setFilter(button.dataset.filter));
      }

      if (typeof window !== 'undefined') {
        window.addEventListener('resize', () => {
          this._drawStage();
        });
      }

      if (typeof ResizeObserver !== 'undefined' && this.stageCanvas) {
        this.stageResizeObserver = new ResizeObserver(() => {
          this._drawStage();
        });
        this.stageResizeObserver.observe(this.stageCanvas);
      }

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && this.studioEl && !this.studioEl.hidden) {
          this.closeStudio();
        }
      });

      if (this.stageCanvas && (this.isEmbeddedStudio || (this.studioEl && !this.studioEl.hidden))) {
        this._startStageLoop();
      }

      if (this.token) {
        this.restoreSession();
      } else {
        this.render();
      }
    }

    async restoreSession() {
      try {
        const response = await this._request('/api/family-voice/auth/me', { method: 'GET' });
        const payload = await response.json();
        this.user = payload.user;
        await this.loadLibrary();
      } catch (error) {
        this._clearSession();
        this._setMessage('Sessione scaduta. Fai di nuovo login.', true);
        this.render();
      }
    }

    async register() {
      try {
        const payload = await this._submitAuth('/api/family-voice/auth/register');
        this._applySession(payload);
        this._setMessage('Profilo creato. Ora puoi registrare le voci.');
        await this.loadLibrary();
      } catch (error) {
        this._setMessage(this._humanizeError(error), true);
      }
    }

    async login() {
      try {
        const payload = await this._submitAuth('/api/family-voice/auth/login');
        this._applySession(payload);
        this._setMessage('Login eseguito. Libreria vocale pronta.');
        await this.loadLibrary();
      } catch (error) {
        this._setMessage(this._humanizeError(error), true);
      }
    }

    async logout() {
      try {
        await this._request('/api/family-voice/auth/logout', { method: 'POST' });
      } catch (error) {
        console.warn('Logout non completato:', error);
      }
      this._clearSession();
      this._setMessage('Sessione terminata.');
      this.render();
    }

    async loadLibrary() {
      if (!this.user) {
        this.render();
        return;
      }

      this._setStatus('Sto caricando il teleprompter...');
      try {
        const response = await this._request('/api/family-voice/library', { method: 'GET' });
        this.library = await response.json();
        this.render();
      } catch (error) {
        this._setMessage(this._humanizeError(error), true);
        this.render();
      }
    }

    async _submitAuth(url) {
      const username = this.usernameInput ? this.usernameInput.value.trim() : '';
      const password = this.passwordInput ? this.passwordInput.value : '';
      if (!username || !password) {
        throw new Error('Inserisci username e password.');
      }

      const response = await fetch(resolveApiUrl(url), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'auth_failed');
      }
      return payload;
    }

    _applySession(payload) {
      this.token = payload.token;
      this.user = payload.user;
      this._saveState();
      if (this.passwordInput) this.passwordInput.value = '';
    }

    _clearSession() {
      this.token = '';
      this.user = null;
      this.library = null;
      this._releaseCachedAudio();
      this._saveState();
    }

    _setStatus(message) {
      if (this.statusEl) {
        this.statusEl.textContent = message;
      }
    }

    _setMessage(message, isError = false) {
      if (!this.messageEl) return;
      this.messageEl.textContent = message || '';
      this.messageEl.dataset.tone = isError ? 'error' : 'neutral';
    }

    _releaseCachedAudio(promptKey = null) {
      if (promptKey) {
        const objectUrl = this.objectUrlCache.get(promptKey);
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          this.objectUrlCache.delete(promptKey);
        }
        return;
      }

      for (const objectUrl of this.objectUrlCache.values()) {
        URL.revokeObjectURL(objectUrl);
      }
      this.objectUrlCache.clear();
    }

    async _request(url, options = {}) {
      const headers = {
        Accept: 'application/json',
        ...(options.headers || {})
      };

      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }

      const response = await fetch(resolveApiUrl(url), {
        ...options,
        headers
      });

      if (!response.ok) {
        let errorCode = `http_${response.status}`;
        try {
          const payload = await response.clone().json();
          if (payload && payload.error) errorCode = payload.error;
        } catch (error) {
          // ignore parse error
        }
        throw new Error(errorCode);
      }

      return response;
    }

    _handleLibraryClick(event) {
      const button = event.target.closest('button[data-action]');
      if (!button) return;

      const promptId = button.dataset.promptId;
      const action = button.dataset.action;

      if (action === 'record') {
        this.selectPrompt(promptId);
      } else if (action === 'play') {
        this.playPrompt(promptId).catch((error) => {
          this._setMessage(this._humanizeError(error), true);
        });
      } else if (action === 'delete') {
        this.deletePrompt(promptId);
      }
    }

    openStudio(promptId) {
      const prompt = this.getPromptById(promptId);
      if (!prompt || !this.studioEl) return;
      this.selectedPromptId = promptId;
      this.selectedPrompt = prompt;
      if (!this.isEmbeddedStudio) {
        this.studioEl.hidden = false;
        this.studioEl.setAttribute('aria-hidden', 'false');
        document.body.classList.add('family-voice-modal-open');
      }
      this._setMessage('');
      this.render();
      this._startStageLoop();
    }

    closeStudio() {
      if (!this.studioEl) return;
      if (this.isEmbeddedStudio) return;
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.stopRecording();
      }
      this.studioEl.hidden = true;
      this.studioEl.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('family-voice-modal-open');
      this.selectedPromptId = '';
      this.selectedPrompt = null;
      this.stageFrame += 1;
    }

    _startStageLoop() {
      const frameToken = ++this.stageFrame;
      const tick = () => {
        if (frameToken !== this.stageFrame) return;
        if (!this.studioEl || (!this.isEmbeddedStudio && this.studioEl.hidden)) return;
        this._drawStage();
        if (this.selectedPrompt) window.requestAnimationFrame(tick);
      };
      window.requestAnimationFrame(tick);
    }

    _drawStage() {
      if (!this.stageCtx || !this.stageCanvas) return;

      const canvas = this.stageCanvas;
      const ctx = this.stageCtx;
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(320, Math.round(rect.width * ratio));
      const height = Math.max(220, Math.round((rect.width * 0.5625) * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const w = canvas.width;
      const h = canvas.height;

      if (!this.selectedPrompt) {
        ctx.clearRect(0, 0, w, h);
        const idleBg = ctx.createLinearGradient(0, 0, 0, h);
        idleBg.addColorStop(0, '#22355f');
        idleBg.addColorStop(1, '#131b30');
        ctx.fillStyle = idleBg;
        ctx.fillRect(0, 0, w, h);

        const cardInset = Math.round(w * 0.055);
        const cardW = w - cardInset * 2;
        const cardH = h - cardInset * 2;
        ctx.fillStyle = '#fff8ea';
        this._roundRect(ctx, cardInset, cardInset, cardW, cardH, 30 * ratio);
        ctx.fill();
        ctx.strokeStyle = 'rgba(176, 132, 47, 0.2)';
        ctx.lineWidth = 2 * ratio;
        ctx.stroke();

        ctx.fillStyle = '#77654a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `600 ${20 * ratio}px "Hanken Grotesk", sans-serif`;
        ctx.fillText('Scegli un prompt dalla libreria per iniziare', w / 2, h / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        return;
      }

      const recommended = this.getRecommendedDuration(this.selectedPrompt);
      const elapsed = this.mediaRecorder && this.mediaRecorder.state !== 'inactive'
        ? (performance.now() - this.recordingStartedAt) / 1000
        : 0;
      const progress = Math.min(1, elapsed / recommended);

      ctx.clearRect(0, 0, w, h);

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#22355f');
      bg.addColorStop(1, '#131b30');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = `rgba(255, 222, 150, ${0.03 + (i % 3) * 0.02})`;
        const size = Math.max(12, w * 0.01 * (i + 1));
        ctx.beginPath();
        ctx.arc((w * ((i * 17) % 100)) / 100, (h * ((i * 11) % 100)) / 100, size, 0, Math.PI * 2);
        ctx.fill();
      }

      const cardInset = Math.round(w * 0.055);
      const cardW = w - cardInset * 2;
      const cardH = h - cardInset * 2;
      ctx.fillStyle = '#fff8ea';
      this._roundRect(ctx, cardInset, cardInset, cardW, cardH, 30 * ratio);
      ctx.fill();
      ctx.strokeStyle = 'rgba(176, 132, 47, 0.2)';
      ctx.lineWidth = 2 * ratio;
      ctx.stroke();

      const script = this.selectedPrompt.script || '';
      const words = script.split(/\s+/).filter(Boolean);
      const highlightCount = words.length === 0 ? 0 : Math.min(words.length, Math.floor(progress * words.length));
      const lines = this._wrapWords(ctx, words, cardW - 96 * ratio, 34 * ratio);

      ctx.fillStyle = '#9f7a34';
      ctx.font = `${18 * ratio}px "Space Grotesk", sans-serif`;
      ctx.fillText('VOCE DI FAMIGLIA', cardInset + 48 * ratio, cardInset + 52 * ratio);

      let currentWordIndex = 0;
      let y = cardInset + 120 * ratio;
      for (const line of lines) {
        let x = cardInset + 48 * ratio;
        for (const word of line) {
          const isHighlighted = currentWordIndex < highlightCount;
          ctx.font = `${isHighlighted ? 700 : 600} ${31 * ratio}px "Hanken Grotesk", sans-serif`;
          ctx.fillStyle = isHighlighted ? '#1f2c4e' : '#77654a';
          ctx.fillText(word.text, x, y);
          x += word.width + word.space;
          currentWordIndex++;
        }
        y += 52 * ratio;
      }

      const barX = cardInset + 48 * ratio;
      const barY = h - cardInset - 70 * ratio;
      const barW = cardW - 96 * ratio;
      const barH = 16 * ratio;
      ctx.fillStyle = 'rgba(176, 132, 47, 0.14)';
      this._roundRect(ctx, barX, barY, barW, barH, 999);
      ctx.fill();

      const fillW = Math.max(0, Math.min(barW, barW * progress));
      const fill = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      fill.addColorStop(0, '#f3c562');
      fill.addColorStop(0.5, '#ea8f55');
      fill.addColorStop(1, '#d94f70');
      ctx.fillStyle = fill;
      this._roundRect(ctx, barX, barY, fillW, barH, 999);
      ctx.fill();
    }

    _roundRect(ctx, x, y, width, height, radius) {
      const r = Math.min(radius, width / 2, height / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + width, y, x + width, y + height, r);
      ctx.arcTo(x + width, y + height, x, y + height, r);
      ctx.arcTo(x, y + height, x, y, r);
      ctx.arcTo(x, y, x + width, y, r);
      ctx.closePath();
    }

    _wrapWords(ctx, words, maxWidth, fontSize) {
      ctx.font = `600 ${fontSize}px "Hanken Grotesk", sans-serif`;
      const lines = [];
      let line = [];
      let lineWidth = 0;
      const space = ctx.measureText(' ').width;

      for (const rawWord of words) {
        const width = ctx.measureText(rawWord).width;
        if (line.length > 0 && lineWidth + width + space > maxWidth) {
          lines.push(line);
          line = [];
          lineWidth = 0;
        }
        line.push({ text: rawWord, width, space });
        lineWidth += width + (line.length > 1 ? space : 0);
      }

      if (line.length > 0) {
        lines.push(line);
      }

      return lines;
    }

    async toggleRecording(promptId) {
      if (this.activeRecording && this.activeRecording.promptId === promptId) {
        this.stopRecording();
        return;
      }

      await this.startRecording(promptId);
    }

    async startRecording(promptId) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
        this._setMessage('Registrazione audio non supportata da questo browser.', true);
        return;
      }

      try {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.stopRecording();
        }

        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : '';

        this.recordingChunks = [];
        this.recordingMimeType = mimeType || 'audio/webm';
        this.mediaRecorder = new MediaRecorder(this.mediaStream, mimeType ? { mimeType } : undefined);
        this.activeRecording = { promptId };
        this.recordingStartedAt = performance.now();

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            this.recordingChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = async () => {
          const blob = new Blob(this.recordingChunks, { type: this.recordingMimeType });
          this._stopMediaStream();
          const completedPromptId = this.activeRecording ? this.activeRecording.promptId : promptId;
          this.activeRecording = null;
          this.recordingStartedAt = 0;
          this.render();

          if (blob.size === 0) {
            this._setMessage('Registrazione vuota, riprova.', true);
            return;
          }

          try {
            await this.uploadPrompt(completedPromptId, blob);
            this._setMessage('Registrazione salvata.');
            await this.loadLibrary();
          } catch (error) {
            this._setMessage(this._humanizeError(error), true);
          }
        };

        this.mediaRecorder.start();
        this._setMessage('Registrazione in corso...');
        this.render();
      } catch (error) {
        this._setMessage(this._humanizeError(error), true);
      }
    }

    stopRecording() {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
    }

    _stopMediaStream() {
      if (!this.mediaStream) return;
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }

    async uploadPrompt(promptId, blob) {
      this._releaseCachedAudio(promptId);
      await this._request(`/api/family-voice/recordings/${encodeURIComponent(promptId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': blob.type || 'audio/webm',
          Accept: 'application/json'
        },
        body: blob
      });
    }

    async deletePrompt(promptId) {
      try {
        await this._request(`/api/family-voice/recordings/${encodeURIComponent(promptId)}`, {
          method: 'DELETE'
        });
        this._releaseCachedAudio(promptId);
        this._setMessage('Registrazione eliminata.');
        await this.loadLibrary();
        if (this.selectedPromptId === promptId) {
          this.selectedPrompt = this.getPromptById(promptId);
          this.render();
        }
      } catch (error) {
        this._setMessage(this._humanizeError(error), true);
      }
    }

    _humanizeError(error) {
      const message = error && error.message ? error.message : String(error || 'unknown_error');
      const map = {
        username_taken: 'Questo username esiste gia.',
        unauthorized: 'Username o password non corretti.',
        username_password_required: 'Servono username e password.',
        invalid_prompt_id: 'Prompt non valido.',
        empty_audio: 'La registrazione e vuota.',
        payload_too_large: 'File audio troppo grande.',
        NotAllowedError: 'Permesso microfono negato.',
        NotFoundError: 'Nessun microfono disponibile.'
      };
      return map[message] || message;
    }

    render() {
      if (!this.panel) return;

      if (!this.user) {
        this._setStatus('Accedi o crea un profilo per salvare registrazioni private.');
        if (this.libraryEl) this.libraryEl.innerHTML = '';
        if (this.logoutBtn) this.logoutBtn.hidden = true;
        if (this.refreshBtn) this.refreshBtn.hidden = true;
        if (this.authForm) this.authForm.hidden = false;
        return;
      }

      if (this.logoutBtn) this.logoutBtn.hidden = false;
      if (this.refreshBtn) this.refreshBtn.hidden = false;
      if (this.authForm) this.authForm.hidden = true;
      this._setStatus(`Profilo attivo: ${this.user.username}`);

      if (!this.library) {
        this._renderStudio();
        return;
      }

      if (!this.selectedPromptId) {
        const firstPrompt = this.getFilteredPrompts()[0] || null;
        if (firstPrompt) {
          this.selectedPromptId = firstPrompt.id;
          this.selectedPrompt = firstPrompt;
        }
      }

      if (this.libraryEl) {
        const prompts = this.getFilteredPrompts();
        const completed = prompts.filter((prompt) => prompt.hasRecording).length;
        this.libraryEl.innerHTML = `
          <div class="family-voice-summary-card">
            <div class="family-voice-summary-top">
              <span class="family-voice-pill${completed > 0 ? ' is-ready' : ''}">${completed}/${prompts.length} completati</span>
              <span class="family-voice-summary-filter">${this.currentFilter === 'story' ? 'Filtro: storie' : this.currentFilter === 'gameplay' ? 'Filtro: suggerimenti' : 'Filtro: tutti'}</span>
            </div>
            <p class="family-voice-group-copy">I prompt si registrano dal teleprompter centrale. Usa i pulsanti sopra la canvas per passare al testo successivo o precedente.</p>
          </div>
        `;
      }

      this._renderStudio();
    }

    _renderStudio() {
      if (!this.studioEl) return;

      const prompt = this.selectedPromptId ? this.getPromptById(this.selectedPromptId) : null;
      if (prompt) {
        this.selectedPrompt = prompt;
      }

      const prompts = this.getFilteredPrompts();
      const selectedIndex = this.getSelectedPromptIndex();
      const hasPrompt = Boolean(this.selectedPrompt);
      const recommended = hasPrompt ? this.getRecommendedDuration(this.selectedPrompt) : 0;
      const isRecording = Boolean(this.activeRecording && this.selectedPrompt && this.activeRecording.promptId === this.selectedPrompt.id);
      const elapsed = isRecording ? (performance.now() - this.recordingStartedAt) / 1000 : 0;
      const progress = recommended > 0 ? Math.min(1, elapsed / recommended) : 0;
      const completed = prompts.filter((entry) => entry.hasRecording).length;

      if (this.studioTitleEl) {
        this.studioTitleEl.textContent = hasPrompt ? this.selectedPrompt.title : '-';
      }
      if (this.studioPositionEl) {
        this.studioPositionEl.textContent = prompts.length > 0 && selectedIndex !== -1
          ? `${selectedIndex + 1} / ${prompts.length}`
          : `0 / ${prompts.length}`;
      }
      if (this.studioGroupEl) {
        this.studioGroupEl.textContent = hasPrompt && prompts[selectedIndex]
          ? prompts[selectedIndex].groupTitle
          : 'Seleziona un prompt';
      }
      if (this.studioCounterEl) {
        this.studioCounterEl.textContent = `${completed} di ${prompts.length} completati`;
      }
      if (this.studioDurationEl) {
        this.studioDurationEl.textContent = `${recommended}s`;
      }
      if (this.studioCopyEl) {
        this.studioCopyEl.textContent = hasPrompt
          ? `Leggi con voce calma e naturale. Il testo si illumina seguendo il ritmo consigliato per questa frase.`
          : 'Scegli un prompt per iniziare.';
      }
      if (this.studioProgressEl) {
        this.studioProgressEl.style.width = `${progress * 100}%`;
      }
      if (this.studioStateEl) {
        this.studioStateEl.textContent = isRecording
          ? 'Registrazione in corso'
          : hasPrompt
            ? 'Pronto a registrare'
            : 'Nessun prompt selezionato';
      }
      if (this.studioElapsedEl) {
        this.studioElapsedEl.textContent = `${elapsed.toFixed(1)}s`;
      }
      if (this.studioRecordBtn) {
        this.studioRecordBtn.textContent = isRecording ? 'Ferma e salva' : 'Inizia registrazione';
        this.studioRecordBtn.disabled = !hasPrompt;
      }
      if (this.prevPromptBtn) {
        this.prevPromptBtn.disabled = prompts.length === 0;
      }
      if (this.nextPromptBtn) {
        this.nextPromptBtn.disabled = prompts.length === 0;
      }
      if (this.studioPlayBtn) {
        this.studioPlayBtn.disabled = !hasPrompt || !this.selectedPrompt || !this.selectedPrompt.hasRecording;
      }
      if (this.studioDeleteBtn) {
        this.studioDeleteBtn.disabled = !hasPrompt || !this.selectedPrompt || !this.selectedPrompt.hasRecording;
      }
      for (const button of this.filterButtons) {
        button.classList.toggle('is-active', button.dataset.filter === this.currentFilter);
      }

      if (hasPrompt && (this.isEmbeddedStudio || !this.studioEl.hidden)) {
        this._drawStage();
        if (this.isEmbeddedStudio) {
          window.requestAnimationFrame(() => this._drawStage());
        }
      }
    }
  }

const familyVoice = new FamilyVoiceManager();

if (typeof window !== 'undefined') {
  Object.assign(window, { FamilyVoiceManager, familyVoice });
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => familyVoice.init());
}

export { FamilyVoiceManager, familyVoice };
