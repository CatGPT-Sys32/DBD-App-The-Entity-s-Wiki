#!/usr/bin/env node

const {
  CONTENT_PATH,
  DATABASE_PATH,
  DISCOVERY_PATH,
  readJson,
  writeJson,
  buildAliases,
  slugify,
  buildCharacterLookup
} = require('./cosmetics-shared');

function mapCharacterSwap(entry, characterLookup) {
  const baseCharacter = entry.baseCharacterId
    ? characterLookup.get((entry.baseCharacterName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim())
    : null;
  const resolvedBase = baseCharacter || (entry.baseCharacterId ? { id: entry.baseCharacterId, name: entry.baseCharacterName, type: entry.baseCharacterType } : null);
  const id = slugify(entry.name);
  const isPortraitException = entry.assetFileTitleCandidates?.[0] && !/(Head|Mask|Hair)/i.test(entry.assetFileTitleCandidates[0]);
  const status = !resolvedBase ? 'blocked_mapping' : (entry.assetFileTitleCandidates?.length ? 'ready' : 'blocked_art');
  return {
    id,
    name: entry.name,
    baseCharacterId: resolvedBase?.id || '',
    baseCharacterName: resolvedBase?.name || entry.baseCharacterName || '',
    baseCharacterType: resolvedBase?.type || entry.baseCharacterType || '',
    groupKey: entry.groupKey,
    groupLabel: entry.groupLabel,
    collectionName: entry.groupLabel,
    image: `./dbd_images/cosmetics/character_swaps/${id}.png`,
    aliases: buildAliases(entry.name),
    sourceKind: entry.sourceKind,
    sourcePage: entry.sourcePage,
    assetProvenance: isPortraitException ? 'official-portrait-exception' : 'official-headshot',
    status,
    rarity: entry.groupLabel,
    assetFileTitleCandidates: entry.assetFileTitleCandidates || [],
    description: `Character-swap cosmetic for ${resolvedBase?.name || entry.baseCharacterName || 'Unknown character'}`
  };
}

function mapFullSet(entry, characterLookup) {
  const baseCharacter = entry.baseCharacterId
    ? characterLookup.get((entry.baseCharacterName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim())
    : null;
  const resolvedBase = baseCharacter || (entry.baseCharacterId ? { id: entry.baseCharacterId, name: entry.baseCharacterName, type: entry.baseCharacterType } : null);
  const id = `${slugify(entry.baseCharacterName || entry.basePageTitle || 'unknown')}--${slugify(entry.name)}`;
  const status = !resolvedBase ? 'blocked_mapping' : (entry.assetFileTitleCandidates?.length ? 'ready' : 'blocked_art');
  return {
    id,
    name: entry.name,
    baseCharacterId: resolvedBase?.id || '',
    baseCharacterName: resolvedBase?.name || entry.baseCharacterName || '',
    baseCharacterType: resolvedBase?.type || entry.baseCharacterType || '',
    groupKey: 'fullSet',
    groupLabel: 'Full Sets',
    collectionName: entry.collectionName || '',
    image: `./dbd_images/cosmetics/full_sets/${id}.png`,
    aliases: buildAliases(entry.name, [entry.collectionName, entry.baseCharacterName]),
    sourceKind: entry.sourceKind,
    sourcePage: entry.sourcePage,
    assetProvenance: 'official-outfit-icon',
    status,
    rarity: entry.rarity || '',
    assetFileTitleCandidates: entry.assetFileTitleCandidates || [],
    description: entry.description || ''
  };
}

function sortEntries(entries) {
  return [...entries].sort((a, b) =>
    a.baseCharacterType.localeCompare(b.baseCharacterType) ||
    a.baseCharacterName.localeCompare(b.baseCharacterName) ||
    a.groupLabel.localeCompare(b.groupLabel) ||
    (a.collectionName || '').localeCompare(b.collectionName || '') ||
    a.name.localeCompare(b.name)
  );
}

function main() {
  const database = readJson(DATABASE_PATH);
  const discovery = readJson(DISCOVERY_PATH);
  const characterLookup = buildCharacterLookup(database);

  const characterSwaps = sortEntries((discovery.characterSwaps || []).map((entry) => mapCharacterSwap(entry, characterLookup)));
  const fullSets = sortEntries((discovery.fullSets || []).map((entry) => mapFullSet(entry, characterLookup)));

  const cosmetics = {
    generatedAt: new Date().toISOString(),
    metadata: {
      sourceDiscoveryGeneratedAt: discovery.generatedAt || null,
      characterSwapCount: characterSwaps.length,
      fullSetCount: fullSets.length
    },
    characterSwaps,
    fullSets
  };

  writeJson(CONTENT_PATH, cosmetics);
  console.log(`normalize-cosmetics: wrote ${CONTENT_PATH}`);
  console.log(`normalize-cosmetics: characterSwaps=${characterSwaps.length} fullSets=${fullSets.length}`);
}

main();
