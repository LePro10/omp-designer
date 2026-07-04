#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { analyzeScreenshot, decodePng, measureBlankRegions } from "../../shared/screenshot-analysis.mjs";

// Minimal PNG encoder (8-bit RGB, filter 0) so tests need no fixtures on disk.
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length, 0);
  header.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([header.subarray(4), data])), 0);
  return Buffer.concat([header, data, crc]);
}

/** rowFn(y) returns a [r, g, b] producer per x: (x) => [r,g,b]. */
function encodePng(width, height, rowFn) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const raw = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y += 1) {
    const pixel = rowFn(y);
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0; // filter none
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixel(x);
      raw[rowStart + 1 + x * 3] = r;
      raw[rowStart + 2 + x * 3] = g;
      raw[rowStart + 3 + x * 3] = b;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const cases = [];
function test(name, fn) {
  cases.push({ name, fn });
}

test("decodePng round-trips dimensions and pixels", () => {
  const png = encodePng(10, 4, () => (x) => [x * 20, 100, 200]);
  const decoded = decodePng(png);
  assert.equal(decoded.width, 10);
  assert.equal(decoded.height, 4);
  assert.equal(decoded.channels, 3);
  assert.equal(decoded.pixels[0], 0);
  assert.equal(decoded.pixels[3], 20);
});

test("solid image is fully blank", () => {
  const png = encodePng(100, 300, () => () => [12, 10, 15]);
  const metrics = measureBlankRegions(decodePng(png));
  assert.equal(metrics.blankRowFraction, 1);
  assert.equal(metrics.maxBlankRunFraction, 1);
});

test("contentful rows break blank runs", () => {
  // Top third: content (horizontal variation). Bottom two thirds: void.
  const png = encodePng(100, 300, (y) =>
    y < 100 ? (x) => [(x * 37) % 255, (x * 11) % 255, 40] : () => [8, 8, 10]);
  const metrics = measureBlankRegions(decodePng(png));
  assert.ok(metrics.maxBlankRunFraction > 0.6, JSON.stringify(metrics));
  assert.ok(metrics.maxBlankRunFraction < 0.72, JSON.stringify(metrics));
});

test("analyzeScreenshot flags tall captures as full-page and survives bad files", () => {
  const dir = mkdtempSync(join(tmpdir(), "designer-shot-"));
  try {
    const tall = join(dir, "tall.png");
    writeFileSync(tall, encodePng(50, 200, () => () => [0, 0, 0]));
    const result = analyzeScreenshot(tall);
    assert.equal(result.fullPage, true);
    assert.equal(result.blankRowFraction, 1);

    const bogus = join(dir, "bogus.png");
    writeFileSync(bogus, Buffer.from("not a png"));
    assert.ok(analyzeScreenshot(bogus).error);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

let failed = 0;
for (const { name, fn } of cases) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error.stack || error.message);
  }
}

if (failed > 0) process.exit(1);
console.log(`\n${cases.length} screenshot-analysis tests passed`);
