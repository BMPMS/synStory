// The shareable result image: a 1080 x 1080 PNG drawn on a canvas, for
// posting or emailing. Three looks, picked by the `style` argument (the
// default is SHARE_CARD_STYLE) — all use the person's OWN colour for each
// letter and number, so every card is different.
//
//   'mosaic'  — "My alphabet, in colour": all 36 letters + numbers as a grid
//   'teaser'  — "What colour is the letter K?": one giant letter, then a
//               strip of all 36; pulls people in with a question
//   'result'  — leads with the result label on grey, then every letter and
//               number as a circle in its own colour (no URL — see shareResult)
//
// No names, scores or raw picks go on the card — only the colours and the
// result label.
import { colors, fonts } from './theme.js';
import { ownColourFor, hexToLab } from './data/graphemeTest.js';

export const SHARE_CARD_STYLE = 'result';
const SIZE = 1080; // layout units
const SCALE = 2; // drawn at 2x, so the picture is 2160 x 2160 px
const M = 72; // outer margin

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
const inkOn = (hex) => (luminance(hex) > 0.4 ? colors.text : '#ffffff');

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// A colour too close to its background to read (pale yellow on white) gets a
// thin outline of its own hue, pushed away from the background until it
// reaches 3:1. Returns null when the letter is already clear.
function outlineFor(hex, background) {
  if (contrast(hex, background) >= 3) return null;
  const towards = luminance(background) > 0.4 ? 0 : 255;
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let t = 0.2; t <= 1.001; t += 0.1) {
    const out =
      '#' +
      rgb
        .map((v) => Math.round(v + (towards - v) * t).toString(16).padStart(2, '0'))
        .join('');
    if (contrast(out, background) >= 3) return out;
  }
  return towards ? '#ffffff' : '#000000';
}

