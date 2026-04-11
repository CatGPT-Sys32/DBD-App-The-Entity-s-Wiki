#!/usr/bin/env node

const {
  DATABASE_PATH,
  DISCOVERY_PATH,
  CHARACTER_SWAP_CATEGORIES,
  OFFICIAL_FILE_OVERRIDES,
  readJson,
  writeJson,
  uniq,
  normalizeKey,
  fetchCategoryMembers,
  fetchPageImages,
  fetchWikitext,
  fetchRenderedHtml,
  extractRenderedImageTitles,
  scorePortraitImageTitle,
  buildCharacterLookup,
  stripWikiMarkup,
  slugify
} = require('./cosmetics-shared');

const IGNORED_TITLES = new Set(['Eddie']);
const COSMETIC_SETS_PAGE = 'Cosmetic_Sets';
const SET_TEMPLATE_REGEX = /===\s+\[\[File:[^\]]+\]\]\s+\[\[([^\]|]+)(?:\|[^\]]+)?\]\]\s+===\s*\{\|[\s\S]*?\{\{Template:([^}]+)\}\}[\s\S]*?\|\}/g;
const OUTFIT_ROW_REGEX = /\|- style="text-align:center"\n\| class="[^"]*" \| \[\[(File:[^\]|]*?outfit[^\]|]*?)\|100px\]\]\n!\s*([^\n]+)\n\| \[\[File:CategoryIcon outfits\.png\|50px\]\]\n\|\s*\{\{#Invoke:Utils\|clr\|[^|]+\|([^}]+)\}\}\s*\|\|\s*([^\n]+)\n\|\s*([^\n]+)\n\|/gi;

function parsePageTitle(pageTitle) {
  const parts = String(pageTitle || '').split('/');
  if (parts.length !== 2) return null;
  const [basePageTitle, cosmeticName] = parts;
  if (!basePageTitle || !cosmeticName) return null;
  return { basePageTitle, cosmeticName };
}

function resolveBaseCharacter(basePageTitle, lookup) {
  return lookup.get(normalizeKey(basePageTitle)) || null;
}

function sanitizeCandidateTitles(titles, scoreFn) {
  return uniq(
    (titles || [])
      .filter((title) => Boolean(title) && scoreFn(title) > 0)
      .sort((a, b) => scoreFn(b) - scoreFn(a) || a.localeCompare(b))
      .slice(0, 12)
  );
}

async function discoverCharacterSwaps(characterLookup) {
  const entries = [];
  const missingTemplates = [];
  const ignored = [];

  for (const category of CHARACTER_SWAP_CATEGORIES) {
    const titles = await fetchCategoryMembers(category.title);
    for (const pageTitle of titles) {
      if (IGNORED_TITLES.has(pageTitle)) {
        ignored.push(pageTitle);
        continue;
      }
      const parsed = parsePageTitle(pageTitle);
      if (!parsed) continue;
      const baseCharacter = resolveBaseCharacter(parsed.basePageTitle, characterLookup);
      const renderedHtml = OFFICIAL_FILE_OVERRIDES[pageTitle] ? '' : await fetchRenderedHtml(pageTitle);
      const imageCandidates = OFFICIAL_FILE_OVERRIDES[pageTitle] || uniq([
        ...(await fetchPageImages(pageTitle)),
        ...extractRenderedImageTitles(renderedHtml)
      ]);
      entries.push({
        kind: 'characterSwap',
        groupKey: category.key,
        groupLabel: category.label,
        pageTitle,
        name: parsed.cosmeticName.trim(),
        basePageTitle: parsed.basePageTitle.trim(),
        baseCharacterId: baseCharacter?.id || '',
        baseCharacterName: baseCharacter?.name || '',
        baseCharacterType: baseCharacter?.type || '',
        assetFileTitleCandidates: sanitizeCandidateTitles(imageCandidates, scorePortraitImageTitle),
        sourceKind: 'wiki-category',
        sourcePage: pageTitle,
        slugHint: slugify(parsed.cosmeticName),
        statusHint: !baseCharacter ? 'blocked_mapping' : (imageCandidates.length > 0 ? 'ready' : 'blocked_art')
      });
    }
  }

  entries.sort((a, b) =>
    a.baseCharacterType.localeCompare(b.baseCharacterType) ||
    a.baseCharacterName.localeCompare(b.baseCharacterName) ||
    a.groupLabel.localeCompare(b.groupLabel) ||
    a.name.localeCompare(b.name)
  );

  return { entries, ignored: uniq(ignored).sort() };
}

