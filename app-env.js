const rawConfig = {
  appName: import.meta.env.VITE_APP_NAME || 'Specula Elementae',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '',
  enableDebug: import.meta.env.VITE_ENABLE_DEBUG === '1' || import.meta.env.VITE_ENABLE_DEBUG === 'true'
};

function normalizeBaseUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}

const speculaEnv = {
  appName: rawConfig.appName,
  apiBaseUrl: normalizeBaseUrl(rawConfig.apiBaseUrl),
  enableDebug: rawConfig.enableDebug,
  api(pathname = '') {
    return `${this.apiBaseUrl}${pathname}`;
  }
};

if (typeof window !== 'undefined') {
  window.__SPECULA_ENV__ = speculaEnv;

  if (document && typeof document.title === 'string') {
    document.title = document.title.replace(/Specula Elementae/g, speculaEnv.appName);
  }

  const appNameNodes = document.querySelectorAll('[data-app-name]');
  for (const node of appNameNodes) {
    node.textContent = speculaEnv.appName;
  }
}

export { speculaEnv };
