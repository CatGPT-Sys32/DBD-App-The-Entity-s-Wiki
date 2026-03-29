#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_ROOT = path.join(ROOT, 'content');
const WEB_ROOT = path.join(ROOT, 'web');

const DATABASE_PATH = path.join(CONTENT_ROOT, 'database.json');
const TIMELINE_PATH = path.join(CONTENT_ROOT, 'timeline.json');
const WEB_DATABASE_PATH = path.join(WEB_ROOT, 'data.js');
const WEB_TIMELINE_PATH = path.join(WEB_ROOT, 'lore.js');

const DATABASE_KEYS = [
  'killers',
  'survivors',
  'perks',
  'maps',
  'realms',
  'items',
  'offerings',
  'addons'
];

const args = new Set(process.argv.slice(2));
const checkMode = args.has('--check');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fail(message) {
  console.error(`build-data: ${message}`);
  process.exit(1);
}

function ensureObject(value, label) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    fail(`${label} must be a JSON object.`);
  }
}

function validateDatabase(database) {
  ensureObject(database, 'content/database.json');

  const keys = Object.keys(database);
  const missing = DATABASE_KEYS.filter((key) => !(key in database));
  const extra = keys.filter((key) => !DATABASE_KEYS.includes(key));

  if (missing.length) {
    fail(`content/database.json is missing required keys: ${missing.join(', ')}`);
  }

  if (extra.length) {
    fail(`content/database.json has unexpected keys: ${extra.join(', ')}`);
  }

  for (const key of DATABASE_KEYS) {
    if (!Array.isArray(database[key])) {
      fail(`content/database.json key "${key}" must be an array.`);
    }
  }
}

function validateTimeline(timeline) {
  ensureObject(timeline, 'content/timeline.json');

  const keys = Object.keys(timeline);
  if (!keys.includes('releases')) {
    fail('content/timeline.json is missing required key: releases');
  }

  const extra = keys.filter((key) => key !== 'releases');
  if (extra.length) {
    fail(`content/timeline.json has unexpected keys: ${extra.join(', ')}`);
  }

  if (!Array.isArray(timeline.releases)) {
    fail('content/timeline.json key "releases" must be an array.');
  }
}

function toJson(value) {
  return JSON.stringify(value, null, 2);
}

function generateDatabaseModule(database) {
  return [
    `var DATABASE = ${toJson(database)};`,
    '',
    "if (typeof module !== 'undefined' && module.exports) {",
    '  module.exports = DATABASE;',
    '}',
    ''
  ].join('\n');
}

function generateTimelineModule(timeline) {
  return [
    '// Dead by Daylight Lore Timeline Data',
    '// Complete chapter history with release dates, characters, maps, and lore summaries',
    '// Data compiled from official DBD Wiki and sources',
    '',
    'var TIMELINE_DATA = {',
    `  releases: ${toJson(timeline.releases).replace(/\n/g, '\n  ')},`,
    '',
    '  getReleaseById: function (id) {',
    '    return this.releases.find(r => r.id === id);',
    '  },',
    '',
    '  getAllKillers: function () {',
    '    return this.releases.flatMap(r => r.killers);',
    '  },',
    '',
    '  getAllSurvivors: function () {',
    '    return this.releases.flatMap(r => r.survivors);',
    '  },',
    '',
    '  getChronological: function () {',
    '    return [...this.releases].sort((a, b) => new Date(a.date) - new Date(b.date));',
    '  }',
    '};',
    '',
    "if (typeof module !== 'undefined' && module.exports) {",
    '  module.exports = TIMELINE_DATA;',
    '}',
    ''
  ].join('\n');
}

function compareOutput(filePath, nextContent) {
  const currentContent = fs.readFileSync(filePath, 'utf8');
  return currentContent === nextContent;
}

function writeOutput(filePath, content) {
  fs.writeFileSync(filePath, content);
  console.log(`build-data: wrote ${path.relative(ROOT, filePath)}`);
}

function main() {
  const database = readJson(DATABASE_PATH);
  const timeline = readJson(TIMELINE_PATH);

  validateDatabase(database);
  validateTimeline(timeline);

  const nextDatabaseModule = generateDatabaseModule(database);
  const nextTimelineModule = generateTimelineModule(timeline);

  if (checkMode) {
    const staleFiles = [];
    if (!compareOutput(WEB_DATABASE_PATH, nextDatabaseModule)) staleFiles.push('web/data.js');
    if (!compareOutput(WEB_TIMELINE_PATH, nextTimelineModule)) staleFiles.push('web/lore.js');

    if (staleFiles.length) {
      console.error(`build-data: generated output is stale: ${staleFiles.join(', ')}`);
      process.exit(1);
    }

    console.log('build-data: generated runtime data is up to date.');
    return;
  }

  writeOutput(WEB_DATABASE_PATH, nextDatabaseModule);
  writeOutput(WEB_TIMELINE_PATH, nextTimelineModule);
}

main();
