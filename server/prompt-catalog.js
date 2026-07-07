import fs from 'node:fs';
import path from 'node:path';
import { CARD_TEMPLATES, getLocalizedElementName, getLocalizedTemplateName } from '../cards.js';
import { normalizeLocale, t } from '../i18n.js';

function getCardLearningLine(template, locale) {
  return `${getLocalizedElementName(template.element, locale)}.`;
}

function buildGameplayPrompts(locale) {
  const prompts = [
    {
      id: 'game.start',
      groupId: 'gameplay',
      channel: 'gameplay',
      title: t('promptCatalog.titleGameStart', {}, locale),
      script: t('game.startAdventure', {}, locale)
    },
    {
      id: 'game.mode.sequential',
      groupId: 'gameplay',
      channel: 'gameplay',
      title: t('promptCatalog.titleModeSequential', {}, locale),
      script: t('sketch.modeSequential', {}, locale)
    },
    {
      id: 'game.mode.simultaneous',
      groupId: 'gameplay',
      channel: 'gameplay',
      title: t('promptCatalog.titleModeSimultaneous', {}, locale),
      script: t('sketch.modeSimultaneous', {}, locale)
    }
  ];

  for (const template of CARD_TEMPLATES) {
    const learningLine = getCardLearningLine(template, locale);
    const localizedName = getLocalizedTemplateName(template.id, locale);
    prompts.push({
      id: `game.card.${template.id}`,
      groupId: 'gameplay',
      channel: 'gameplay',
      title: t('promptCatalog.titleCardSlot', { name: localizedName }, locale),
      script: learningLine
    });
    prompts.push({
      id: `game.card.${template.id}.remove`,
      groupId: 'gameplay',
      channel: 'gameplay',
      title: t('promptCatalog.titleCardSingle', { name: localizedName }, locale),
      script: t('sketch.cardInSingleSlot', { line: learningLine }, locale)
    });
    prompts.push({
      id: `game.enemy.${template.id}`,
      groupId: 'gameplay',
      channel: 'gameplay',
      title: t('promptCatalog.titleEnemy', { name: localizedName }, locale),
      script: localizedName
    });
  }

  return prompts;
}

function loadGeneratedStories(rootDir, locale = 'it') {
  const generatedDir = path.join(rootDir, 'stories', 'generated');
  const indexPath = path.join(generatedDir, 'index.json');
  if (!fs.existsSync(indexPath)) {
    return [];
  }

  const storyIndex = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const stories = [];

  for (const [cardId, entry] of Object.entries(storyIndex)) {
    if (cardId === '_meta') continue;
    const localizedEntry = entry.locales && entry.locales[locale]
      ? entry.locales[locale]
      : entry.locales && entry.locales.it
        ? entry.locales.it
        : entry;
    const storyPath = path.join(rootDir, localizedEntry.file);
    if (!fs.existsSync(storyPath)) continue;
    stories.push(JSON.parse(fs.readFileSync(storyPath, 'utf8')));
  }

  return stories;
}

function buildStoryGroups(rootDir, locale) {
  const stories = loadGeneratedStories(rootDir, locale);
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
      description: t('promptCatalog.storyGroupDescription', { title: story.title }, locale),
      prompts
    });
  }

  return groups;
}

function buildPromptCatalog(rootDir, options = {}) {
  const locale = normalizeLocale(options.locale);
  const gameplayPrompts = buildGameplayPrompts(locale);
  const storyGroups = buildStoryGroups(rootDir, locale);

  const groups = [
    {
      id: 'gameplay',
      title: t('promptCatalog.groupGameplayTitle', {}, locale),
      description: t('promptCatalog.groupGameplayDescription', {}, locale),
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
