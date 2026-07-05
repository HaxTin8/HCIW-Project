import fs from 'node:fs';
import path from 'node:path';
import { CARD_TEMPLATES, ELEMENTS } from '../cards.js';

function getStrongAgainstText(elementId) {
  const element = ELEMENTS[elementId];
  if (!element || !element.strongVs || element.strongVs.length === 0) return '';
  return element.strongVs.map((id) => ELEMENTS[id].name).join(' e ');
}

function getCardLearningLine(template) {
  const strongChoices = getStrongAgainstText(template.element);
  return `${ELEMENTS[template.element].name}`;
}

function buildGameplayPrompts() {
  const prompts = [
    {
      id: 'game.start',
      groupId: 'gameplay',
      channel: 'gameplay',
      title: 'Inizio avventura',
      script: 'Inizia l\'avventura.'
    },
    {
      id: 'game.mode.sequential',
      groupId: 'gameplay',
      channel: 'gameplay',
      title: 'Modalita una carta alla volta',
      script: 'Modalita una carta alla volta.'
    },
    {
      id: 'game.mode.simultaneous',
      groupId: 'gameplay',
      channel: 'gameplay',
      title: 'Modalita sfida multipla',
      script: 'Modalita sfida multipla.'
    }
  ];

  for (const template of CARD_TEMPLATES) {
    const learningLine = getCardLearningLine(template);
    prompts.push({
      id: `game.card.${template.id}`,
      groupId: 'gameplay',
      channel: 'gameplay',
      title: `${template.name} nello slot`,
      script: learningLine
    });
    prompts.push({
      id: `game.card.${template.id}.remove`,
      groupId: 'gameplay',
      channel: 'gameplay',
      title: `${template.name} nello slot singolo`,
      script: `${learningLine} Togli la carta.`
    });
  }

  return prompts;
}

function loadGeneratedStories(rootDir) {
  const generatedDir = path.join(rootDir, 'stories', 'generated');
  const indexPath = path.join(generatedDir, 'index.json');
  if (!fs.existsSync(indexPath)) {
    return [];
  }

  const storyIndex = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const stories = [];

  for (const [cardId, entry] of Object.entries(storyIndex)) {
    if (cardId === '_meta') continue;
    const storyPath = path.join(rootDir, entry.file);
    if (!fs.existsSync(storyPath)) continue;
    stories.push(JSON.parse(fs.readFileSync(storyPath, 'utf8')));
  }

  return stories;
}

function buildStoryGroups(rootDir) {
  const stories = loadGeneratedStories(rootDir);
  const groups = [];

  for (const story of stories) {
    const prompts = [];
    for (const passage of story.passages || []) {
      if (!passage.text || !String(passage.text).trim()) continue;
      prompts.push({
        id: `story.${story.id}.${passage.name}`,
        groupId: `story-${story.id}`,
        channel: 'story',
        title: passage.name,
        script: passage.text,
        storyId: story.id,
        storyTitle: story.title,
        tags: Array.isArray(passage.tags) ? passage.tags.slice() : []
      });
    }

    groups.push({
      id: `story-${story.id}`,
      title: story.title,
      description: `Passaggi narrativi della storia ${story.title}`,
      prompts
    });
  }

  return groups;
}

function buildPromptCatalog(rootDir) {
  const gameplayPrompts = buildGameplayPrompts();
  const storyGroups = buildStoryGroups(rootDir);

  const groups = [
    {
      id: 'gameplay',
      title: 'Frasi di gioco',
      description: 'Prompt essenziali del gameplay che possono usare voci di famiglia.',
      prompts: gameplayPrompts
    },
    ...storyGroups
  ];

  const promptMap = {};
  for (const group of groups) {
    for (const prompt of group.prompts) {
      promptMap[prompt.id] = { ...prompt };
    }
  }

  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    groups,
    promptMap
  };
}

export {
  buildPromptCatalog,
  buildGameplayPrompts,
  loadGeneratedStories
};
