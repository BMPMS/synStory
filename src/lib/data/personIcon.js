// Placeholder person icon (Font Awesome "user", SOLID — Bryony supplied
// this one directly, replacing the earlier "regular" variant, which read
// as a thin outline/stroke even though it was filled: the regular style
// draws the figure as thin bands, this one as a real solid silhouette).
// Used for all 5 quote-people + the 36 step9 participant icons, until
// Bryony swaps in real artwork one at a time. Same shape as
// senseIcons.js: a single monochrome path + its viewBox.
//
// headCropHeight marks where the head/neck ends and the shoulders begin,
// in this icon's own viewBox units (not fractional) — used to crop to
// "just the head" when there isn't enough vertical room for the whole
// figure (see layoutPeopleBubble in ChartSvg.svelte). The solid icon's
// own head circle bottoms out at y=312 — 340 still clears it with a
// touch of neck, same as it did for the old icon.
export const personIcon = {
  viewBox: '0 0 640 640',
  headCropHeight: 340,
  path: 'M320 312C386.3 312 440 258.3 440 192C440 125.7 386.3 72 320 72C253.7 72 200 125.7 200 192C200 258.3 253.7 312 320 312zM290.3 368C191.8 368 112 447.8 112 546.3C112 562.7 125.3 576 141.7 576L498.3 576C514.7 576 528 562.7 528 546.3C528 447.8 448.2 368 349.7 368L290.3 368z'
};
