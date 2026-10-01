// The battery test's own logic — deliberately kept separate from
// TestApp.svelte (same split as the story's own data/ files vs
// ChartSvg.svelte) so the trial sequence, colour maths and scoring can be
// read/checked/changed on their own, independent of the UI.
//
// Test format: the standard grapheme-colour CONSISTENCY design used by
// real synaesthesia batteries (e.g. synesthete.org's Synesthesia Battery,
// Eagleman et al.) — each of the 26 letters + 10 digits is shown 3 times,
// in random order (never twice in a row, so a repeat is never just
// answered from short-term memory of the previous trial), and the
// subject picks whatever colour feels right for it each time. Someone
// with grapheme-colour synaesthesia tends to pick close to the same
// colour for a given letter every time; someone without it tends to
// pick fairly different colours across the 3 rounds. The distance
// between a person's own 3 picks for each grapheme — averaged over all
// 36 — is the "consistency score" this file computes.

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const DIGITS = '0123456789'.split('');
export const GRAPHEMES = [...LETTERS, ...DIGITS]; // 36
export const REPEATS_PER_GRAPHEME = 3;

// Fisher-Yates, reshuffled whenever it lands two of the same grapheme
// back to back. `random` is injectable so this stays testable.
export function buildTrialSequence(random = Math.random) {
  const pool = [];
  GRAPHEMES.forEach((grapheme) => {
    for (let i = 0; i < REPEATS_PER_GRAPHEME; i++) pool.push(grapheme);
  });

  function shuffleOnce(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function hasAdjacentRepeat(arr) {
    return arr.some((g, i) => i > 0 && arr[i - 1] === g);
  }

  let sequence = shuffleOnce(pool);
  let attempts = 0;
  while (hasAdjacentRepeat(sequence) && attempts < 500) {
    sequence = shuffleOnce(pool);
    attempts++;
  }
  return sequence;
}

// --- Colour maths -----------------------------------------------------
// sRGB -> linear -> CIE XYZ (D65) -> CIELab, then plain Euclidean
// distance in Lab (CIE76 ∆E) — the simplest perceptually-reasonable
// distance for this purpose; no need for CIE94/CIEDE2000's extra
// correction terms at this scale.

function srgbChannelToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function labF(t) {
  const delta = 6 / 29;
  return t > delta ** 3 ? Math.cbrt(t) : t / (3 * delta ** 2) + 4 / 29;
}

export function hexToLab(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const [rl, gl, bl] = [r, g, b].map(srgbChannelToLinear);

  // sRGB (D65) -> XYZ
  const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  const z = rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041;

  // D65 reference white
  const xn = 0.95047,
    yn = 1.0,
    zn = 1.08883;
  const fx = labF(x / xn),
    fy = labF(y / yn),
    fz = labF(z / zn);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz)
  };
}

export function labDistance(c1, c2) {
  return Math.sqrt((c1.L - c2.L) ** 2 + (c1.a - c2.a) ** 2 + (c1.b - c2.b) ** 2);
}

function mean(nums) {
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

// responsesByGrapheme: { [grapheme]: [hex, hex, hex] } — 3 picks per
// grapheme, in the order they were made.
export function scoreConsistency(responsesByGrapheme) {
  const perGrapheme = GRAPHEMES.map((grapheme) => {
    const colors = responsesByGrapheme[grapheme] || [];
    const labs = colors.map(hexToLab);
    const centroid = {
      L: mean(labs.map((c) => c.L)),
      a: mean(labs.map((c) => c.a)),
      b: mean(labs.map((c) => c.b))
    };
    const meanDistance = mean(labs.map((c) => labDistance(c, centroid)));
    return { grapheme, colors, meanDistance };
  });
  const overallScore = mean(perGrapheme.map((p) => p.meanDistance));
  return { perGrapheme, overallScore };
}

// Deliberately descriptive, not diagnostic — these bands are a rough,
// approximate read on the score for an engaging result screen, not a
// clinical cutoff. Real batteries validate their own thresholds against
// a studied population; this one hasn't been, and says so on screen.
// "grapheme-colour" is the field's term for it; "letters + numbers ->
// colour" is the plain-English version used everywhere user-facing (and
// bolded wherever it's rendered as HTML) — split into detailBefore/
// detailBold/detailAfter so the results screen can bold it with a real
// <strong>, not string interpolation.
const LETTERS_NUMBERS_COLOUR = 'letters + numbers → colour';

export function describeConsistency(overallScore) {
  if (overallScore < 8) {
    return {
      label: 'Highly consistent',
      detailBefore:
        'Your colour choices for the same letter or number stayed remarkably close across all three rounds — the kind of result many people with ',
      detailBold: LETTERS_NUMBERS_COLOUR,
      detailAfter: ' synaesthesia show.'
    };
  }
  if (overallScore < 20) {
    return {
      label: 'Fairly consistent',
      detailBefore:
        'Your colour choices were noticeably steadier than chance across the three rounds — somewhat more consistent than most people without ',
      detailBold: LETTERS_NUMBERS_COLOUR,
      detailAfter: ' synaesthesia tend to be.'
    };
  }
  return {
    label: 'Variable',
    detailBefore:
      'Your colour choices varied a fair bit across the three rounds — the typical pattern for people who don’t experience letters or numbers as having an inherent colour.',
    detailBold: null,
    detailAfter: ''
  };
}