function chroma(hex) {
  const { a, b } = hexToLab(hex);
  return Math.hypot(a, b);
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function text(ctx, str, x, y, { font, fill, align = 'left', spacing = 0 }) {
  ctx.font = font;
  ctx.fillStyle = fill;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(str, x, y);
  ctx.letterSpacing = '0px';
}

// Greedy word wrap; returns the lines.
function wrap(ctx, str, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of str.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

const heading = (px) => `600 ${px}px ${fonts.heading}`;
const body = (px, weight = 400) => `${weight} ${px}px ${fonts.body}`;

// Footer shared by every look: call to action + link, centred or left.
function footer(ctx, { url, cta, fill, muted }) {
  text(ctx, cta, M, SIZE - M - 44, { font: heading(40), fill });
  text(ctx, url, M, SIZE - M, { font: body(30, 700), fill: muted });
}

function paintMosaic(ctx, own, bandLabel, url) {
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, SIZE, SIZE);

  text(ctx, 'SYNAESTHESIA BATTERY TEST', M, 112, {
    font: heading(28),
    fill: colors.purple,
    spacing: 4
  });
  text(ctx, 'My alphabet,', M, 222, { font: heading(112), fill: colors.text });
  text(ctx, 'in colour.', M, 334, { font: heading(112), fill: colors.text });

  // 9 x 4 grid of tiles filling the full content width.
  const cols = 9;
  const gap = 9;
  const tile = (SIZE - M * 2 - gap * (cols - 1)) / cols;
  const top = 396;
  own.forEach(({ grapheme, colour }, i) => {
    const x = M + (i % cols) * (tile + gap);
    const y = top + Math.floor(i / cols) * (tile + gap);
    ctx.fillStyle = colour;
    rrect(ctx, x, y, tile, tile, 18);
    ctx.fill();
    text(ctx, grapheme, x + tile / 2, y + tile / 2 + 17, {
      font: heading(52),
      fill: inkOn(colour),
      align: 'center'
    });
  });

  // Result pill.
  const pillY = top + 4 * tile + 3 * gap + 52;
  ctx.font = heading(34);
  const pw = ctx.measureText(bandLabel).width + 64;
  ctx.fillStyle = colors.purple;
  rrect(ctx, M, pillY, pw, 68, 34);
  ctx.fill();
  text(ctx, bandLabel, M + 32, pillY + 46, { font: heading(34), fill: '#ffffff' });

  footer(ctx, {
    url,
    cta: 'Are your colours the same every time?',
    fill: colors.text,
    muted: colors.purple
  });
}

function paintTeaser(ctx, own, bandLabel, url) {
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // The letter with the boldest colour becomes the hero.
  const hero = own.reduce((best, o) => (chroma(o.colour) > chroma(best.colour) ? o : best), own[0]);

  text(ctx, 'SYNAESTHESIA BATTERY TEST', M, 112, {
    font: heading(28),
    fill: colors.purple,
    spacing: 4
  });
  text(ctx, 'What colour is', M, 226, { font: heading(100), fill: colors.text });
  text(ctx, `the ${/[0-9]/.test(hero.grapheme) ? 'number' : 'letter'} ${hero.grapheme}?`, M, 332, { font: heading(100), fill: colors.text });

  // Giant letter in its own colour.
  const tile = 420;
  const ty = 392;
  ctx.fillStyle = hero.colour;
  rrect(ctx, M, ty, tile, tile, 56);
  ctx.fill();
  text(ctx, hero.grapheme, M + tile / 2, ty + tile / 2 + 120, {
    font: heading(330),
    fill: inkOn(hero.colour),
    align: 'center'
  });

  // My answer, beside it.
  const rx = M + tile + 56;
  text(ctx, 'My result:', rx, ty + 70, { font: body(36), fill: colors.text });
  ctx.font = heading(72);
  wrap(ctx, bandLabel, SIZE - M - rx).forEach((line, i) => {
    text(ctx, line, rx, ty + 160 + i * 84, { font: heading(72), fill: colors.purple });
  });

  // Strip of all 36 along the bottom.
  const gap = 6;
  const w = (SIZE - M * 2 - gap * 35) / 36;
  own.forEach(({ colour }, i) => {
    ctx.fillStyle = colour;
    rrect(ctx, M + i * (w + gap), 850, w, 70, 8);
    ctx.fill();
  });

  footer(ctx, { url, cta: 'Find out how yours hold up →', fill: colors.text, muted: colors.purple });
}

// Two looks, both a grey and a white shape holding the letters:
//   'whitePanel' — grey picture, white panel behind the letters
//   'greyPanel'  — white picture, grey panel behind the letters
const PANEL_LOOKS = {
  whitePanel: { bg: '#6E6E75', panel: '#FFFFFF' },
  greyPanel: { bg: '#FFFFFF', panel: '#6E6E75' },
  // white picture, and the text colour of the site used as the panel
  darkPanel: { bg: '#FFFFFF', panel: colors.text }
};
export let PANEL_LOOK = 'whitePanel';

function paintResult(ctx, own, bandLabel, url, look = PANEL_LOOK) {
  const { bg, panel } = PANEL_LOOKS[look] || PANEL_LOOKS.whitePanel;
  const ink = inkOn(bg);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  text(ctx, 'SYNAESTHESIA BATTERY TEST', M, 112, {
    font: heading(34),
    fill: ink,
    spacing: 4
  });
  text(ctx, 'My colour test says…', M, 200, { font: body(44), fill: ink });

  // One line always: shrink the label until it fits the width.
  let labelPx = 100;
  ctx.font = body(labelPx, 700);
  while (ctx.measureText(bandLabel).width > SIZE - M * 2 && labelPx > 60) {
    labelPx -= 2;
    ctx.font = body(labelPx, 700);
  }
  text(ctx, bandLabel, M, 312, { font: body(labelPx, 700), fill: ink });

  // Panel holding every letter and number in the colour the person chose.
  const px = 48;
  const pw = SIZE - px * 2;
  const ph = 530;
  const labelBottom = 312 + 100 * 0.28; // descenders
  const footerTop = SIZE - M + 4 - 44 * 0.75; // cap height of the footer line
  const py = Math.round(labelBottom + (footerTop - labelBottom - ph) / 2);
  ctx.fillStyle = panel;
  rrect(ctx, px, py, pw, ph, 40);
  ctx.fill();

  const cols = 9;
  const padX = 28;
  const pitchX = (pw - padX * 2) / cols;
  const letterPx = 108;
  const pitchY = (ph - 56 - letterPx) / 3;
  own.forEach(({ grapheme, colour }, i) => {
    const x = px + padX + pitchX / 2 + (i % cols) * pitchX;
    const y = py + 28 + Math.floor(i / cols) * pitchY + letterPx * 0.8;
    const outline = outlineFor(colour, panel);
    if (outline) {
      ctx.font = heading(letterPx);
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 5;
      ctx.strokeStyle = outline;
      ctx.strokeText(grapheme, x, y);
    }
    text(ctx, grapheme, x, y, { font: heading(letterPx), fill: colour, align: 'center' });
  });

  // The question, then the address on the same line after a gap. A picture
  // can't be clicked, so the address is printed short; the real clickable
  // link travels with the picture in the share text.
  const question = 'What would yours say?';
  const gapPx = 40;
  const baseline = SIZE - M + 4;
  let qPx = 44;
  let uPx = 32;
  const measure = () => {
    ctx.font = heading(qPx);
    const q = ctx.measureText(question).width;
    ctx.font = body(uPx, 400);
    return { q, u: ctx.measureText(url).width };
  };
  let m = measure();
  while (m.q + gapPx + m.u > SIZE - M * 2 && qPx > 30) {
    qPx -= 1;
    uPx = Math.round(qPx * 0.73);
    m = measure();
  }
  text(ctx, question, M, baseline, { font: heading(qPx), fill: ink });
  text(ctx, url, M + m.q + gapPx, baseline, { font: body(uPx, 400), fill: ink });
}

const PAINTERS = { mosaic: paintMosaic, teaser: paintTeaser, result: paintResult };

// perGrapheme: [{ grapheme, colors: [hex x3] }] straight from scoreConsistency.
export async function renderShareCard(perGrapheme, bandLabel, url, style = SHARE_CARD_STYLE, look = PANEL_LOOK) {
  if (document.fonts) {
    await Promise.all([
      document.fonts.load('600 40px Fredoka', 'ABC xyz 0123'),
      document.fonts.load('400 30px Literata', 'ABC xyz 0123…'),
      document.fonts.load('700 30px Literata', 'abc xyz/.')
    ]).catch(() => {});
  }
  const own = perGrapheme.map((p) => ({ grapheme: p.grapheme, colour: ownColourFor(p.colors) }));
  const canvas = document.createElement('canvas');
  canvas.width = SIZE * SCALE;
  canvas.height = SIZE * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);
  (PAINTERS[style] || paintMosaic)(ctx, own, bandLabel, url, look);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('no image'))), 'image/png')
  );
}
