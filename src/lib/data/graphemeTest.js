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
  const variety = checkColourVariety(responsesByGrapheme);
  return { perGrapheme, overallScore, variety, lowVariety: variety.tooSimilar };
}

// Variety guard. Consistency alone can't tell a real grapheme-colour
// synaesthete from someone who simply picks (about) the same colour for
// everything — that scores a perfect 0. The research tooling for these tests
// (the synr R package) guards against it by flagging anyone who gave roughly
// the same colour on more than 60% of trials, or who used fewer than 3
// clearly different colours. This is the same idea, in Lab distance: two
// picks within VARIETY_SAME_DISTANCE of each other count as "roughly the same
// colour".
const VARIETY_SAME_DISTANCE = 25;
const MAX_SAME_COLOUR_SHARE = 0.6;
const MIN_DISTINCT_COLOURS = 3;
const MIN_PICKS_FOR_A_COLOUR = 4; // a lone stray pick doesn't make a colour

export function checkColourVariety(responsesByGrapheme) {
  const labs = GRAPHEMES.flatMap((g) => (responsesByGrapheme[g] || []).map(hexToLab));
  if (!labs.length) return { tooSimilar: false, biggestShare: 0, distinctColours: 0 };

  // Biggest share of picks that are all roughly one colour.
  let biggest = 0;
  for (const centre of labs) {
    const near = labs.filter((c) => labDistance(c, centre) <= VARIETY_SAME_DISTANCE).length;
    if (near > biggest) biggest = near;
  }
  const biggestShare = biggest / labs.length;

  // How many clearly different colours were used (greedy grouping).
  const groups = [];
  for (const c of labs) {
    const group = groups.find((g) => labDistance(g.lab, c) <= VARIETY_SAME_DISTANCE);
    if (group) group.count += 1;
    else groups.push({ lab: c, count: 1 });
  }
  const distinctColours = groups.filter((g) => g.count >= MIN_PICKS_FOR_A_COLOUR).length;

  return {
    tooSimilar: biggestShare > MAX_SAME_COLOUR_SHARE || distinctColours < MIN_DISTINCT_COLOURS,
    biggestShare,
    distinctColours
  };
}

// Shown instead of a consistency band when the guard above trips.
export function describeLowVariety() {
  return {
    label: 'Not enough variety',
    detailBefore:
      'Most of your colours were similar, so we can’t score consistency.',
    detailBold: null,
    detailAfter: ''
  };
}

// Deliberately descriptive, not diagnostic — these bands are a rough,
// approximate read on the score for an engaging result screen, not a
// clinical cutoff. Real batteries validate their own thresholds against
// a studied population; this one hasn't been, and says so on screen.
// detailBefore/detailBold/detailAfter let the results screen bold a phrase
// with a real <strong>; currently none of the bands use it.

export function describeConsistency(overallScore) {
  if (overallScore < 8) {
    return {
      label: 'Highly consistent',
      detailBefore: 'Your colours barely changed — likely you’re a grapheme → colour synaesthete.',
      detailBold: null,
      detailAfter: ''
    };
  }
  if (overallScore < 20) {
    return {
      label: 'Fairly consistent',
      detailBefore: 'Steadier than chance and more consistent than most people.',
      detailBold: null,
      detailAfter: ''
    };
  }
  return {
    label: 'Variable',
    detailBefore: 'Your colours shifted a fair bit — likely you don’t have synaesthesia.',
    detailBold: null,
    detailAfter: ''
  };
}

// --- Speed congruency test ---------------------------------------------
// Second half of the battery, after the colour test above. Each of the 36
// graphemes is shown once, with SPEED_OPTIONS colour swatches underneath;
// the subject taps the colour THEY picked for it earlier, as fast as they
// can. The correct swatch is that person's own colour for the grapheme (so
// there's no fixed palette to be wrong about); the other swatches are
// their own colours for other graphemes. Someone whose colours are
// automatic and stable tends to be both quick and accurate; someone who
// was guessing in the colour test has to remember, so is slower and gets
// more wrong.
export const SPEED_OPTIONS = 6;
// Two swatches closer than this (CIE76 ∆E) look the same, so tapping
// either counts as correct.
const SAME_COLOUR_DISTANCE = 6;

