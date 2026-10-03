// The 4 brain regions for step9 ("Is synaesthete brain activity
// different?" — Rouw & Scholte 2007). Bryony's own research: real MNI
// coordinates (x/y/z) are kept here for reference/future use, but the
// scene currently only reads screenX/screenY (already researched,
// ballpark-placed % position on brainIcon.js's own 640x640 viewBox —
// see ChartSvg.svelte's layoutBrain()), volume and effect. Bryony:
// "will tell you more once this is done" — expect this file to change.
export const brainRegions = [
  {
    region: 'Superior frontal',
    hemisphere: 'Left',
    x: -20,
    y: -25,
    z: 55,
    volume: 53,
    effect: 3.7,
    screenX: 39,
    screenY: 30
  },
  {
    region: 'Superior frontal',
    hemisphere: 'Right',
    x: 21,
    y: -21,
    z: 57,
    volume: 100,
    effect: 4.4,
    screenX: 61,
    screenY: 29
  },
  {
    region: 'Superior parietal',
    hemisphere: 'Left',
    x: -17,
    y: -61,
    z: 55,
    volume: 44,
    effect: 4.8,
    screenX: 38,
    screenY: 42
  },
  {
    region: 'Inferior temporal',
    hemisphere: 'Right',
    x: 36,
    y: -40,
    z: -21,
    volume: 67,
    effect: 4.8,
    screenX: 67,
    screenY: 69
  }
];
