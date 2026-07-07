import { DEFAULT_LOCALE, LOCALES, SUPPORTED_LOCALES } from './locales/generated.js';

const STORAGE_KEY = 'specula-elementae-locale';
let currentLocale = DEFAULT_LOCALE;
const listeners = new Set();

function normalizeLocale(locale) {
  if (!locale) return DEFAULT_LOCALE;
  const normalized = String(locale).trim().toLowerCase();
  if (SUPPORTED_LOCALES.includes(normalized)) return normalized;
  const short = normalized.split('-')[0];
  return SUPPORTED_LOCALES.includes(short) ? short : DEFAULT_LOCALE;
}

function getMessages(locale = currentLocale) {
  return LOCALES[normalizeLocale(locale)] || LOCALES[DEFAULT_LOCALE];
}

function resolveMessage(locale, key) {
  const segments = String(key).split('.');
  let current = getMessages(locale);
  for (const segment of segments) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      current = null;
      break;
    }
    current = current[segment];
  }

  if (typeof current === 'string') return current;
  if (locale !== DEFAULT_LOCALE) return resolveMessage(DEFAULT_LOCALE, key);
  return key;
}

function interpolate(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => (
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : `{${key}}`
  ));
}

function t(key, params = {}, locale = currentLocale) {
  return interpolate(resolveMessage(locale, key), params);
}

function setDocumentLanguage(locale) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = normalizeLocale(locale);
}

function localizeElement(element, locale = currentLocale) {
  if (!element || !element.dataset) return;

  const textKey = element.dataset.i18n;
  if (textKey) {
    element.textContent = t(textKey, {}, locale);
  }

  const htmlKey = element.dataset.i18nHtml;
  if (htmlKey) {
    element.innerHTML = t(htmlKey, {}, locale);
  }

  const attrSpec = element.dataset.i18nAttr;
  if (attrSpec) {
    const pairs = attrSpec.split(';').map((item) => item.trim()).filter(Boolean);
    for (const pair of pairs) {
      const [attrName, attrKey] = pair.split(':');
      if (!attrName || !attrKey) continue;
      element.setAttribute(attrName, t(attrKey, {}, locale));
    }
  }
}

function localizeDocument(root = document, locale = currentLocale) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  const elements = root.querySelectorAll('[data-i18n], [data-i18n-html], [data-i18n-attr]');
  for (const element of elements) {
    localizeElement(element, locale);
  }
  setDocumentLanguage(locale);
}

function getBrowserLocale() {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const primary = Array.isArray(navigator.languages) && navigator.languages.length > 0
    ? navigator.languages[0]
    : navigator.language;
  return normalizeLocale(primary);
}

function loadStoredLocale() {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored ? normalizeLocale(stored) : getBrowserLocale();
}

function initLocale() {
  currentLocale = loadStoredLocale();
  setDocumentLanguage(currentLocale);
  return currentLocale;
}

function getLocale() {
  return currentLocale;
}

function setLocale(locale) {
  const nextLocale = normalizeLocale(locale);
  if (nextLocale === currentLocale) return currentLocale;
  currentLocale = nextLocale;
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(STORAGE_KEY, currentLocale);
  }
  setDocumentLanguage(currentLocale);
  for (const listener of listeners) {
    listener(currentLocale);
  }
  return currentLocale;
}

function onLocaleChange(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getLocaleOptions() {
  return SUPPORTED_LOCALES.map((locale) => ({
    value: locale,
    label: t(`languages.${locale}`, {}, locale)
  }));
}

function getLanguagePrefixes(locale = currentLocale) {
  const normalized = normalizeLocale(locale);
  if (normalized === 'en') return ['en', 'en-us', 'en-gb'];
  return ['it', 'it-it'];
}

initLocale();

export {
  DEFAULT_LOCALE,
  LOCALES,
  SUPPORTED_LOCALES,
  getLanguagePrefixes,
  getLocale,
  getLocaleOptions,
  getMessages,
  initLocale,
  localizeDocument,
  localizeElement,
  normalizeLocale,
  onLocaleChange,
  setLocale,
  t
};