function shuffled(arr, random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A grapheme's "own" colour: whichever of its picks sits closest to the
// others (the medoid), so it's always a colour the person really chose.
export function ownColourFor(colors) {
  if (!colors || !colors.length) return '#888888';
  const labs = colors.map(hexToLab);
  let best = 0;
  let bestSum = Infinity;
  labs.forEach((lab, i) => {
    const sum = labs.reduce((acc, other) => acc + labDistance(lab, other), 0);
    if (sum < bestSum) {
      bestSum = sum;
      best = i;
    }
  });
  return colors[best];
}

// responsesByGrapheme: same shape as scoreConsistency's input.
// Returns [{ grapheme, options: [hex x SPEED_OPTIONS], correctIndex }].
export function buildSpeedTrials(responsesByGrapheme, random = Math.random) {
  const own = {};
  GRAPHEMES.forEach((g) => {
    own[g] = ownColourFor(responsesByGrapheme[g]);
  });
  const labs = {};
  GRAPHEMES.forEach((g) => {
    labs[g] = hexToLab(own[g]);
  });

  return shuffled(GRAPHEMES, random).map((grapheme) => {
    const target = labs[grapheme];
    const candidates = shuffled(
      othersThan(grapheme),
      random
    );
    // Prefer distractors that are clearly different from the answer and
    // from each other; relax if this person's colours are all similar.
    const chosen = [];
    for (const [minFromTarget, minFromEachOther] of [
      [14, 8],
      [8, 4],
      [0, 0]
    ]) {
      for (const g of candidates) {
        if (chosen.length >= SPEED_OPTIONS - 1) break;
        if (chosen.includes(g)) continue;
        if (labDistance(labs[g], target) < minFromTarget) continue;
        if (chosen.some((c) => labDistance(labs[c], labs[g]) < minFromEachOther)) continue;
        chosen.push(g);
      }
    }
    const options = shuffled([own[grapheme], ...chosen.map((g) => own[g])], random);
    return { grapheme, options, correctIndex: options.indexOf(own[grapheme]) };
  });
}

function othersThan(grapheme) {
  return GRAPHEMES.filter((g) => g !== grapheme);
}

export function isSpeedAnswerCorrect(trial, clickedIndex) {
  if (clickedIndex === trial.correctIndex) return true;
  const answer = hexToLab(trial.options[trial.correctIndex]);
  return labDistance(hexToLab(trial.options[clickedIndex]), answer) < SAME_COLOUR_DISTANCE;
}

function median(nums) {
  if (!nums.length) return null;
  const s = nums.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// answers: [{ grapheme, correct, rt }] with rt in milliseconds.
export function scoreSpeed(answers) {
  const correctRts = answers.filter((a) => a.correct).map((a) => a.rt);
  return {
    total: answers.length,
    correctCount: answers.filter((a) => a.correct).length,
    accuracy: answers.length ? answers.filter((a) => a.correct).length / answers.length : 0,
    medianMs: median(correctRts)
  };
}

// Informal, like describeConsistency — chance here is 1 in SPEED_OPTIONS
// (about 17% correct), and these bands haven't been validated against a
// studied population.
export function describeSpeed({ accuracy, medianMs }) {
  const seconds = medianMs == null ? null : medianMs / 1000;
  if (accuracy >= 0.85 && seconds != null && seconds < 2.5) {
    return {
      label: 'Quick and accurate',
      detail:
        'You found your own colour for almost every letter and number, and fast — the pattern researchers expect when the colours really are automatic.'
    };
  }
  if (accuracy >= 0.85) {
    return {
      label: 'Accurate, but deliberate',
      detail:
        'You found your own colours almost every time, but took a moment to think. Plenty of people who remember their choices do the same.'
    };
  }
  if (accuracy >= 0.5) {
    return {
      label: 'Mixed',
      detail:
        'You remembered a good share of your colours, but not all of them — somewhere between guessing and knowing.'
    };
  }
  return {
    label: 'Hard to recall',
    detail:
      'Your own colours were hard to pick back out. That is the typical pattern when the colours were guesses rather than something automatic.'
  };
}
