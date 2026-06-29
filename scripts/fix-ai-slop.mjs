#!/usr/bin/env node
/**
 * fix-ai-slop.js — Post-processing script to catch common AI patterns.
 * Run after building: node fix-ai-slop.js src/
 * 
 * Fixes:
 * - Em-dashes (—) → commas or periods
 * - Common AI buzzwords → flagged (not auto-replaced)
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const targetDir = process.argv[2] || 'src';

// Em-dash replacement: — → comma (most cases)
function fixEmDashes(content, filePath) {
  const lines = content.split('\n');
  let count = 0;
  const fixed = lines.map((line, i) => {
    // Skip comments and strings that are OK
    if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('/*')) {
      return line;
    }
    // Replace em-dashes in visible text (string literals, JSX text)
    if (line.includes('—')) {
      count++;
      // In JSX text or string: replace with comma
      return line.replace(/ — /g, ', ').replace(/—/g, ',');
    }
    return line;
  });
  if (count > 0) {
    console.log(`  Fixed ${count} em-dash(es) in ${filePath}`);
  }
  return { content: fixed.join('\n'), count };
}

// Buzzword detection (report only, don't replace)
const BUZZWORDS = [
  'revolutionary', 'revolutionize', 'cutting-edge', 'seamless', 'seamlessly',
  'empower', 'empowering', 'unlock', 'unleashing', 'leverage', 'leveraging',
  'synergy', 'synergize', 'next-gen', 'game-changing', 'best-in-class',
  'world-class', 'robust', 'scalable', 'holistic', 'comprehensive',
  'innovative', 'innovation', 'transformative', 'elevate', 'curated'
];

function detectBuzzwords(content, filePath) {
  const found = [];
  for (const word of BUZZWORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = content.match(regex);
    if (matches) {
      found.push({ word, count: matches.length });
    }
  }
  if (found.length > 0) {
    console.log(`  ⚠️  Buzzwords in ${filePath}:`);
    for (const { word, count } of found) {
      console.log(`    - "${word}" (${count}x)`);
    }
  }
  return found;
}

// Walk directory recursively
function walkDir(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walkDir(full));
    } else if (['.tsx', '.ts', '.jsx', '.js'].includes(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

// Main
console.log(`\n🔍 Scanning ${targetDir}/ for AI slop...\n`);

const files = walkDir(targetDir);
let totalEmDashes = 0;
let totalBuzzwords = 0;

for (const file of files) {
  const content = readFileSync(file, 'utf-8');
  
  // Fix em-dashes
  const { content: fixed, count } = fixEmDashes(content, file);
  if (count > 0) {
    writeFileSync(file, fixed);
    totalEmDashes += count;
  }
  
  // Detect buzzwords
  const buzzwords = detectBuzzwords(content, file);
  totalBuzzwords += buzzwords.reduce((sum, b) => sum + b.count, 0);
}

console.log(`\n📊 Summary:`);
console.log(`  Files scanned: ${files.length}`);
console.log(`  Em-dashes fixed: ${totalEmDashes}`);
console.log(`  Buzzwords found: ${totalBuzzwords}`);

if (totalEmDashes === 0 && totalBuzzwords === 0) {
  console.log(`\n✅ Clean! No AI slop detected.\n`);
} else {
  console.log(`\n⚠️  Review the issues above.\n`);
}

process.exit(totalBuzzwords > 0 ? 1 : 0);
