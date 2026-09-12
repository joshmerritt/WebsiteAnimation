/**
 * make-og-image.mjs — Build the 1200x630 social card
 *
 * index.html and portfolio.html have always advertised
 *   og:image = /assets/images/og-preview.jpg
 * but that file never existed, so every LinkedIn / Slack / iMessage / X
 * preview fell back to no image at all.
 *
 * Composed from logos/DaDataDad_combined_logo.png on the site's own background
 * (#0a0e12), with the palette taken from src/game/config.js so the card and the
 * site match.
 *
 * Usage: npm run og
 */

import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const W = 1200, H = 630;

// Palette from config.js. BG is the logo PNG's own flat background rather than
// config's #0a0e12: the logo is a rectangular crop with a soft reflection that
// fades into its backdrop, so any mismatch draws a visible box around it.
// The two differ imperceptibly in isolation, and the card is a standalone asset.
const BG      = '#0f1119';
const MAIN    = '#c7d6d5';
const ACCENT  = '#5985b1';
const MUTED   = '#7f8c96';

const LOGO = 'logos/DaDataDad_combined_logo.png';
const OUT  = 'public/assets/images/og-preview.jpg';

// Content box of the logo artwork inside its 2400x2400 canvas. The height runs
// to y=1700 rather than the 1548 a naive bounding-box probe reports: the mark's
// reflection fades gradually and is still ~13/255 above the background at 1548,
// so cropping there leaves a faint horizontal edge across the card.
const CROP = { left: 866, top: 725, width: 669, height: 975 };

const LOGO_H = 480;
const logo = await sharp(LOGO)
  .extract(CROP)
  .resize({ height: LOGO_H, fit: 'inside' })
  .png()
  .toBuffer();
const logoW = (await sharp(logo).metadata()).width;

const LOGO_X = 96;
const TEXT_X = LOGO_X + logoW + 72;

// Segoe UI is present on Windows and renders cleanly; the site's own Syne /
// DM Sans are webfonts and are not installed locally, so they cannot be used
// here. The card leans on the logo for brand voice instead.
const FONT = "Segoe UI, Helvetica Neue, Arial, sans-serif";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <!-- Deliberately flat. The logo is composited on top as an opaque rectangle,
       so any gradient underneath it stops at the crop edge and draws a visible
       box around the mark. Flat background = invisible seam. -->
  <rect width="${W}" height="${H}" fill="${BG}"/>

  <!-- accent rule, echoes the bar-chart mark -->
  <rect x="${TEXT_X}" y="214" width="64" height="4" rx="2" fill="${ACCENT}"/>

  <text x="${TEXT_X}" y="196" font-family="${FONT}" font-size="34" font-weight="600"
        fill="${ACCENT}" letter-spacing="3">JOSH MERRITT</text>

  <text x="${TEXT_X}" y="292" font-family="${FONT}" font-size="56" font-weight="700"
        fill="${MAIN}">Analyst. Creator.</text>
  <text x="${TEXT_X}" y="360" font-family="${FONT}" font-size="56" font-weight="700"
        fill="${MAIN}">Engineer.</text>

  <text x="${TEXT_X}" y="424" font-family="${FONT}" font-size="27" fill="${MUTED}">
    Interactive, physics-based portfolio
  </text>

  <text x="${TEXT_X}" y="486" font-family="${FONT}" font-size="27" font-weight="600"
        fill="${ACCENT}">dadatadad.com</text>
</svg>`;

const png = await sharp(Buffer.from(svg))
  .composite([{ input: logo, left: LOGO_X, top: Math.round((H - LOGO_H) / 2) }])
  .png()
  .toBuffer();

// JPEG because the og:image URL says .jpg and some scrapers key off the
// extension; the card is flat colour so quality 88 is visually lossless here.
const jpg = await sharp(png).jpeg({ quality: 88, chromaSubsampling: '4:4:4' }).toBuffer();
await writeFile(OUT, jpg);

console.log(`${OUT}  ${W}x${H}  ${(jpg.length / 1024).toFixed(1)} KB`);
