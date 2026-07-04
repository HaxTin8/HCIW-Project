import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SOURCE_INDEX_PATH = path.join(ROOT, 'stories', 'twine', 'index.json');
const OUTPUT_DIR = path.join(ROOT, 'stories', 'generated');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function clearOutputDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  for (const entry of fs.readdirSync(dirPath)) {
    fs.rmSync(path.join(dirPath, entry), { recursive: true, force: true });
  }
}

function cleanText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseStoryPassages(source, storyPath) {
  const normalized = source.replace(/\r\n/g, '\n');
  const headerRegex = /^::\s+(.+?)(?:\s+\[(.*?)\])?\s*$/gm;
  const matches = [...normalized.matchAll(headerRegex)];

  if (matches.length === 0) {
    throw new Error(`Nessun passaggio trovato in ${storyPath}`);
  }

  return matches.map((match, index) => {
    const bodyStart = match.index + match[0].length;
    const bodyEnd = index + 1 < matches.length ? matches[index + 1].index : normalized.length;
    const rawName = match[1].trim();
    const rawTags = (match[2] || '').trim();
    const body = normalized.slice(bodyStart, bodyEnd).trim();

    return {
      name: rawName,
      tags: rawTags ? rawTags.split(/\s+/).filter(Boolean) : [],
      body
    };
  });
}

function parseLinks(text) {
  const links = [];
  const stripped = text.replace(/\[\[([^\]]+)\]\]/g, (_, content) => {
    const arrowIndex = content.indexOf('->');
    const pipeIndex = content.indexOf('|');

    if (arrowIndex !== -1) {
      const label = content.slice(0, arrowIndex).trim();
      const target = content.slice(arrowIndex + 2).trim();
      links.push({ text: label, target });
      return '';
    }

    if (pipeIndex !== -1) {
      const target = content.slice(0, pipeIndex).trim();
      const label = content.slice(pipeIndex + 1).trim();
      links.push({ text: label, target });
      return '';
    }

    const target = content.trim();
    links.push({ text: target, target });
    return '';
  });

  return {
    text: cleanText(stripped),
    links
  };
}

function parseGameEffects(text) {
  const effectRegex = /```(?:json\s+)?gameEffects\s*([\s\S]*?)```/i;
  const match = text.match(effectRegex);

  if (!match) {
    return {
      text,
      gameEffects: null
    };
  }

  let gameEffects;

  try {
    gameEffects = JSON.parse(match[1].trim());
  } catch (error) {
    throw new Error(`Blocco gameEffects non valido: ${error.message}`);
  }

  return {
    text: cleanText(text.replace(effectRegex, '')),
    gameEffects
  };
}

function compileStory(sourcePath) {
  const rawSource = fs.readFileSync(sourcePath, 'utf8');
  const rawPassages = parseStoryPassages(rawSource, sourcePath);
  const storyTitlePassage = rawPassages.find((passage) => passage.name === 'StoryTitle');
  const storyDataPassage = rawPassages.find((passage) => passage.name === 'StoryData');

  if (!storyTitlePassage) {
    throw new Error(`Passaggio StoryTitle mancante in ${sourcePath}`);
  }

  if (!storyDataPassage) {
    throw new Error(`Passaggio StoryData mancante in ${sourcePath}`);
  }

  let storyData;

  try {
    storyData = JSON.parse(storyDataPassage.body);
  } catch (error) {
    throw new Error(`StoryData non valido in ${sourcePath}: ${error.message}`);
  }

  const passages = rawPassages
    .filter((passage) => passage.name !== 'StoryTitle' && passage.name !== 'StoryData')
    .map((passage, index) => {
      const withEffects = parseGameEffects(passage.body);
      const withLinks = parseLinks(withEffects.text);
      const compiledPassage = {
        pid: index + 1,
        name: passage.name,
        tags: passage.tags,
        text: withLinks.text
      };

      if (withLinks.links.length > 0) {
        compiledPassage.links = withLinks.links;
      }

      if (withEffects.gameEffects) {
        compiledPassage.gameEffects = withEffects.gameEffects;
      }

      return compiledPassage;
    });

  if (!storyData.id || !storyData.author || !storyData.startPassage) {
    throw new Error(`StoryData incompleto in ${sourcePath}`);
  }

  const passageNames = new Set(passages.map((passage) => passage.name));

  if (passageNames.size !== passages.length) {
    throw new Error(`Ci sono passaggi duplicati in ${sourcePath}`);
  }

  if (!passageNames.has(storyData.startPassage)) {
    throw new Error(`startPassage "${storyData.startPassage}" non trovato in ${sourcePath}`);
  }

  for (const passage of passages) {
    for (const link of passage.links || []) {
      if (!passageNames.has(link.target)) {
        throw new Error(`Link verso passaggio inesistente "${link.target}" in ${sourcePath}`);
      }
    }
  }

  return {
    id: storyData.id,
    title: cleanText(storyTitlePassage.body),
    author: storyData.author,
    passages,
    startPassage: storyData.startPassage
  };
}

function buildStories() {
  const sourceIndex = JSON.parse(fs.readFileSync(SOURCE_INDEX_PATH, 'utf8'));
  ensureDir(OUTPUT_DIR);
  clearOutputDir(OUTPUT_DIR);

  const generatedIndex = {
    _meta: {
      description: 'Mappa generata automaticamente dai sorgenti Twine',
      version: '2.0',
      generatedAt: new Date().toISOString()
    }
  };

  for (const [cardId, entry] of Object.entries(sourceIndex)) {
    if (cardId === '_meta') {
      continue;
    }

    const sourcePath = path.join(ROOT, entry.source);
    const story = compileStory(sourcePath);
    const outputName = `${path.basename(entry.source, path.extname(entry.source))}.json`;
    const outputRelativePath = path.posix.join('stories', 'generated', outputName);
    const outputPath = path.join(OUTPUT_DIR, outputName);

    fs.writeFileSync(outputPath, `${JSON.stringify(story, null, 2)}\n`);

    generatedIndex[cardId] = {
      id: story.id,
      title: story.title,
      file: outputRelativePath
    };
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.json'), `${JSON.stringify(generatedIndex, null, 2)}\n`);
  return generatedIndex;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const generatedIndex = buildStories();
  const storyCount = Object.keys(generatedIndex).filter((key) => key !== '_meta').length;
  console.log(`Build storie completata: ${storyCount} storie generate in stories/generated`);
}

export {
  buildStories,
  clearOutputDir,
  compileStory,
  parseLinks,
  parseGameEffects,
  parseStoryPassages
};
