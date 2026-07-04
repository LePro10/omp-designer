/**
 * Screenshot content analysis.
 *
 * Decodes PNG screenshots (8-bit, RGB/RGBA/grayscale, non-interlaced — the
 * formats browsers emit) without dependencies and measures how much of the
 * image is contentless: rows whose sampled pixels are nearly uniform.
 *
 * A full-page capture of a healthy page has text, imagery, and section
 * boundaries breaking up uniform rows. A page whose sections start at
 * opacity 0 (scroll-reveal) or whose hero is pure wallpaper produces long
 * contiguous runs of uniform rows. `maxBlankRunFraction` is therefore the
 * honest signal for "this screenshot shows nothing".
 */
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CHANNELS_BY_COLOR_TYPE = { 0: 1, 2: 3, 4: 2, 6: 4 };

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * Decode a PNG buffer. Returns { width, height, channels, pixels } where
 * pixels is unfiltered raw scanline data (width * channels bytes per row).
 * Throws on unsupported formats (interlaced, palette, 16-bit).
 */
export function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("not a PNG file");
  let offset = 8;
  let header = null;
  const idat = [];
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  if (!header) throw new Error("missing IHDR");
  if (header.bitDepth !== 8) throw new Error(`unsupported bit depth ${header.bitDepth}`);
  if (header.interlace !== 0) throw new Error("interlaced PNG is unsupported");
  const channels = CHANNELS_BY_COLOR_TYPE[header.colorType];
  if (!channels) throw new Error(`unsupported color type ${header.colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = header.width * channels;
  const pixels = Buffer.allocUnsafe(stride * header.height);
  for (let y = 0; y < header.height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const lineStart = y * (stride + 1) + 1;
    const outStart = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[lineStart + x];
      const left = x >= channels ? pixels[outStart + x - channels] : 0;
      const up = y > 0 ? pixels[outStart + x - stride] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[outStart + x - stride - channels] : 0;
      let decoded;
      switch (filter) {
        case 0: decoded = value; break;
        case 1: decoded = value + left; break;
        case 2: decoded = value + up; break;
        case 3: decoded = value + ((left + up) >> 1); break;
        case 4: decoded = value + paeth(left, up, upLeft); break;
        default: throw new Error(`unsupported filter ${filter}`);
      }
      pixels[outStart + x] = decoded & 0xff;
    }
  }
  return { width: header.width, height: header.height, channels, pixels };
}

/**
 * Measure contentless regions of a decoded PNG.
 *
 * A row is "blank" when up to 64 sampled pixels vary by no more than
 * `tolerance` per channel — solid fills and horizontally-uniform wallpaper
 * both count, deliberately: neither shows content.
 *
 * Returns { width, height, rowsSampled, blankRowFraction, maxBlankRunFraction }.
 */
export function measureBlankRegions({ width, height, channels, pixels }, { tolerance = 6, maxRows = 4000 } = {}) {
  const rowStep = Math.max(1, Math.floor(height / maxRows));
  const colStep = Math.max(1, Math.floor(width / 64));
  const stride = width * channels;
  const colorChannels = Math.min(channels, 3); // ignore alpha
  let rowsSampled = 0;
  let blankRows = 0;
  let run = 0;
  let maxRun = 0;
  for (let y = 0; y < height; y += rowStep) {
    rowsSampled += 1;
    const rowStart = y * stride;
    let blank = true;
    const min = [255, 255, 255];
    const max = [0, 0, 0];
    for (let x = 0; x < width; x += colStep) {
      const pixelStart = rowStart + x * channels;
      for (let c = 0; c < colorChannels; c += 1) {
        const value = pixels[pixelStart + c];
        if (value < min[c]) min[c] = value;
        if (value > max[c]) max[c] = value;
      }
      if (max.some((value, c) => value - min[c] > tolerance)) {
        blank = false;
        break;
      }
    }
    if (blank) {
      blankRows += 1;
      run += 1;
      if (run > maxRun) maxRun = run;
    } else {
      run = 0;
    }
  }
  return {
    width,
    height,
    rowsSampled,
    blankRowFraction: rowsSampled ? blankRows / rowsSampled : 0,
    maxBlankRunFraction: rowsSampled ? maxRun / rowsSampled : 0,
  };
}

/**
 * Analyze a screenshot file. Returns metrics plus `fullPage` (heuristic:
 * height at least twice the width). Returns { error } instead of throwing
 * so unreadable or exotic files degrade to "not analyzable".
 */
export function analyzeScreenshot(path) {
  try {
    const decoded = decodePng(readFileSync(path));
    const metrics = measureBlankRegions(decoded);
    return { path, fullPage: decoded.height >= decoded.width * 2, ...metrics };
  } catch (error) {
    return { path, error: error instanceof Error ? error.message : String(error) };
  }
}
