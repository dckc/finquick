#!/usr/bin/env node
// Queries the npm registry to resolve current dev dist-tags for @agoric/* packages.
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.git', '.hg', '.yarn', '.vscode']);

function listPackageJsonFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...listPackageJsonFiles(path.join(dir, entry.name)));
    } else if (entry.isFile() && entry.name === 'package.json') {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function getDevTag(pkg) {
  const raw = execSync(`npm view ${pkg} dist-tags --json`, { stdio: ['ignore', 'pipe', 'pipe'] })
    .toString()
    .trim();
  const tags = raw ? JSON.parse(raw) : {};
  return tags.dev || null;
}

const packageFiles = listPackageJsonFiles(ROOT);
const devTagCache = new Map();
const updated = [];
const skipped = new Set();

for (const file of packageFiles) {
  const data = readJson(file);
  let changed = false;

  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const deps = data[field];
    if (!deps) continue;
    for (const name of Object.keys(deps)) {
      if (!name.startsWith('@agoric/')) continue;
      if (!devTagCache.has(name)) {
        const devTag = getDevTag(name);
        devTagCache.set(name, devTag);
      }
      const devTag = devTagCache.get(name);
      if (!devTag) {
        skipped.add(name);
        continue;
      }
      if (deps[name] !== devTag) {
        deps[name] = devTag;
        changed = true;
      }
    }
  }

  if (changed) {
    writeJson(file, data);
    updated.push(file);
  }
}

console.log('Updated package.json files:');
if (updated.length === 0) {
  console.log('  (none)');
} else {
  for (const file of updated) {
    console.log(`  ${path.relative(ROOT, file)}`);
  }
}

if (devTagCache.size > 0) {
  console.log('Agoric dev tags used:');
  for (const [name, tag] of devTagCache.entries()) {
    console.log(`  ${name}: ${tag || '(no dev tag)'}`);
  }
}

if (skipped.size > 0) {
  console.log('Skipped (no dev tag):');
  for (const name of skipped) console.log(`  ${name}`);
}
