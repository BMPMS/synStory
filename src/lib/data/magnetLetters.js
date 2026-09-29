// Bryony: "how about making your own version of the fisher price magnet
// box with our header font?" (step10) — the 26 letters, in reading order,
// each carrying the accent colour it cycles through. Same 6-colour
// Fisher-Price-mapped list step3's sense icons use (theme.js's own
// accents), just not skipping yellow this time — there's no adjacent-icon
// clash to avoid here, and the real reference photo's own letters do
// repeat yellow throughout.
import { colors } from '../theme.js';

const palette = [colors.red, colors.orange, colors.yellow, colors.green, colors.blue, colors.purple];

export const magnetLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter, i) => ({
  letter,
  color: palette[i % palette.length]
}));

// Row lengths, left to right, top to bottom — mirrors the real photo's own
// tray (7, 7, 6, 6 — a 7-column tray with the last row-and-a-bit left
// short) rather than a perfectly even grid.
export const magnetRowLengths = [7, 7, 6, 6];
