import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'locales');
const OUTPUT_PATH = path.join(LOCALES_DIR, 'generated.js');
const DEFAULT_LOCALE = 'it';

const localeFiles = fs.readdirSync(LOCALES_DIR)
  .filter((file) => file.endsWith('.json'))
  .sort();

const locales = {};
for (const file of localeFiles) {
  const fullPath = path.join(LOCALES_DIR, file);
  const localeCode = path.basename(file, '.json');
  locales[localeCode] = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

const supportedLocales = Object.keys(locales);
if (!supportedLocales.includes(DEFAULT_LOCALE)) {
  throw new Error(`Missing default locale ${DEFAULT_LOCALE}`);
}

const output = `export const DEFAULT_LOCALE = ${JSON.stringify(DEFAULT_LOCALE)};
export const SUPPORTED_LOCALES = ${JSON.stringify(supportedLocales)};
export const LOCALES = ${JSON.stringify(locales, null, 2)};
`;

fs.writeFileSync(OUTPUT_PATH, output);
console.log(`Built locales: ${supportedLocales.join(', ')}`);
