/**
 * optimize-images.mjs — Re-encode the portfolio images as WebP
 *
 * Why: the 8 ball images must ALL finish downloading before p5's setup() fires
 * load:complete and the loading screen hides, so their combined weight sets the
 * floor on portfolio_loaded.load_time_ms. As full-size JPEG/PNG they were
 * ~1.31 MB; as capped WebP they are a fraction of that.
 *
 * Sizing: the largest on-screen consumer is the detail modal's hero image,
 * capped by CSS at min(55vh, 450px) tall. MAX_EDGE covers that at 2x DPR.
 * Balls themselves render at viewport/6 (~170-320 CSS px), so they have plenty
 * of headroom. Images already smaller than MAX_EDGE are never upscaled.
 *
 * Usage:  npm run images            # write .webp next to the sources
 *         npm run images -- --dry   # report what would change, write nothing
 *
 * Run this after adding a new ball image (see src/data/projects.js) and commit
 * the generated .webp alongside it.
 */

import sharp from 'sharp';
import { readdir, stat, unlink } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

const DIR      = 'public/assets/images';
const MAX_EDGE = 900;   // long edge, in px
const QUALITY  = 80;

// favicon.png is referenced as-is by every HTML entry; handled separately below.
const ICON_MAX = 180;   // apple-touch-icon wants 180x180

// Nothing references this file — leaving it untouched rather than quietly
// converting and deleting an orphan. Delete it by hand if it really is dead.
const SKIP = new Set(['TWYD Logo v1.0.0.png']);

const dry = process.argv.includes('--dry');
const kb  = (n) => (n / 1024).toFixed(1).padStart(7) + ' KB';

const files = (await readdir(DIR)).filter((f) => /\.(jpe?g|png)$/i.test(f) && !SKIP.has(f));
let before = 0;
let after  = 0;

for (const file of files.sort()) {
  const src = join(DIR, file);
  const isIcon = /^favicon\.png$/i.test(file);
  const srcBytes = (await stat(src)).size;
  before += srcBytes;

  const meta = await sharp(src).metadata();
  const cap  = isIcon ? ICON_MAX : MAX_EDGE;
  const longEdge = Math.max(meta.width, meta.height);

  const pipeline = sharp(src).rotate();           // honour EXIF orientation
  if (longEdge > cap) {
    pipeline.resize({ width: cap, height: cap, fit: 'inside', withoutEnlargement: true });
  }

  // The favicon stays a PNG so the <link rel="shortcut icon"> in all five HTML
  // entries keeps working without touching them; everything else becomes WebP.
  const out = isIcon ? src : join(DIR, basename(file, extname(file)) + '.webp');
  const buf = isIcon
    ? await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer()
    : await pipeline.webp({ quality: QUALITY, effort: 6 }).toBuffer();

  const dims = longEdge > cap ? `${meta.width}x${meta.height} -> capped ${cap}` : `${meta.width}x${meta.height} (kept)`;
  const pct  = ((1 - buf.length / srcBytes) * 100).toFixed(0);
  console.log(`${file.padEnd(36)} ${kb(srcBytes)} -> ${kb(buf.length)}  (-${pct}%)  ${dims}`);
  after += buf.length;

  if (dry) continue;
  const { writeFile } = await import('node:fs/promises');
  await writeFile(out, buf);
  // Drop the original once a .webp replaces it, so the old bytes stop shipping.
  if (!isIcon) await unlink(src);
}

console.log('-'.repeat(78));
console.log(`${'TOTAL'.padEnd(36)} ${kb(before)} -> ${kb(after)}  (-${((1 - after / before) * 100).toFixed(0)}%)`);
if (dry) console.log('\n(dry run — nothing written)');
