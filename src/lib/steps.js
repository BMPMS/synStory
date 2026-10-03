// Reveal choreography per Scrollama step. Pure data — ChartSvg drives the DOM.

import { colors } from './theme.js';

// Position t within [start, end] as 0-1, clamped.
export function phase(t, start, end) {
  return Math.max(0, Math.min(1, (t - start) / (end - start)));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Step 1: header fades, lead+words fade in, tiles cluster to bottom-left.
export const step1 = {
  header: { fadeOut: { start: 0.05, end: 0.25 } },
  lead: { fadeIn: { start: 0.25, end: 0.45 } },
  word: { fadeIn: { start: 0.45, end: 0.65 } },
  tilesToCorner: {
    // Starts with lead fade-in, settled by 60% progress.
    start: 0.25,
    end: 0.6,
    scale: 0.45,
    tileOpacity: 0.2,
    labelOpacity: 0
  }
};

// Step 3: title settles into header slot, "What is" + senses + closing lines.
export const step3 = {
  // leadText element reused for the next line once cleared.
  lead: { fadeOut: { start: 0.0, end: 0.3 } },
  title: { start: 0.0, end: 0.35 },
  whatIs: { fadeIn: { start: 0.15, end: 0.4 } },
  senses: {
    text: "It's when one of the FIVE SENSES",
    // Starts right as whatIs finishes.
    fadeIn: { start: 0.4, end: 0.6 },
    riseBy: 48 // clears the icon row
  },
  icons: {
    // Five icons, staggered quickly.
    start: 0.5,
    staggerEach: 0.03,
    fadeInLength: 0.08,
    // Fisher-Price palette, skipping yellow.
    colors: [colors.red, colors.orange, colors.purple, colors.green, colors.blue]
  },
  // Closing lines pick up once icons finish (~t=0.7).
  closing: {
    line: 'consistently triggers another SENSE',
    fadeIn: { start: 0.72, end: 0.85 },
    subline: '(or more than one)',
    sublineFadeIn: { start: 0.85, end: 0.95 }
  }
};

// Step 2: SYN then AESTHESIA grow/colour/label in turn, then unwind.
export const step2 = {
  syn: {
    label: 'together',
    caption: 'Latin for',
    // Moves left, away from AESTHESIA which follows with no gap.
    grow: { start: 0.0, end: 0.1, scale: 1.05, dx: -10 },
    colorIn: { start: 0.05, end: 0.15 },
    labelIn: { start: 0.12, end: 0.22 },
    fadeBack: { start: 0.35, end: 0.5 },
    color: colors.red
  },
  aesthesia: {
    label: 'perception',
    caption: 'Latin for',
    // Mirror of SYN's, moves right away from it.
    grow: { start: 0.5, end: 0.6, scale: 1.05, dx: 10 },
    colorIn: { start: 0.55, end: 0.65 },
    labelIn: { start: 0.62, end: 0.72 },
    fadeBack: { start: 0.85, end: 1.0 },
    color: colors.orange
  }
};

// Step 4: 5 quotes reveal one word at a time (see layoutQuoteReveals).
export const step4 = {
  // Title/senses/closing fade out as icons rise; quotes wait for this.
  clear: {
    fadeOut: { start: 0, end: 0.06 }
  },
  // People illustration + bubble fade in once icons have risen.
  people: {
    fadeIn: { start: 0.06, end: 0.1 }
  },
  revealFraction: 0.55,
  holdFraction: 0.2,
  fadeOutFraction: 0.2,
  // Flash pulse width/scale when a sense word reveals its matching icon.
  flashHalfWidth: 0.015,
  flashScale: 0.4
};

// Step 5 (shown as "Step 6"): step4 fades except sense icons, which move
// onto a ring around sight; then 3 scrolling captions play over a held
// scene (see .step--sight in global.css, and App.svelte for the captions).
//
// Bryony's flow: "SIGHT splits into 3 sub groups..." (sub-icons stagger
// in) -> "grapheme is the academic term..." -> PAUSE, nothing moves or
// changes opacity until that caption is more than half way -> photos fly
// into place while the other senses + arrows fade in fast (~10% of the
// step) -> "some of the famous synaesthetes have only one relationship...".
//
// The step is SIGHT_STEP_VH tall (global.css keeps the two in sync), so
// every beat below is written in "vh scrolled into the step" and divided
// by that height to get t. A caption whose CSS `top` is T vh sits at the
// middle of the screen when 40 + T vh have been scrolled (scrollama
// progress starts at the 90% trigger line), and a quarter of the way up
// the screen (75vh) when 15 + T have been scrolled, which is how the
// caption positions in global.css were chosen.
export const SIGHT_STEP_VH = 240;
const sightVh = (vh) => vh / SIGHT_STEP_VH;
export const step5 = {
  arrive: {
    fadeOut: { start: 0, end: sightVh(15) }
  },
  // Bryony: the header appears fast, over the first 5% of the step.
  header: {
    fadeIn: { start: 0, end: 0.05 }
  },
  // Sub-icons stagger in (and the beige circle fades in) only once caption 1
  // is a quarter of the way up the screen: it is centred at 55vh scrolled,
  // so that's 30vh. Caption 2 is centred at 135vh (captions are 80vh apart).
  reveal: {
    fadeIn: { start: sightVh(30), end: sightVh(75) }
  },
  // Held completely still from the end of the reveal until just past the
  // middle of caption 2 (155vh), then the photos fly into place.
  move: { start: sightVh(150), end: sightVh(225) },
  // Other senses back to full opacity + relationship arrows fade in, over
  // the first 10% of the step's progress once movement begins.
  linksFade: { start: sightVh(150), end: sightVh(150) + 0.1 }
};

// Step 6: relationship arrows + photo fans fade in together.
export const step6 = {
  reveal: {
    fadeIn: { start: 0.1, end: 0.5 }
  }
};

// Step 7: story fades, then x-axis, line/area draw, y-axis, per Bryony.
// Step 8 is now taller than one screen to fit its own scrolling step
// text (see App.svelte/global.css) after the chart finishes drawing.
// Bug fix: the cards were appearing before the reveal had even started,
// then compressing the reveal into too NARROW a scroll window made it
// easy to scroll straight past without ever seeing it animate — widened
// so the draw alone takes a full screen's worth of scroll.
// Bryony: "the line animation is far too long - cut that to 1/3 of the
// time". The draw used to take 80vh of scroll (0.15 -> 0.35 of a 400vh
// step); it's now ~27vh, and everything after it has slid earlier by the
// 53vh saved (same dwell as before between beats). So the beats are written
// in "vh scrolled into the step" and divided by the step's height, which
// global.css (.step--captions-2) keeps in sync.
export const PUB_STEP_VH = 307;
const pubVh = (vh) => vh / PUB_STEP_VH;
export const step7 = {
  storyFadeOut: { start: 0, end: pubVh(16) },
  title: { fadeIn: { start: pubVh(12), end: pubVh(32) } },
  xAxis: { fadeIn: { start: pubVh(36), end: pubVh(52) } },
  draw: { start: pubVh(60), end: pubVh(87) },
  yAxis: { fadeIn: { start: pubVh(74), end: pubVh(87) } },
  // Bryony: markers now sync with this step's own captions (see
  // step--captions-2 in global.css) — 1892 as "The term" moves up near
  // 50%, 2007+2015 near 80%, settled well before the step ends.
  marker: { fadeIn: { start: pubVh(139), end: pubVh(179) } },
  citation1: { fadeIn: { start: pubVh(219), end: pubVh(251) } },
  citation2: { fadeIn: { start: pubVh(243), end: pubVh(275) } }
};

// Bryony: captions inside one step are now a uniform 80vh apart. Steps 9 and
// 10 were written as fractions of their OLD heights (300vh / 644vh), so the
// fractions below are converted piecewise: each beat keeps its position
// relative to the caption it was timed against. `anchors` pairs old and new
// scrolled-vh positions (caption centres); in between it is linear.
function remapVh(v, anchors) {
  for (let i = 1; i < anchors.length; i++) {
    const [o0, n0] = anchors[i - 1];
    const [o1, n1] = anchors[i];
    if (v <= o1) return n0 + ((v - o0) / (o1 - o0)) * (n1 - n0);
  }
  return v;
}
function retime(obj, oldH, newH, anchors) {
  if (typeof obj === 'number') return remapVh(obj * oldH, anchors) / newH;
  const out = {};
  for (const k of Object.keys(obj)) out[k] = retime(obj[k], oldH, newH, anchors);
  return out;
}

// Step 9: pub chart fades, then 36-icon intro, then brain scene, per Bryony.
const step9Old = {
  chartFadeOut: { start: 0, end: 0.08 },
  // Header carries 4 stages in order; brainSubtitle shares this fade-in.
  title: { fadeIn: { start: 0.04, end: 0.12 } },
  intro: {
    fadeIn: { start: 0.12, end: 0.22 }, // 36 icons, after question lands
    // Scan-line sweeps all 36 icons; title stays fixed (see App.svelte's
    // scrolling step text for the study details that used to live here).
    scan: { start: 0.54, end: 0.66 },
    fadeOut: { start: 0.7, end: 0.8 }
  },
  // Tighter fade-in span per Bryony's "faster" note.
  brain: { fadeIn: { start: 0.78, end: 0.83 } },
  dots: { fadeIn: { start: 0.88, end: 0.98 } }
};

// Step 10: brain scene fades, magnet-tray scene fades in — title then tray.
// Step 11 is now taller than one screen to fit its own scrolling study
// captions (see App.svelte/global.css) after the tray finishes revealing.
// Bryony: "hold brain for an extra 30%... then move on as we do now",
// then "you've maybe gone too far with the brain gap - half it please" —
// this step grew from 560vh to 644vh (+84vh, half of the original +168vh
// hold; see step--captions-4 in global.css) purely to hold brain on
// screen a bit longer; every beat below is the same sequence/pacing as
// before, just slid later by that same 84vh.
const step10Old = {
  // Bug fix: brain used to stay fully opaque while this step's own title
  // and "Do you remember" caption were already fading in on top of it —
  // visible label overlap. Brain now clears fully, fast, once its extra
  // held time is up.
  chartFadeOut: { start: 0.148, end: 0.217 },
  // Bryony: "titles should start fading in so there's never a blank
  // screen" — now overlaps the tail of chartFadeOut as a crossfade.
  title: { fadeIn: { start: 0.17, end: 0.26 } },
  // Bryony: "magnets section fades in too soon" — starts with the brain's
  // own fade-out (not during the title's), tray takes a bit longer.
  // Bryony: "Step 10 24% -> 32% nothing happens, the magnet tray should
  // start to appear ... as the Witthoft [title] is almost there" — now
  // 145vh -> 201vh of the old 644vh step (24% -> 33% of the new one):
  // starts the moment the brain has cleared (140vh) while the title is
  // still finishing (109 -> 167vh), and is done before the first caption
  // enters (~214vh).
  tray: { fadeIn: { start: 145 / 644, end: 201 / 644 } },
  // Bryony: "as 'It found that' starts to scroll in, animate from the
  // letters to the first graph view (circular)" — the tray->ring move
  // used to be step 11's opening beat; runs here now instead, finishing
  // just before that caption centres (see step--captions-4 in global.css).
  // Pushed later, with more of a pause once the tray's fully formed
  // first, so the tray -> ring move doesn't feel rushed.
  trayToRing: { start: 0.53, end: 0.6 },
  // Filters the ring down to the 1975-1980-born respondents (real data,
  // Bryony's own filteredUsers_1.json), fully filtered by 70% and fully
  // back to the unfiltered ring by 85% of the ORIGINAL (pre-hold) timing.
  yobFilter: {
    fadeIn: { start: 0.687, end: 0.739 },
    fadeBack: { start: 0.817, end: 0.87 }
  },
  // Bryony: "grey out the other participants and expand this
  // participant's circle of letters by 5x, then shrink again" — syncs
  // with the "25 out of 26" caption (step--captions-4 in global.css).
  // Bryony: "the One participant matched highlight should persist till
  // Step 11 10%" — so it no longer shrinks here; step11.spotlightRelease
  // lets it go.
  spotlight: {
    expand: { start: 0.87, end: 0.9 }
  }
};

// Step 9: 300vh -> 260vh (captions at 100/180/260vh scrolled, were 100/200/300).
export const step9 = retime(step9Old, 300, 260, [
  [0, 0],
  [100, 100],
  [300, 260]
]);

// Step 10: 644vh -> 604vh (captions centred at 264/344/424/504/584vh scrolled,
// were 264/324/384/524/624).
export const step10 = retime(step10Old, 644, 604, [
  [0, 0],
  [264, 264],
  [324, 344],
  [384, 424],
  [524, 504],
  [624, 584],
  [644, 604]
]);

// Step 11 (Bryony's "Step 12"): 26 letters shrink onto a ring, then
// per-respondent cells sort by match — the "2nd circle" state the
// "Decades after exposure" caption holds on. Bryony: "let's forget the
// horizontal bar that currently comes after" — that morph is gone.
export const step11 = {
  // Ring + raw/unsorted cells both already revealed by the time this step
  // starts — see step10's own trayToRing, which now drives the cells'
  // fade-in too, in sync with the letters landing on the ring.
  // Morphs cells from raw order into match-clustered order, then holds.
  colorOrderTrue: { start: 0.42, end: 0.64 },
  // The spotlighted respondent (step10's "One participant matched") holds
  // until 10% of this step, then shrinks back to the ring.
  spotlightRelease: { start: 0.1, end: 0.14 }
};

// Step 12 (Bryony's "Why do I care?"): the connections/heatmap scene
// clears the same way every other step hands off (crossfade: outgoing
// scene fades out while the incoming title's own fade-in overlaps its
// tail — "stick with step 1" rule), then the icon-rebus passage
// (App.svelte) cascades in across the rest of the step, one token at a
// time — see layoutWeightedReveal below.
export const step12 = {
  chartFadeOut: { start: 0, end: 0.12 },
  title: { fadeIn: { start: 0.05, end: 0.2 } },
  passage: { start: 0.22, end: 0.88 },
  // "What about you?" / battery-test doorway, appended below the
  // passage once it's essentially finished revealing.
  cta: { fadeIn: { start: 0.9, end: 1.0 } }
};

// Ramps in over `in_`, unwinds over `out` — word grow/colour/label sync.
export function windPhase(t, in_, out) {
  return Math.max(0, Math.min(1, phase(t, in_.start, in_.end) - phase(t, out.start, out.end)));
}

// Pure layout for step4: equal slice per quote, staggered words, hold, fade.
// Returns { sliceStart, sliceEnd, words: [{start,end}], fadeStart, fadeEnd }
export function layoutQuoteReveals(quotes, cfg) {
  // Starts once "clear" + people/bubble fade-in finish; slices the remainder.
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

// Same idea as layoutQuoteReveals's per-word stagger, generalised for
// items of uneven "weight" (how much of the range a bigger beat — an
// icon, a phrase — should claim versus a plain word) and for App.svelte's
// HTML-rendered reveals rather than ChartSvg's own SVG text. Contiguous,
// non-overlapping slices sized by weight. Returns [{start, end}] parallel
// to `weights`.
export function layoutWeightedReveal(weights, range) {
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const rangeLen = range.end - range.start;
  let cursor = range.start;
  return weights.map((w) => {
    const start = cursor;
    const end = start + (w / total) * rangeLen;
    cursor = end;
    return { start, end };
  });
}

// Grid of tiles anchored bottom-left, wrapping upward, centred in a
// reserved bottom band. Returns one {x, y} centre per index.
export function cornerGridTargets({ count, tileSize, gap, width, height, edgeMargin, bottomMargin = 0 }) {
  const perRow = Math.max(1, Math.floor((width - edgeMargin * 2 + gap) / (tileSize + gap)));
  const rows = Math.ceil(count / perRow);
  const blockHeight = rows * tileSize + (rows - 1) * gap;

  // Bottom band tall enough for breathing room, any row count. bottomMargin
  // (Bryony: ~2/3 a tile's height, on mobile) lifts the whole band clear of
  // the screen's bottom edge, since the band's own margin wasn't enough.
  const bottomBand = Math.max(tileSize + 40, 90);
  const bandCenterY = height - bottomMargin - bottomBand / 2;
  const bottomRowY = bandCenterY + blockHeight / 2 - tileSize / 2;

  // Each row centred on its own width, so the block reads centred.
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
