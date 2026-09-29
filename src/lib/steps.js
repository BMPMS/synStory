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
// SYNAESTHESIA?" — then "It's when one of yourFIVE SENSES" and the 5 sense
// icons appear, and finally the closing "consistently triggers another
// sense (or more than one)" lines.
export const step3 = {
  // "They've all been..." clears out of the way as SYNAESTHESIA rises,
  // then the SAME text element is reused for the next line.
  lead: { fadeOut: { start: 0.0, end: 0.3 } },
  title: { start: 0.0, end: 0.35 },
  whatIs: { fadeIn: { start: 0.15, end: 0.4 } },
  senses: {
    text: "It's when one of the FIVE SENSES",
    // starts right as whatIs finishes (step3.whatIs.fadeIn.end)
    fadeIn: { start: 0.4, end: 0.6 },
    riseBy: 48 // higher than step1's lead line, clears the icon row
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
    line: 'consistently triggers another SENSE',
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
  },
  // Bryony: "the famous synetheses should only start to fade in AFTER
  // letter+numbers is fully visible" — starts exactly where reveal.fadeIn
  // ends (t=0.4, the moment the lettersNumbers sub-icon — last in the
  // stagger — finishes), so the header swaps straight from the "splits
  // into 3" text at full opacity into this fade-in with no dead gap.
  famousHeader: {
    fadeIn: { start: 0.4, end: 0.6 }
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

// Step 7: everything from the story so far fades out, the new title
// ("This is not old news...") fades in, then the publications line/area
// chart builds up in three beats, per Bryony — x-axis first, then the
// line + area drawing in left to right, then the y-axis (with its
// rotated "Number of publications" label) last.
export const step7 = {
  storyFadeOut: { start: 0, end: 0.12 },
  title: { fadeIn: { start: 0.08, end: 0.22 } },
  xAxis: { fadeIn: { start: 0.25, end: 0.35 } },
  // Bryony: "the line/area reveal is taking too long... could it end at
  // Step 8 100%" — was ending exactly at t=1 (this step's own end), which
  // left no margin, so it was still visibly catching up once scrolled
  // into step8. Pulled in to finish with buffer before the step itself
  // ends.
  draw: { start: 0.38, end: 0.85 },
  // Bryony: "the y axis doesn't appear until step 9 25%, it should start
  // appearing around step 8 75%... both that and the line reveal should
  // end at the same time" — was living in step8 (starting right at 0%
  // there); moved here, ending together with draw above.
  yAxis: { fadeIn: { start: 0.75, end: 0.85 } }
};

// Step 8: once the publications chart has fully drawn, mark 2 specific
// publications on it, one at a time — Bryony: "mark 2 publications -
// Rouw & Scholte (2007) and Witthoft, Winawer & Eagleman (2015)... show
// label for 1st, then 2nd.." Neither fades back out once shown. The
// step's own intro ("Let's focus...") isn't timed here — it's an instant
// swap of .publicationsTitle's text the moment the step starts, done in
// ChartSvg's setPublicationsMarkersProgress() itself.
export const step8 = {
  // Bryony: "wait for line + area fully in, THEN change the header,
  // THEN reveal the [1892] marker" — the line (and now the y-axis, see
  // step7) already finished by the time this step starts, so marker
  // goes right at the front here; title swap to the marker text is
  // instant, at marker.fadeIn.start (t=0).
  marker: { fadeIn: { start: 0, end: 0.06 } },
  // Bryony: "let's wait till step 9 50% to bring in Let's focus (and the
  // two lines)" — title swap to the "let's focus" text and both citation
  // lines now all held until the step's midpoint, well clear of the
  // marker/y-axis fade-in above (was yAxis.fadeIn.end, 0.15 — too soon).
  titleSwap: 0.5,
  citation1: { fadeIn: { start: 0.5, end: 0.68 } },
  citation2: { fadeIn: { start: 0.75, end: 0.93 } }
};

// Step 9: the publications chart fades out, then the title comes straight
// up (it's the header for the whole step). Bryony: "start with a visual
// of 18 + 18 person icons... leadText should say [36 participants],
// then [letters, numbers + symbols]... then the participants fade out +
// the brain stuff fades in as well as the label below the header" — so
// the intro (leadText + 2 group labels + 36 icons) fills the same slot
// the subtitle/brain will later occupy, then clears for them. subtitle
// now shares brain's own beat instead of appearing earlier with the title.
export const step9 = {
  chartFadeOut: { start: 0, end: 0.08 },
  // Bryony: "We lead with Is synesthese brain activity different - fade
  // in the people." — the header carries 4 stages in order: the real
  // question first (this fade-in), then "36 participants", then "letters,
  // numbers + symbols", then "while undergoing fMRI scanning" (which also
  // triggers the scan animation below). brainSubtitle shares this exact
  // fade-in ramp too (see setBrainProgress) and never fades back out.
  title: { fadeIn: { start: 0.04, end: 0.12 } },
  intro: {
    fadeIn: { start: 0.12, end: 0.22 }, // the 36 icons, right after the question lands
    // Header text swaps at these instants, no crossfade — same pattern
    // as every other text swap in the piece (see step3.senses).
    stage1At: 0.3, // -> "The study worked with 36 participants"
    stage2At: 0.42, // -> "They were shown letters, numbers + symbols"
    stage3At: 0.54, // -> "while undergoing fMRI scanning"
    // Bryony: "add some cool animation which scanned the people icons
    // left to right" — a light sweeps across all 36 icons over this
    // window, synced with the stage3 text landing.
    scan: { start: 0.54, end: 0.66 },
    fadeOut: { start: 0.7, end: 0.8 }
  },
  // Bryony: "made the brain fade in quicker" — tighter span than before.
  brain: { fadeIn: { start: 0.78, end: 0.83 } },
  dots: { fadeIn: { start: 0.88, end: 0.98 } }
};

// Step 10: the brain-regions scene fades out, then the new "when do
// synaesthete connections form?" scene fades in — title first, then the
// drawn magnet-letter tray (Bryony's own mock-up of her Fisher-Price
// reference photo, in the app's own header font — see magnetLetters.js).
// Just getting the beat on the page for now — same shape as step9.
export const step10 = {
  chartFadeOut: { start: 0, end: 0.12 },
  title: { fadeIn: { start: 0.15, end: 0.35 } },
  tray: { fadeIn: { start: 0.35, end: 0.6 } }
};

// Step 11 ("Step 12" in Bryony's own 1-indexed count): step10's tray
// scene fades out, then its own 26 magnet letters (the SAME
// magnetLetterGroups elements — see buildMagnetLetters()/layoutHeatmap()
// in ChartSvg) shrink and travel from their tray-grid position onto a
// ring. Once they've landed, a per-respondent "heatmap" builds around
// that ring: each letter gets 326 thin radial cells (one per magnetAgg
// respondent — see magnetResponses.js), initially in raw/unsorted order
// (colorOrder false). Scrolling on from there morphs those cells first
// into match-clustered order (colorOrder true — every match recolours to
// that letter's own template colour, every non-match to a neutral grey),
// then again into a horizontal bar chart (colorBar — row = letter,
// ordered by matchCount per barLetterOrder, bar length = matchCount).
// Bryony asked for exactly these 4 beats, scroll-driven rather than the
// original Observable cell's own dropdown control.
export const step11 = {
  // Tray rect + divider lines fade out while the 26 letters shrink and
  // travel from their tray-grid position to their ring position — no
  // separate chartFadeOut beat needed here (unlike every step before it):
  // there's no earlier scene to clear, the tray IS step10's own scene,
  // continuously morphing into this one.
  trayToRing: { start: 0.06, end: 0.3 },
  // The colorOrder-FALSE view (326 per-respondent cells per letter, in
  // raw/unsorted order) fades in right as the letters land on the ring.
  cellsFadeIn: { start: 0.24, end: 0.36 },
  // Morphs each letter's 326 cells from raw respondent order (mixed
  // colours) into match-clustered order (colorOrder true).
  colorOrderTrue: { start: 0.42, end: 0.64 },
  // Morphs the ring (26 wedges, angle = letter, radius = respondent
  // rank) into a horizontal bar chart (row = letter, length = matchCount).
  colorBar: { start: 0.72, end: 0.96 }
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
