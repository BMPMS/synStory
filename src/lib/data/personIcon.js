// Placeholder person icon (Font Awesome "user", regular) — used for all
// 5 quote-people until Bryony swaps in real artwork one at a time. Same
// shape as senseIcons.js: a single monochrome path + its viewBox.
//
// headCropHeight marks where the head/neck ends and the shoulders begin,
// in this icon's own viewBox units (not fractional) — used to crop to
// "just the head" when there isn't enough vertical room for the whole
// figure (see layoutPeopleBubble in ChartSvg.svelte).
export const personIcon = {
  viewBox: '0 0 640 640',
  headCropHeight: 340,
  path: 'M240 192C240 147.8 275.8 112 320 112C364.2 112 400 147.8 400 192C400 236.2 364.2 272 320 272C275.8 272 240 236.2 240 192zM448 192C448 121.3 390.7 64 320 64C249.3 64 192 121.3 192 192C192 262.7 249.3 320 320 320C390.7 320 448 262.7 448 192zM144 544C144 473.3 201.3 416 272 416L368 416C438.7 416 496 473.3 496 544L496 552C496 565.3 506.7 576 520 576C533.3 576 544 565.3 544 552L544 544C544 446.8 465.2 368 368 368L272 368C174.8 368 96 446.8 96 544L96 552C96 565.3 106.7 576 120 576C133.3 576 144 565.3 144 552L144 544z'
};
