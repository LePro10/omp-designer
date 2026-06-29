#!/usr/bin/env node
/**
 * analyze-layout.js — Analyze page layout structure from HTML/CSS.
 * Run: node analyze-layout.js <project-dir>
 * 
 * Reports:
 * - Section count and layout families
 * - Color usage (are all palette colors used?)
 * - Typography scale (are sizes consistent?)
 * - Spacing patterns (is 4px grid used?)
 * - Component variety (are sections different?)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const projectDir = process.argv[2] || '.';

// Walk directory recursively
function walkDir(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory() && !['node_modules', 'dist', '.git'].includes(entry)) {
      files.push(...walkDir(full));
    } else if (['.tsx', '.ts', '.css'].includes(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

// Extract colors from CSS/Tailwind classes
function extractColors(content) {
  const colors = new Set();
  // Hex colors
  const hexMatches = content.match(/#[0-9a-fA-F]{6}/g);
  if (hexMatches) hexMatches.forEach(c => colors.add(c.toLowerCase()));
  // CSS variables
  const varMatches = content.match(/var\(--color-(\w+)\)/g);
  if (varMatches) varMatches.forEach(v => colors.add(v));
  return colors;
}

// Extract font sizes
function extractFontSizes(content) {
  const sizes = new Set();
  const matches = content.match(/text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)/g);
  if (matches) matches.forEach(s => sizes.add(s));
  return sizes;
}

// Extract spacing values
function extractSpacing(content) {
  const spacing = new Set();
  const matches = content.match(/\b(p|m|gap|space)-(0|1|2|3|4|5|6|8|10|12|16|20|24|32|48|64|96|128)\b/g);
  if (matches) matches.forEach(s => spacing.add(s));
  return spacing;
}

// Analyze sections
function analyzeSections(files) {
  const sections = [];
  for (const file of files) {
    if (!file.endsWith('.tsx')) continue;
    const content = readFileSync(file, 'utf-8');
    const name = file.split('/').pop().replace('.tsx', '');
    
    // Detect layout type
    let layout = 'unknown';
    if (content.includes('sticky') && content.includes('h-[300vh]')) layout = 'pinned-scroll';
    else if (content.includes('grid-cols') && content.includes('col-span')) layout = 'bento-grid';
    else if (content.includes('grid-cols-3')) layout = '3-column';
    else if (content.includes('grid-cols-2')) layout = '2-column';
    else if (content.includes('flex-row') && content.includes('w-1/2')) layout = 'split-50/50';
    else if (content.includes('flex-row') && content.includes('w-3/5')) layout = 'split-60/40';
    else if (content.includes('text-center') && content.includes('max-w-3xl')) layout = 'centered';
    else if (content.includes('overflow-x-auto') || content.includes('overflow-x-scroll')) layout = 'horizontal-scroll';
    else if (content.includes('grid-cols-4')) layout = '4-column';
    else if (content.includes('grid-cols-1')) layout = 'single-column';
    
    // Detect animations
    const hasScrollAnimation = content.includes('whileInView') || content.includes('useScroll');
    const hasHover = content.includes('whileHover');
    const hasStagger = content.includes('stagger');
    
    sections.push({ name, layout, hasScrollAnimation, hasHover, hasStagger });
  }
  return sections;
}

// Main
console.log(`\n📐 Analyzing layout in ${projectDir}/\n`);

const files = walkDir(projectDir);
const allColors = new Set();
const allFontSizes = new Set();
const allSpacing = new Set();

for (const file of files) {
  const content = readFileSync(file, 'utf-8');
  extractColors(content).forEach(c => allColors.add(c));
  extractFontSizes(content).forEach(s => allFontSizes.add(s));
  extractSpacing(content).forEach(s => allSpacing.add(s));
}

const sections = analyzeSections(files);

// Report
console.log('📊 SECTIONS:');
const layoutCounts = {};
for (const s of sections) {
  layoutCounts[s.layout] = (layoutCounts[s.layout] || 0) + 1;
  console.log(`  ${s.name}: ${s.layout} ${s.hasScrollAnimation ? '📜' : ''} ${s.hasHover ? '🖱️' : ''} ${s.hasStagger ? '⏳' : ''}`);
}

console.log('\n🎨 LAYOUT VARIETY:');
const uniqueLayouts = Object.keys(layoutCounts).filter(l => l !== 'unknown');
console.log(`  Unique layouts: ${uniqueLayouts.length}`);
for (const [layout, count] of Object.entries(layoutCounts)) {
  console.log(`    ${layout}: ${count}`);
}
if (uniqueLayouts.length < 4) {
  console.log('  ⚠️  Less than 4 unique layouts — sections may look too similar');
}

console.log('\n🔤 FONT SIZES:');
console.log(`  Used: ${[...allFontSizes].sort().join(', ')}`);
if (allFontSizes.size < 4) {
  console.log('  ⚠️  Less than 4 font sizes — hierarchy may be flat');
}

console.log('\n📏 SPACING:');
console.log(`  Used: ${[...allSpacing].sort().join(', ')}`);

console.log('\n🎨 COLORS:');
console.log(`  Count: ${allColors.size}`);
if (allColors.size > 10) {
  console.log('  ⚠️  More than 10 colors — may be inconsistent');
}

console.log('\n');
