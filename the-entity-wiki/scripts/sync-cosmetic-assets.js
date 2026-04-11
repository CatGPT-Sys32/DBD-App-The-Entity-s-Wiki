#!/usr/bin/env node

const path = require('path');
const {
  CONTENT_PATH,
  CHARACTER_SWAP_DIR,
  FULL_SET_DIR,
  readJson,
  writeJson,
  getImageInfo,
  downloadToFile,
  ensureDir
} = require('./cosmetics-shared');

const force = process.argv.includes('--force');

async function downloadEntry(entry) {
  const candidates = Array.isArray(entry.assetFileTitleCandidates) ? entry.assetFileTitleCandidates : [];
  for (const candidate of candidates) {
    const info = await getImageInfo(candidate);
    if (!info?.url) continue;
    const targetPath = path.join(path.resolve(__dirname, '..', 'web'), entry.image.replace(/^\.\//, ''));
    if (!force) {
      try {
        require('fs').accessSync(targetPath);
        return { status: 'skipped', entry, fileTitle: candidate };
      } catch (error) {
        // continue to download
      }
    }
    ensureDir(path.dirname(targetPath));
    await downloadToFile(info.url, targetPath);
    return { status: 'downloaded', entry, fileTitle: candidate };
  }
  return { status: 'missing', entry, fileTitle: null };
}

async function main() {
  const cosmetics = readJson(CONTENT_PATH);
  const groups = ['characterSwaps', 'fullSets'];
  const readyEntries = groups.flatMap((groupKey) =>
    (cosmetics[groupKey] || [])
      .filter((entry) => entry.status === 'ready')
      .map((entry) => ({ entry, groupKey }))
  );
  ensureDir(CHARACTER_SWAP_DIR);
  ensureDir(FULL_SET_DIR);

  const results = [];
  for (const { entry, groupKey } of readyEntries) {
    const result = await downloadEntry(entry);
    results.push({ ...result, groupKey });
  }

  const downloaded = results.filter((result) => result.status === 'downloaded').length;
  const skipped = results.filter((result) => result.status === 'skipped').length;
  const missing = results.filter((result) => result.status === 'missing');

  if (missing.length) {
    missing.forEach((result) => {
      const targetGroup = cosmetics[result.groupKey] || [];
      const manifestEntry = targetGroup.find((entry) => entry.id === result.entry.id);
      if (manifestEntry) manifestEntry.status = 'blocked_art';
      console.warn(`sync-cosmetic-assets: blocked missing asset for ${result.entry.name}`);
    });
    writeJson(CONTENT_PATH, cosmetics);
  }

  console.log(`sync-cosmetic-assets: ready=${readyEntries.length} downloaded=${downloaded} skipped=${skipped} blocked=${missing.length}`);
}

main().catch((error) => {
  console.error(`sync-cosmetic-assets: ${error.message}`);
  process.exit(1);
});
