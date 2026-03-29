#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { validateNormalizedDatabase } = require('./normalize-images');

const ROOT = path.resolve(__dirname, '..');
const WEB_ROOT = path.join(ROOT, 'web');
const INDEX_PATH = path.join(WEB_ROOT, 'index.html');
const DATA_PATH = path.join(WEB_ROOT, 'data.js');
const CAPACITOR_CONFIG_PATH = path.join(ROOT, 'capacitor.config.json');

const issues = [];
const warnings = [];

function fail(message) {
  issues.push(message);
}

function warn(message) {
  warnings.push(message);
}

function fileExists(relPathFromRoot) {
  return fs.existsSync(path.join(ROOT, relPathFromRoot));
}

function parseDatabase() {
  const code = fs.readFileSync(DATA_PATH, 'utf8');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${code}\nthis.DATABASE = DATABASE;`, sandbox);
  return sandbox.DATABASE;
}

function auditHtml(indexHtml) {
  const externalTagPatterns = [
    { pattern: /<script\b[^>]*\bsrc=["']https?:\/\//i, message: 'External <script> src found in web/index.html.' },
    { pattern: /<link\b[^>]*\bhref=["']https?:\/\//i, message: 'External <link> href found in web/index.html.' },
    { pattern: /<img\b[^>]*\bsrc=["']https?:\/\//i, message: 'External <img> src found in web/index.html.' },
    { pattern: /url\(["']?https?:\/\//i, message: 'External CSS url(...) found in web/index.html.' },
  ];
  externalTagPatterns.forEach(({ pattern, message }) => {
    if (pattern.test(indexHtml)) fail(message);
  });

  const forbiddenRuntimePatterns = [
    { pattern: /fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com|cdn\.tailwindcss\.com/i, message: 'Remote CDN or font host reference still present in web/index.html.' },
    { pattern: /const\s+CDN_BASE\s*=/, message: 'CDN_BASE fallback is still defined in web/index.html.' },
    { pattern: /\bcdnUrl\s*=/, message: 'A CDN image fallback is still defined in web/index.html.' },
    { pattern: /const\s+IMAGE_ALIASES\s*=/, message: 'Legacy IMAGE_ALIASES resolver logic is still present in web/index.html.' },
    { pattern: /const\s+buildPerkCandidates\s*=/, message: 'Legacy buildPerkCandidates resolver logic is still present in web/index.html.' },
    { pattern: /const\s+buildMapCandidates\s*=/, message: 'Legacy buildMapCandidates resolver logic is still present in web/index.html.' },
    { pattern: /url\.startsWith\((['"])http\1\)/, message: 'AssetFrame still accepts raw http image URLs at runtime.' },
    { pattern: /\bfetch\s*\(/, message: 'fetch() is present in web/index.html.' },
    { pattern: /\bXMLHttpRequest\b/, message: 'XMLHttpRequest is present in web/index.html.' },
    { pattern: /\baxios\b/, message: 'axios is present in web/index.html.' },
    { pattern: /\bCapacitorHttp\b/, message: 'CapacitorHttp is present in web/index.html.' },
    { pattern: /serviceWorker\.register\s*\(/, message: 'service worker registration is present in web/index.html.' },
  ];
  forbiddenRuntimePatterns.forEach(({ pattern, message }) => {
    if (pattern.test(indexHtml)) fail(message);
  });
}

function auditCapacitorConfig() {
  const config = JSON.parse(fs.readFileSync(CAPACITOR_CONFIG_PATH, 'utf8'));
  if (config.webDir !== 'web') {
    fail(`capacitor.config.json should point to "web", found "${config.webDir}".`);
  }
  if (config.server && config.server.url) {
    fail('capacitor.config.json has server.url configured, which breaks the offline bundle contract.');
  }
}

function auditRequiredFiles(indexHtml) {
  const requiredFiles = [
    'web/vendor/react.production.min.js',
    'web/vendor/react-dom.production.min.js',
    'web/vendor/babel.min.js',
    'web/vendor/tailwindcss.min.js',
    'web/assets/default-killer.png',
    'web/assets/default-survivor.png',
    'web/assets/default-perk.svg',
    'web/assets/default-map.svg',
  ];

  requiredFiles.forEach((relPath) => {
    if (!fileExists(relPath)) fail(`Missing required offline runtime file: ${relPath}`);
  });

  const gameIconMatches = [...indexHtml.matchAll(/icon:\s*["'](\.\/dbd_images\/game_icons\/[^"']+)["']/g)];
  const gameIcons = new Set(gameIconMatches.map((match) => match[1].replace(/^\.\//, 'web/')));
  gameIcons.forEach((relPath) => {
    if (!fileExists(relPath)) fail(`Missing game icon asset referenced in web/index.html: ${relPath}`);
  });

  const layoutMatches = [...indexHtml.matchAll(/path:\s*["']([^"']+)["']/g)];
  const mapLayouts = new Set(layoutMatches.map((match) => path.posix.join('web/dbd_images', match[1])));
  mapLayouts.forEach((relPath) => {
    if (!fileExists(relPath)) warn(`Missing map layout asset referenced in web/index.html: ${relPath}`);
  });
}

function auditDatabaseImages(db) {
  const issuesFromDatabase = validateNormalizedDatabase(db, { webRoot: WEB_ROOT });
  issuesFromDatabase.forEach((message) => fail(`Generated DATABASE image issue: ${message}`));
}

function main() {
  const indexHtml = fs.readFileSync(INDEX_PATH, 'utf8');
  auditHtml(indexHtml);
  auditCapacitorConfig();
  auditRequiredFiles(indexHtml);
  auditDatabaseImages(parseDatabase());

  if (warnings.length) {
    console.log('Warnings:');
    warnings.forEach((message) => console.log(`- ${message}`));
  }

  if (issues.length) {
    console.error('Offline runtime verification failed:');
    issues.forEach((message) => console.error(`- ${message}`));
    process.exit(1);
  }

  console.log('Offline runtime verification passed.');
}

main();
