// Made-up colour picks for previewing the Battery Test's result screens
// without taking the test (add ?preview=high to test.html — see the end of
// TestApp.svelte's script). Fixed seeds, so each preview is always the same.
// Nothing here is ever saved.
import { GRAPHEMES } from './graphemeTest.js';

function seededRandom(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (channels) =>
  '#' +
  channels
    .map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0'))
    .join('');

// kind: 'high' (scores about 0.45), 'fair' (about 1.28), 'variable' (about
// 2.0), or 'similar' (the same colour for everything, which the variety
// guard catches).
const SETTINGS = {
  high: { seed: 7, jitter: 0.12 },
  fair: { seed: 11, jitter: 0.4 },
  variable: { seed: 5, jitter: null },
  similar: { seed: 3, jitter: 0.03 }
};

export function previewResponses(kind) {
  const { seed, jitter } = SETTINGS[kind];
  const random = seededRandom(seed);
  const responses = {};
  GRAPHEMES.forEach((grapheme) => {
    const base = kind === 'similar' ? [0.5, 0.55, 0.6] : [random(), random(), random()];
    responses[grapheme] = [0, 1, 2].map(() =>
      hex(jitter == null ? [random(), random(), random()] : base.map((v) => v + (random() - 0.5) * 2 * jitter))
    );
  });
  return responses;
}

export const PREVIEW_KINDS = Object.keys(SETTINGS);