function parseCharacterSetTemplates(pageWikitext) {
  return [...pageWikitext.matchAll(SET_TEMPLATE_REGEX)].map((match) => ({
    basePageTitle: stripWikiMarkup(match[1]),
    templateName: String(match[2] || '').trim()
  }));
}

function parseTemplateSetRows(templateWikitext) {
  return [...templateWikitext.matchAll(OUTFIT_ROW_REGEX)].map((match) => ({
    assetFileTitle: match[1].trim(),
    name: stripWikiMarkup(match[2]),
    rarity: stripWikiMarkup(match[3]),
    description: stripWikiMarkup(match[4]),
    collectionName: stripWikiMarkup(match[5])
  }));
}

async function discoverFullSets(characterLookup) {
  const overviewWikitext = await fetchWikitext(COSMETIC_SETS_PAGE);
  const templates = parseCharacterSetTemplates(overviewWikitext);
  const entries = [];
  const missingTemplates = [];

  for (const template of templates) {
    const baseCharacter = resolveBaseCharacter(template.basePageTitle, characterLookup);
    const templateTitle = `Template:${template.templateName}`;
    let templateWikitext = "";
    try {
      templateWikitext = await fetchWikitext(templateTitle);
    } catch (error) {
      if (/missingtitle/.test(error.message)) {
        missingTemplates.push(templateTitle);
        continue;
      }
      throw error;
    }
    const rows = parseTemplateSetRows(templateWikitext);

    rows.forEach((row) => {
      entries.push({
        kind: 'fullSet',
        groupKey: 'fullSet',
        groupLabel: 'Full Sets',
        pageTitle: templateTitle,
        templateName: template.templateName,
        name: row.name,
        rarity: row.rarity,
        description: row.description,
        collectionName: row.collectionName,
        basePageTitle: template.basePageTitle,
        baseCharacterId: baseCharacter?.id || '',
        baseCharacterName: baseCharacter?.name || '',
        baseCharacterType: baseCharacter?.type || '',
        assetFileTitleCandidates: sanitizeCandidateTitles([row.assetFileTitle], (title) => title.toLowerCase().includes('outfit') ? 100 : 0),
        sourceKind: 'wiki-template',
        sourcePage: `${COSMETIC_SETS_PAGE}#${template.basePageTitle.replace(/\s+/g, '_')}`,
        slugHint: `${slugify(template.basePageTitle)}--${slugify(row.name)}`,
        statusHint: !baseCharacter ? 'blocked_mapping' : (row.assetFileTitle ? 'ready' : 'blocked_art')
      });
    });
  }

  entries.sort((a, b) =>
    a.baseCharacterType.localeCompare(b.baseCharacterType) ||
    a.baseCharacterName.localeCompare(b.baseCharacterName) ||
    (a.collectionName || '').localeCompare(b.collectionName || '') ||
    a.name.localeCompare(b.name)
  );

  return { entries, templatesCount: templates.length, missingTemplates };
}

async function main() {
  const database = readJson(DATABASE_PATH);
  const characterLookup = buildCharacterLookup(database);
  const characterSwap = await discoverCharacterSwaps(characterLookup);
  const fullSets = await discoverFullSets(characterLookup);

  const discovery = {
    generatedAt: new Date().toISOString(),
    sources: {
      characterSwapCategories: CHARACTER_SWAP_CATEGORIES.map((category) => ({ key: category.key, title: category.title })),
      fullSetsPage: COSMETIC_SETS_PAGE,
      fullSetTemplateCount: fullSets.templatesCount,
      missingFullSetTemplates: fullSets.missingTemplates.length
    },
    stats: {
      characterSwapCandidates: characterSwap.entries.length,
      fullSetCandidates: fullSets.entries.length,
      ignoredTitles: characterSwap.ignored.length
    },
    ignoredTitles: characterSwap.ignored,
    missingTemplates: fullSets.missingTemplates,
    characterSwaps: characterSwap.entries,
    fullSets: fullSets.entries
  };

  writeJson(DISCOVERY_PATH, discovery);
  console.log(`discover-cosmetics: wrote ${DISCOVERY_PATH}`);
  console.log(`discover-cosmetics: characterSwaps=${characterSwap.entries.length} fullSets=${fullSets.entries.length}`);
}

main().catch((error) => {
  console.error(`discover-cosmetics: ${error.message}`);
  process.exit(1);
});
