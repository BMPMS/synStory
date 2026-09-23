// Declarative reveal choreography, keyed by Scrollama step. A component
// (ChartSvg, for now) reads these plain timing/target values and drives
// its own DOM with them — this file never touches the DOM itself, so new
// steps get added here as data instead of growing the component.

import { colors } from './theme.js';

// Position `t` within [start, end] as 0–1, clamped.
export function phase(t, start, end) {
  return Math.max(0, Math.min(1, (t - start) / (end - start)));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Step 1: header fades out, then the lead line + SYN/AESTHESIA fade in
// while the tiles cluster into the bottom-left corner, shrinking and
// dimming as they go.
export const step1 = {
  header: { fadeOut: { start: 0.05, end: 0.25 } },
  lead: { fadeIn: { start: 0.25, end: 0.45 } },
  word: { fadeIn: { start: 0.45, end: 0.65 } },
  tilesToCorner: {
    // Starts as the lead line starts fading in, settled by 60% progress.
    start: 0.25,
    end: 0.6,
    scale: 0.45,
    tileOpacity: 0.2,
    labelOpacity: 0
  }
};

// Step 3: SYNAESTHESIA rises and shrinks into the header's old slot,
// "What is" fades in beside it so it reads as one line — "What is
// SYNAESTHESIA" — then "It's when one of your 5 senses" and the 5 sense
// icons appear, and finally the closing "consistently triggers another
// sense (or more than one)" lines.
export const step3 = {
  // "They've all been..." clears out of the way as SYNAESTHESIA rises,
  // then the SAME text element is reused for the next line.
  lead: { fadeOut: { start: 0.0, end: 0.3 } },
  title: { start: 0.0, end: 0.35 },
  whatIs: { fadeIn: { start: 0.15, end: 0.4 } },
  senses: {
    text: "It's when one of your 5 senses",
    fadeIn: { start: 0.45, end: 0.6 },
    // Sits this much higher than "They've all been..." did, for better
    // spacing above the icon row below it.
    riseBy: 48
  },
  icons: {
    // Five, quickly, one after another.
    start: 0.5,
    staggerEach: 0.03,
    fadeInLength: 0.08,
    // Fisher-Price, skipping yellow — red, orange, purple, green, blue.
    colors: [colors.red, colors.orange, colors.purple, colors.green, colors.blue]
  },
  // Icons finish fading in by 0.5 + 4*0.03 + 0.08 = 0.7 — the closing
  // lines pick up shortly after that, once the row has properly landed.
  closing: {
    line: 'consistently triggers another sense',
    fadeIn: { start: 0.72, end: 0.85 },
    subline: '(or more than one)',
    sublineFadeIn: { start: 0.85, end: 0.95 }
  }
};

// Step 2: SYN, then AESTHESIA, take their turn growing, moving left, and
// reddening while their caption ("Latin for") and label ("together" /
// "perception") appear — then unwind back to normal before the next
// word's turn. Tune the numbers below directly; nothing else needs to
// change to retime this.
export const step2 = {
  syn: {
    label: 'together',
    caption: 'Latin for',
    // A gentle 1.05x, moving left — away from AESTHESIA, which follows
    // immediately after it with no gap — so it doesn't grow into it.
    grow: { start: 0.0, end: 0.1, scale: 1.05, dx: -10 },
    colorIn: { start: 0.05, end: 0.15 },
    labelIn: { start: 0.12, end: 0.22 },
    fadeBack: { start: 0.35, end: 0.5 },
    color: colors.red
  },
  aesthesia: {
    label: 'perception',
    caption: 'Latin for',
    // Mirror of SYN's — moves right, away from SYN, which sits just
    // before it.
    grow: { start: 0.5, end: 0.6, scale: 1.05, dx: 10 },
    colorIn: { start: 0.55, end: 0.65 },
    labelIn: { start: 0.62, end: 0.72 },
    fadeBack: { start: 0.85, end: 1.0 },
    color: colors.orange
  }
};

// Step 4: the 5 quotes, revealed one at a time, one word at a time, below
// the closing lines. Each quote gets an equal slice of the step's 0–1
// progress (see layoutQuoteReveals below) — revealFraction of that slice
// is spent staggering its own words in, then it holds fully visible for
// holdFraction, then fades out as a whole over fadeOutFraction, leaving a
// small gap before the next quote's slice begins.
export const step4 = {
  // Before any quote appears: the "What is SYNAESTHESIA?" title, "It's
  // when one of your 5 senses", and the two closing lines all fade out
  // together, while the sense icons rise to make room below them — how
  // far is computed in ChartSvg (near header height, using the same
  // topPadding the header itself uses), not a flat number here. Quick —
  // 6% of the step — and the quotes themselves don't start until it's
  // done (see layoutQuoteReveals below).
  clear: {
    fadeOut: { start: 0, end: 0.06 }
  },
  // Right after the icons finish rising, the (placeholder, for now)
  // people illustration and the speech bubble above it fade in together
  // and then stay for the whole step — quotes don't start until this is
  // done.
  people: {
    fadeIn: { start: 0.06, end: 0.1 }
  },
  revealFraction: 0.55,
  holdFraction: 0.2,
  fadeOutFraction: 0.2,
  // How a sense word "flashes" its matching icon as it's revealed — a
  // symmetric pulse this wide (in the same 0–1 progress units) centred on
  // the moment the word finishes fading in, scaling the icon up by this
  // much at its peak.
  flashHalfWidth: 0.015,
  flashScale: 0.4
};

// Step 5: after the last quote, the story consolidates onto "sight" —
// everything from step 4 except the sense icons + labels and the
// people tiles fades out, the sense icons themselves move from their
// row into a ring (sight at the top, the other 4 spaced evenly around
// it, around the same point on screen the row already rested at), and
// once the ring has landed, a circle plus its 3 "sight splits into..."
// sub-icons and a caption fade in.
export const step5 = {
  arrive: {
    fadeOut: { start: 0, end: 0.15 }
  },
  reveal: {
    fadeIn: { start: 0.2, end: 0.4 }
  }
};

// Step 6: once the sight scene has settled, the synaesthesia-relationship
// arrows (and the duplicated person-photo fans that sit along them)
// fade in together.
export const step6 = {
  reveal: {
    fadeIn: { start: 0.1, end: 0.5 }
  }
};

// A phase that ramps in over `in_`, then unwinds over `out` — used so a
// word's grow/colour/label all wind back down together during fadeBack,
// having each ramped in on their own separate schedule. Reused for the
// quote words below: `in_` is the word's own fade-in window, `out` is its
// quote's shared fade-out window.
export function windPhase(t, in_, out) {
  return Math.max(0, Math.min(1, phase(t, in_.start, in_.end) - phase(t, out.start, out.end)));
}

// Pure layout math for the quotes step — no DOM. Splits 0–1 into one
// equal slice per quote, and within each slice, one evenly-staggered
// fade-in window per word (so a longer quote's words come slightly
// faster, but every quote's own reveal takes about the same length of
// scroll), followed by a hold, then a shared fade-out for the whole
// quote. Returns one layout object per quote:
// { sliceStart, sliceEnd, words: [{start, end}, ...], fadeStart, fadeEnd }
export function layoutQuoteReveals(quotes, cfg) {
  // Quotes only start once the "clear" phase (old text fading out, icons
  // rising) and the people/bubble fade-in have both finished — everything
  // below is sliced across the remaining range, not the full 0–1.
  const rangeStart = cfg.people ? cfg.people.fadeIn.end : cfg.clear ? cfg.clear.fadeOut.end : 0;
  const rangeLen = 1 - rangeStart;
  const n = quotes.length;
  const sliceLen = n > 0 ? rangeLen / n : rangeLen;

  return quotes.map((quote, qi) => {
    const sliceStart = rangeStart + qi * sliceLen;
    const sliceEnd = sliceStart + sliceLen;

    const revealLen = sliceLen * cfg.revealFraction;
    const holdLen = sliceLen * cfg.holdFraction;
    const fadeLen = sliceLen * cfg.fadeOutFraction;

    const revealStart = sliceStart;
    const revealEnd = revealStart + revealLen;
    const holdEnd = revealEnd + holdLen;
    const fadeStart = holdEnd;
    const fadeEnd = Math.min(sliceEnd, fadeStart + fadeLen);

    const wordCount = quote.words.length;
    const perWord = wordCount > 0 ? revealLen / wordCount : 0;
    const words = quote.words.map((w, wi) => {
      const start = revealStart + wi * perWord;
      return { start, end: start + perWord };
    });

    return { sliceStart, sliceEnd, words, fadeStart, fadeEnd };
  });
}

// Lays out `count` shrunk tiles as a grid anchored to the bottom-left
// corner, wrapping upward into more rows if one row would run past the
// right edge. The whole block of rows is centred, top-and-bottom, inside
// a reserved band at the screen's bottom — rather than jammed flush
// against the edge — so there's always a bit of clear margin below the
// tiles too. Returns one {x, y} centre per index.
export function cornerGridTargets({ count, tileSize, gap, width, height, edgeMargin }) {
  const perRow = Math.max(1, Math.floor((width - edgeMargin * 2 + gap) / (tileSize + gap)));
  const rows = Math.ceil(count / perRow);
  const blockHeight = rows * tileSize + (rows - 1) * gap;

  // Reserved bottom band: tall enough to give the block breathing room on
  // both sides, however many rows it ends up being.
  const bottomBand = Math.max(tileSize + 40, 90);
  const bandCenterY = height - bottomBand / 2;
  const bottomRowY = bandCenterY + blockHeight / 2 - tileSize / 2;

  // Each row is centred on its own width (the last row may be shorter
  // than a full row), so the whole block reads as centred on screen.
  const targets = [];
  for (let row = 0; row < rows; row++) {
    const rowStart = row * perRow;
    const rowCount = Math.min(perRow, count - rowStart);
    const rowWidth = rowCount * tileSize + (rowCount - 1) * gap;
    const rowStartX = (width - rowWidth) / 2 + tileSize / 2;
    const rowY = bottomRowY - row * (tileSize + gap);
    for (let col = 0; col < rowCount; col++) {
      targets.push({ x: rowStartX + col * (tileSize + gap), y: rowY });
    }
  }
  return targets;
}
