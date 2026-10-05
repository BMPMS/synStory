<script>
  import * as d3 from 'd3';
  import forceBounce from 'd3-force-bounce';
  import forceSurface from 'd3-force-surface';
  import {
    phase,
    lerp,
    cornerGridTargets,
    step1,
    step2,
    step3,
    step4,
    step5,
    step6,
    step7,
    step9,
    step10,
    step11,
    step12,
    windPhase,
    layoutQuoteReveals
  } from '../steps.js';
  import { colors, spacing, typeScale, breakpoints } from '../theme.js'; // theme's --text-caption/--text-lead CSS vars carry the type scale
  import { senseIcons } from '../data/senseIcons.js';
  import { quotes } from '../data/quotes.js';
  import { personIcon } from '../data/personIcon.js'; // placeholder icon for the step 9 participants, real art later
  import { quotePersonIcons, quotePersonIconSize } from '../data/quotePersonIcons.js'; // the 5 quote-people (steps 4-5)
  import { sightSubIcons } from '../data/sightSubIcons.js'; // sight's 3 sub-icons, step 5
  import { synaesthesiaLinks } from '../data/synaesthesiaLinks.js'; // who has which cross-sense association (step 6)
  import { famousQuotes } from '../data/famousQuotes.js'; // one quote per person, shown in the hover panel under the diagram
  import {
    publicationsByDecade,
    publicationsMinYear,
    publicationsMaxYear,
    publicationsByDecadeMaxCount
  } from '../data/publications.js'; // PubMed counts binned into decades, step 7
  import { brainIcon } from '../data/brainIcon.js'; // Bryony's own brain-solid-full.svg upload (step 9)
  import { brainRegions } from '../data/brainRegions.js'; // 4 researched regions, ballpark-placed on brainIcon's own viewBox (step 9)
  import { magnetLetters, magnetRowLengths } from '../data/magnetLetters.js'; // step10's own drawn mock-up of Bryony's Fisher-Price reference photo
  import { magnetResponses, nUsers, codeColor, inYobFilter } from '../data/magnetResponses.js'; // step11's per-respondent match data (see that file's own header comment)

  // Bryony: aggregate tooltip text across all of a person's edges, step 6.
  function senseDisplayLabel(key) {
    const subIcon = sightSubIcons.find((s) => s.key === key);
    return subIcon ? subIcon.label : key; // senseIcons.js's own labels (sound/taste/smell/touch) already match the edge keys directly
  }
  // Bryony: reverseLabel flips the text only, not the edge/arrow itself.
  function personRelationships(name) {
    return synaesthesiaLinks
      .filter((e) => e.people.some((p) => p.name === name))
      .map((e) => {
        const p = e.people.find((p) => p.name === name);
        const from = p.reverseLabel ? e.to : e.from;
        const to = p.reverseLabel ? e.from : e.to;
        return {
          text: `${senseDisplayLabel(from)} → ${senseDisplayLabel(to)}`,
          fromLabel: senseDisplayLabel(from),
          toLabel: senseDisplayLabel(to),
          fromKey: from,
          toKey: to,
          edgeKey: `${e.from}-${e.to}`
        };
      });
  }

  let {
    people,
    headerText = null, // shown until it fades out; tiles are kept clear of it
    answer = null, // { lead, syn, aesthesia } — omit to render tiles with no reveal text
    progress = 0, // 0–1, drives the header/answer/tiles reveal — see steps.js
    etymologyProgress = 0, // 0–1, drives the SYN/AESTHESIA "Latin for" beats (step2)
    titleProgress = 0, // 0–1, drives SYNAESTHESIA rising into the header slot, the senses
    // line + icons, and the closing lines (step3)
    quotesProgress = 0, // 0–1, drives the 5 quotes revealing word by word (step4)
    sightProgress = 0, // 0–1, drives the post-quotes consolidation onto sight (step5)
    linksProgress = 0, // 0–1, drives the relationship arrows + photo fans, once sight has settled (step6)
    publicationsProgress = 0, // 0–1, drives the everything-fades-out + publications line/area chart (step7)
    brainProgress = 0, // 0–1, drives the publications chart fading out + the new brain-regions scene (step9)
    connectionsProgress = 0, // 0–1, drives the brain scene fading out + the new "when do connections form?" scene (step10)
    heatmapProgress = 0, // 0–1, drives the tray fading out + the magnet letters moving onto a ring + the per-respondent heatmap/bar morph (step11)
    whyICareProgress = 0, // 0–1, drives the connections/heatmap ring clearing + the "Why do I care?" title taking its place (step12)
    tileSizeFor = (w) => (w < 420 ? 62 : w < 800 ? 79 : 101),
    edgeMargin = 6,
    labelOffset = 12,
    ariaLabel = 'Portraits of well-known people, drifting and bouncing gently within the frame.'
  } = $props();

  // Wraps text onto tspans, measuring the real rendered element. Optional
  // boldWords (a Set) renders matching words bold within the wrapped lines.
  function wrap(textSelection, width, fontSize, boldWords) {
    textSelection.each(function () {
      const text = d3.select(this);
      const words = text.text().split(/\s+/).reverse();
      const x = text.attr('x');
      const y = text.attr('y');
      const setLine = (el, lineWords) => {
        if (!boldWords) {
          el.text(lineWords.join(' '));
          return;
        }
        el.text(null);
        lineWords.forEach((w, i) => {
          el.append('tspan')
            .style('font-weight', boldWords.has(w) ? 700 : null)
            .text(i === 0 ? w : ` ${w}`);
        });
      };
      let word;
      let line = [];
      let tspan = text.text(null).append('tspan').attr('x', x).attr('y', y).attr('dy', 0);

      while ((word = words.pop())) {
        line.push(word);
        setLine(tspan, line);
        if (tspan.node().getComputedTextLength() > width) {
          line.pop();
          setLine(tspan, line);
          line = [word];
          if (word.trim() !== '') {
            if (tspan.text().trim() === '') {
              setLine(tspan, line);
            } else {
              // Fix: only the first tspan gets an explicit y (which resets
              // the SVG baseline); every later line advances via dy alone.
              tspan = text.append('tspan').attr('x', x).attr('dy', fontSize);
              setLine(tspan, line);
            }
          }
        }
      }
    });
  }

  // Bubble tail curve, reverse-engineered from Bryony's reference SVGs;
  // scales with bubble height, mirrored for the left half.
  const TAIL_RIGHT = [
    [28.138, 0.478], [25.118, 1.296], [22.583, 2.455],
    [18.317, 4.405], [15.402, 7.318], [13.452, 11.212],
    [11.452, 15.714], [9.473, 20.915], [7.335, 25.945],
    [5.209, 30.948], [2.942, 35.743], [0.407, 39.291]
  ];
  const TAIL_LEFT = [
    [-2.942, 35.743], [-5.209, 30.948], [-7.335, 25.945],
    [-9.473, 20.914], [-11.452, 15.714], [-13.453, 11.212],
    [-15.403, 7.319], [-18.317, 4.405], [-22.583, 2.455],
    [-25.118, 1.296], [-28.138, 0.478], [-31.727, 0]
  ];
  const ICON_GAP_BELOW_TAIL = 20; // px from the bottom of the bubble's tail to the top of the quote-people icons
  const TAIL_HALF_SPAN = 31.727; // how far the tail's curve reaches out from its own apex, at reference scale

  // On narrow screens the bubble is capped to the screen width, so a full-size
  // corner (r) + tail half-span can't fit between the bubble's edge and the
  // outer icons, and the tail would stop short of sitting above them.
  // layoutPeopleBubble() sets these two caps so the tail can still reach the
  // outermost icons (Infinity = no cap, e.g. desktop): the corners shrink
  // more than the tail does, so the tail keeps most of its size.
  let bubbleCornerCap = Infinity;
  let bubbleTailCap = Infinity;
  const bubbleCornerScale = (h) => Math.min(h / 202, bubbleCornerCap);
  const bubbleTailScale = (h) => Math.min(h / 202, bubbleTailCap);

  // Bubble with a tail; personT (0-1) positions it left-right.
  function bubblePersonPath(x, y, w, h, personT) {
    const scale = bubbleTailScale(h); // the reference design's own box height is 202
    const cornerScale = bubbleCornerScale(h);
    const r = 50 * cornerScale;
    const kappa = 27.614 * cornerScale; // same circular-bezier constant the reference corners use

    const left = x;
    const right = x + w;
    const top = y;
    const bottom = y + h;

    const halfTailSpan = TAIL_HALF_SPAN * scale;
    const safeLeft = left + r + halfTailSpan;
    const safeRight = Math.max(safeLeft, right - r - halfTailSpan);
    const tailX = lerp(safeLeft, safeRight, personT);

    // Bryony: tail/pointer half the height — only the vertical reach is
    // compressed (dy), width/shape in x is untouched.
    const tailHeightScale = 0.5;
    const P = (dx, dy) => `${(tailX + dx * scale).toFixed(2)} ${(bottom + dy * scale * tailHeightScale).toFixed(2)}`;
    const curveCommands = (points) => {
      const out = [];
      for (let i = 0; i < points.length; i += 3) {
        const [c1, c2, end] = points.slice(i, i + 3);
        out.push(`C ${P(...c1)} ${P(...c2)} ${P(...end)}`);
      }
      return out.join(' ');
    };

    return [
      `M ${right - r} ${top}`,
      `C ${right - r + kappa} ${top} ${right} ${top + r - kappa} ${right} ${top + r}`,
      `V ${bottom - r}`,
      `C ${right} ${bottom - r + kappa} ${right - r + kappa} ${bottom} ${right - r} ${bottom}`,
      `H ${(tailX + halfTailSpan).toFixed(2)}`,
      curveCommands(TAIL_RIGHT),
      `L ${P(0, 39.86)}`,
      `L ${P(-0.407, 39.291)}`,
      curveCommands(TAIL_LEFT),
      `H ${left + r}`,
      `C ${left + r - kappa} ${bottom} ${left} ${bottom - r + kappa} ${left} ${bottom - r}`,
      `V ${top + r}`,
      `C ${left} ${top + r - kappa} ${left + r - kappa} ${top} ${left + r} ${top}`,
      `H ${right - r}`,
      'Z'
    ].join(' ');
  }

  // Inverse of bubblePersonPath's tail placement — finds the personT
  // that points the tail at targetX.
  function personTForX(targetX, bx, bw, bh) {
    const scale = bubbleTailScale(bh);
    const r = 50 * bubbleCornerScale(bh);
    const halfTailSpan = TAIL_HALF_SPAN * scale;
    const safeLeft = bx + r + halfTailSpan;
    const safeRight = Math.max(safeLeft, bx + bw - r - halfTailSpan);
    if (safeRight <= safeLeft) return 0.5;
    return Math.max(0, Math.min(1, (targetX - safeLeft) / (safeRight - safeLeft)));
  }

  let container;
  let svgEl;

  // Lets the scroll-tick effect drive the scene without rebuilding it.
  let sceneApi = null;

  $effect(() => {
    const svg = d3.select(svgEl);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bottomMargin = labelOffset + 26;
    const nodes = people.map((d) => ({ ...d }));

    let width = 0;
    let height = 0;
    let TILE;
    let CORNER;
    let R;
    let simulation;
    let personGroups;
    // How far tiles must clear the header, set by layoutHeader().
    let topMargin = edgeMargin;
    // Set by setRevealProgress(); read by positionNodes() for step1's blend.
    let currentProgress = 0;
    // Set by setLinksProgress(); read by positionNodes() to fade linked tiles.
    let linksRevealT = 0;
    // Drives linked-tile shrink/fade, tied to the photo fly-in (step 6).
    let tileShrinkT = 0;
    // Raw step5 t (Step 6 on-screen) — photos fly into their link
    // positions during this step, not step6, so the tooltip's mode
    // switch needs to watch this progress, not linksProgress.
    let sightT = 0;
    // Mirrors setSightProgress()'s stagger, so resize mid-scroll stays correct.
    let sightRevealT = 0;

    // The 3 .sightLabel texts in sequence, kept as named constants so
    // layoutSight() and the progress setters always agree on wording.
    // Bryony: Step 6 now keeps ONE header for its whole length (the old
    // "SIGHT splits into 3 sub groups" line moved into the scrolling
    // captions in App.svelte), so the 'split' and 'famous' stages share it.
    const sightFamousText = 'So what about our famous synaesthetes?';
    const sightSplitText = sightFamousText;
    // Which of the 3 texts was last set — same pattern as linksRevealT.
    // One of 'split' | 'famous' (Bryony: no 'closing' header any more — the
    // same title now stays through Step 7).
    let sightHeaderStage = 'split';
    let sightLabelFontSize = 18;
    let sightLabelWrapWidth = 0;
    // step3: senses vs plain lead
    let leadTextShowingSenses = false;
    // step3: extra Y added to etymLeadY only in senses mode, so the whole
    // lead+icons+closing block can be recentred without moving the plain
    // intro lead text. Computed by centerSensesBlock().
    let sensesYShift = 0;

    // step3: senses lead line (needs svg, so lives in this scope not top-level)
    function renderSensesLeadText(baseY) {
      svg.select('.leadText').attr('y', baseY).text(step3.senses.text);
    }
    let cornerTargets = [];
    const cornerGap = 10;
    // Header's top inset, reused wherever something sits "at header height".
    const topPadding = 40;
    // Stable resting position for setEtymologyProgress()/setTitleProgress()
    // to animate from (not the live, often-animating attrs).
    let etymSynX = 0;
    let etymSynWidth = 0;
    let etymAesthesiaWidth = 0;
    let etymWordBaselineY = 0;
    let etymWordFontSize = 0;

    // Where SYNAESTHESIA + "What is" land once step 3's title move finishes.
    let titleFontSize = 0;
    let titleY = 0;
    let whatIsX = 0;
    let synTitleX = 0;
    let aesthesiaTitleX = 0;
    // Set by layoutAnswer() — where the reused lead-text line sits.
    let etymLeadY = 0;
    let etymLeadFontSize = 0;

    // 5 sense icons, join-once; layoutSenses() positions, progress setters animate.
    const iconNodes = senseIcons.map((d) => ({ ...d, x: 0, y: 0, scale: 1, color: colors.text, opacity: 0, flash: 0, riseAmt: 0 }));
    let senseGroups;

    // One per quote, join-once; x set by layoutPeopleBubble(), read by
    // setQuotesProgress() to aim the bubble's tail.
    const personIconNodes = quotes.map((_, i) => ({ icon: quotePersonIcons[i % quotePersonIcons.length], x: 0, y: 0, scale: 1, cropped: false }));
    let personIconGroups;

    // Step 9: 36 participant icons, 18 synaesthetes + 18 controls, colour
    // picked once (cosmetic only).
    const participantNodes = Array.from({ length: 36 }, (_, i) => ({
      group: i < 18 ? 'synaesthete' : 'control',
      index: i < 18 ? i : i - 18,
      color: i < 18 ? step3.icons.colors[Math.floor(Math.random() * step3.icons.colors.length)] : colors.grey,
      x: 0,
      y: 0,
      scale: 1,
      cropped: false
    }));
    let participantIconGroups;

    // Fixed for the whole brain step, per Bryony — study details now
    // scroll past as separate step text blocks (see App.svelte) instead.
    const brainQuestionText = 'Is synaesthete brain activity different?';
    // Real rendered icon-row bounds, from layoutSenses(), used by layoutClosing().
    let iconsTopY = 0;
    let iconsBottomY = 0;
    // How far the icon row rises in step4.clear, from layoutSenses().
    let iconsRiseBy = 0;
    // Risen row's resting Y; layoutSight() reuses it as the ring centre.
    let senseRestY = 0;
    // Real top edge of the tile cluster, reused as the ring's lower bound.
    let tilesTopY = 0;

    // Set by layoutClosing() every resize — where the quotes below it
    // should start.
    let closingSubY = 0;
    let quotesStartY = 0;

    // Bubble box, set by layoutPeopleBubble(); setQuotesProgress() redraws
    // just the tail each tick.
    let bubbleX = 0;
    let bubbleY = 0;
    let bubbleW = 0;
    let bubbleH = 0;

    // Quote reveal timing, computed once from the quotes data (step4).
    const quotesLayout = layoutQuoteReveals(quotes, step4);

    // Progress values where each sense's icon should "flash", from quotesLayout.
    const senseFlashCenters = {};
    quotes.forEach((quote, qi) => {
      quote.words.forEach((w, wi) => {
        if (!w.sense) return;
        const center = quotesLayout[qi].words[wi].end;
        (senseFlashCenters[w.sense] ||= []).push(center);
      });
    });

    // Maps each sense to its icon's Fisher-Price colour, for quote-word tinting.
    const senseColors = Object.fromEntries(
      senseIcons.map((s, i) => [s.label, step3.icons.colors[i % step3.icons.colors.length]])
    );

    let quotesGroups;

    // 3 sight sub-icons, join-once; layoutSight() positions and fades them in.
    const sightSubIconNodes = sightSubIcons.map((d) => {
      const [, , vbW, vbH] = d.viewBox.split(' ').map(Number);
      return { ...d, vbW, vbH, x: 0, y: 0, scale: 1 };
    });
    let sightSubIconGroups;

    // One node per (edge, person) photo; layoutLinks()/setLinksProgress()
    // fill in position (start = shared per person, end = per edge).
    const linkPhotoNodes = synaesthesiaLinks.flatMap((e) =>
      e.people.map((p, i) => ({
        from: e.from,
        to: e.to,
        edgeKey: `${e.from}-${e.to}`,
        index: i,
        count: e.people.length,
        name: p.name,
        image: p.image,
        x: 0,
        y: 0,
        rotation: 0,
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0,
        endRotation: 0
      }))
    );
    // Bryony: photos travel from a person's own settled tile position.
    const personIndexByName = new Map(people.map((p, i) => [p.name, i]));
    // Bryony: linked people's tiles shrink/fade as their photos fly off.
    const linkedPersonNames = new Set(synaesthesiaLinks.flatMap((e) => e.people.map((p) => p.name)));
    let linkGroups;
    let linkPhotoGroups;

    // Step7 x-ticks: a FIXED array (data-joined once) — must never need
    // to shrink, since a join's exit branch would remove elements.
    // Bryony: min/max year as the first/last ticks, plus round decades
    // in between — 20 years apart normally, widened to 40 on a mobile-width
    // chart, where 20-year spacing crowded the labels into each other.
    function computeXTickValues(w) {
      const values = [publicationsMinYear];
      const firstRoundXTick = Math.ceil(publicationsMinYear / 10) * 10;
      // Bryony: drop a round tick within 10 years of either endpoint.
      const xTickEdgeGuard = 10;
      const step = w < 600 ? 40 : 20;
      for (let year = firstRoundXTick; year < publicationsMaxYear; year += step) {
        if (year - publicationsMinYear > xTickEdgeGuard && publicationsMaxYear - year > xTickEdgeGuard) {
          values.push(year);
        }
      }
      values.push(publicationsMaxYear);
      return values;
    }

    // Bryony: 1892 "De la synesthésie" marker, x from the fixed year alone.
    const publicationsMarkerYear = 1892;
    // Bryony: one marker/label carries both the date and term-coined fact.
    const publicationsMarkerLabel = 'De la synesthésie (1892)';

    // Mark 2 recent publications, revealed during step7's own captions.
    const publicationsCitations = [
      { year: 2007, label: 'Rouw & Scholte (2007)' },
      { year: 2015, label: 'Witthoft, Winawer & Eagleman (2015)' }
    ];

    // d3's "nice" y-domain, shared by layoutPublications() and this tick list.
    const publicationsYNiceScale = d3.scaleLinear().domain([0, publicationsByDecadeMaxCount]).nice();
    const publicationsYDomain = publicationsYNiceScale.domain();
    const publicationsYTickValues = publicationsYNiceScale.ticks(4).filter((v) => v > 0);
    let pubXTickGroups;
    let pubYTickGroups;
    let pubXScale;
    let pubYScale;
    // Set by setPublicationsProgress(); keeps the chart wipe stable across resize.
    let pubDrawT = 0;
    // Clip rect's full width at drawT=1, cached for setPublicationsProgress().
    let pubChartWidth = 0;
    // Fixed for the whole publications chart, per Bryony — the marker/
    // focus text now scroll past as separate step text blocks instead
    // (see App.svelte).
    const publicationsChartTitleText = 'But is it real?';
    let pubMarkerT = 0;
    // Bryony: colour by effect, size by volume — fixed d3 scales, tuned live.
    const brainEffectColorScale = d3.scaleLinear().domain([0, 4.8]).range(['white', colors.green]);
    const brainVolumeRadiusScale = d3.scaleSqrt().domain([0, 100]).range([0, 30]);
    let brainDots;
    // Bryony: region-dot labels with leader lines, built once in buildBrain().
    let brainDotLabelGroups; // the text (one per ANNOTATION), screen space
    let brainDotLeaderLines; // the leader lines (one per DOT), local/icon space
    // Brain icon's 2 hemispheres don't meet at x=320 — real edges are
    // 296/344 — padded by a real 6px (converted through iconScale).
    // `hemisphere` picks which edge a label aligns to; `textAnchor`
    // follows from it. A leader line runs to whichever target dot(s).
    const brainLeftHemisphereRightEdge = 296;
    const brainRightHemisphereLeftEdge = 344;
    const brainDotAnnotations = [
      {
        main: 'Attention + Planning',
        sub: 'Superior frontal',
        hemisphere: 'right',
        localY: 255, // Bryony: "move Attention + Planning up a bit" (was 280)
        targets: ['Superior frontalLeft', 'Superior frontalRight']
      },
      {
        main: 'Directing Attention',
        sub: 'Parietal',
        hemisphere: 'left',
        localY: 340, // Bryony: "move Directing Attention down to align vertically with Visual Recognition" (was 310)
        targets: ['Superior parietalLeft']
      },
      {
        main: 'Visual Recognition',
        sub: 'Temporal',
        hemisphere: 'right',
        localY: 340,
        targets: ['Inferior temporalRight']
      }
    ];
    // Reverse lookup: dot key -> its annotation, for the leader-line join.
    const brainDotAnnotationByTarget = {};
    brainDotAnnotations.forEach((a) => {
      a.targets.forEach((key) => {
        brainDotAnnotationByTarget[key] = a;
      });
    });
    let magnetLetterGroups; // step10 magnet letters, built in buildMagnetLetters()
    let heatmapCellGroups; // step11 per-respondent cells, ranked in setHeatmapProgress()
    let heatmapCellBandOuterRadius = 0; // ring's outer radius, set by layoutHeatmap()
    let heatmapSeparatorLines; // step11's 26 slice separators
    const heatmapArc = d3.arc(); // shared arc generator for ring cells
    let magnetTrayLetterFontSize = 16; // tray letter size, read by layoutHeatmap()
    // Step10's full available band (before the tray's own aspect ratio
    // shrinks it) — layoutHeatmap() sizes the ring off this directly, per
    // Bryony, so the ring uses real horizontal space instead of being
    // capped by the tray's own (much shorter) rectangle.
    let connectionsBandTop = 0;
    let connectionsBandBottom = 0;
    let connectionsBandWidth = 0;
    let connectionsBandCenterX = 0;
    let heatmapRanksSeeded = false; // seedHeatmapRanks() runs once only
    let currentHeatmapProgress = 0; // last t, reapplied by layoutHeatmap() on resize
    let currentConnectionsProgress = 0; // last step-10 t, so the spotlight can span steps 10 -> 11
    const heatmapColorInterpCache = {}; // cached colour interpolators, keyed by colour pair
    // Letter -> its own correct colour, used by setHeatmapProgress().
    const magnetTemplateColorByLetter = {};
    magnetLetters.forEach((d) => {
      magnetTemplateColorByLetter[d.letter] = d.color;
    });
    // Respondent i's rank among just the 1975-1980 filter (step10's "even
    // stronger" caption), in original order; -1 if not in that filter.
    // Same for every letter, so computed once rather than per cell.
    const yobFilterRankByIndex = new Array(nUsers).fill(-1);
    let yobFilterCount = 0;
    for (let i = 0; i < nUsers; i++) {
      if (inYobFilter[i] === '1') yobFilterRankByIndex[i] = yobFilterCount++;
    }
    // Caption: "one participant matched 25 out of 26 letters" — first
    // respondent with exactly one mismatch, the one step10's spotlight
    // beat highlights (see drawHeatmapCells()).
    const spotlightUserIndex = (() => {
      const letters = Object.keys(magnetResponses);
      for (let i = 0; i < nUsers; i++) {
        let matches = 0;
        letters.forEach((letter) => {
          if (magnetResponses[letter].codes[i] === magnetResponses[letter].template) matches++;
        });
        if (matches === letters.length - 1) return i;
      }
      return -1;
    })();
    // Bryony: "move the 25/26 person for all the visualisations, not
    // as an animation" — swaps raw-order position with whichever
    // respondent would otherwise land at the ring's own middle.
    const spotlightMiddleIndex = Math.floor(nUsers / 2);
    // Same bg-circle radius as layoutSight(), so arrows meet the circle edge.
    let iconBgRadius = 0;

    // Ring centre/radius from layoutSight(); setSightProgress() only
    // toggles opacity, never geometry.
    let sightCenterX = 0;
    let sightCenterY = 0;
    let sightRadius = 0;

    // Shared tooltip: stacked lines, measured via getBBox, clamped on-canvas.
    function showPersonTooltip(anchorX, anchorY, lines) {
      const lineHeight = 18;
      const linesG = svg.select('.personTooltipLines');
      linesG
        .selectAll('.personTooltipLine')
        .data(lines)
        .join('text')
        .attr('class', 'personTooltipLine')
        .attr('x', 0)
        .attr('y', (d, i) => i * lineHeight)
        .style('font-weight', (d) => (d.bold ? 700 : 400))
        .style('fill', (d) => (d.grey ? 'var(--grey)' : null))
        .text((d) => d.text);

      const bbox = linesG.node().getBBox();
      const padX = 8;
      const padY = 6;
      svg
        .select('.personTooltipBg')
        .attr('x', bbox.x - padX)
        .attr('y', bbox.y - padY)
        .attr('width', bbox.width + padX * 2)
        .attr('height', bbox.height + padY * 2)
        .attr('rx', 4);

      const tooltipWidth = bbox.width + padX * 2;
      const tooltipHeight = bbox.height + padY * 2;
      let boxX = anchorX - tooltipWidth / 2;
      boxX = Math.max(edgeMargin, Math.min(width - edgeMargin - tooltipWidth, boxX));
      const boxY = Math.max(edgeMargin, anchorY - tooltipHeight - 12);

      svg
        .select('.personTooltip')
        .attr('transform', `translate(${boxX - (bbox.x - padX)},${boxY - (bbox.y - padY)})`)
        .style('opacity', 1);
    }

    function hidePersonTooltip() {
      svg.select('.personTooltip').style('opacity', 0);
    }

    // ---- Hover panel (Steps 6-7) -------------------------------------
    // Bryony: instead of a floating tooltip over the busy diagram, hovering
    // a famous person's photo fills a panel UNDER the diagram — name, their
    // relationships joined with " · ", then their quote — so it never
    // overlaps anything. layoutPersonPanel() finds the free band below the
    // composition; the panel's font scale is then picked so the tallest of
    // the 12 people still fits with padding below (quotes vary in length).
    const quoteByName = Object.fromEntries(famousQuotes.map((q) => [q.name, q.quote]));
    const highlightsByName = Object.fromEntries(famousQuotes.map((q) => [q.name, q.highlights || []]));
    // Panel colours: each sense's own icon colour; the 3 sight sub-groups share sight's.
    const SIGHT_SUB_KEYS = new Set(['lettersNumbers', 'colors', 'objects']);
    const panelSenseColor = (key) => senseColors[SIGHT_SUB_KEYS.has(key) ? 'sight' : key];

    // Character ranges of a quote to tint, longest match first so a phrase
    // beats a word inside it; overlaps dropped.
    function quoteHighlightRanges(name, quote) {
      const taken = new Array(quote.length).fill(false);
      const ranges = [];
      [...highlightsByName[name]].sort((a, b) => b.text.length - a.text.length).forEach((h) => {
        let from = 0;
        let i;
        while ((i = quote.indexOf(h.text, from)) !== -1) {
          const end = i + h.text.length;
          if (!taken.slice(i, end).some(Boolean)) {
            for (let k = i; k < end; k++) taken[k] = true;
            ranges.push({ start: i, end, sense: h.sense });
          }
          from = end;
        }
      });
      return ranges.sort((a, b) => a.start - b.start);
    }
    let personPanelGeom = null; // { top, maxWidth, availH, cx } from layoutPersonPanel()
    let personPanelScale = null; // lazily chosen per layout (needs the real fonts loaded)
    const PANEL_SCALES = [1, 0.93, 0.86, 0.8, 0.74];
    let linkPhotoSizeLast = 0; // set by layoutLinks(), read by layoutPersonPanel()

    function measurePanelText(str, { family, size, weight = 400, style = 'normal' }) {
      const el = svg.select('.personPanelMeasure');
      el.style('font-family', family).style('font-size', `${size}px`).style('font-weight', weight).style('font-style', style).text(str);
      return el.node().getComputedTextLength();
    }

    // Greedy word wrap for the quote, measured with the real font. Returns
    // [start, end) character offsets into `str`, so tinted ranges map onto lines.
    function wrapPanelWords(str, maxWidth, font) {
      const lines = [];
      let lineStart = null;
      let lineEnd = 0;
      for (const m of str.matchAll(/\S+/g)) {
        if (lineStart == null) {
          lineStart = m.index;
        } else if (measurePanelText(str.slice(lineStart, m.index + m[0].length), font) > maxWidth) {
          lines.push([lineStart, lineEnd]);
          lineStart = m.index;
        }
        lineEnd = m.index + m[0].length;
      }
      if (lineStart != null) lines.push([lineStart, lineEnd]);
      return lines;
    }

    // Everything the panel needs for one person at one font scale.
    function panelContent(name, edgeKey, scale, maxWidth) {
      const nameSize = Math.max(14, Math.round(typeScale.body * scale));
      const bodySize = Math.max(11, Math.round(typeScale.caption * scale));
      const lineH = bodySize * 1.4;
      const bodyFont = { family: 'var(--font-body)', size: bodySize };

      // Relationships packed onto as few lines as fit, whole ones only.
      const rels = personRelationships(name).map((r) => ({ ...r, emph: r.edgeKey === edgeKey }));
      const relLines = [];
      let cur = [];
      rels.forEach((r) => {
        const test = [...cur, r].map((x) => x.text).join(' · ');
        // Measured bold (the widest the hovered one can be) so it never overflows.
        if (cur.length && measurePanelText(test, { ...bodyFont, weight: 700 }) > maxWidth) {
          relLines.push(cur);
          cur = [r];
        } else {
          cur.push(r);
        }
      });
      if (cur.length) relLines.push(cur);

      const quote = quoteByName[name] || '';
      const quoteRanges = quoteHighlightRanges(name, quote);
      const quoteLines = wrapPanelWords(quote, maxWidth, { ...bodyFont, style: 'italic' }).map(([start, end]) => {
        // Split this line into plain / tinted pieces.
        const pieces = [];
        let pos = start;
        quoteRanges.forEach((r) => {
          const rs = Math.max(r.start, start);
          const re = Math.min(r.end, end);
          if (rs >= re) return;
          if (rs > pos) pieces.push({ text: quote.slice(pos, rs) });
          pieces.push({ text: quote.slice(rs, re), sense: r.sense });
          pos = re;
        });
        if (pos < end) pieces.push({ text: quote.slice(pos, end) });
        return pieces;
      });

      const nameH = nameSize * 1.25;
      const height = nameH + 4 + relLines.length * lineH + 8 + quoteLines.length * lineH;
      return { name, nameSize, bodySize, lineH, nameH, relLines, quoteLines, height };
    }

    // Biggest font scale at which the TALLEST panel (any of the 12) still
    // fits in the free band, with padding below.
    function choosePanelScale() {
      const { maxWidth, availH } = personPanelGeom;
      for (const sc of PANEL_SCALES) {
        const tallest = Math.max(...famousQuotes.map((q) => panelContent(q.name, null, sc, maxWidth).height));
        if (tallest <= availH) return sc;
      }
      return PANEL_SCALES[PANEL_SCALES.length - 1];
    }

    // Free band under the composition: below the bottom corner icons, the
    // sight circle and the lowest link photo; above a bottom pad.
    function layoutPersonPanel() {
      if (!answer || !iconNodes) return;
      const cornerBottoms = iconNodes.filter((d) => d.label !== 'sight').map((d) => d.sightY + iconBgRadius);
      const photoBottoms = linkPhotoNodes.map((d) => d.endY + linkPhotoSizeLast * 0.75); // 0.75 > half-diagonal ratio, covers rotation
      const compBottom = Math.max(sightCenterY + sightRadius, ...cornerBottoms, ...photoBottoms);
      const bottomPad = spacing['2xl'];
      const top = compBottom + spacing['2xl'];
      personPanelGeom = {
        cx: width / 2,
        top,
        maxWidth: Math.min(width - spacing['3xl'] * 2, 560),
        availH: height - bottomPad - top
      };
      personPanelScale = null; // re-chosen on next hover
    }

    function showPersonPanel(d) {
      if (!personPanelGeom) return;
      if (personPanelScale == null) personPanelScale = choosePanelScale();
      const { cx, top, maxWidth } = personPanelGeom;
      const c = panelContent(d.name, d.edgeKey, personPanelScale, maxWidth);
      const g = svg.select('.personPanel');

      g.select('.personPanelName').attr('x', cx).attr('y', top).attr('font-size', c.nameSize).text(c.name);

      let y = top + c.nameH + 4;
      const relsG = g.select('.personPanelRels');
      relsG.selectAll('*').remove();
      c.relLines.forEach((line) => {
        const t = relsG.append('text').attr('class', 'personPanelRel').attr('x', cx).attr('y', y).attr('font-size', c.bodySize);
        line.forEach((seg, i) => {
          if (i > 0) t.append('tspan').attr('class', 'personPanelSep').text(' · ');
          // Each end of the hovered photo's own relationship is bold and
          // tinted with its sense's colour; the person's other
          // relationships are plain grey (Bryony).
          const word = (label, key) =>
            t
              .append('tspan')
              .style('fill', seg.emph ? panelSenseColor(key) : 'var(--grey)')
              .style('font-weight', seg.emph ? 700 : null)
              .text(label);
          word(seg.fromLabel, seg.fromKey);
          t.append('tspan').style('fill', seg.emph ? 'var(--text)' : 'var(--grey)').text(' → ');
          word(seg.toLabel, seg.toKey);
        });
        y += c.lineH;
      });

      y += 8;
      const quoteG = g.select('.personPanelQuote');
      quoteG.selectAll('*').remove();
      c.quoteLines.forEach((line) => {
        const qt = quoteG.append('text').attr('class', 'personPanelQuoteLine').attr('x', cx).attr('y', y).attr('font-size', c.bodySize);
        line.forEach((piece) => {
          qt.append('tspan').style('fill', piece.sense ? panelSenseColor(piece.sense) : null).text(piece.text);
        });
        y += c.lineH;
      });

      g.style('opacity', 1);
    }

    function hidePersonPanel() {
      svg.select('.personPanel').style('opacity', 0);
    }

    // Bryony: hovering a photo keeps that photo, its link and the link's
    // source + target (circle + icon) as they are and dims everything else
    // to 0.2 (the same dim the non-sight senses already use). Done with a
    // class + CSS rather than inline opacity, so the scroll-driven opacity
    // setters can't fight it and mouseout simply restores normal.
    function highlightLink(d) {
      const [from, to] = d.edgeKey.split('-');
      svg.classed('linkHover', true);
      svg.selectAll('.linkPhotoItem').classed('hl', (p) => p === d);
      svg.selectAll('.linkArrow').classed('hl', (e) => e.from === from && e.to === to);
      svg.selectAll('.senseIcon').classed('hl', (sIcon) => sIcon.label === from || sIcon.label === to);
      svg.selectAll('.sightSubIcon').classed('hl', (sIcon) => sIcon.key === from || sIcon.key === to);
    }

    // Touch only: a tap that isn't on a link photo closes the panel opened by
    // a tap on one. Listens on the document because the svg itself ignores
    // pointer events (clicks fall through to the page behind it).
    function dismissLinkOnTap(event) {
      if (!window.matchMedia('(hover: none)').matches) return;
      if (event.target.closest && event.target.closest('.linkPhotoItem')) return;
      hidePersonTooltip();
      hidePersonPanel();
      clearLinkHighlight();
    }

    function clearLinkHighlight() {
      svg.classed('linkHover', false);
      svg.selectAll('.hl').classed('hl', false);
    }

    // Joins nodes onto .person groups; update never removes/rebuilds DOM.
    function buildScene() {
      const groups = svg
        .select('.peopleGroup')
        .selectAll('.personGroup')
        .data(nodes, (d) => d.name)
        .join((enter) => {
          // Nest everything under one captured g, not re-appended each time.
          const g = enter.append('g').attr('class', 'personGroup');

          const defs = g.append('defs');
          defs
            .append('pattern')
            .attr('class', 'tilePattern')
            .attr('width', 1)
            .attr('height', 1)
            .append('image')
            .attr('class', 'patternImage')
            .attr('preserveAspectRatio', 'xMidYMid slice');

          g.append('rect').attr('class', 'personTile');
          g.append('text').attr('class', 'personLabel');

          return g;
        });

      // Data-dependent attrs applied outside the join, on the full selection.
      groups.select('.tilePattern').attr('id', (d, i) => `tile-photo-${i}`);
      groups.select('.patternImage').attr('href', (d) => d.image);
      groups.select('.personTile').attr('fill', (d, i) => `url(#tile-photo-${i})`);
      groups.select('.personLabel').text((d) => d.name);

      // Bryony: tooltip shows job only, then name+job once arrived.
      groups
        .on('mouseenter', function (event, d) {
          // Bryony: switch once tiles have actually arrived, not partway.
          const cornerT = phase(currentProgress, step1.tilesToCorner.start, step1.tilesToCorner.end);
          const lines =
            cornerT < 1 ? [{ text: d.profession, bold: false }] : [{ text: `${d.name} - ${d.profession}`, bold: false }];
          showPersonTooltip(d.x, d.y, lines);
        })
        .on('mouseleave', hidePersonTooltip);

      return groups;
    }

    function applyTileSize() {
      personGroups
        .select('.personTile')
        .attr('width', TILE)
        .attr('height', TILE)
        .attr('x', -TILE / 2)
        .attr('y', -TILE / 2)
        .attr('rx', CORNER)
        .attr('ry', CORNER);
      personGroups.select('.patternImage').attr('width', TILE).attr('height', TILE);
      personGroups.select('.personLabel').attr('y', TILE / 2 + labelOffset);
    }

    // Sizes/wraps the header; resets to plain text first since wrap()
    // rebuilds it as tspans.
    function layoutHeader() {
      if (!headerText) {
        topMargin = edgeMargin;
        return;
      }
      const fontSize = Math.max(24, Math.min(40, width * 0.04));
      const bottomPadding = 28;
      // Scales with the font, not a flat pixel ceiling.
      const maxTextWidth = Math.min(width - 48, fontSize * 24);

      const headerEl = svg
        .select('.headerText')
        .text(headerText)
        .attr('font-size', fontSize)
        .attr('x', width / 2)
        .attr('y', topPadding + fontSize / 2);

      wrap(headerEl, maxTextWidth, fontSize);

      // getBBox since wrap() may have made this multi-line.
      const headerBox = headerEl.node().getBBox();
      topMargin = headerBox.y + headerBox.height + bottomPadding;
    }

    // Text content doesn't depend on size, so this only needs to run once.
    function buildAnswer() {
      if (!answer) return;
      svg.select('.leadText').text(answer.lead);
      svg.select('.synText').text(answer.syn);
      svg.select('.aesthesiaText').text(answer.aesthesia);
    }

    // Re-runs on resize; SYN/AESTHESIA are 2 elements read as one centred word.
    function layoutAnswer() {
      if (!answer) return;
      const wordFontSize = Math.max(40, Math.min(92, width * 0.085));
      const leadFontSize = Math.max(18, Math.min(28, width * 0.045));
      const gap = 44; // a bit more clearance above SYN/AESTHESIA, per your note
      const wordY = height / 2;
      const leadY = wordY - wordFontSize / 2 - gap - leadFontSize / 2;

      const synText = svg.select('.synText').attr('font-size', wordFontSize).attr('y', wordY);
      const aesthesiaText = svg
        .select('.aesthesiaText')
        .attr('font-size', wordFontSize)
        .attr('y', wordY);

      const synWidth = synText.node().getComputedTextLength();
      const aesthesiaWidth = aesthesiaText.node().getComputedTextLength();
      const startX = width / 2 - (synWidth + aesthesiaWidth) / 2;

      synText.attr('x', startX);
      aesthesiaText.attr('x', startX + synWidth);

      svg.select('.leadText').attr('font-size', leadFontSize).attr('x', width / 2).attr('y', leadY);

      etymSynX = startX;
      etymSynWidth = synWidth;
      etymAesthesiaWidth = aesthesiaWidth;
      etymWordBaselineY = wordY;
      etymWordFontSize = wordFontSize;
      etymLeadY = leadY;
      etymLeadFontSize = leadFontSize;

      // step3: re-apply on resize
      if (leadTextShowingSenses) renderSensesLeadText(etymLeadY + sensesYShift);
    }

    // Where SYNAESTHESIA + "What is" land at title size; widths are
    // scaled from resting widths, not re-measured.
    function layoutTitle() {
      if (!answer) return;
      titleFontSize = Math.max(24, Math.min(40, width * 0.04)); // same formula as the header
      titleY = topPadding + titleFontSize / 2;

      // Measured at the title size with a throwaway element (not scaled
      // from the big resting words): the 1px letter-spacing doesn't scale,
      // and trailing spaces are measured differently by Safari/Chrome — both
      // used to leave SYN/AESTHESIA/"?" too tight or too loose on phones.
      const measure = (cls, str) => {
        const t = svg.append('text').attr('class', cls).attr('font-size', titleFontSize).style('opacity', 0).text(str);
        const w = t.node().getComputedTextLength();
        t.remove();
        return w;
      };
      const synWidthAtTitle = measure('synText', answer.syn);
      const aesthesiaWidthAtTitle = measure('aesthesiaText', answer.aesthesia);
      const whatIsEl = svg.select('.whatIsText').attr('font-size', titleFontSize).text('What is');
      // One real word space, measured: "a a" minus "aa".
      const spaceWidth = measure('whatIsText', 'a a') - measure('whatIsText', 'aa');
      const whatIsWidth = measure('whatIsText', 'What is') + spaceWidth;

      const combinedWidth = whatIsWidth + synWidthAtTitle + aesthesiaWidthAtTitle;
      whatIsX = width / 2 - combinedWidth / 2;
      synTitleX = whatIsX + whatIsWidth;
      aesthesiaTitleX = synTitleX + synWidthAtTitle;

      whatIsEl.attr('x', whatIsX).attr('y', titleY);

      // "?" is its own element since AESTHESIA alone (no ?) appears earlier.
      svg
        .select('.titleQuestion')
        .attr('font-size', titleFontSize)
        .attr('x', aesthesiaTitleX + aesthesiaWidthAtTitle)
        .attr('y', titleY)
        .text('?');
    }

    // 5 sense icons, join-once; layoutSenses() sets position/size/colour.
    function buildSenses() {
      const groups = svg
        .select('.sensesGroup')
        .selectAll('.senseIcon')
        .data(iconNodes, (d) => d.label)
        .join((enter) => {
          const g = enter.append('g').attr('class', 'senseIcon');
          g.append('circle').attr('class', 'senseIconBg');
          g.append('path').attr('class', 'senseIconPath');
          g.append('text').attr('class', 'senseIconLabel');
          return g;
        });

      groups.select('.senseIconPath').attr('d', (d) => d.path);
      groups.select('.senseIconLabel').text((d) => d.label);

      return groups;
    }

    // 5 person icons, join-once; layoutPeopleBubble() sets position/scale/crop.
    function buildPeopleIcons() {
      const groups = svg
        .select('.peopleIconsGroup')
        .selectAll('.personIconItem')
        .data(personIconNodes)
        .join((enter) => {
          const g = enter.append('g').attr('class', 'personIconItem');
          g.append('path').attr('class', 'personIconPath').attr('d', (d) => d.icon.path);
          return g;
        });

      return groups;
    }

    // Step9: 36 participant icons, join-once; labels set once (static text).
    function buildParticipantIcons() {
      svg.select('.participantLabelLeft').text('18 grapheme-colour synaesthetes');
      svg.select('.participantLabelRight').text('18 controls');

      const groups = svg
        .select('.participantIconsGroup')
        .selectAll('.participantIconItem')
        .data(participantNodes)
        .join((enter) => {
          const g = enter.append('g').attr('class', 'participantIconItem');
          g.append('path')
            .attr('class', 'participantIconPath')
            .attr('d', personIcon.path)
            .attr('fill', (d) => d.color);
          return g;
        });

      return groups;
    }

    // 3 sight sub-icons, join-once; label fades with links, never removed.
    function buildSightSubIcons() {
      const groups = svg
        .select('.sightSubIconsGroup')
        .selectAll('.sightSubIcon')
        .data(sightSubIconNodes, (d) => d.key)
        .join((enter) => {
          const g = enter.append('g').attr('class', 'sightSubIcon');
          g.append('circle').attr('class', 'sightSubIconBg');
          g.append('path').attr('class', 'sightSubIconPath').attr('d', (d) => d.path);
          g.append('text').attr('class', 'sightSubIconLabel');
          return g;
        });

      groups.select('.sightSubIconLabel').text((d) => d.label);

      return groups;
    }

    // 8 relationship edges as paths; geometry from layoutLinks(), arrowhead via <marker>.
    function buildLinks() {
      const groups = svg
        .select('.linksGroup')
        .selectAll('.linkArrow')
        .data(synaesthesiaLinks, (d) => `${d.from}-${d.to}`)
        .join((enter) => enter.append('path').attr('class', 'linkArrow').attr('marker-end', 'url(#linkArrowhead)'));

      // Bryony: sound<->colors needs arrowheads at both ends, one shared marker.
      groups.attr('marker-start', (d) => (d.from === 'sound' && d.to === 'colors' ? 'url(#linkArrowhead)' : null));

      return groups;
    }

    // Link photos, same tilePattern-fill technique as the step1 tiles.
    function buildLinkPhotos() {
      const groups = svg
        .select('.linkPhotosGroup')
        .selectAll('.linkPhotoItem')
        .data(linkPhotoNodes, (d) => `${d.edgeKey}-${d.name}`)
        .join((enter) => {
          const g = enter.append('g').attr('class', 'linkPhotoItem');

          const defs = g.append('defs');
          defs
            .append('pattern')
            .attr('class', 'linkPhotoPattern')
            .attr('width', 1)
            .attr('height', 1)
            .append('image')
            .attr('class', 'linkPhotoImage')
            .attr('preserveAspectRatio', 'xMidYMid slice');

          g.append('rect').attr('class', 'linkPhotoTile');

          return g;
        });

      groups.select('.linkPhotoPattern').attr('id', (d, i) => `link-photo-${i}`);
      groups.select('.linkPhotoImage').attr('href', (d) => d.image);
      groups.select('.linkPhotoTile').attr('fill', (d, i) => `url(#link-photo-${i})`);

      // Bryony: name-job tooltip while the photos are still on their way
      // (before this point of step5.move); once they've essentially landed,
      // the panel under the diagram shows name, relationships and quote
      // instead — grey-ing is per relationship, the hovered photo's own
      // edge stays dark.
      const panelReadyT = step5.move.start + 0.85 * (step5.move.end - step5.move.start);
      const enterPhoto = (d) => {
        if (sightT < panelReadyT) {
          const idx = personIndexByName.get(d.name);
          const profession = idx != null ? people[idx].profession : '';
          showPersonTooltip(d.x, d.y, [{ text: `${d.name} - ${profession}`, bold: false }]);
        } else {
          hidePersonTooltip();
          showPersonPanel(d);
          highlightLink(d);
        }
      };
      const leavePhoto = () => {
        hidePersonTooltip();
        hidePersonPanel();
        clearLinkHighlight();
      };
      groups
        .on('mouseenter', function (event, d) {
          enterPhoto(d);
        })
        .on('mouseleave', () => {
          // Touch browsers fire a mouseleave straight after the tap, which
          // would close the panel at once; there it's closed by tapping
          // elsewhere instead.
          if (window.matchMedia('(hover: none)').matches) return;
          leavePhoto();
        })
        // Touch: iOS Safari only fires mouse events (and so "hover") for
        // elements with their own click handler, so a tap did nothing. A tap
        // now shows the photo's panel directly; tapping anywhere else clears
        // it (see the svg click handler below).
        .on('click', function (event, d) {
          if (!window.matchMedia('(hover: none)').matches) return;
          event.stopPropagation();
          enterPhoto(d);
        });
      return groups;
    }

    // Step7 chart structure; axis ticks joined once (fixed count), shape
    // set later by layoutPublications().
    function buildPublications() {
      const xTicks = svg
        .select('.pubXAxisGroup')
        .selectAll('.pubXTick')
        .data(computeXTickValues(width), (d) => d)
        .join((enter) => {
          // Bryony: no tick marks, just the year text.
          const g = enter.append('g').attr('class', 'pubXTick');
          g.append('text').attr('class', 'pubXTickLabel').text((d) => d);
          return g;
        });

      // Bryony: middle-anchor all ticks except first/last (start/end).
      xTicks
        .select('.pubXTickLabel')
        .style('text-anchor', (d, i, nodes) => (i === 0 ? 'start' : i === nodes.length - 1 ? 'end' : 'middle'));

      const yTicks = svg
        .select('.pubYAxisGroup')
        .selectAll('.pubYTick')
        .data(publicationsYTickValues, (d) => d)
        .join((enter) => enter.append('text').attr('class', 'pubYTick').text((d) => d));

      // Bryony: the Rouw & Scholte / Witthoft citation labels crowded a
      // mobile-width chart — keep their dashed reference lines, drop the
      // rotated label text there. The 1892 "De la synesthésie" marker
      // label stays on every screen size, per Bryony.
      const showCitationLabels = width >= 600;
      svg.select('.pubMarkerLabel').text(publicationsMarkerLabel);
      svg.select('.pubCitation1 .pubCitationLabel').text(showCitationLabels ? publicationsCitations[0].label : '');
      svg.select('.pubCitation2 .pubCitationLabel').text(showCitationLabels ? publicationsCitations[1].label : '');

      return { xTicks, yTicks };
    }

    // 4 region dots, fixed array — safe for a single join() (see the
    // tick-array comment above for why).
    function buildBrain() {
      brainDots = svg
        .select('.brainDotsGroup')
        .selectAll('.brainDot')
        .data(brainRegions, (d) => d.region + d.hemisphere)
        .join((enter) => enter.append('circle').attr('class', 'brainDot'));

      // Bryony: leader lines same colour as dots, drawn underneath.
      brainDotLeaderLines = svg
        .select('.brainDotLeadersGroup')
        .selectAll('.brainDotLeader')
        .data(brainRegions, (d) => d.region + d.hemisphere)
        .join((enter) => enter.append('line').attr('class', 'brainDotLeader'));

      // One label per annotation, not per dot (2 dots can share one).
      brainDotLabelGroups = svg
        .select('.brainDotLabelsGroup')
        .selectAll('.brainDotLabelItem')
        .data(brainDotAnnotations, (d) => d.main + d.sub)
        .join((enter) => {
          const g = enter.append('g').attr('class', 'brainDotLabelItem');
          g.append('text').attr('class', 'brainDotLabelMain');
          g.append('text').attr('class', 'brainDotLabelSub');
          return g;
        });
    }

    // Step10 magnet letters, coloured once, positioned by layoutConnections().
    function buildMagnetLetters() {
      magnetLetterGroups = svg
        .select('.magnetLetterGroup')
        .selectAll('.magnetLetter')
        .data(magnetLetters, (d) => d.letter)
        .join((enter) =>
          enter
            .append('text')
            .attr('class', 'magnetLetter')
            .text((d) => d.letter)
            .style('fill', (d) => d.color)
        );
    }

    // Step11: 8476 per-respondent wedge cells (d3.arc()), built once,
    // never rebuilt — only 'd'/fill change per tick.
    function buildHeatmap() {
      const cellData = [];
      Object.keys(magnetResponses).forEach((letter) => {
        const codes = magnetResponses[letter].codes;
        const template = magnetResponses[letter].template;
        for (let i = 0; i < nUsers; i++) {
          cellData.push({
            letter,
            i,
            code: codes[i],
            isMatch: codes[i] === template,
            // Bryony: real 1975-1980 birth-year data, for the "even
            // stronger" caption's ring highlight (see magnetResponses.js).
            inFilter: inYobFilter[i] === '1'
          });
        }
      });
      heatmapCellGroups = svg
        .select('.heatmapCellsGroup')
        .selectAll('.heatmapCell')
        .data(cellData, (d) => d.letter + d.i)
        .join((enter) => enter.append('path').attr('class', 'heatmapCell'));

      // 26 white slice separators, faded out once the bar morph starts.
      heatmapSeparatorLines = svg
        .select('.heatmapSeparatorsGroup')
        .selectAll('.heatmapSeparator')
        .data(magnetLetters, (d) => d.letter)
        .join((enter) => enter.append('line').attr('class', 'heatmapSeparator'));
    }

    // Centres the icon (or cropped head) on d.x/d.y; shared transform.
    function personIconTransform(d) {
      const localCenterY = d.cropped ? personIcon.headCropHeight / 2 : 320;
      return `translate(${d.x - 320 * d.scale},${d.y - localCenterY * d.scale}) scale(${d.scale})`;
    }

    // Same idea for the 5 quote-people, whose canvas is 416 x 504, not square.
    function quotePersonTransform(d) {
      const { width: iw, height: ih, headCropHeight } = quotePersonIconSize;
      const localCenterY = d.cropped ? headCropHeight / 2 : ih / 2;
      return `translate(${d.x - (iw / 2) * d.scale},${d.y - localCenterY * d.scale}) scale(${d.scale})`;
    }

    // Icon transform + quote "flash" pulse; d.x/d.y never overwritten,
    // only blended away from via d.sightAmt.
    function iconTransform(d) {
      const flash = d.flash || 0;
      const rise = d.riseAmt || 0;
      const sightAmt = d.sightAmt || 0;
      const rowX = d.x;
      const rowY = d.y - rise * iconsRiseBy;
      const x = sightAmt > 0 ? lerp(rowX, d.sightX, sightAmt) : rowX;
      const y = sightAmt > 0 ? lerp(rowY, d.sightY, sightAmt) : rowY;
      return `translate(${x},${y}) scale(${1 + flash * step4.flashScale})`;
    }

    // Link endpoint lookup: sense corner position, or sub-icon x/y.
    function nodePos(key) {
      const sub = sightSubIconNodes.find((d) => d.key === key);
      if (sub) return { x: sub.x, y: sub.y };
      const sense = iconNodes.find((d) => d.label === key);
      return { x: sense.sightX, y: sense.sightY };
    }

    // Sizes/spaces the 5 sense icons in a row, assigns colours.
    function layoutSenses() {
      if (!answer) return;
      const iconSize = Math.max(40, Math.min(64, width * 0.06));
      const rowMargin = Math.max(edgeMargin, width * 0.08);
      const slot = (width - rowMargin * 2) / iconNodes.length;
      // step3: anchored to risen baseline, matches sensesTextBottom, +80 per your note
      const rowY = etymLeadY + sensesYShift - step3.senses.riseBy + etymLeadFontSize * 2.4 + 80;

      iconNodes.forEach((d, i) => {
        const [, , vbW, vbH] = d.viewBox.split(' ').map(Number);
        d.vbW = vbW;
        d.vbH = vbH;
        d.scale = iconSize / Math.max(vbW, vbH);
        d.x = rowMargin + slot * (i + 0.5);
        d.y = rowY;
        d.color = step3.icons.colors[i % step3.icons.colors.length];
      });

      senseGroups.attr('transform', iconTransform);
      senseGroups
        .select('.senseIconPath')
        .attr('transform', (d) => `translate(${-(d.vbW * d.scale) / 2},${-(d.vbH * d.scale) / 2}) scale(${d.scale})`)
        .attr('fill', (d) => d.color);
      // Bug fix: per-icon vbH*scale put "sight" (a wider, shorter
      // viewBox) noticeably closer to its icon than the near-square
      // icons' labels. All 5 share one iconSize bounding box, so the
      // label offset should too.
      senseGroups.select('.senseIconLabel').attr('y', iconSize / 2 + labelOffset);
      // Bryony: labels 0.9x on mobile.
      const senseLabelFontSize = typeScale.lead * (width < breakpoints.mobile ? 0.9 : 1);
      senseGroups.select('.senseIconLabel').style('font-size', `${senseLabelFontSize}px`);

      // Real row extent, so layoutClosing() mirrors the gap above exactly.
      const sensesBox = svg.select('.sensesGroup').node().getBBox();
      iconsTopY = sensesBox.y;
      iconsBottomY = sensesBox.y + sensesBox.height;

      // How far the row rises in step4.clear, toward header height.
      iconsRiseBy = rowY - (topPadding * 2 + iconSize / 2);
      senseRestY = topPadding * 2 + iconSize / 2;
    }

    // Closing lines, spaced symmetrically around the icon row.
    function layoutClosing() {
      if (!answer) return;
      const closingFontSize = etymLeadFontSize;
      const sublineFontSize = closingFontSize * 0.75;

      // Bug fix: this used to estimate the lead text's bottom edge from
      // its y/font-size (and wrongly subtracted step3.senses.riseBy, which
      // .leadText's own position never actually applies), inflating the
      // measured top gap and pushing the closing block too far down.
      // Reading its real bbox matches exactly how iconsTopY is measured.
      // Measured against .leadText's own applied y, then projected onto
      // the senses anchor — correct even before senses mode first runs,
      // since the box's offset/height are font-metric, not text-content.
      const leadEl = svg.select('.leadText');
      const leadAppliedY = parseFloat(leadEl.attr('y')) || etymLeadY;
      const leadBox = leadEl.node().getBBox();
      const leadTopOffset = leadBox.y - leadAppliedY;
      const sensesLeadY = etymLeadY + sensesYShift;
      const sensesTextBottom = sensesLeadY + leadTopOffset + leadBox.height;
      const gapAboveIcons = Math.max(20, iconsTopY - sensesTextBottom);

      // Gap below mirrors the gap above exactly, per Bryony.
      const closingY = iconsBottomY + gapAboveIcons + closingFontSize / 2;
      const sublineY = closingY + closingFontSize / 2 + labelOffset + sublineFontSize / 2;

      // Bryony: plain "FIVE SENSES SENSE" line, no split font.
      svg
        .select('.closingLine')
        .style('text-anchor', null)
        .attr('font-size', closingFontSize)
        .attr('x', width / 2)
        .attr('y', closingY)
        .text(step3.closing.line);

      svg
        .select('.closingSubline')
        .attr('font-size', sublineFontSize)
        .attr('x', width / 2)
        .attr('y', sublineY)
        .text(step3.closing.subline);

      closingSubY = sublineY;
      quotesStartY = closingSubY + sublineFontSize / 2 + Math.max(40, gapAboveIcons);
    }

    // Bryony: the whole lead+icons+closing group sat too low overall (much
    // more empty space above it than below) — recentre it as one block
    // between the pinned title and the corner tile grid, same band
    // layoutSight() uses later for the sight ring.
    function centerSensesBlock() {
      if (!answer) return;

      const leadEl = svg.select('.leadText');
      const leadAppliedY = parseFloat(leadEl.attr('y')) || etymLeadY;
      const leadBox = leadEl.node().getBBox();
      const leadTopOffset = leadBox.y - leadAppliedY;
      const topOfBlock = etymLeadY + sensesYShift + leadTopOffset;

      const subBox = svg.select('.closingSubline').node().getBBox();
      const bottomOfBlock = subBox.y + subBox.height;

      const topBound = titleY + titleFontSize / 2 + spacing['2xl'];
      const tileHalfSize = (TILE * step1.tilesToCorner.scale) / 2;
      const tilesTop = cornerTargets.length ? Math.min(...cornerTargets.map((t) => t.y)) - tileHalfSize : height;
      const bottomBound = tilesTop - spacing['4xl'];

      const available = bottomBound - topBound;
      const naturalHeight = bottomOfBlock - topOfBlock;
      const targetTop = topBound + Math.max(0, available - naturalHeight) / 2;
      const delta = targetTop - topOfBlock;
      if (Math.abs(delta) < 0.5) return;

      sensesYShift += delta;
      if (leadTextShowingSenses) renderSensesLeadText(etymLeadY + sensesYShift);
      layoutSenses();
      layoutClosing();
    }

    // Placeholder people illustration + speech bubble, fixed size for now.
    function layoutPeopleBubble() {
      if (!answer) return;
      const risenIconsBottomY = iconsBottomY - iconsRiseBy;
      const specUnit = topPadding;
      const tailRatio = 39.86 / 202; // tail depth is always this fraction of the bubble's own height

      // Gap above the bubble: one 4xl (48px) per Setup — Spec.
      bubbleY = risenIconsBottomY + spacing['4xl'];

      // Icon row anchored to the bottom; bubble fills the room left above it.
      const tileHalfSize = (TILE * step1.tilesToCorner.scale) / 2;
      tilesTopY = cornerTargets.length ? Math.min(...cornerTargets.map((t) => t.y)) - tileHalfSize : height;
      const rowBottomY = tilesTopY - spacing['4xl']; // per Setup — Spec: a small (48px) gap above the person tiles

      // Same rowMargin/slot formula layoutSenses() uses for the sense
      // icons, so the two rows line up column for column.
      const rowMargin = Math.max(edgeMargin, width * 0.08);
      const slot = (width - rowMargin * 2) / personIconNodes.length;
      const maxIconWidth = slot * 0.85;
      const desiredHeight = Math.min(slot * 1.1, specUnit * 3.75);

      // Short-screen safety: crop to head-only if a full row won't fit.
      const minBubbleH = specUnit * 2;
      const spaceForRow = rowBottomY - (bubbleY + minBubbleH * (1 + tailRatio) + spacing['4xl']);
      const cropped = spaceForRow < desiredHeight;
      const { width: iconW, height: iconH, headCropHeight } = quotePersonIconSize;
      const scale = cropped
        ? Math.max(20, Math.min(spaceForRow, maxIconWidth)) / headCropHeight
        : Math.min(desiredHeight / iconH, maxIconWidth / iconW);
      const renderedHeight = (cropped ? headCropHeight : iconH) * scale;
      // Where the row WOULD sit if anchored to the bottom — only used to size
      // the bubble (that sizing is unchanged); the row itself is then placed
      // relative to the bubble's tail, below.
      const rowTopY = rowBottomY - renderedHeight;

      // Bubble height fills the gap between its top offset and the icon row.
      const available = rowTopY - bubbleY - spacing['4xl'];
      bubbleH = Math.max(minBubbleH, available / (1 + tailRatio));

      const leftmostIconX = rowMargin + slot / 2;
      const rightmostIconX = width - rowMargin - slot / 2;
      const iconSpan = rightmostIconX - leftmostIconX;
      const edgePerBubbleH = (50 + TAIL_HALF_SPAN) / 202; // r + halfTailSpan, per unit of bubbleH

      // Bubble width spans exactly to the leftmost/rightmost person icons.
      const edge = edgePerBubbleH * bubbleH;
      bubbleW = Math.min(width - 32, iconSpan + edge * 2);
      bubbleX = width / 2 - bubbleW / 2;

      // If the bubble got squeezed by the screen edge, shrink its corners and
      // tail just enough that the tail can still point straight down at the
      // outermost icons (the middle ones always could).
      const reachNeeded = Math.min(leftmostIconX - bubbleX, bubbleX + bubbleW - rightmostIconX);
      if (reachNeeded > 0 && reachNeeded < (50 + TAIL_HALF_SPAN) * (bubbleH / 202)) {
        bubbleCornerCap = (reachNeeded * 0.45) / 50;
        bubbleTailCap = (reachNeeded * 0.55) / TAIL_HALF_SPAN;
      } else {
        bubbleCornerCap = Infinity;
        bubbleTailCap = Infinity;
      }

      svg.select('.quoteBubblePath').attr('d', bubblePersonPath(bubbleX, bubbleY, bubbleW, bubbleH, 0));

      // Icons sit a fixed 20px below the tip of the bubble's tail, at every
      // aspect ratio: top of each icon's own SVG space to the bottom of the
      // arrow. (Tail depth = the path's own 39.86 reference depth, halved by
      // its tailHeightScale, at the tail's actual scale.)
      const tailTipY = bubbleY + bubbleH + 39.86 * bubbleTailScale(bubbleH) * 0.5;
      const iconTopY = tailTipY + ICON_GAP_BELOW_TAIL;
      const rowY = iconTopY + renderedHeight / 2;

      personIconNodes.forEach((d, i) => {
        d.x = rowMargin + slot * (i + 0.5);
        d.y = rowY;
        d.scale = scale;
        d.cropped = cropped;
      });

      if (personIconGroups) {
        personIconGroups.attr('transform', quotePersonTransform);
        personIconGroups.select('.personIconPath').attr('clip-path', (d) => (d.cropped ? 'url(#personHeadClip)' : null));
      }
    }

    // Quote words, built once, only opacity toggled; sense-word
    // punctuation stays neutral (split into its own nested tspan).
    const QUOTE_LEADING = /^([“‘(]+)/;
    const QUOTE_TRAILING = /([”’)]+)$/;

    function buildQuotes() {
      const groups = svg
        .select('.quotesGroup')
        .selectAll('.quoteLine')
        .data(quotes, (d, i) => i)
        .join((enter) => {
          const text = enter.append('text').attr('class', 'quoteLine');
          text.each(function (quote) {
            const el = d3.select(this);
            quote.words.forEach((w) => {
              // Exactly one .quoteWord element per word — punctuation
              // nests inside it, never as a sibling.
              const wordTspan = el.append('tspan').attr('class', 'quoteWord');
              if (!w.sense) {
                wordTspan.text(w.text);
                return;
              }
              let core = w.text;
              let leading = '';
              let trailing = '';
              const leadMatch = core.match(QUOTE_LEADING);
              if (leadMatch) {
                leading = leadMatch[1];
                core = core.slice(leading.length);
              }
              const trailMatch = core.match(QUOTE_TRAILING);
              if (trailMatch) {
                trailing = trailMatch[1];
                core = core.slice(0, core.length - trailing.length);
              }
              if (leading) wordTspan.append('tspan').text(leading);
              wordTspan.append('tspan').text(core).style('fill', senseColors[w.sense]);
              if (trailing) wordTspan.append('tspan').text(trailing);
            });
          });
          return text;
        });

      return groups;
    }

    // Wraps/centres each quote; all 5 share one font size, shrunk to fit.
    function layoutQuotes() {
      if (!answer || !quotesGroups || !bubbleW) return;

      const maxFontSize = Math.max(22, Math.min(34, width * 0.055)); // the old ideal — now a ceiling, not a fixed value
      const minFontSize = 16; // never shrink past this even if a quote still doesn't fit
      const pad = spacing['2xl']; // inner margin from the bubble's own edges
      const innerW = Math.max(40, bubbleW - pad * 2);
      const innerH = Math.max(30, bubbleH - pad * 2);
      const centerX = bubbleX + bubbleW / 2;
      const centerY = bubbleY + bubbleH / 2;

      const quoteEls = quotesGroups.nodes();

      // Measures one quote's wrap/line-breaks at fontSize; doesn't touch x/y.
      function wrapAt(el, fontSize) {
        const spaceWidth = fontSize * 0.28;
        const lineHeight = fontSize * 1.4;
        const tspanNodes = d3.select(el).selectAll('.quoteWord').nodes();
        const widths = tspanNodes.map((n) => n.getComputedTextLength());

        const lines = [];
        let lineStart = 0;
        let cursor = 0;
        widths.forEach((w, i) => {
          const addW = (i === lineStart ? 0 : spaceWidth) + w;
          if (cursor + addW > innerW && i > lineStart) {
            lines.push({ start: lineStart, end: i });
            lineStart = i;
            cursor = w;
          } else {
            cursor += addW;
          }
        });
        lines.push({ start: lineStart, end: widths.length });

        return { tspanNodes, widths, lines, spaceWidth, lineHeight, blockHeight: (lines.length - 1) * lineHeight + fontSize };
      }

      let fontSize = maxFontSize;
      let wrapped = [];
      quotesGroups.attr('font-size', fontSize);
      for (;;) {
        wrapped = quoteEls.map((el) => wrapAt(el, fontSize));
        const tallest = Math.max(...wrapped.map((w) => w.blockHeight));
        if (tallest <= innerH || fontSize <= minFontSize) break;
        fontSize = Math.max(minFontSize, fontSize - 1);
        quotesGroups.attr('font-size', fontSize);
      }

      wrapped.forEach(({ tspanNodes, widths, lines, spaceWidth, lineHeight }) => {
        const blockTop = centerY - ((lines.length - 1) * lineHeight) / 2;
        lines.forEach((line, li) => {
          let x = 0;
          const positions = [];
          for (let i = line.start; i < line.end; i++) {
            if (i > line.start) x += spaceWidth;
            positions.push(x);
            x += widths[i];
          }
          const lineStartX = centerX - x / 2;
          for (let i = line.start; i < line.end; i++) {
            d3
              .select(tspanNodes[i])
              .attr('x', lineStartX + positions[i - line.start])
              .attr('y', blockTop + li * lineHeight);
          }
        });
      });
    }

    // Step5: circle wraps the 3 sub-icons; other 4 senses scattered to corners.
    function layoutSight() {
      if (!answer) return;

      // Caption laid out first; its bbox sets this composition's upper bound.
      const labelFontSize = Math.max(18, Math.min(28, width * 0.036));
      const labelWrapWidth = Math.min(width - 48, labelFontSize * 24);
      // Bryony: 3-stage header text swap, resize-safe via persisted progress flags.
      sightHeaderStage = sightRevealT >= 1 ? 'famous' : 'split';
      const sightHeaderTextFor = { split: sightSplitText, famous: sightFamousText };
      sightLabelFontSize = labelFontSize;
      sightLabelWrapWidth = labelWrapWidth;
      const labelEl = svg
        .select('.sightLabel')
        .text(sightHeaderTextFor[sightHeaderStage])
        .attr('font-size', labelFontSize)
        .attr('x', width / 2)
        .attr('y', topPadding + labelFontSize / 2);
      wrap(labelEl, labelWrapWidth, labelFontSize);
      const labelBox = labelEl.node().getBBox();

      // Composition must fit the band between the caption and the tile cluster.
      const topBound = Math.max(senseRestY, labelBox.y + labelBox.height + spacing['2xl']);
      const bottomBound = tilesTopY - spacing['4xl'];

      // Sub-icons match the sense icons' own size, per Bryony.
      const iconSize = Math.max(40, Math.min(64, width * 0.06));
      const subSize = iconSize;

      // Sub-icon circles sized/spaced so no two backgrounds overlap.
      const bgPad = 5; // margin around each icon inside its circle, per Bryony
      const circleGap = spacing.sm; // desired clear gap between adjacent circles
      const bgScale = 1.3; // circles overall ~1.3x, so icons that aren't perfectly round still fit with room
      iconBgRadius = (subSize / 2 + bgPad) * bgScale;
      const minCenterDist = 2 * iconBgRadius + circleGap;

      const basePairGap = subSize * 1.15;
      const baseObjectsOffset = subSize * 0.85;
      const basePairOffsetY = subSize * 0.7;
      const baseObjToPairDist = Math.hypot(basePairGap / 2, baseObjectsOffset + basePairOffsetY);
      const spreadScale = Math.max(1, minCenterDist / basePairGap, minCenterDist / baseObjToPairDist);

      // Bryony: +10px gap between the 2 bottom sub-icon circles.
      const extraPairGap = 10;
      const pairGap = basePairGap * spreadScale + extraPairGap;
      const objectsOffset = baseObjectsOffset * spreadScale;
      const pairOffsetY = basePairOffsetY * spreadScale;

      // Outer circle sized to just contain the 3 sub-icon circles.
      const objectsReach = objectsOffset + iconBgRadius;
      const pairReach = Math.hypot(pairGap / 2, pairOffsetY) + iconBgRadius;
      sightRadius = Math.max(objectsReach, pairReach) + spacing.lg;

      // Circle + icons centred in the available space, clamped to fit.
      sightCenterX = width / 2;
      sightCenterY = Math.min(
        Math.max(topBound + (bottomBound - topBound) / 2, topBound + sightRadius),
        bottomBound - sightRadius
      );
      // Sight's own icon sits a small gap above the circle's top edge.
      const sightIconY = Math.max(topBound + iconSize / 2, sightCenterY - sightRadius - spacing.md - iconSize / 2);

      // 4 other senses at fixed corners of the available band.
      const cornerPad = spacing['6xl'];
      // Bryony: left/right padding shrinks on narrower screens (down to
      // half on mobile) to free up horizontal room; top/bottom untouched.
      const cornerPadX = width < breakpoints.mobile ? cornerPad * 0.5 : width < breakpoints.tablet ? cornerPad * 0.75 : cornerPad;
      const left = edgeMargin + cornerPadX + iconSize / 2;
      const right = width - edgeMargin - cornerPadX - iconSize / 2;
      // Bryony: taste/sound (the 2 top corners) raised by one circle
      // radius, to leave room for bigger mobile photo fans below them.
      const top = topBound + cornerPad + iconSize / 2 - iconBgRadius;
      // Bryony: touch/smell (the 2 bottom corners) nudged lower on mobile
      // so they fill the band more evenly instead of leaving a gap below
      // them that the top pair's own raise doesn't have to balance.
      const bottomPad = cornerPad * (width < breakpoints.mobile ? 0.6 : 1);
      const bottom = bottomBound - bottomPad - iconSize / 2;
      const corners = [
        { x: left, y: top }, // above-left
        { x: right, y: top }, // above-right
        { x: left, y: bottom }, // below-left
        { x: right, y: bottom } // below-right
      ];

      let cornerIdx = 0;
      iconNodes.forEach((d) => {
        if (d.label === 'sight') {
          d.sightX = sightCenterX;
          d.sightY = sightIconY;
        } else {
          const c = corners[cornerIdx++];
          d.sightX = c.x;
          d.sightY = c.y;
        }
      });

      // Bryony: nudge both sub-icon pairs up ~15px, spread math untouched.
      // objects gets an extra lift of its own — on mobile its label sat
      // right on top of the letters+numbers/colour row below it.
      const pairLift = 15;
      const objectsLift = 12;
      const targets = {
        objects: { x: sightCenterX, y: sightCenterY - objectsOffset - objectsLift },
        lettersNumbers: { x: sightCenterX - pairGap / 2, y: sightCenterY + pairOffsetY - pairLift },
        colors: { x: sightCenterX + pairGap / 2, y: sightCenterY + pairOffsetY - pairLift }
      };
      sightSubIconNodes.forEach((d) => {
        const target = targets[d.key];
        d.x = target.x;
        d.y = target.y;
        d.scale = subSize / Math.max(d.vbW, d.vbH);
      });
      // Bryony: letters+numbers icon's own path isn't centred — manual nudge.
      const pathOffsetX = { lettersNumbers: -8 };
      if (sightSubIconGroups) {
        sightSubIconGroups.attr('transform', (d) => `translate(${d.x},${d.y})`);
        sightSubIconGroups
          .select('.sightSubIconPath')
          .attr(
            'transform',
            (d) =>
              `translate(${-(d.vbW * d.scale) / 2 + (pathOffsetX[d.key] || 0) * d.scale},${-(d.vbH * d.scale) / 2}) scale(${d.scale})`
          );
        sightSubIconGroups.select('.sightSubIconBg').attr('r', iconBgRadius);
        // Bryony: sub-icon labels centred below their circles; padding cut
        // hard since dominant-baseline:hanging already adds clearance.
        const subIconLabelPad = 2;
        const iconCircleClearance = iconBgRadius + subIconLabelPad;
        // Bryony: "letters + numbers" crowded into "colour" beside it on
        // narrow screens — wrap it onto 2 lines whenever the gap between
        // those two circles is too tight for it to sit on one line; the
        // other labels have the open sides of the circle to spill into,
        // so they're left as a fixed max width they'll never hit.
        const pairLabelMaxWidth = Math.max(40, pairGap - circleGap);
        const labelMaxWidth = { lettersNumbers: pairLabelMaxWidth };
        sightSubIconGroups.each(function (d) {
          const labelSel = d3
            .select(this)
            .select('.sightSubIconLabel')
            .attr('x', 0)
            .attr('y', iconCircleClearance + 16) // one line below the circle's edge
            .text(d.label);
          wrap(labelSel, labelMaxWidth[d.key] || 400, 15);
        });
      }
      // Same bg-circle radius on all 4 corner senses, per Bryony.
      if (senseGroups) senseGroups.select('.senseIconBg').attr('r', iconBgRadius);

      svg.select('.sightCircle').attr('cx', sightCenterX).attr('cy', sightCenterY).attr('r', sightRadius);
    }

    // Step6: curved relationship arrows + photo fans, derived from
    // sight/sub-icon positions (runs after layoutSight()).
    function layoutLinks() {
      if (!answer) return;

      // Bryony: person photos shrink on mobile — 3 tiers by width
      // (60%/70%/100%), independent of tileSizeFor's own breakpoints.
      // Mobile tier raised 1.5x (was 0.4), paired with taste/sound's
      // circles moving up above to make room.
      const mobilePhotoScale = width < breakpoints.mobile ? 0.6 : width < breakpoints.tablet ? 0.7 : 1;
      const photoSize = TILE * step1.tilesToCorner.scale * mobilePhotoScale;
      linkPhotoSizeLast = photoSize;
      const photoCorner = photoSize * 0.167; // same corner-radius ratio buildScene()'s tiles use (CORNER = TILE * 0.167)
      const pull = iconBgRadius + spacing.xs;

      // End pullback compensates for the arrowhead's own refX taper, or
      // the tip overshoots into the destination circle.
      const linkStrokeWidth = 2.5; // .linkArrow's own stroke-width, kept in sync with the CSS below
      const arrowTipMargin = linkStrokeWidth + 1; // shared with arrowRefX below, so the two stay in sync

      // Sight-sight and bidirectional edges get curve; everything else
      // stays straight, per Bryony.
      const sightKeys = new Set(['colors', 'lettersNumbers', 'objects']);
      const pairKeys = new Set(synaesthesiaLinks.map((e) => `${e.from}->${e.to}`));

      // Straight by default; curveOverrides below hand-tunes the few
      // edges that structurally can't be (sight-sight, bidirectional,
      // or one Bryony asked to bow a particular way).
      const curveOverrides = {
        // Bows away from 'colors' (avoids cutting the cluster); gridFixed
        // places its 3 people left of the line, unrotated (plain screen axes).
        'lettersNumbers-objects': { flip: true, curveFraction: 0.75, gridRows: [2, 1], gridFixed: true },
        // Symmetric sag (dy=0); startAngleOffset/endAngleOffset keep p0/p2
        // anchored to the circle edges while nudging the attach point;
        // gridRows stacks its 5 photos below in rows of 3 then 2; liftY
        // raises the curve (and its photo grid) up by that many px.
        'lettersNumbers-colors': {
          curveFraction: 1.9,
          startAngleOffset: 0.5,
          endAngleOffset: -0.5,
          gridRows: [3, 2],
          liftY: -spacing['4xl']
        },
        // Borrows lettersNumbers-objects' own control point (controlFrom),
        // stretched via controlScale, so both edges share one departure
        // line off the same node before peeling off toward sound.
        // positionT pins its one photo directly on the curve at t=0.75.
        'lettersNumbers-sound': { controlFrom: 'lettersNumbers-objects', controlScale: 3.0, positionT: 0.75 },
        // Bryony: fixed straight-up endDir into the colour circle, photo
        // pinned at 25% along the line (positionT), avoids overlap.
        'taste-colors': { endDir: { x: 0, y: -1 }, positionT: 0.25 }
      };

      // Pass 1: each edge's own perpendicular control point, keyed for
      // controlFrom lookups.
      const ownControlByKey = {};
      const rawByKey = {};
      synaesthesiaLinks.forEach((e) => {
        const key = `${e.from}-${e.to}`;
        const rawFrom = nodePos(e.from);
        const rawTo = nodePos(e.to);
        const isSightSight = sightKeys.has(e.from) && sightKeys.has(e.to);
        const isBidirectional = pairKeys.has(`${e.to}->${e.from}`);
        const override = curveOverrides[key];
        const curveFraction = override?.curveFraction ?? (isSightSight ? 0.5 : isBidirectional ? 0.35 : 0);

        const dx = rawTo.x - rawFrom.x;
        const dy = rawTo.y - rawFrom.y;
        const len = Math.hypot(dx, dy) || 1;
        // 90° rotation for the offset; flip/paired-edge sign picks which
        // side it bows to.
        const sign = override?.flip ? -1 : 1;
        const nx = (-dy / len) * sign;
        const ny = (dx / len) * sign;
        const curveAmt = len * curveFraction;

        ownControlByKey[key] = {
          x: (rawFrom.x + rawTo.x) / 2 + nx * curveAmt,
          y: (rawFrom.y + rawTo.y) / 2 + ny * curveAmt
        };
        rawByKey[key] = { rawFrom, rawTo };
      });

      // Pass 2: resolve the final control point, then pull both ends to
      // the circle edges.
      synaesthesiaLinks.forEach((e) => {
        const key = `${e.from}-${e.to}`;
        const { rawFrom, rawTo } = rawByKey[key];
        const override = curveOverrides[key];
        // controlFrom borrows another edge's control point; controlScale
        // stretches it further out along the same departure direction.
        const borrowed = override?.controlFrom ? ownControlByKey[override.controlFrom] : null;
        const controlScale = override?.controlScale ?? 1;
        const control = borrowed
          ? { x: lerp(rawFrom.x, borrowed.x, controlScale), y: lerp(rawFrom.y, borrowed.y, controlScale) }
          : { ...ownControlByKey[key] };

        // liftY shifts the control point by DOUBLE its value — a
        // quadratic bezier's midpoint only gets about half of whatever
        // the control point moves.
        if (override?.liftY) {
          control.y += override.liftY * 2;
        }

        // Pulls each end back to the circle edge along its own tangent;
        // startAngleOffset/endAngleOffset rotate the exit direction first.
        const rotate = (dx, dy, theta) =>
          theta ? { x: dx * Math.cos(theta) - dy * Math.sin(theta), y: dx * Math.sin(theta) + dy * Math.cos(theta) } : { x: dx, y: dy };

        // sound-colors also has a start arrowhead, needing the same pullback.
        const hasStartArrow = e.from === 'sound' && e.to === 'colors';
        const startPull = hasStartArrow ? pull + arrowTipMargin : pull;
        const startDir = rotate(control.x - rawFrom.x, control.y - rawFrom.y, override?.startAngleOffset);
        const startLen = Math.hypot(startDir.x, startDir.y) || 1;
        const p0 = {
          x: rawFrom.x + (startDir.x / startLen) * startPull,
          y: rawFrom.y + (startDir.y / startLen) * startPull
        };

        const endPull = pull + arrowTipMargin;
        // endDir: fixed direction from the destination centre, for edges
        // nudging can't reach. Otherwise the usual tangent direction.
        const rawEndDir = override?.endDir ?? rotate(control.x - rawTo.x, control.y - rawTo.y, override?.endAngleOffset);
        const endLen = Math.hypot(rawEndDir.x, rawEndDir.y) || 1;
        const p2 = { x: rawTo.x + (rawEndDir.x / endLen) * endPull, y: rawTo.y + (rawEndDir.y / endLen) * endPull };

        e.p0 = p0;
        e.control = control;
        e.p2 = p2;
      });

      if (linkGroups) {
        linkGroups.attr('d', (d) => `M ${d.p0.x},${d.p0.y} Q ${d.control.x},${d.control.y} ${d.p2.x},${d.p2.y}`);
      }

      // Bryony: small arrowhead, scaled off icon-circle size with a cap.
      const arrowSize = Math.min(16, Math.max(8, iconBgRadius * 0.28));

      // refX must sit back from the apex to match the stroke width, or
      // the line's butt-cap sticks out past the triangle's taper.
      const arrowRefX = 10 * (1 - arrowTipMargin / arrowSize);

      svg
        .select('#linkArrowhead')
        .attr('markerWidth', arrowSize)
        .attr('markerHeight', arrowSize)
        .attr('refX', arrowRefX);

      // Level row centred above each edge's curve midpoint (t=0.5
      // bezier formula), Kandinsky below instead per Bryony.
      const belowNames = new Set(['Wassily Kandinsky']);
      const photoNodeByKey = new Map(linkPhotoNodes.map((d) => [`${d.edgeKey}-${d.name}`, d]));
      const rowGap = photoSize + spacing.xs; // gap between adjacent photos in a row
      const edgeGap = photoSize / 2 + spacing.xs; // gap between the row and the line itself

      synaesthesiaLinks.forEach((e) => {
        const midX = 0.25 * e.p0.x + 0.5 * e.control.x + 0.25 * e.p2.x;
        const midY = 0.25 * e.p0.y + 0.5 * e.control.y + 0.25 * e.p2.y;
        const tanX = e.p2.x - e.p0.x;
        const tanY = e.p2.y - e.p0.y;
        const tanLen = Math.hypot(tanX, tanY) || 1;
        const ux = tanX / tanLen;
        const uy = tanY / tanLen;

        // Whichever perpendicular points up-screen is "above", regardless
        // of edge lean.
        const perpA = { x: -uy, y: ux };
        const perpB = { x: uy, y: -ux };
        const up = perpA.y <= perpB.y ? perpA : perpB;
        const down = { x: -up.x, y: -up.y };

        // Tilt must derive from the real `down` vector, not the tangent
        // angle directly — a fixed formula only matched half the slopes,
        // since `down` can be either perpendicular depending on slope.
        const tiltDeg = Math.atan2(down.y, down.x) * (180 / Math.PI) - 90;

        const place = (people, dir) => {
          const m = people.length;
          people.forEach((p, i) => {
            const d = photoNodeByKey.get(`${e.from}-${e.to}-${p.name}`);
            if (!d) return;
            const fanIndex = i - (m - 1) / 2; // centred row, evenly spread
            d.endX = midX + ux * fanIndex * rowGap + dir.x * edgeGap;
            d.endY = midY + uy * fanIndex * rowGap + dir.y * edgeGap;
            d.endRotation = tiltDeg;
          });
        };

        // Bryony: photos below the line in rows (e.g. 3 then 2), not
        // hidden along the curve.
        const placeGridBelow = (people, rows, dir) => {
          let idx = 0;
          rows.forEach((rowSize, rowIndex) => {
            const rowPeople = people.slice(idx, idx + rowSize);
            idx += rowSize;
            const m = rowPeople.length;
            const rowOffset = edgeGap + rowIndex * rowGap;
            rowPeople.forEach((p, i) => {
              const d = photoNodeByKey.get(`${e.from}-${e.to}-${p.name}`);
              if (!d) return;
              const fanIndex = i - (m - 1) / 2;
              d.endX = midX + ux * fanIndex * rowGap + dir.x * rowOffset;
              d.endY = midY + uy * fanIndex * rowGap + dir.y * rowOffset;
              d.endRotation = tiltDeg;
            });
          });
        };

        // Bryony: for this edge, photos stack straight left, unrotated
        // (plain screen axes, not the curve's tangent).
        const placeGridLeft = (people, rows) => {
          let idx = 0;
          rows.forEach((rowSize, rowIndex) => {
            const rowPeople = people.slice(idx, idx + rowSize);
            idx += rowSize;
            const m = rowPeople.length;
            const colOffset = edgeGap + rowIndex * rowGap;
            rowPeople.forEach((p, i) => {
              const d = photoNodeByKey.get(`${e.from}-${e.to}-${p.name}`);
              if (!d) return;
              const stackIndex = i - (m - 1) / 2;
              d.endX = midX - colOffset;
              d.endY = midY + stackIndex * rowGap;
              d.endRotation = 0;
            });
          });
        };

        // Bryony: pins one photo directly on the curve at a fixed t
        // (bezier parameter, not true arc length).
        const placeAtT = (people, t) => {
          const omt = 1 - t;
          const x = omt * omt * e.p0.x + 2 * omt * t * e.control.x + t * t * e.p2.x;
          const y = omt * omt * e.p0.y + 2 * omt * t * e.control.y + t * t * e.p2.y;
          // Rotation uses the curve's real tangent at t, correct for any bow.
          const dx = 2 * omt * (e.control.x - e.p0.x) + 2 * t * (e.p2.x - e.control.x);
          const dy = 2 * omt * (e.control.y - e.p0.y) + 2 * t * (e.p2.y - e.control.y);
          const tanLenT = Math.hypot(dx, dy) || 1;
          const tUx = dx / tanLenT;
          const tUy = dy / tanLenT;
          const tPerpA = { x: -tUy, y: tUx };
          const tPerpB = { x: tUy, y: -tUx };
          const tUp = tPerpA.y <= tPerpB.y ? tPerpA : tPerpB;
          const localTiltDeg = Math.atan2(-tUp.y, -tUp.x) * (180 / Math.PI) - 90;
          people.forEach((p) => {
            const d = photoNodeByKey.get(`${e.from}-${e.to}-${p.name}`);
            if (!d) return;
            // Bryony: sit above the line, not on it.
            d.endX = x + tUp.x * edgeGap;
            d.endY = y + tUp.y * edgeGap;
            d.endRotation = localTiltDeg;
          });
        };

        const gridRows = curveOverrides[`${e.from}-${e.to}`]?.gridRows;
        const gridFixed = curveOverrides[`${e.from}-${e.to}`]?.gridFixed;
        const positionT = curveOverrides[`${e.from}-${e.to}`]?.positionT;
        if (positionT != null) {
          placeAtT(e.people, positionT);
        } else if (gridRows && gridFixed) {
          placeGridLeft(e.people, gridRows);
        } else if (gridRows) {
          placeGridBelow(e.people, gridRows, down);
        } else {
          const above = e.people.filter((p) => !belowNames.has(p.name));
          const below = e.people.filter((p) => belowNames.has(p.name));
          place(above, up);
          place(below, down);
        }
      });

      // Photo's shared start = wherever its person settled in the tile cluster.
      linkPhotoNodes.forEach((d) => {
        const idx = personIndexByName.get(d.name);
        const target = idx != null ? cornerTargets[idx] : null;
        d.startX = target ? target.x : d.endX;
        d.startY = target ? target.y : d.endY;
      });

      if (linkPhotoGroups) {
        // Resting position = the start point; setLinksProgress() drives
        // it from here on every tick.
        linkPhotoGroups.attr('transform', (d) => {
          d.x = d.startX;
          d.y = d.startY;
          d.rotation = 0;
          return `translate(${d.x},${d.y}) rotate(${d.rotation})`;
        });
        linkPhotoGroups
          .select('.linkPhotoTile')
          .attr('x', -photoSize / 2)
          .attr('y', -photoSize / 2)
          .attr('width', photoSize)
          .attr('height', photoSize)
          .attr('rx', photoCorner)
          .attr('ry', photoCorner);
        linkPhotoGroups.select('.linkPhotoImage').attr('width', photoSize).attr('height', photoSize);
      }
    }

    // Step7 chart geometry; setPublicationsProgress() handles the reveal, not this.
    function layoutPublications() {
      const titleFontSize = Math.max(18, Math.min(28, width * 0.036));
      const titleWrapWidth = Math.min(width - 48, titleFontSize * 30);
      const titleEl = svg
        .select('.publicationsTitle')
        .text(publicationsChartTitleText)
        .attr('font-size', titleFontSize)
        .attr('x', width / 2)
        .attr('y', topPadding + titleFontSize / 2);
      wrap(titleEl, titleWrapWidth, titleFontSize);
      const titleBox = titleEl.node().getBBox();

      // Bryony: more padding around the chart; y-axis moved right, freeing the left.
      const isMobilePub = width < breakpoints.mobile;
      // Bryony: "100px more space between the end of the header and the
      // top of the line chart" on mobile.
      const chartTop = titleBox.y + titleBox.height + spacing['4xl'] + (isMobilePub ? 100 : 0);
      // Bryony: more bottom space so the footnote doesn't crowd the ticks —
      // mobile needs 2.5x that, since the footnote wraps to 2 lines there.
      // Bryony: 2.5x was too much once she saw it — dialled back to 2/3 of that.
      const bottomReserve = (spacing['4xl'] + spacing['2xl']) * (isMobilePub ? 2.5 * (2 / 3) : 1);
      const chartBottom = height - edgeMargin - bottomReserve;
      const chartLeft = edgeMargin + spacing['2xl'];
      const chartRight = width - edgeMargin - spacing['5xl'] - spacing.xl; // right margin: a tiny bit more (+16px)

      pubXScale = d3.scaleLinear().domain([publicationsMinYear, publicationsMaxYear]).range([chartLeft, chartRight]);
      pubYScale = d3.scaleLinear().domain(publicationsYDomain).range([chartBottom, chartTop]);
      pubChartWidth = chartRight - chartLeft;

      // Bryony: ticks + y-axis label were a fixed 24px regardless of screen
      // — fine on desktop, way too big for a mobile-width chart.
      const tickFontSize = Math.max(11, Math.min(24, width * 0.04));

      // x axis: baseline + one tick per computeXTickValues() entry.
      svg
        .select('.pubXAxisLine')
        .attr('x1', chartLeft)
        .attr('x2', chartRight)
        .attr('y1', chartBottom)
        .attr('y2', chartBottom);

      if (pubXTickGroups) {
        pubXTickGroups.attr('transform', (d) => `translate(${pubXScale(d)},${chartBottom})`);
        // Bryony: no tick marks, label closer to the axis line.
        pubXTickGroups.select('.pubXTickLabel').attr('y', spacing.sm).style('font-size', `${tickFontSize}px`);
      }

      // Bryony: add a y-axis baseline, same style as the x-axis.
      svg
        .select('.pubYAxisLine')
        .attr('x1', chartRight)
        .attr('x2', chartRight)
        .attr('y1', chartTop)
        .attr('y2', chartBottom);

      // Bryony: y-axis moved to the right; label sits left of the ticks.
      if (pubYTickGroups) {
        pubYTickGroups
          .attr('x', chartRight + spacing.md)
          .attr('y', (d) => pubYScale(d))
          .style('font-size', `${tickFontSize}px`); // closer to the axis, per your note
      }
      // Bryony: not rotated, sitting above the y-axis, smaller so it can
      // be text-anchor:middle — same treatment on every width now (this
      // used to rotate 90deg on desktop only; the isMobilePub branch
      // below was already doing what she wants everywhere).
      const yLabelFontSize = Math.max(9, tickFontSize * 0.7);
      svg
        .select('.pubYAxisLabel')
        .attr('transform', null)
        .attr('x', chartRight)
        .attr('y', chartTop - spacing.sm)
        .style('font-size', `${yLabelFontSize}px`)
        .style('text-anchor', 'middle')
        .style('dominant-baseline', 'auto');

      // Bryony: 1892 marker line + labels rotated/aligned to mirror the y-axis label.
      const markerLabelGap = spacing.md;
      const markerX = pubXScale(publicationsMarkerYear);
      svg.select('.pubMarkerLine').attr('x1', markerX).attr('x2', markerX).attr('y1', chartTop).attr('y2', chartBottom);
      svg
        .select('.pubMarkerLabel')
        .attr('transform', `translate(${markerX - markerLabelGap},${chartTop - spacing.md}) rotate(-90)`);

      // 2 more publications, same dashed-line style; reveal in step7.
      const citation1X = pubXScale(publicationsCitations[0].year);
      svg
        .select('.pubCitation1 .pubCitationLine')
        .attr('x1', citation1X)
        .attr('x2', citation1X)
        .attr('y1', chartTop)
        .attr('y2', chartBottom);
      svg
        .select('.pubCitation1 .pubCitationLabel')
        .attr('transform', `translate(${citation1X - markerLabelGap},${chartTop - spacing.md}) rotate(-90)`);

      const citation2X = pubXScale(publicationsCitations[1].year);
      svg
        .select('.pubCitation2 .pubCitationLine')
        .attr('x1', citation2X)
        .attr('x2', citation2X)
        .attr('y1', chartTop)
        .attr('y2', chartBottom);
      svg
        .select('.pubCitation2 .pubCitationLabel')
        .attr('transform', `translate(${citation2X - markerLabelGap},${chartTop - spacing.md}) rotate(-90)`);

      // Bryony: small footnote, bottom-left, below the x-axis ticks —
      // wraps onto its own 2nd line on mobile, where it's too long to fit.
      // Bryony: on mobile, tethered to the chart's own bottom axis instead
      // of the viewport edge, so it reads as part of the chart rather than
      // floating in the (now smaller) reserved space below it.
      const footnoteY = isMobilePub ? chartBottom + tickFontSize + spacing['2xl'] + spacing.lg : height - edgeMargin - 12; // down another line, per your note
      svg.select('.pubFootnote').attr('x', chartLeft).attr('y', footnoteY);
      const footnoteFontSize = 15;
      svg
        .select('.pubFootnoteLink')
        .attr('x', isMobilePub ? chartLeft : null)
        .attr('dy', isMobilePub ? footnoteFontSize * 1.3 : null);

      // Full stable line/area path; only the clip rect's width animates.
      // Bryony: curveCardinal for both.
      const lineGen = d3.line().x((d) => pubXScale(d.year)).y((d) => pubYScale(d.count)).curve(d3.curveCardinal);
      const areaGen = d3
        .area()
        .x((d) => pubXScale(d.year))
        .y0(chartBottom)
        .y1((d) => pubYScale(d.count))
        .curve(d3.curveCardinal);
      svg.select('.pubLine').attr('d', lineGen(publicationsByDecade));
      svg.select('.pubArea').attr('d', areaGen(publicationsByDecade));

      const clipTop = chartTop - spacing.lg;
      svg
        .select('.pubDrawClipRect')
        .attr('x', chartLeft)
        .attr('y', clipTop)
        .attr('width', pubChartWidth * pubDrawT)
        .attr('height', chartBottom - clipTop);
    }

    // Step9: title + brain icon scaled to fit; dots share the icon's local space.
    function layoutBrain() {
      const titleFontSize = Math.max(18, Math.min(28, width * 0.036));
      const titleWrapWidth = Math.min(width - 48, titleFontSize * 30);
      const titleEl = svg
        .select('.brainTitle')
        .text(brainQuestionText)
        .attr('font-size', titleFontSize)
        .attr('x', width / 2)
        .attr('y', topPadding + titleFontSize / 2);
      wrap(titleEl, titleWrapWidth, titleFontSize);
      const titleBox = titleEl.node().getBBox();

      const subtitleFontSize = Math.max(13, Math.min(17, width * 0.018));
      const subtitleWrapWidth = Math.min(width - 48, subtitleFontSize * 44);
      const subtitleEl = svg
        .select('.brainSubtitle')
        .text('Rouw & Scholte (2007) · 18 grapheme-colour synaesthetes vs 18 controls')
        .attr('font-size', subtitleFontSize)
        .attr('x', width / 2)
        .attr('y', titleBox.y + titleBox.height + spacing.lg + subtitleFontSize / 2);
      wrap(subtitleEl, subtitleWrapWidth, subtitleFontSize);
      const subtitleBox = subtitleEl.node().getBBox();

      const headerHeight = subtitleBox.y + subtitleBox.height;
      const iconTop = headerHeight + spacing['4xl'];
      const iconBottom = height - edgeMargin - spacing['2xl'];
      // Bryony: same as the step10 tray — mobile side margin shrunk to
      // 25% of what it was, so the left/right brain panels can use
      // almost the full screen width.
      const isMobileBrain = width < breakpoints.mobile;
      const brainSideMargin = (edgeMargin + spacing['4xl']) * (isMobileBrain ? 0.25 : 1);
      const iconMaxWidth = width - brainSideMargin * 2;
      const iconMaxHeight = iconBottom - iconTop;
      const iconScale = Math.max(0.05, Math.min(iconMaxWidth, iconMaxHeight) / 640);
      const iconX = width / 2 - (640 * iconScale) / 2;
      // Bryony: headerHeight + (100vh - headerHeight) / 2 still read as
      // top-heavy — the header text itself sits above that gap, so the
      // whole top region (header + gap) ends up bigger than the bottom
      // gap even though the two gaps either side of the header are equal.
      // True screen-centre (vh / 2) is what actually balances it, clamped
      // so it never climbs under the header or runs past iconBottom.
      const targetCenterY = height / 2;
      const iconY = Math.min(
        iconBottom - 640 * iconScale,
        Math.max(iconTop, targetCenterY - (640 * iconScale) / 2)
      );
      const brainTransform = `translate(${iconX},${iconY}) scale(${iconScale})`;
      // Bryony: bg rects share the icon's transform, so nothing drifts apart.
      svg.select('.brainBgGroup').attr('transform', brainTransform);
      svg.select('.brainIconGroup').attr('transform', brainTransform);

      // Converts a local 0-640 point to a real screen coordinate.
      const toScreenX = (lx) => iconX + lx * iconScale;
      const toScreenY = (ly) => iconY + ly * iconScale;

      // Bryony: "letters + numbers -> colour"/"controls" bold, to match
      // the Step 10 caption — sized down from the subtitle so the bold
      // run still fits on one line.
      const headingFontSize = subtitleFontSize * 0.85;
      const headingWrapWidth = Math.max(60, 320 * iconScale - 24);
      const participantLeftBoldWords = new Set(['letters', '+', 'numbers', '→', 'colour']);
      const participantRightBoldWords = new Set(['controls']);
      const headingLeftEl = svg
        .select('.participantLabelLeft')
        .attr('font-size', headingFontSize)
        .attr('x', toScreenX(160))
        .attr('y', toScreenY(50));
      wrap(headingLeftEl, headingWrapWidth, headingFontSize, participantLeftBoldWords);
      const headingRightEl = svg
        .select('.participantLabelRight')
        .attr('font-size', headingFontSize)
        .attr('x', toScreenX(480))
        .attr('y', toScreenY(50));
      wrap(headingRightEl, headingWrapWidth, headingFontSize, participantRightBoldWords);

      // 18 icons per side, 3x6 grid, scales with iconScale.
      const localHalfWidth = 320;
      const gridCols = 3;
      const gridRows = 6;
      const gridTop = 110;
      const gridBottom = 620;
      const cellW = localHalfWidth / gridCols;
      const cellH = (gridBottom - gridTop) / gridRows;
      const participantScale = (Math.min(cellW, cellH) * 0.7) / 640;

      participantNodes.forEach((d) => {
        const xOffset = d.group === 'synaesthete' ? 0 : localHalfWidth;
        const col = d.index % gridCols;
        const row = Math.floor(d.index / gridCols);
        d.x = xOffset + cellW * (col + 0.5);
        d.y = gridTop + cellH * (row + 0.5);
        d.scale = participantScale;
      });
      if (participantIconGroups) {
        participantIconGroups.attr('transform', personIconTransform);
      }

      if (brainDots) {
        brainDots
          .attr('cx', (d) => (d.screenX / 100) * 640)
          .attr('cy', (d) => (d.screenY / 100) * 640)
          .attr('r', (d) => brainVolumeRadiusScale(d.volume))
          .attr('fill', (d) => brainEffectColorScale(d.effect))
          // Bryony: dots pulse (CSS), staggered per-dot so they don't flash in unison.
          .style('animation-delay', (d, i) => `${(i % 4) * 0.45}s`);
      }

      // Bryony: region-dot labels with leader lines, off the brain's local
      // midline; leader lines stay 1-per-dot so 2 can fan from one label.
      if (brainDotLabelGroups && brainDotLeaderLines) {
        // Bryony: labels scale with width like the other text.
        const dotLabelFontSize = Math.max(12, Math.min(15, width * 0.016));
        const labelLineGap = 6; // clears the text before the line starts
        const labelLineSpacing = dotLabelFontSize + 4; // main → sub baseline
        // Bryony: real 6px gap from the stroke's outer edge, via iconScale.
        const brainStrokeHalfWidth = 1.5;
        const hemisphereEdgePaddingLocal = brainStrokeHalfWidth + 6 / iconScale;

        const dotLocalPoint = (d) => ({ x: (d.screenX / 100) * 640, y: (d.screenY / 100) * 640 });

        // Screen position from the real hemisphere edge, so it reads
        // correctly at any icon size.
        const annotationLayout = {};
        brainDotAnnotations.forEach((a) => {
          const goRight = a.hemisphere === 'right';
          const localX = goRight
            ? brainRightHemisphereLeftEdge + hemisphereEdgePaddingLocal
            : brainLeftHemisphereRightEdge - hemisphereEdgePaddingLocal;
          const anchorX = toScreenX(localX);
          const mainY = toScreenY(a.localY);
          const subY = mainY + labelLineSpacing;
          annotationLayout[a.main + a.sub] = { anchorX, mainY, subY, textAnchor: goRight ? 'start' : 'end' };
        });

        // Bug: lines started from a fixed text-anchor side, sometimes
        // cutting through the label text; now from the nearest real edge.
        const annotationBox = {};
        brainDotLabelGroups.each(function (a) {
          const layout = annotationLayout[a.main + a.sub];
          const group = d3.select(this);
          const mainEl = group
            .select('.brainDotLabelMain')
            .text(a.main)
            .attr('x', layout.anchorX)
            .attr('y', layout.mainY)
            .attr('font-size', dotLabelFontSize)
            .attr('text-anchor', layout.textAnchor);
          const subEl = group
            .select('.brainDotLabelSub')
            .text(a.sub)
            .attr('x', layout.anchorX)
            .attr('y', layout.subY)
            .attr('font-size', dotLabelFontSize)
            .attr('text-anchor', layout.textAnchor);
          const mainBox = mainEl.node().getBBox();
          const subBox = subEl.node().getBBox();
          annotationBox[a.main + a.sub] = {
            left: Math.min(mainBox.x, subBox.x),
            right: Math.max(mainBox.x + mainBox.width, subBox.x + subBox.width),
            top: Math.min(mainBox.y, subBox.y),
            bottom: Math.max(mainBox.y + mainBox.height, subBox.y + subBox.height)
          };
        });

        // One shared attach point per label (centred on its box), not per line.
        const regionByKey = {};
        brainRegions.forEach((d) => {
          regionByKey[d.region + d.hemisphere] = d;
        });
        const annotationAttachPoint = {};
        brainDotAnnotations.forEach((a) => {
          const box = annotationBox[a.main + a.sub];
          const centerX = (box.left + box.right) / 2;
          const targetYs = a.targets.map((key) => toScreenY(dotLocalPoint(regionByKey[key]).y));
          const avgY = targetYs.reduce((sum, y) => sum + y, 0) / targetYs.length;
          const boxCenterY = (box.top + box.bottom) / 2;
          const y = avgY < boxCenterY ? box.top - labelLineGap : box.bottom + labelLineGap;
          annotationAttachPoint[a.main + a.sub] = { x: centerX, y };
        });

        // Leader lines live in local space (icon's own group), clamped to
        // the icon's 0-640 bounds; stroke-width compensated for iconScale.
        brainDotLeaderLines.each(function (d) {
          const key = d.region + d.hemisphere;
          const annotation = brainDotAnnotationByTarget[key];
          const line = d3.select(this);
          if (!annotation) {
            line.style('display', 'none');
            return;
          }
          line.style('display', null);
          const lineStart = annotationAttachPoint[annotation.main + annotation.sub];
          const dotLocal = dotLocalPoint(d);
          const localStartX = Math.max(0, Math.min(640, (lineStart.x - iconX) / iconScale));
          const localStartY = Math.max(0, Math.min(640, (lineStart.y - iconY) / iconScale));
          line
            .attr('x1', localStartX)
            .attr('y1', localStartY)
            .attr('x2', dotLocal.x)
            .attr('y2', dotLocal.y)
            .attr('stroke', brainEffectColorScale(d.effect))
            .attr('stroke-width', 1 / iconScale);
        });
      }

      // Bryony: simple corner legend; bar/circles scale with the icon,
      // but text is a fixed, resize-independent size (like .pubFootnote).
      const legendPad = 20; // matches .brainBgLabel's own corner padding

      // Effect bar spans the real data range (3.7-4.8); set here since
      // template expressions can't reach this closure's consts.
      // Bryony: small gap between the rect's bottom and the legend text.
      // Narrow phones (iPhone SE): the legend text steps down a size so its
      // lines no longer collide with each other or with the Volume circles.
      const narrowLegend = width < 420;
      const legendFontSize = narrowLegend ? 10 : 12;
      svg
        .selectAll(
          '.brainEffectValue, .brainEffectCaption, .brainVolumeValue, .brainVolumeCaption, .brainEffectTitle, .brainVolumeTitle, .brainLegendAnnotation'
        )
        .style('font-size', `${legendFontSize}px`);
      const microRowHeight = narrowLegend ? 14 : 16;
      // Bryony: bar width 2/3 of original (was 160).
      const effectBarWidth = Math.round(160 * (2 / 3));
      const effectBarHeight = 16;
      const effectBarScreenX = toScreenX(legendPad);
      const effectBarScreenRight = toScreenX(legendPad + effectBarWidth);
      const effectCaptionLines = 2;
      const effectCaptionFontSize = legendFontSize;
      const bottomPadding = 12; // real screen px, between a caption's last line and the rect's bottom edge
      const rectBottomScreen = toScreenY(640);

      svg.select('.brainEffectGradientMin').attr('stop-color', brainEffectColorScale(3.7));
      svg.select('.brainEffectGradientMax').attr('stop-color', brainEffectColorScale(4.8));

      const effectCaptionTop = rectBottomScreen - bottomPadding - effectCaptionLines * effectCaptionFontSize;
      const effectCaptionEl = svg
        .select('.brainEffectCaption')
        .text('Max statistical difference between synaesthetes + controls')
        .attr('x', effectBarScreenX)
        .attr('y', effectCaptionTop);
      // Bryony: wider wrap for the caption text.
      wrap(effectCaptionEl, Math.min(220, 280 * iconScale), effectCaptionFontSize);

      const effectBarScreenBottom = effectCaptionTop - 8;
      const effectBarScreenTop = effectBarScreenBottom - effectBarHeight * iconScale;
      // Back to local space; the bar still lives in the scaled group.
      const effectBarY = (effectBarScreenTop - iconY) / iconScale;
      svg
        .select('.brainEffectBar')
        .attr('x', legendPad)
        .attr('y', effectBarY)
        .attr('width', effectBarWidth)
        .attr('height', effectBarHeight);

      const effectValueScreenY = effectBarScreenTop - 4;
      svg
        .select('.brainEffectValueMin')
        .text('3.7')
        .attr('x', effectBarScreenX)
        .attr('y', effectValueScreenY);
      svg
        .select('.brainEffectValueMax')
        .text('4.8')
        .attr('x', effectBarScreenRight)
        .attr('y', effectValueScreenY);
      // Bryony: legend title labels, shifted up 8px.
      const legendTitleShift = 8;
      const legendTitleY = effectValueScreenY - microRowHeight - legendTitleShift;
      const effectTitleEl = svg
        .select('.brainEffectTitle')
        .text('Effect')
        .attr('x', effectBarScreenX)
        .attr('y', legendTitleY);

      // Bryony: "greater" in small grey italic, right after the title.
      const effectTitleBox = effectTitleEl.node().getBBox();
      svg
        .select('.brainEffectAnnotation')
        .text('greater')
        .attr('x', effectTitleBox.x + effectTitleBox.width + 4)
        .attr('y', legendTitleY);

      // Volume: 2 to-scale reference circles, right-aligned to mirror
      // Effect's own legendPad (measured from x=640 instead of x=0).
      const volumeLargeR = brainVolumeRadiusScale(100);
      const volumeSmallR = brainVolumeRadiusScale(44);
      // Bryony: whole Volume block (circles, title, annotation) nudged
      // left 8 screen px — subtracted in local units so it comes out as
      // exactly 8px after iconScale, same as everything derived from this.
      const volumeShiftPx = 8;
      const volumeCenterX = 640 - legendPad - volumeLargeR - volumeShiftPx / iconScale;
      const volumeCircleTopScreenY = effectValueScreenY;
      const volumeCircleBottomScreenY = volumeCircleTopScreenY + volumeLargeR * 2 * iconScale;
      const volumeBaselineY = (volumeCircleBottomScreenY - iconY) / iconScale; // back to local space

      svg
        .select('.brainVolumeCircleLarge')
        .attr('cx', volumeCenterX)
        .attr('cy', volumeBaselineY - volumeLargeR)
        .attr('r', volumeLargeR);
      svg
        .select('.brainVolumeCircleSmall')
        .attr('cx', volumeCenterX)
        .attr('cy', volumeBaselineY - volumeSmallR)
        .attr('r', volumeSmallR);

      const volumeScreenCenterX = toScreenX(volumeCenterX);
      svg
        .select('.brainVolumeValueLarge')
        .text('100')
        .attr('x', volumeScreenCenterX)
        .attr('y', volumeCircleTopScreenY + 3);
      svg
        .select('.brainVolumeValueSmall')
        .text('44')
        .attr('x', volumeScreenCenterX)
        .attr('y', toScreenY(volumeBaselineY - volumeSmallR * 2) + 3);
      // Bryony: align Volume's label with Effect's, same row.
      const volumeTitleY = legendTitleY;
      svg
        .select('.brainVolumeTitle')
        .text('Volume')
        .attr('x', volumeScreenCenterX)
        .attr('y', volumeTitleY);

      // Bryony: "more widespread" annotation below Volume's title.
      svg
        .select('.brainVolumeAnnotation')
        .text('more widespread')
        .attr('x', volumeScreenCenterX)
        .attr('y', volumeTitleY + microRowHeight - 4);

      // Bryony: Volume caption aligned with Effect's caption row.
      const volumeCaptionFontSize = legendFontSize;
      const volumeCaptionTop = effectCaptionTop;
      const volumeCaptionEl = svg
        .select('.brainVolumeCaption')
        .text('Size of the significant brain region (mm³)')
        .attr('x', toScreenX(350))
        .attr('y', volumeCaptionTop);
      // Bryony: wider wrap for the Volume caption — narrowed by the same
      // 8px the Volume block above shifted left, so wrapped lines don't
      // now run into it.
      // Also stop short of the Volume circles, which sit to its right.
      const volumeCaptionRoom = volumeScreenCenterX - volumeLargeR * iconScale - 8 - toScreenX(350);
      const volumeCaptionWidth = Math.max(
        60,
        Math.min(Math.min(220, 250 * iconScale) - volumeShiftPx, volumeCaptionRoom)
      );
      wrap(volumeCaptionEl, volumeCaptionWidth, volumeCaptionFontSize);
    }

    // Step 10, just getting the beat on the page for now: a title
    // ("When do synaesthete connections form?") over Bryony's reference
    // photo — mirrors layoutBrain()'s own title layout above, then fits
    // the image, aspect-ratio-locked (1022x848, its real pixel size),
    // into the remaining space below it.
    function layoutConnections() {
      const titleFontSize = Math.max(18, Math.min(28, width * 0.036));
      const titleWrapWidth = Math.min(width - 48, titleFontSize * 30);
      const titleEl = svg
        .select('.connectionsTitle')
        .text('When do synaesthete connections form?')
        .attr('font-size', titleFontSize)
        .attr('x', width / 2)
        .attr('y', topPadding + titleFontSize / 2);
      wrap(titleEl, titleWrapWidth, titleFontSize);
      const titleBox = titleEl.node().getBBox();

      const subtitleFontSize = Math.max(13, Math.min(17, width * 0.018));
      const subtitleWrapWidth = Math.min(width - 48, subtitleFontSize * 44);
      const subtitleEl = svg
        .select('.connectionsSubtitle')
        .text('Witthoft, Winawer & Eagleman (2015) · 6,588 synaesthetes')
        .attr('font-size', subtitleFontSize)
        .attr('x', width / 2)
        .attr('y', titleBox.y + titleBox.height + spacing.lg + subtitleFontSize / 2);
      wrap(subtitleEl, subtitleWrapWidth, subtitleFontSize);
      const subtitleBox = subtitleEl.node().getBBox();

      // Step10: drawn magnet tray (rounded rect + dividers), 26 letters.
      const headerHeight = subtitleBox.y + subtitleBox.height;
      const trayTop = headerHeight + spacing['4xl'];
      const trayBottom = height - edgeMargin - spacing['2xl'];
      // Bryony: mobile side margin shrunk to 25% of what it was, so the
      // tray (and the ring, which shares this same band width) can use
      // almost the full screen width — the letters, sized off the tray's
      // inner width, grow along with it.
      const isMobileConnections = width < breakpoints.mobile;
      const connectionsSideMargin = (edgeMargin + spacing['4xl']) * (isMobileConnections ? 0.25 : 1);
      const trayMaxWidth = width - connectionsSideMargin * 2;
      const trayMaxHeight = trayBottom - trayTop;
      // Bryony: shared with layoutHeatmap() — the ring sizes itself off
      // this full band, not the (aspect-constrained, often much shorter)
      // tray rectangle below.
      connectionsBandTop = trayTop;
      connectionsBandBottom = trayBottom;
      connectionsBandWidth = trayMaxWidth;
      connectionsBandCenterX = width / 2;
      // Tray aspect ratio, tuned per Bryony's feedback. Letters sized off
      // trayMaxWidth so this constant reshapes tray, not letter size.
      const trayAspect = 1.8;
      let trayWidth = trayMaxWidth;
      let trayHeight = trayWidth / trayAspect;
      if (trayHeight > trayMaxHeight) {
        trayHeight = trayMaxHeight;
        trayWidth = trayHeight * trayAspect;
      }
      const trayX = width / 2 - trayWidth / 2;
      // Bryony: same fix as the brain icon — true screen-centre (vh / 2),
      // not just centred within the band below the header, which read as
      // top-heavy. Clamped so it never climbs under the header or runs
      // past the bottom of its band.
      const trayTargetCenterY = height / 2;
      const trayY = Math.min(
        trayBottom - trayHeight,
        Math.max(trayTop, trayTargetCenterY - trayHeight / 2)
      );
      // Split X/Y padding so vertical pad can be tightened separately.
      const trayPadX = trayWidth * 0.035;
      // Top pad cut back per Bryony's "less space at the top".
      const trayPadTop = trayHeight * 0.006;
      const trayPadBottom = trayHeight * 0.015;

      svg
        .select('.magnetTray')
        .attr('x', trayX)
        .attr('y', trayY)
        .attr('width', trayWidth)
        .attr('height', trayHeight)
        .attr('rx', trayWidth * 0.03);

      const innerX = trayX + trayPadX;
      const innerY = trayY + trayPadTop;
      const innerWidth = trayWidth - trayPadX * 2;
      const innerHeight = trayHeight - trayPadTop - trayPadBottom;
      // Rectangular cells edge-to-edge, mimicking the real tray photo.
      const rowCount = magnetRowLengths.length;
      const cellHeight = innerHeight / rowCount;

      // Compartment dividers between rows, full inner width.
      for (let d = 1; d < rowCount; d++) {
        const dividerY = innerY + cellHeight * d;
        svg
          .select(`.magnetTrayDivider${d}`)
          .attr('x1', innerX)
          .attr('x2', innerX + innerWidth)
          .attr('y1', dividerY)
          .attr('y2', dividerY);
      }
      // Left/right edge lines, mimicking the real tray's outer walls.
      svg
        .select('.magnetTrayEdgeLeft')
        .attr('x1', innerX)
        .attr('x2', innerX)
        .attr('y1', innerY)
        .attr('y2', innerY + innerHeight);
      svg
        .select('.magnetTrayEdgeRight')
        .attr('x1', innerX + innerWidth)
        .attr('x2', innerX + innerWidth)
        .attr('y1', innerY)
        .attr('y2', innerY + innerHeight);

      if (magnetLetterGroups) {
        // Bug fix: sizing off row height alone let wide letters (esp. 'M')
        // overlap. Now sized off measured Fredoka 600 glyph widths instead.
        const FREDOKA600_MAX_ADVANCE_RATIO = 0.9951; // 'M' — advance width ÷ font-size, the widest letter in a 7-letter row
        const letterWidthClearance = 0.97; // gap left for 'M', tightened per Bryony's "font size a bit bigger"
        // Bug fix: was sizing off trayMaxWidth, wrong on height-bound
        // (mobile) trays. Uses actual innerWidth so it's consistent everywhere.
        const narrowestRowCellWidth = innerWidth / 7; // the two 7-letter rows are the tight fit; 6-letter rows have room to spare
        const letterFontSize = (narrowestRowCellWidth * letterWidthClearance) / FREDOKA600_MAX_ADVANCE_RATIO;
        const positions = [];
        magnetRowLengths.forEach((rowLength, r) => {
          // 6-letter rows spread evenly across full width, per Bryony.
          const rowCellWidth = innerWidth / rowLength;
          for (let c = 0; c < rowLength; c++) {
            positions.push({
              x: innerX + rowCellWidth * c + rowCellWidth / 2,
              y: innerY + cellHeight * r + cellHeight / 2
            });
          }
        });
        magnetLetterGroups
          .attr('x', (d, i) => positions[i].x)
          .attr('y', (d, i) => positions[i].y)
          .attr('font-size', letterFontSize)
          // Re-centre on measured bbox, not font metrics, for true alignment.
          .each(function (d, i) {
            const target = positions[i].y;
            const bbox = this.getBBox();
            const visualCenter = bbox.y + bbox.height / 2;
            this.setAttribute('y', target + (target - visualCenter));
          });

        // Step11 needs each letter's settled tray position as origin.
        magnetLetterGroups.each(function (d) {
          d.trayX = parseFloat(this.getAttribute('x'));
          d.trayY = parseFloat(this.getAttribute('y'));
        });
        magnetTrayLetterFontSize = letterFontSize;
      }
    }

    // Step 12: "Why do I care?" takes the header slot once the
    // connections/heatmap scene has cleared — same layout approach as
    // layoutConnections()'s own title above.
    function layoutWhyICare() {
      // Bryony: was out of sync with every other step's title (22-36/0.04
      // instead of the 18-28/0.036 the comment above already claimed) —
      // now actually matches layoutConnections()/layoutBrain()/etc, and
      // "What about you?" below it (same clamp in App.svelte's CSS).
      const fontSize = Math.max(18, Math.min(28, width * 0.036));
      const wrapWidth = Math.min(width - 48, fontSize * 20);
      const titleEl = svg
        .select('.whyICareTitle')
        .text('Why do I care?')
        .attr('font-size', fontSize)
        .attr('x', width / 2)
        .attr('y', topPadding + fontSize / 2);
      wrap(titleEl, wrapWidth, fontSize);
    }

    // Step11: blends letter from tray -> ring position.
    function magnetLetterTransform(d) {
      const t1 = d.ringAmt || 0;
      const targetX = lerp(d.trayX, d.ringX, t1);
      const targetY = lerp(d.trayY, d.ringY, t1);
      const s = lerp(1, d.ringScale, t1);
      const dx = targetX - d.trayX;
      const dy = targetY - d.trayY;
      return `translate(${dx},${dy}) translate(${d.trayX},${d.trayY}) scale(${s}) translate(${-d.trayX},${-d.trayY})`;
    }

    // Cached d3.interpolateRgb per rawColor/sortedColor pair.
    function heatmapCellColor(rawColor, sortedColor, amt) {
      const key = rawColor + '|' + sortedColor;
      let interp = heatmapColorInterpCache[key];
      if (!interp) {
        interp = d3.interpolateRgb(rawColor, sortedColor);
        heatmapColorInterpCache[key] = interp;
      }
      return interp(amt);
    }

    // Shared by setConnectionsProgress() (raw order, as letters land on the
    // ring) and setHeatmapProgress() (animates on to match-clustered order).
    // filterAmt (step10's "even stronger" caption) is a real filter, not a
    // dim: the 1975-1980 respondents expand to fill the whole ring band,
    // everyone else shrinks away to nothing and fades out; reverses the
    // same way as the step moves on.
    function drawHeatmapCells(colorOrderAmt, filterAmt = 0, spotlightAmt = 0) {
      heatmapCellGroups.each(function (d) {
        const baseRank = lerp(d.falseRank, d.trueRank, colorOrderAmt);
        const baseR0 = d.ringInnerRadius + baseRank * d.ringPitch;
        const baseR1 = d.ringInnerRadius + (baseRank + 1) * d.ringPitch + d.cellOverlap;
        let r0 = baseR0;
        let r1 = baseR1;
        let opacity = 1;
        if (filterAmt > 0) {
          if (d.inFilter) {
            // Re-ranked (and re-pitched) across just the filtered
            // respondents, so the 107 cells widen to fill the whole ring
            // band rather than spreading thin with gaps between them.
            const filteredPitch = d.ringPitch * (nUsers / yobFilterCount);
            const filteredR0 = d.ringInnerRadius + d.filterRank * filteredPitch;
            const filteredR1 = filteredR0 + filteredPitch + d.cellOverlap * (nUsers / yobFilterCount);
            r0 = lerp(baseR0, filteredR0, filterAmt);
            r1 = lerp(baseR1, filteredR1, filterAmt);
          } else {
            // Collapses to a sliver at its own outer edge, fading out —
            // "filtered away" rather than just dimmed.
            r0 = lerp(baseR0, baseR1, filterAmt);
            opacity = 1 - filterAmt;
          }
        }
        const fill = heatmapCellColor(d.rawColor, d.sortedColor, colorOrderAmt);
        if (spotlightAmt > 0) {
          // Bryony: "instead of greying out go for opacity 0.1" — the
          // "25 out of 26" respondent's own band (already repositioned
          // to the ring's middle, see seedHeatmapRanks()) widens to 5x,
          // while everyone else just fades down to near-invisible.
          if (d.isSpotlight) {
            const mid = (r0 + r1) / 2;
            const halfWidth = ((r1 - r0) / 2) * lerp(1, 5, spotlightAmt);
            r0 = mid - halfWidth;
            r1 = mid + halfWidth;
          } else {
            opacity = lerp(opacity, 0.1, spotlightAmt);
          }
        }
        this.setAttribute('d', heatmapArc({ innerRadius: r0, outerRadius: r1, startAngle: d.a0, endAngle: d.a1 }));
        this.style.fill = fill;
        this.style.opacity = opacity;
      });
    }

    // Step11 cell ranks/colours, seeded once (data-only, not layout).
    function seedHeatmapRanks() {
      const byLetter = {};
      heatmapCellGroups.each(function (d) {
        (byLetter[d.letter] || (byLetter[d.letter] = [])).push(d);
      });
      Object.keys(byLetter).forEach((letter) => {
        const cells = byLetter[letter];
        const matches = cells.filter((d) => d.isMatch);
        const nonMatches = cells.filter((d) => !d.isMatch);
        matches.forEach((d, r) => {
          d.trueRank = r;
        });
        nonMatches.forEach((d, r) => {
          d.trueRank = matches.length + r;
        });
        cells.forEach((d) => {
          // Permanent swap (not an animated move) — every raw-order
          // view shows the spotlighted respondent at the middle.
          if (d.i === spotlightUserIndex) {
            d.falseRank = spotlightMiddleIndex;
          } else if (d.i === spotlightMiddleIndex) {
            d.falseRank = spotlightUserIndex;
          } else {
            d.falseRank = d.i;
          }
          d.rawColor = codeColor[d.code] || colors.grey;
          d.sortedColor = d.isMatch ? magnetTemplateColorByLetter[letter] : colors.backgroundTint; // Bryony: non-matches use the darker background tint (same as the side panels)
          d.filterRank = yobFilterRankByIndex[d.i];
          d.isSpotlight = d.i === spotlightUserIndex;
        });
      });
      // Paints on top of every other cell it overlaps once expanded,
      // regardless of data-join order.
      heatmapCellGroups.filter((d) => d.isSpotlight).raise();
    }

    // Step11 ring + bar geometry, computed once per resize per datum.
    // Uses real d3.arc() annular sectors, matching Bryony's Observable original.
    const HEATMAP_SLICE_WIDTH = (2 * Math.PI) / 26; // d3.arc's own angle convention: 0 = 12 o'clock, increasing clockwise
    function heatmapLetterStartAngle(letter) {
      return (letter.charCodeAt(0) - 65) * HEATMAP_SLICE_WIDTH; // 'A'.charCodeAt(0) — A's slice starts at the top
    }

    function layoutHeatmap() {
      if (!heatmapCellGroups || !magnetLetterGroups) return;

      // --- Ring layout (colorOrder false/true beats) ---
      // Bryony: sized off the full step10 band layoutConnections() set
      // aside (connectionsBand*), not the tray rectangle itself — the
      // tray's own aspect ratio made it much shorter than the band, which
      // left the ring tiny with unused horizontal room either side of it.
      // Bryony: margin only needs to clear the letter glyphs themselves
      // now, not a flat guess — so the ring can grow as big as the band
      // allows with just a sliver of padding either side.
      const ringBandHeight = connectionsBandBottom - connectionsBandTop;
      // Bryony: ring letters at least twice as big, and sitting a bit
      // closer in (ringLetterRadius below), per her screen-size-independent note.
      const ringLetterFontSize = Math.max(20, Math.min(32, magnetTrayLetterFontSize * 1.1));
      const ringScale = ringLetterFontSize / magnetTrayLetterFontSize;
      const ringLabelMargin = ringLetterFontSize * 0.4 + 2; // a bit tighter again, per Bryony — slightly bigger ring
      const ringCx = connectionsBandCenterX;
      const ringOuterRadius = Math.max(20, Math.min(connectionsBandWidth, ringBandHeight) / 2 - ringLabelMargin);
      // Bryony: same fix as the brain icon/tray — true screen-centre
      // (vh / 2), clamped so the ring never climbs under the header or
      // runs past the bottom of its band.
      const ringTargetCenterY = height / 2;
      const ringCy = Math.min(
        connectionsBandBottom - ringOuterRadius,
        Math.max(connectionsBandTop + ringOuterRadius, ringTargetCenterY)
      );
      const ringInnerRadius = ringOuterRadius * 0.32;
      const cellBandOuterRadius = ringOuterRadius * 0.86; // leaves room for the letter labels just outside it
      const ringLetterRadius = ringOuterRadius * 0.96; // Bryony: 0.94 still sat too close to the coloured ring, push right out to the edge of the available band
      heatmapCellBandOuterRadius = cellBandOuterRadius;

      // Every ring child (cells/separators/morph pieces) draws in LOCAL
      // coordinates, origin at the ring's own centre — one group
      // transform here instead of baking ringCx/ringCy into every shape.
      svg.select('.heatmapRingGroup').attr('transform', `translate(${ringCx},${ringCy})`);

      magnetLetterGroups.each(function (d) {
        const a0 = heatmapLetterStartAngle(d.letter);
        const mid = a0 + HEATMAP_SLICE_WIDTH / 2;
        d.ringX = ringCx + Math.sin(mid) * ringLetterRadius;
        d.ringY = ringCy - Math.cos(mid) * ringLetterRadius;
        d.ringScale = ringScale;
      });

      // --- Separators: one per letter, at its slice's own start angle ---
      heatmapSeparatorLines
        .attr('x1', (d) => Math.sin(heatmapLetterStartAngle(d.letter)) * ringInnerRadius)
        .attr('y1', (d) => -Math.cos(heatmapLetterStartAngle(d.letter)) * ringInnerRadius)
        .attr('x2', (d) => Math.sin(heatmapLetterStartAngle(d.letter)) * cellBandOuterRadius)
        .attr('y2', (d) => -Math.cos(heatmapLetterStartAngle(d.letter)) * cellBandOuterRadius);

      // --- Per-cell geometry (ring wedges) ---
      // `pitch` is the plain, unpadded radial spacing between consecutive
      // respondents' boundaries — matches the original's own
      // radiusAt()/radiusBoundaries. Each cell's drawn OUTER radius gets
      // a small overlap added (Bryony's original does exactly this too:
      // "r1 = r0 + cellH + 0.4 // slight overlap hides seams") so
      // adjacent cells overlap by a hair instead of merely touching —
      // same fix as the bar-rect seam Bryony flagged, ported to arcs.
      const heatmapCellOverlap = 0.6;
      const ringPitch = (cellBandOuterRadius - ringInnerRadius) / nUsers;

      heatmapCellGroups.each(function (d) {
        d.a0 = heatmapLetterStartAngle(d.letter);
        d.a1 = d.a0 + HEATMAP_SLICE_WIDTH;
        d.ringInnerRadius = ringInnerRadius;
        d.ringPitch = ringPitch;
        d.cellOverlap = heatmapCellOverlap;
      });

      if (!heatmapRanksSeeded) {
        seedHeatmapRanks();
        heatmapRanksSeeded = true;
      }

      // Re-applies current progress so a resize mid-scroll doesn't snap.
      setHeatmapProgress(currentHeatmapProgress);
    }

    // Step2: grows/colours/labels one word, scaling around its start point.
    function applyWordHighlight(el, cfg, t, baseX, baseY) {
      const posAmt = windPhase(t, cfg.grow, cfg.fadeBack);
      const colorAmt = windPhase(t, cfg.colorIn, cfg.fadeBack);
      const labelAmt = windPhase(t, cfg.labelIn, cfg.fadeBack);

      const textWidth = el.node().getComputedTextLength();
      const s = lerp(1, cfg.grow.scale, posAmt);
      const dx = lerp(0, cfg.grow.dx, posAmt);

      el.attr(
        'transform',
        `translate(${dx},0) translate(${baseX},${baseY}) scale(${s}) translate(${-baseX},${-baseY})`
      );
      el.style('fill', d3.interpolateRgb(colors.text, cfg.color)(colorAmt));

      // Word's current on-screen centre: start point + dx + half width.
      const centerX = baseX + dx + (textWidth * s) / 2;

      return { centerX, labelAmt };
    }

    // Step 2: SYN then AESTHESIA take their turn (see step2 in steps.js).
    function setEtymologyProgress(t) {
      if (!answer) return;

      const syn = applyWordHighlight(svg.select('.synText'), step2.syn, t, etymSynX, etymWordBaselineY);
      const aesthesia = applyWordHighlight(
        svg.select('.aesthesiaText'),
        step2.aesthesia,
        t,
        etymSynX + etymSynWidth,
        etymWordBaselineY
      );

      const active = t < 0.5 ? { cfg: step2.syn, ...syn } : { cfg: step2.aesthesia, ...aesthesia };
      const wordTop = etymWordBaselineY - etymWordFontSize / 2;
      const wordBottom = etymWordBaselineY + etymWordFontSize / 2;
      const x = active.centerX;

      svg
        .select('.etymologyCaption')
        .text(active.cfg.caption)
        .attr('x', x)
        .attr('y', wordTop - labelOffset)
        .style('opacity', active.labelAmt);

      svg
        .select('.etymologyLabel')
        .text(active.cfg.label)
        .attr('x', x)
        .attr('y', wordBottom + labelOffset)
        .style('opacity', active.labelAmt);
    }

    // Step 3: title settles, "What is" fades in, icons + closing lines follow.
    function setTitleProgress(t) {
      if (!answer) return;
      const titleT = phase(t, step3.title.start, step3.title.end);
      const whatIsT = phase(t, step3.whatIs.fadeIn.start, step3.whatIs.fadeIn.end);
      const leadOutT = phase(t, step3.lead.fadeOut.start, step3.lead.fadeOut.end);
      const sensesT = phase(t, step3.senses.fadeIn.start, step3.senses.fadeIn.end);
      // leadOutT is already done by the time senses.fadeIn starts.
      const showSenses = t >= step3.senses.fadeIn.start;

      svg
        .select('.synText')
        .attr('x', lerp(etymSynX, synTitleX, titleT))
        .attr('y', lerp(etymWordBaselineY, titleY, titleT))
        .attr('font-size', lerp(etymWordFontSize, titleFontSize, titleT));

      svg
        .select('.aesthesiaText')
        .attr('x', lerp(etymSynX + etymSynWidth, aesthesiaTitleX, titleT))
        .attr('y', lerp(etymWordBaselineY, titleY, titleT))
        .attr('font-size', lerp(etymWordFontSize, titleFontSize, titleT));

      svg.select('.whatIsText').style('opacity', whatIsT);
      svg.select('.titleQuestion').style('opacity', whatIsT);

      // Step3: leadText swap, stays put. Senses mode uses etymLeadY +
      // sensesYShift so the whole senses block can sit higher than the
      // plain intro text without moving that intro text itself.
      if (t > 0) {
        const leadEl = svg.select('.leadText');
        if (showSenses !== leadTextShowingSenses) {
          leadTextShowingSenses = showSenses;
          if (showSenses) renderSensesLeadText(etymLeadY + sensesYShift);
          else leadEl.text(answer.lead);
        }
        leadEl.attr('y', showSenses ? etymLeadY + sensesYShift : etymLeadY);
        leadEl.style('opacity', showSenses ? sensesT : 1 - leadOutT);
      }

      // Guard for the brief pre-first-resize gap, like personGroups.
      if (senseGroups) {
        iconNodes.forEach((d, i) => {
          const start = step3.icons.start + i * step3.icons.staggerEach;
          d.opacity = phase(t, start, start + step3.icons.fadeInLength);
        });
        senseGroups.style('opacity', (d) => d.opacity);
      }

      svg.select('.closingLine').style('opacity', phase(t, step3.closing.fadeIn.start, step3.closing.fadeIn.end));
      svg
        .select('.closingSubline')
        .style('opacity', phase(t, step3.closing.sublineFadeIn.start, step3.closing.sublineFadeIn.end));
    }

    // Step 4: 5 quotes, one word at a time; sense words flash matching icon.
    function setQuotesProgress(t) {
      if (!answer) return;

      // Current quote: last one whose sliceStart we've reached.
      let activeQuote = 0;
      for (let qi = 0; qi < quotesLayout.length; qi++) {
        if (t >= quotesLayout[qi].sliceStart) activeQuote = qi;
      }

      // "Clear" phase: title/senses/closing fade as icons rise. Guarded
      // like leadText so it doesn't show before step3 has run.
      const clearT = phase(t, step4.clear.fadeOut.start, step4.clear.fadeOut.end);
      if (t > 0) {
        const fadeOpacity = 1 - clearT;
        svg.select('.synText').style('opacity', fadeOpacity);
        svg.select('.aesthesiaText').style('opacity', fadeOpacity);
        svg.select('.whatIsText').style('opacity', fadeOpacity);
        svg.select('.titleQuestion').style('opacity', fadeOpacity);
        svg.select('.leadText').style('opacity', fadeOpacity);
        svg.select('.closingLine').style('opacity', fadeOpacity);
        svg.select('.closingSubline').style('opacity', fadeOpacity);
      }

      if (senseGroups) {
        // Icons dim to 0.4, light up once active quote's matching word appears.
        const arrived = clearT >= 1;
        const activeWords = quotes[activeQuote].words;
        const activeWordLayout = quotesLayout[activeQuote].words;

        iconNodes.forEach((d) => {
          d.riseAmt = clearT;
          const centers = senseFlashCenters[d.label] || [];
          let flash = 0;
          centers.forEach((center) => {
            const amt = Math.max(0, 1 - Math.abs(t - center) / step4.flashHalfWidth);
            if (amt > flash) flash = amt;
          });
          d.flash = flash;

          if (arrived) {
            const included = activeWords.some((w, wi) => w.sense === d.label && t >= activeWordLayout[wi].start);
            d.opacity = included ? 1 : 0.4;
          }
        });
        senseGroups.attr('transform', iconTransform);
        if (arrived) senseGroups.style('opacity', (d) => d.opacity);
      }

      // People illustration + bubble fade in once after the clear phase.
      const peopleT = phase(t, step4.people.fadeIn.start, step4.people.fadeIn.end);
      svg.select('.peopleIconsGroup').style('opacity', peopleT);
      svg.select('.quoteBubble').style('opacity', peopleT);

      // Dim every person icon except whoever's quote is currently active.
      if (personIconGroups) {
        personIconGroups.style('opacity', (d, i) => (i === activeQuote ? 1 : 0.4));
      }

      // Bubble tail aims at the active person icon's real x.
      if (bubbleW) {
        const targetX = personIconNodes[activeQuote] ? personIconNodes[activeQuote].x : bubbleX + bubbleW / 2;
        const personT = personTForX(targetX, bubbleX, bubbleW, bubbleH);
        svg.select('.quoteBubblePath').attr('d', bubblePersonPath(bubbleX, bubbleY, bubbleW, bubbleH, personT));
      }

      if (!quotesGroups) return;
      quotesGroups.each(function (quote, qi) {
        const layout = quotesLayout[qi];
        const wordNodes = d3.select(this).selectAll('.quoteWord').nodes();
        quote.words.forEach((w, wi) => {
          const wordLayout = layout.words[wi];
          const amt = windPhase(t, wordLayout, { start: layout.fadeStart, end: layout.fadeEnd });
          wordNodes[wi].style.opacity = amt;
        });
      });
    }

    // Step 5: step4 fades except sense icons, which move onto the sight ring.
    function setSightProgress(t) {
      if (!answer) return;
      sightT = t;

      // Pure functions of t, so scrolling back up unwinds cleanly.
      const arriveT = phase(t, step5.arrive.fadeOut.start, step5.arrive.fadeOut.end);
      const revealT = phase(t, step5.reveal.fadeIn.start, step5.reveal.fadeIn.end);
      // Bryony: nothing moves or changes opacity (people, other senses,
      // sub-group labels) until the "grapheme" caption is past halfway —
      // see step5.move in steps.js. Photos then fly into their link
      // positions, while the other senses and the arrows fade in quickly
      // (step5.linksFade, ~10% of the step) so they're already visible as
      // the pictures travel.
      const headerT = phase(t, step5.header.fadeIn.start, step5.header.fadeIn.end);
      const moveT = phase(t, step5.move.start, step5.move.end);
      const linksT = phase(t, step5.linksFade.start, step5.linksFade.end);
      if (linkPhotoGroups) {
        linkPhotoGroups.attr('transform', (d) => {
          d.x = lerp(d.startX, d.endX, moveT);
          d.y = lerp(d.startY, d.endY, moveT);
          d.rotation = lerp(0, d.endRotation, moveT);
          return `translate(${d.x},${d.y}) rotate(${d.rotation})`;
        });
      }
      tileShrinkT = moveT;
      if (personGroups) positionNodes();
      // Temp labels fade out on the same trigger as tiles moving.
      if (sightSubIconGroups) {
        sightSubIconGroups.select('.sightSubIconLabel').style('opacity', 1 - moveT);
      }

      if (senseGroups) {
        // sightAmt blends toward sightX/Y only; never touches row position.
        iconNodes.forEach((d) => {
          d.sightAmt = arriveT;
        });
        senseGroups.attr('transform', iconTransform).style('opacity', (d) => {
          const arrived = lerp(d.opacity, 1, arriveT);
          // Non-sight icons dim to 0.2 while sub-icons stagger in.
          if (d.label === 'sight') return arrived;
          return lerp(lerp(arrived, 0.2, revealT), arrived, linksT);
        });
        // Labels fade out with arriveT, reversible on scroll-back.
        senseGroups.select('.senseIconLabel').style('opacity', 1 - arriveT);
        // White bg circle behind every sense except sight, this step only.
        senseGroups.select('.senseIconBg').style('opacity', (d) => (d.label === 'sight' ? 0 : arriveT));
      }

      if (t > 0) {
        const fadeOpacity = 1 - arriveT;
        svg.select('.peopleIconsGroup').style('opacity', fadeOpacity);
        svg.select('.quoteBubble').style('opacity', fadeOpacity);
        svg.select('.quotesGroup').style('opacity', fadeOpacity);
      }

      svg.select('.sightCircle').style('opacity', revealT);

      // Staggers objects -> colour -> letters/numbers, per Bryony.
      svg.select('.sightSubIconsGroup').style('opacity', 1);
      if (sightSubIconGroups) {
        const staggerOrder = ['objects', 'colors', 'lettersNumbers'];
        const span = (step5.reveal.fadeIn.end - step5.reveal.fadeIn.start) / staggerOrder.length;
        sightSubIconGroups.style('opacity', (d) => {
          const start = step5.reveal.fadeIn.start + staggerOrder.indexOf(d.key) * span;
          return phase(t, start, start + span);
        });
      }

      // Relationship arrows now fade in here (was Step 7), with the photos.
      svg.select('.linksGroup').style('opacity', linksT);
      svg.select('.linkPhotosGroup').style('opacity', revealT);
      sightRevealT = revealT;

      const displayStage = revealT >= 1 ? 'famous' : 'split';
      svg.select('.sightLabel').style('opacity', headerT);
      if (displayStage !== sightHeaderStage) {
        sightHeaderStage = displayStage;
        const labelEl = svg
          .select('.sightLabel')
          .text(sightHeaderStage === 'famous' ? sightFamousText : sightSplitText)
          .attr('font-size', sightLabelFontSize)
          .attr('x', width / 2)
          .attr('y', topPadding + sightLabelFontSize / 2);
        wrap(labelEl, sightLabelWrapWidth, sightLabelFontSize);
      }
    }

    // Step 6: relationship arrows fade in; photo fans already flew in step5.
    function setLinksProgress(t) {
      if (!answer) return;
      const revealT = phase(t, step6.reveal.fadeIn.start, step6.reveal.fadeIn.end);
      // Photos AND arrows are handled in setSightProgress now, and the header
      // stays "So what about our famous synaesthetes?" through this step
      // (Bryony), so this only shrinks the linked tiles.
      // Same revealT shrinks the linked person's own tile (positionNodes()).
      linksRevealT = revealT;
      if (personGroups) positionNodes();
    }

    // Step 7: x-axis, then line/area draw left-to-right, then y-axis.
    function setPublicationsProgress(t) {
      const storyFadeT = phase(t, step7.storyFadeOut.start, step7.storyFadeOut.end);
      svg.select('.storyGroup').style('opacity', 1 - storyFadeT);
      // Bug fix: opacity alone didn't stop hover; toggle pointer-events
      // on .personGroup/.linkPhotoItem directly, since their own explicit
      // value beats the ancestor's.
      svg.select('.storyGroup').style('pointer-events', storyFadeT >= 1 ? 'none' : null);
      if (storyFadeT > 0) {
        // no mouseleave fires once pointer-events go off
        hidePersonPanel();
        clearLinkHighlight();
      }
      svg.selectAll('.personGroup, .linkPhotoItem').style('pointer-events', storyFadeT >= 1 ? 'none' : null);

      const titleT = phase(t, step7.title.fadeIn.start, step7.title.fadeIn.end);
      svg.select('.publicationsTitle').style('opacity', titleT);

      const xAxisT = phase(t, step7.xAxis.fadeIn.start, step7.xAxis.fadeIn.end);
      svg.select('.pubXAxisGroup').style('opacity', xAxisT);

      // Draw ends with buffer before the step itself ends.
      const drawT = phase(t, step7.draw.start, step7.draw.end);
      pubDrawT = drawT;
      svg.select('.pubDrawClipRect').attr('width', pubChartWidth * drawT);

      // Y-axis moved here so it shares this step's timeline with the draw.
      const yAxisT = phase(t, step7.yAxis.fadeIn.start, step7.yAxis.fadeIn.end);
      svg.select('.pubYAxisGroup').style('opacity', yAxisT);
      svg.select('.pubFootnote').style('opacity', yAxisT);

      // Markers now reveal alongside this step's own captions (was step 9's
      // opening beat) — 1892 as "The term" caption moves up, 2007+2015 as
      // "Let's focus" arrives.
      const markerT = phase(t, step7.marker.fadeIn.start, step7.marker.fadeIn.end);
      svg.select('.pubMarker').style('opacity', markerT);
      pubMarkerT = markerT;

      const citation1T = phase(t, step7.citation1.fadeIn.start, step7.citation1.fadeIn.end);
      svg.select('.pubCitation1').style('opacity', citation1T);

      const citation2T = phase(t, step7.citation2.fadeIn.start, step7.citation2.fadeIn.end);
      svg.select('.pubCitation2').style('opacity', citation2T);
    }

    // Step 9: publications chart fades out, brain scene fades in in order.
    function setBrainProgress(t) {
      const chartFadeT = phase(t, step9.chartFadeOut.start, step9.chartFadeOut.end);
      svg.select('.publicationsGroup').style('opacity', 1 - chartFadeT);

      const titleT = phase(t, step9.title.fadeIn.start, step9.title.fadeIn.end);
      svg.select('.brainTitle').style('opacity', titleT);
      // Rouw & Scholte subtitle stays visible once faded in, per Bryony.
      svg.select('.brainSubtitle').style('opacity', titleT);

      // Group labels + participant icons fade in then out before the brain.
      const introFadeInT = phase(t, step9.intro.fadeIn.start, step9.intro.fadeIn.end);
      const introFadeOutT = phase(t, step9.intro.fadeOut.start, step9.intro.fadeOut.end);
      const introT = Math.min(introFadeInT, 1 - introFadeOutT);
      svg.select('.participantLabelLeft').style('opacity', introT);
      svg.select('.participantLabelRight').style('opacity', introT);
      svg.select('.participantIconsGroup').style('opacity', introT);
      // Bg rects fade in with intro and stay, doubling as the brain's backdrop.
      svg.select('.brainBgGroup').style('opacity', introFadeInT);

      // Scan-line sweep brightens icons as it passes, per Bryony's request.
      const scanRawT = phase(t, step9.intro.scan.start, step9.intro.scan.end);
      const scanSpan = step9.intro.scan.end - step9.intro.scan.start;
      const scanFadeInT = phase(t, step9.intro.scan.start, step9.intro.scan.start + scanSpan * 0.08);
      const scanFadeOutT = phase(t, step9.intro.scan.end - scanSpan * 0.08, step9.intro.scan.end);
      const scanOpacity = Math.min(scanFadeInT, 1 - scanFadeOutT);
      const scanX = scanRawT * 640;
      svg
        .select('.brainScanBar')
        .attr('x', scanX - 22.5)
        .style('opacity', scanOpacity);
      if (participantIconGroups) {
        const scanHalfWidth = 70; // units either side of the beam that light up
        participantIconGroups.style('filter', (d) => {
          if (scanOpacity <= 0) return null;
          const dist = Math.abs(d.x - scanX);
          const glow = Math.max(0, 1 - dist / scanHalfWidth) * scanOpacity;
          // Bryony: subtler — a hint of brighter colour, not a near-white wash-out.
          return glow > 0.03 ? `brightness(${(1 + glow * 0.2).toFixed(2)})` : null;
        });
      }

      const brainT = phase(t, step9.brain.fadeIn.start, step9.brain.fadeIn.end);
      svg.select('.brainIconGroup').style('opacity', brainT);
      // Left/right labels fade in with the brain, per Bryony.
      svg.selectAll('.brainBgLabel').style('opacity', brainT);

      // Legend text lives in its own screen-space group; needs its own line.
      const dotsT = phase(t, step9.dots.fadeIn.start, step9.dots.fadeIn.end);
      svg.select('.brainDotsGroup').style('opacity', dotsT);
      svg.select('.brainLegendTextGroup').style('opacity', dotsT);
      // Dot labels + leader lines share the dots' own reveal beat.
      svg.select('.brainDotLabelsGroup').style('opacity', dotsT);
    }

    // "One participant matched" spotlight: expands in step 10, then holds
    // through the start of step 11 and is released at step11.spotlightRelease.
    function spotlightAmount() {
      return (
        phase(currentConnectionsProgress, step10.spotlight.expand.start, step10.spotlight.expand.end) *
        (1 -
          phase(currentHeatmapProgress, step11.spotlightRelease.start, step11.spotlightRelease.end))
      );
    }

    function setConnectionsProgress(t) {
      currentConnectionsProgress = t;
      const chartFadeT = phase(t, step10.chartFadeOut.start, step10.chartFadeOut.end);
      svg.select('.brainGroup').style('opacity', 1 - chartFadeT);

      const titleT = phase(t, step10.title.fadeIn.start, step10.title.fadeIn.end);
      svg.select('.connectionsTitle').style('opacity', titleT);
      // Citation subtitle stays visible once faded in, same as brainSubtitle.
      svg.select('.connectionsSubtitle').style('opacity', titleT);

      const trayT = phase(t, step10.tray.fadeIn.start, step10.tray.fadeIn.end);
      svg.select('.magnetLetterGroup').style('opacity', trayT);

      // Letters shrink onto the ring as "It found that" scrolls in; tray
      // box fades out once they've left it (was step 11's opening beat).
      const ringAmt = phase(t, step10.trayToRing.start, step10.trayToRing.end);
      if (magnetLetterGroups) {
        magnetLetterGroups.each(function (d) {
          d.ringAmt = ringAmt;
        });
        magnetLetterGroups.attr('transform', magnetLetterTransform);
      }
      svg.select('.magnetTray').style('opacity', trayT * (1 - ringAmt));
      svg.select('.magnetTrayDividers').style('opacity', trayT * (1 - ringAmt));

      // Bug fix: raw cell data used to appear as the letters landed on the
      // ring, but stayed silent (step 11 only) once trayToRing moved here —
      // drive the same reveal off ringAmt so they come in together again.
      if (heatmapCellGroups) {
        svg.select('.heatmapCellsGroup').style('opacity', ringAmt);
        svg.select('.heatmapSeparatorsGroup').style('opacity', ringAmt);
        // Bryony: filter down to the 1975-1980 respondents as that
        // caption comes in, then unfilter back to the full ring.
        const filterAmt = windPhase(t, step10.yobFilter.fadeIn, step10.yobFilter.fadeBack);
        // "One participant matched 25/26" caption's own spotlight pulse.
        drawHeatmapCells(0, filterAmt, spotlightAmount());
      }
    }

    // Step11: tray fades as letters shrink onto a ring; cells build up around it.
    function setHeatmapProgress(t) {
      currentHeatmapProgress = t;
      if (!heatmapCellGroups || !magnetLetterGroups) return;

      // Ring transform already ran in step 10 (Step 11 on-screen); tray's
      // already hidden by the time this step starts, so ringAmt is fixed.
      const ringAmt = 1;
      magnetLetterGroups.each(function (d) {
        d.ringAmt = ringAmt;
      });
      magnetLetterGroups.attr('transform', magnetLetterTransform);

      // "Decades after exposure..." caption: ring settles into its
      // matched/unmatched clusters (the "2nd circle" state) and holds.
      const colorOrderAmt = phase(t, step11.colorOrderTrue.start, step11.colorOrderTrue.end);
      drawHeatmapCells(colorOrderAmt, 0, spotlightAmount());
    }

    // Step 12: connections/heatmap scene clears as a whole (every child
    // inside it is already fully visible by now, so fading the group
    // itself fades everything at once) while the title takes its place —
    // same crossfade shape as setConnectionsProgress's own chartFadeOut/
    // title.fadeIn pair above.
    function setWhyICareProgress(t) {
      const chartFadeT = phase(t, step12.chartFadeOut.start, step12.chartFadeOut.end);
      svg.select('.connectionsGroup').style('opacity', 1 - chartFadeT);

      const titleT = phase(t, step12.title.fadeIn.start, step12.title.fadeIn.end);
      svg.select('.whyICareTitle').style('opacity', titleT);
    }

    function wallSurfaces() {
      const bottom = height - bottomMargin;
      return [
        { from: { x: edgeMargin, y: topMargin }, to: { x: width - edgeMargin, y: topMargin } },
        { from: { x: width - edgeMargin, y: topMargin }, to: { x: width - edgeMargin, y: bottom } },
        { from: { x: width - edgeMargin, y: bottom }, to: { x: edgeMargin, y: bottom } },
        { from: { x: edgeMargin, y: bottom }, to: { x: edgeMargin, y: topMargin } }
      ];
    }

    // Evenly-spaced starting ring so nobody spawns on top of anybody.
    function seedPositions() {
      const cx = width / 2;
      const cy = height / 2;
      const ringR = Math.max(R * 1.6, Math.min(width, height) / 2 - R - 8);
      const topBound = topMargin + R;
      const bottomBound = Math.max(R, bottomMargin);
      nodes.forEach((d, i) => {
        const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
        d.x = Math.min(Math.max(cx + Math.cos(angle) * ringR, R), Math.max(R, width - R));
        d.y = Math.min(Math.max(cy + Math.sin(angle) * ringR, topBound), Math.max(topBound, height - bottomBound));
        const speed = reduceMotion ? 0 : 0.45 + Math.random() * 0.4;
        const dir = Math.random() * Math.PI * 2;
        d.vx = Math.cos(dir) * speed;
        d.vy = Math.sin(dir) * speed;
      });
    }

    // Guards against a tile tunnelling past walls on a sudden radius change.
    function clampToBounds() {
      const topBound = topMargin + R;
      const bottomBound = Math.max(R, bottomMargin);
      nodes.forEach((d) => {
        d.x = Math.min(Math.max(d.x, R), Math.max(R, width - R));
        d.y = Math.min(Math.max(d.y, topBound), Math.max(topBound, height - bottomBound));
      });
    }

    function positionNodes() {
      const cornerT = phase(currentProgress, step1.tilesToCorner.start, step1.tilesToCorner.end);
      // Linked person's tile also shrinks via tileShrinkT as their photo flies out.
      personGroups.attr('transform', (d, i) => {
        const target = cornerTargets[i] || d;
        const x = lerp(d.x, target.x, cornerT);
        const y = lerp(d.y, target.y, cornerT);
        let s = lerp(1, step1.tilesToCorner.scale, cornerT);
        if (linkedPersonNames.has(d.name)) s = lerp(s, 0, tileShrinkT);
        return `translate(${x},${y}) scale(${s})`;
      });
      personGroups.select('.personTile').style('opacity', (d) => {
        let o = lerp(1, step1.tilesToCorner.tileOpacity, cornerT);
        if (linkedPersonNames.has(d.name)) o = lerp(o, 0, tileShrinkT);
        return o;
      });
      personGroups.select('.personLabel').style('opacity', lerp(0.7, step1.tilesToCorner.labelOpacity, cornerT));
    }

    function tick() {
      clampToBounds();
      positionNodes();
    }

    function startSimulation() {
      if (simulation) simulation.stop();

      simulation = d3.forceSimulation(nodes).velocityDecay(0).alphaDecay(0).alphaMin(-1).alpha(1);

      simulation.force('bounce', forceBounce().radius(() => R).elasticity(1));
      simulation.force(
        'surface',
        forceSurface().surfaces(wallSurfaces()).radius(() => R).elasticity(1)
      );
      simulation.on('tick', tick);

      if (reduceMotion) {
        simulation.stop();
        tick();
      }
    }

    function resize(rect) {
      width = Math.max(280, rect.width);
      height = Math.max(220, rect.height);
      svg.attr('viewBox', `0 0 ${width} ${height}`);

      const firstRun = personGroups === undefined;
      const newTile = tileSizeFor(width);
      const tileChanged = newTile !== TILE;
      if (firstRun || tileChanged) {
        TILE = newTile;
        CORNER = Math.round(TILE * 0.167);
        R = (TILE / 2) * 1.08;
      }

      cornerTargets = cornerGridTargets({
        count: nodes.length,
        tileSize: TILE * step1.tilesToCorner.scale,
        gap: cornerGap,
        width,
        height,
        edgeMargin,
        // Bryony: the tiles sat right on the screen's bottom edge on
        // mobile — lift the whole cluster clear by ~2/3 of a tile.
        bottomMargin: TILE * step1.tilesToCorner.scale * 0.67
      });

      // layoutHeader sets topMargin, needed by seedPositions/clampToBounds.
      layoutHeader();

      if (firstRun) {
        personGroups = buildScene();
        seedPositions();
        buildAnswer();
        senseGroups = buildSenses();
        personIconGroups = buildPeopleIcons();
        quotesGroups = buildQuotes();
        sightSubIconGroups = buildSightSubIcons();
        linkGroups = buildLinks();
        linkPhotoGroups = buildLinkPhotos();
        document.addEventListener('click', dismissLinkOnTap);
        ({ xTicks: pubXTickGroups, yTicks: pubYTickGroups } = buildPublications());
        buildBrain();
        participantIconGroups = buildParticipantIcons();
        buildMagnetLetters();
        buildHeatmap();
      } else {
        clampToBounds();
      }

      // Must run on firstRun too, else the first tiles have no size.
      if (firstRun || tileChanged) applyTileSize();

      layoutAnswer();
      layoutTitle();
      layoutSenses();
      layoutClosing();
      centerSensesBlock();
      layoutPeopleBubble();
      layoutQuotes();
      layoutSight();
      layoutLinks();
      layoutPersonPanel();
      layoutPublications();
      layoutBrain();
      layoutConnections();
      layoutHeatmap();
      layoutWhyICare();

      // Bug fix: sub-icons could render visible before setSightProgress's
      // $effect ever ran (it fires before this build). Call it once here too.
      if (firstRun) {
        setSightProgress(sightProgress);
      }

      startSimulation();
      positionNodes();
    }

    // Debounced so a live resize doesn't restart on every pixel.
    let resizeTimer;
    let firstObservation = true;
    let lastRect = null;
    const observer = new ResizeObserver(([entry]) => {
      const rect = entry.contentRect;
      lastRect = rect;
      if (firstObservation) {
        firstObservation = false;
        resize(rect);
        return;
      }
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => resize(rect), 120);
    });
    observer.observe(container);

    // Everything above measures text, so lay out again once Fredoka and
    // Literata have actually loaded: on a phone the first pass often runs on
    // the fallback font, which left gaps/overlaps (the step 3 title, legends)
    // that only the real fonts' widths would have avoided.
    let disposed = false;
    if (document.fonts?.load) {
      Promise.all([
        document.fonts.load('600 40px Fredoka', 'What is SYNAESTHESIA?'),
        document.fonts.load('400 20px Literata', 'Sample text 0123'),
        document.fonts.load('700 20px Literata', 'Sample text 0123'),
        document.fonts.load('italic 400 20px Literata', 'Sample text 0123')
      ])
        .catch(() => {})
        .then(() => document.fonts.ready)
        .then(() => {
          if (!disposed && lastRect) resize(lastRect);
        });
    }

    sceneApi = {
      setRevealProgress(t) {
        currentProgress = t;
        if (headerText) {
          svg.select('.headerText').style('opacity', 1 - phase(t, step1.header.fadeOut.start, step1.header.fadeOut.end));
        }
        if (answer) {
          svg.select('.leadText').style('opacity', phase(t, step1.lead.fadeIn.start, step1.lead.fadeIn.end));
          svg.select('.synText').style('opacity', phase(t, step1.word.fadeIn.start, step1.word.fadeIn.end));
          svg.select('.aesthesiaText').style('opacity', phase(t, step1.word.fadeIn.start, step1.word.fadeIn.end));
        }
        if (personGroups) positionNodes();
      },
      setEtymologyProgress,
      setTitleProgress,
      setQuotesProgress,
      setSightProgress,
      setLinksProgress,
      setPublicationsProgress,
      setBrainProgress,
      setConnectionsProgress,
      setHeatmapProgress,
      setWhyICareProgress
    };

    return () => {
      disposed = true;
      clearTimeout(resizeTimer);
      document.removeEventListener('click', dismissLinkOnTap);
      observer.disconnect();
      if (simulation) simulation.stop();
      sceneApi = null;
    };
  });

  // Purely reacts to `progress`, driving the already-built scene above
  // rather than rebuilding it.
  $effect(() => {
    if (!sceneApi) return;
    sceneApi.setRevealProgress(progress);
  });

  $effect(() => {
    if (!sceneApi) return;
    sceneApi.setEtymologyProgress(etymologyProgress);
  });

  $effect(() => {
    if (!sceneApi) return;
    sceneApi.setTitleProgress(titleProgress);
  });

  $effect(() => {
    if (!sceneApi) return;
    sceneApi.setQuotesProgress(quotesProgress);
  });

  $effect(() => {
    if (!sceneApi) return;
    sceneApi.setSightProgress(sightProgress);
  });

  $effect(() => {
    if (!sceneApi) return;
    sceneApi.setLinksProgress(linksProgress);
  });

  $effect(() => {
    if (!sceneApi) return;
    sceneApi.setPublicationsProgress(publicationsProgress);
  });

  $effect(() => {
    if (!sceneApi) return;
    sceneApi.setBrainProgress(brainProgress);
  });

  $effect(() => {
    if (!sceneApi) return;
    sceneApi.setConnectionsProgress(connectionsProgress);
  });

  $effect(() => {
    if (!sceneApi) return;
    sceneApi.setHeatmapProgress(heatmapProgress);
  });

  $effect(() => {
    if (!sceneApi) return;
    sceneApi.setWhyICareProgress(whyICareProgress);
  });
</script>

<div class="chart-svg" bind:this={container}>
  <svg bind:this={svgEl} role="img" aria-label={ariaLabel}>
    <defs>
      <!-- step 4/5 heads -->
      <clipPath id="personHeadClip">
        <rect x="0" y="0" width="416" height="420" />
      </clipPath>
      <!-- step 6/7 arrowheads  -->
      <marker
        id="linkArrowhead"
        markerUnits="userSpaceOnUse"
        markerWidth="10"
        markerHeight="10"
        refX="7"
        refY="5"
        orient="auto-start-reverse"
        viewBox="0 0 10 10"
      >
        <path class="linkArrowheadPath" d="M0,0 L10,5 L0,10 Z"></path>
      </marker>
      <!-- step 7 line/area -->
      <clipPath id="pubDrawClip">
        <rect class="pubDrawClipRect"></rect>
      </clipPath>
    </defs>
    <!-- Steps 1–6: fades in/out after step 7 -->
    <g class="storyGroup">
      <text class="headerText"></text>
      <g class="peopleGroup"></g>
      <g class="answerGroup">
        <text class="leadText"></text>
        <text class="synText"></text>
        <text class="aesthesiaText"></text>
        <text class="etymologyCaption"></text>
        <text class="etymologyLabel"></text>
        <text class="whatIsText"></text>
        <text class="titleQuestion"></text>
      </g>
      <g class="sensesGroup"></g>
      <text class="closingLine"></text>
      <text class="closingSubline"></text>
      <g class="peopleIconsGroup"></g>
      <g class="quoteBubble">
        <path class="quoteBubblePath"></path>
      </g>
      <g class="quotesGroup"></g>
      <circle class="sightCircle"></circle>
      <g class="sightSubIconsGroup"></g>
      <text class="sightLabel"></text>
      <g class="linksGroup"></g>
      <g class="linkPhotosGroup"></g>
      <g class="personPanel">
        <text class="personPanelMeasure"></text>
        <text class="personPanelName"></text>
        <g class="personPanelRels"></g>
        <g class="personPanelQuote"></g>
      </g>
    </g>
    <!-- Step 7: Line Area Chart - Publications -->
    <g class="publicationsGroup">
      <text class="publicationsTitle"></text>
      <g class="pubXAxisGroup">
        <line class="pubXAxisLine"></line>
      </g>
      <g class="pubYAxisGroup">
        <line class="pubYAxisLine"></line>
        <text class="pubYAxisLabel"># of publications</text>
      </g>
      <g class="pubDrawGroup" clip-path="url(#pubDrawClip)">
        <path class="pubArea"></path>
        <path class="pubLine"></path>
      </g>
      <!-- 1892 marker -->
      <g class="pubMarker">
        <line class="pubMarkerLine"></line>
        <text class="pubMarkerLabel"></text>
      </g>
      <!-- 2007 + 2015 markers -->
      <g class="pubCitation pubCitation1">
        <line class="pubCitationLine"></line>
        <text class="pubCitationLabel"></text>
      </g>
      <g class="pubCitation pubCitation2">
        <line class="pubCitationLine"></line>
        <text class="pubCitationLabel"></text>
      </g>
      <!-- AI generated publications link -->
      <text class="pubFootnote"
        ><tspan class="pubFootnoteText">Data source: PubMed</tspan
        ><tspan> </tspan
        ><a href={`${import.meta.env.BASE_URL}chatGPTPublications.csv`} download="chatGPTPublications.csv"
          ><tspan class="pubFootnoteLink">(pre-1942 AI researched + cross checked)</tspan></a
        ></text
      >
    </g>
    <!-- Step 9: 2007 article -->
    <g class="brainGroup">
      <!-- brainTitle carries step9-intro messages; brainSubtitle stays visible. -->
      <text class="brainTitle"></text>
      <text class="brainSubtitle"></text>
      <!-- Bg rects contain the participant icons; brainBgLabel hidden via CSS. -->
      <g class="brainBgGroup">
        <rect class="brainBgRect brainBgRectLeft" x="0" y="0" width="320" height="640"></rect>
        <rect class="brainBgRect brainBgRectRight" x="320" y="0" width="320" height="640"></rect>
        <text class="brainBgLabel brainBgLabelLeft" x="20" y="20">left side</text>
        <text class="brainBgLabel brainBgLabelRight" x="620" y="20">right side</text>
        <g class="participantIconsGroup"></g>
        <!-- Scan-line sweep during step9.intro.scan, per Bryony. -->
        <defs>
          <linearGradient id="brainScanGradient" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stop-color="var(--greyDark)" stop-opacity="0"></stop>
            <stop offset="50%" stop-color="var(--greyDark)" stop-opacity="0.6"></stop>
            <stop offset="100%" stop-color="var(--greyDark)" stop-opacity="0"></stop>
          </linearGradient>
        </defs>
        <!-- Bryony: half width — thinner blur/shadow either side of the beam. -->
        <rect class="brainScanBar" y="0" width="45" height="640" fill="url(#brainScanGradient)"></rect>
      </g>
      <!-- Fixed real-px headings live outside the scaled .brainBgGroup. -->
      <text class="participantLabel participantLabelLeft"></text>
      <text class="participantLabel participantLabelRight"></text>
      <g class="brainIconGroup">
        <path class="brainIconPath" d={brainIcon.path}></path>
        <g class="brainDotsGroup">
          <defs>
            <linearGradient id="brainEffectGradient">
              <stop class="brainEffectGradientMin" offset="0%"></stop>
              <stop class="brainEffectGradientMax" offset="100%"></stop>
            </linearGradient>
          </defs>
          <rect class="brainEffectBar" fill="url(#brainEffectGradient)"></rect>
          <circle class="brainVolumeCircle brainVolumeCircleLarge"></circle>
          <circle class="brainVolumeCircle brainVolumeCircleSmall"></circle>
          <!-- Placed before .brainDot so dots paint on top of leader lines. -->
          <g class="brainDotLeadersGroup"></g>
        </g>
      </g>
      <!-- Legend -->
      <g class="brainLegendTextGroup">
        <text class="brainEffectTitle"></text>
        <text class="brainLegendAnnotation brainEffectAnnotation"></text>
        <text class="brainEffectValue brainEffectValueMin"></text>
        <text class="brainEffectValue brainEffectValueMax"></text>
        <text class="brainEffectCaption"></text>
        <text class="brainVolumeTitle"></text>
        <text class="brainLegendAnnotation brainVolumeAnnotation"></text>
        <text class="brainVolumeValue brainVolumeValueLarge"></text>
        <text class="brainVolumeValue brainVolumeValueSmall"></text>
        <text class="brainVolumeCaption"></text>
      </g>
      <!-- One label per annotation, screen space, no arrowheads per Bryony. -->
      <g class="brainDotLabelsGroup"></g>
    </g>

    <!-- Step 10: 2015 publication -->
    <g class="connectionsGroup">
      <text class="connectionsTitle"></text>
      <text class="connectionsSubtitle"></text>
      <rect class="magnetTray"></rect>
      <g class="magnetTrayDividers">
        <line class="magnetTrayDivider magnetTrayDivider1"></line>
        <line class="magnetTrayDivider magnetTrayDivider2"></line>
        <line class="magnetTrayDivider magnetTrayDivider3"></line>
        <line class="magnetTrayDivider magnetTrayEdgeLeft"></line>
        <line class="magnetTrayDivider magnetTrayEdgeRight"></line>
      </g>
      <!-- Step 12: ring letters shrink onto this; placed before letters so they paint on top. -->
      <g class="heatmapRingGroup">
        <g class="heatmapCellsGroup"></g>
        <g class="heatmapSeparatorsGroup"></g>
      </g>
      <g class="magnetLetterGroup"></g>
    </g>

    <!-- Step 12: connections/heatmap scene (above) clears as this title
         takes the header slot, same "stick with step 1" treatment as
         every other step title. -->
    <text class="whyICareTitle"></text>

    <!-- linked to  -->
    <g class="personTooltip">
      <rect class="personTooltipBg"></rect>
      <g class="personTooltipLines"></g>
    </g>
  </svg>
</div>


<style>
:global(.chart-svg) {
  width: 100%;
  height: 100%;
  position: relative;
  user-select: none;
}
:global(.chart-svg) svg {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
  :global(.chart-svg .personGroup),
  :global(.chart-svg .linkPhotoItem) {
    pointer-events: auto;
    cursor: pointer; /* also makes iOS treat the photos as tappable */
  }
  :global(.chart-svg .personLabel) {
    font-family: var(--font-body);
    font-size: 12px;
    fill: var(--text);
    opacity: 0.7;
    text-anchor: middle;
    pointer-events: none;
    user-select: none;
  }
  :global(.chart-svg .personTile) {
    cursor: default;
  }
  :global(.chart-svg .headerText) {
    font-family: var(--font-heading);
    font-weight: 600;
    fill: var(--text);
    text-anchor: middle;
    dominant-baseline: central;
  }
  :global(.chart-svg .leadText) {
    font-family: var(--font-body);
    fill: var(--text);
    text-anchor: middle;
    dominant-baseline: central;
    opacity: 0;
  }
  :global(.chart-svg .synText),
  :global(.chart-svg .aesthesiaText) {
    font-family: var(--font-heading);
    font-weight: 600;
    letter-spacing: 1px;
    fill: var(--text);
    text-anchor: start;
    dominant-baseline: central;
    opacity: 0;
  }
  :global(.chart-svg .etymologyCaption) {
    font-family: var(--font-body);
    font-style: italic;
    font-size: var(--text-caption, 15px);
    fill: var(--text);
    text-anchor: middle;
    dominant-baseline: central;
    opacity: 0;
  }
  :global(.chart-svg .etymologyLabel) {
    font-family: var(--font-body);
    font-size: var(--text-lead, 24px);
    fill: var(--text);
    text-anchor: middle;
    dominant-baseline: central;
    opacity: 0;
  }
  :global(.chart-svg .whatIsText),
  :global(.chart-svg .titleQuestion) {
    font-family: var(--font-heading);
    font-weight: 600;
    fill: var(--text);
    text-anchor: start;
    dominant-baseline: central;
    opacity: 0;
  }
  :global(.chart-svg .senseIcon) {
    opacity: 0;
  }
  :global(.chart-svg .senseIconBg) {
    fill: #fff;
    stroke: var(--grey);
    stroke-width: 1.5;
    opacity: 0;
  }
  :global(.chart-svg .senseIconPath) {
    stroke: none;
  }
  :global(.chart-svg .senseIconLabel) {
    font-family: var(--font-body);
    font-size: var(--text-lead, 24px); /* matches "together"/"perception" */
    fill: var(--text);
    text-anchor: middle;
    dominant-baseline: hanging;
  }
  :global(.chart-svg .closingLine) {
    font-family: var(--font-body);
    fill: var(--text);
    text-anchor: middle;
    dominant-baseline: central;
    opacity: 0;
  }
  :global(.chart-svg .closingSubline) {
    font-family: var(--font-body);
    font-style: italic; /* Bryony: italics, per her request */
    fill: var(--text);
    text-anchor: middle;
    dominant-baseline: central;
    opacity: 0;
  }
  :global(.chart-svg .peopleIconsGroup) {
    opacity: 0;
  }
  :global(.chart-svg .personIconPath) {
    fill: var(--text);
    stroke: none;
  }
  :global(.chart-svg .quoteBubble) {
    opacity: 0;
  }
  :global(.chart-svg .quoteBubblePath) {
    /* White fill per Bryony, same treatment as .sightSubIconBg. */
    fill: #fff;
    stroke: var(--grey);
    stroke-width: 1.5;
  }
  :global(.chart-svg .quoteLine) {
    font-family: var(--font-body);
    font-style: italic;
    fill: var(--text);
    text-anchor: start;
    dominant-baseline: central;
  }
  :global(.chart-svg .quoteWord) {
    opacity: 0;
  }
  :global(.chart-svg .sightCircle) {
    /* backgroundTint: no stroke, ~8% darker than page bg, per Bryony. */
    fill: var(--backgroundTint);
    stroke: none;
    opacity: 0;
  }
  :global(.chart-svg .sightSubIconsGroup) {
    opacity: 0;
  }
  :global(.chart-svg .sightSubIconBg) {
    fill: #fff;
    stroke: var(--grey);
    stroke-width: 1.5;
  }
  :global(.chart-svg .sightSubIconPath) {
    fill: var(--purple, #6A488C);
    stroke: none;
  }
  :global(.chart-svg .sightSubIconLabel) {
    /* 15px (--text-caption step), purple accent, per Bryony. */
    font-family: var(--font-body);
    font-size: var(--text-caption, 15px);
    fill: var(--purple, #6a488c);
    text-anchor: middle;
    /* Alphabetic, not hanging: iOS Safari doesn't honour hanging, which let
       these labels ride up over their circles. The y offset in layoutSight()
       supplies the ascent instead, so every browser agrees. */
    dominant-baseline: alphabetic;
  }
  :global(.chart-svg .sightLabel) {
    /* Matches .headerText (Fredoka 600), per "stick with step 1" rule. */
    font-family: var(--font-heading);
    font-weight: 600;
    fill: var(--text);
    text-anchor: middle;
    dominant-baseline: central;
    opacity: 0;
  }
  :global(.chart-svg .linksGroup) {
    opacity: 0;
  }
  :global(.chart-svg .linkArrow) {
    fill: none;
    stroke: var(--grey);
    stroke-width: 2.5;
    /* Bug fix: round cap poked past arrowhead tip; butt cap fixes it. */
    stroke-linecap: butt;
  }
  :global(.chart-svg .linkArrowheadPath) {
    fill: var(--grey);
    stroke: none;
  }
  :global(.chart-svg .linkPhotosGroup) {
    opacity: 0;
  }
  :global(.chart-svg .linkPhotoTile) {
    /* No stroke anywhere, per Bryony: "take away any stroke/outline". */
    stroke: none;
  }
  :global(.chart-svg .publicationsTitle) {
    /* Matches .headerText (Fredoka 600), per "stick with step 1" rule. */
    font-family: var(--font-heading);
    font-weight: 600;
    fill: var(--text);
    text-anchor: middle;
    dominant-baseline: central;
    opacity: 0;
  }
  /* Step 7 axes: hairline grey per dataviz skill; x-tick/y-label colours below differ per Bryony. */
  :global(.chart-svg .pubXAxisGroup),
  :global(.chart-svg .pubYAxisGroup) {
    opacity: 0;
  }
  :global(.chart-svg .pubXAxisLine),
  :global(.chart-svg .pubYAxisLine) {
    stroke: var(--grey);
    stroke-width: 1;
  }
  :global(.chart-svg .pubXTickLabel) {
    /* Bumped to lead size, `text` colour, per "no ticks, text bigger". */
    font-family: var(--font-body);
    font-size: var(--text-lead, 24px);
    font-variant-numeric: tabular-nums;
    fill: var(--text);
    text-anchor: middle;
    dominant-baseline: hanging;
  }
  :global(.chart-svg .pubYTick) {
    font-family: var(--font-body);
    /* Matches .pubXTickLabel size + `text` colour, per Bryony. */
    font-size: var(--text-lead, 24px);
    font-variant-numeric: tabular-nums;
    fill: var(--text);
    /* Anchor start: axis moved to the right, per Bryony. */
    text-anchor: start;
    dominant-baseline: central;
  }
  :global(.chart-svg .pubYAxisLabel) {
    /* Literal black + anchor start, per Bryony's exact spec. */
    font-family: var(--font-body);
    font-size: var(--text-lead, 24px);
    fill: #000;
    text-anchor: start;
    dominant-baseline: hanging;
  }
  :global(.chart-svg .pubLine) {
    /* Fisher-Price blue; reveal is via clip-path, not opacity. */
    fill: none;
    stroke: var(--blue);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  :global(.chart-svg .pubArea) {
    /* 10% opacity wash per the dataviz skill; flat, not progress-driven. */
    fill: var(--blue);
    stroke: none;
    opacity: 0.1;
  }
  :global(.chart-svg .pubMarker) {
    opacity: 0;
  }
  :global(.chart-svg .pubMarkerLine) {
    /* Recessive + dashed: an annotation, not a plotted mark. */
    stroke: var(--grey);
    stroke-width: 1;
    stroke-dasharray: 4 3;
  }
  :global(.chart-svg .pubMarkerLabel) {
    font-family: var(--font-body);
    font-size: var(--text-caption, 15px);
    /* Darker grey than the dashed line itself, per Bryony. */
    fill: var(--greyDark);
    /* Rotated -90 (see layoutPublications()); anchor end keeps it aligned top. */
    text-anchor: end;
  }
  :global(.chart-svg .pubCitation) {
    opacity: 0;
  }
  :global(.chart-svg .pubCitationLine) {
    stroke: var(--grey);
    stroke-width: 1;
    stroke-dasharray: 4 3;
  }
  :global(.chart-svg .pubCitationLabel) {
    font-family: var(--font-body);
    font-size: var(--text-caption, 15px);
    /* Darker grey, same as .pubMarkerLabel above. */
    fill: var(--greyDark);
    /* Rotated, anchor end — see .pubMarkerLabel above. */
    text-anchor: end;
  }
  :global(.chart-svg .pubFootnote) {
    opacity: 0;
    font-family: var(--font-body);
    font-size: var(--text-caption, 15px);
    fill: var(--grey);
    text-anchor: start;
  }
  :global(.chart-svg .pubFootnoteLink) {
    /* Underline is the only clickable cue; same grey as rest of footnote. */
    text-decoration: underline;
    cursor: pointer;
  }
  :global(.chart-svg .brainTitle) {
    /* Matches .publicationsTitle/.headerText, "stick with step 1" rule. */
    font-family: var(--font-heading);
    font-weight: 600;
    fill: var(--text);
    text-anchor: middle;
    dominant-baseline: central;
    opacity: 0;
  }
  :global(.chart-svg .brainSubtitle) {
    /* Citation-style: recessive grey, smaller than the title. */
    font-family: var(--font-body);
    fill: var(--grey);
    text-anchor: middle;
    dominant-baseline: central;
    opacity: 0;
  }
  :global(.chart-svg .brainIconGroup) {
    opacity: 0;
  }
  :global(.chart-svg .brainBgGroup) {
    opacity: 0;
  }
  :global(.chart-svg .participantIconsGroup) {
    opacity: 0;
  }
  :global(.chart-svg .participantIconPath) {
    stroke: none;
  }
  :global(.chart-svg .participantLabel) {
    /* Normal weight per Bryony; inherits, like .brainSubtitle. */
    font-family: var(--font-body);
    fill: var(--text);
    text-anchor: middle;
    dominant-baseline: central;
    opacity: 0;
  }
  :global(.chart-svg .brainScanBar) {
    opacity: 0;
    pointer-events: none;
  }
  :global(.chart-svg .brainIconPath) {
    /* White fill, grey stroke, per Bryony's approved preview. */
    fill: #fff;
    stroke: var(--grey);
    stroke-width: 3;
  }
  :global(.chart-svg .brainBgRect) {
    /* backgroundTint, per the approved preview. */
    fill: var(--backgroundTint);
  }
  :global(.chart-svg .brainBgRectLeft) {
    opacity: 1;
  }
  :global(.chart-svg .brainBgRectRight) {
    opacity: 0.5;
  }
  :global(.chart-svg .brainBgLabel) {
    /* Opacity driven by brainT, same beat as the brain drawing. */
    opacity: 0;
    font-family: var(--font-body);
    font-size: 26px;
    font-weight: 600;
    fill: var(--text);
    dominant-baseline: hanging;
  }
  :global(.chart-svg .brainBgLabelLeft) {
    text-anchor: start;
  }
  :global(.chart-svg .brainBgLabelRight) {
    text-anchor: end;
  }
  :global(.chart-svg .brainDotsGroup) {
    opacity: 0;
  }
  :global(.chart-svg .brainDot) {
    /* Fill/radius set per-dot in layoutBrain(); no stroke, per Bryony. */
    stroke: none;
    /* Gentle pulsing breathe, staggered (layoutBrain's animation-delay).
       transform-origin center so each dot scales around its own centre. */
    transform-box: fill-box;
    transform-origin: center;
    animation: brainDotPulse 3.2s ease-in-out infinite;
  }
  @keyframes brainDotPulse {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.18);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.chart-svg .brainDot) {
      animation: none;
    }
  }
  :global(.chart-svg .brainLegendTextGroup) {
    opacity: 0;
  }
  :global(.chart-svg .brainDotLabelsGroup) {
    opacity: 0;
  }
  :global(.chart-svg .brainDotLabelMain),
  :global(.chart-svg .brainDotLabelSub) {
    /* Shared size set in layoutBrain() (dotLabelFontSize), per Bryony. */
    font-family: var(--font-body);
    font-weight: 400;
    dominant-baseline: hanging;
  }
  :global(.chart-svg .brainDotLabelMain) {
    fill: var(--text);
  }
  :global(.chart-svg .brainDotLabelSub) {
    fill: var(--grey);
  }
  :global(.chart-svg .brainDotLeader) {
    /* No arrowheads; stroke colour/width set per-line in layoutBrain(). */
    fill: none;
  }
  :global(.chart-svg .brainEffectValue),
  :global(.chart-svg .brainEffectCaption),
  :global(.chart-svg .brainVolumeValue),
  :global(.chart-svg .brainVolumeCaption) {
    /* --text-micro (12px), fixed real size, per Bryony's "too big" note. */
    font-family: var(--font-body);
    font-size: var(--text-micro, 12px);
    fill: var(--grey);
  }
  :global(.chart-svg .brainEffectValue) {
    /* Sits above the bar; alphabetic baseline reads above, not into it. */
    font-variant-numeric: tabular-nums;
  }
  :global(.chart-svg .brainEffectValueMin) {
    text-anchor: start;
  }
  :global(.chart-svg .brainEffectValueMax) {
    text-anchor: end;
  }
  :global(.chart-svg .brainEffectCaption),
  :global(.chart-svg .brainVolumeCaption) {
    text-anchor: start;
    dominant-baseline: hanging;
  }
  :global(.chart-svg .brainVolumeCircle) {
    /* Uncoloured: size-only, doesn't double as the Effect colour legend. */
    fill: none;
    stroke: var(--grey);
    stroke-width: 1.5;
  }
  :global(.chart-svg .brainEffectTitle),
  :global(.chart-svg .brainVolumeTitle) {
    /* Legend headings, per Bryony; y computed in layoutBrain() above the value line. */
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: var(--text-micro, 12px);
    fill: var(--text);
  }
  :global(.chart-svg .brainEffectTitle) {
    text-anchor: start;
  }
  :global(.chart-svg .brainVolumeTitle) {
    text-anchor: middle;
  }
  :global(.chart-svg .brainLegendAnnotation) {
    /* Grey italic micro text, echoing the activation header, per Bryony. */
    font-family: var(--font-body);
    font-style: italic;
    font-weight: 400;
    font-size: var(--text-micro, 12px);
    fill: var(--grey);
  }
  :global(.chart-svg .brainEffectAnnotation) {
    text-anchor: start;
  }
  :global(.chart-svg .brainVolumeAnnotation) {
    text-anchor: middle;
  }
  :global(.chart-svg .brainVolumeValue) {
    /* Hanging baseline: sits just below the top of its own circle. */
    font-variant-numeric: tabular-nums;
    text-anchor: middle;
    dominant-baseline: hanging;
  }
  :global(.chart-svg .connectionsTitle) {
    /* Matches every other step title, "stick with step 1" rule. */
    font-family: var(--font-heading);
    font-weight: 600;
    fill: var(--text);
    text-anchor: middle;
    dominant-baseline: central;
    opacity: 0;
  }
  :global(.chart-svg .connectionsSubtitle) {
    /* Citation-style: recessive grey, smaller than the title. */
    font-family: var(--font-body);
    fill: var(--grey);
    text-anchor: middle;
    dominant-baseline: central;
    opacity: 0;
  }
  :global(.chart-svg .whyICareTitle) {
    /* Matches every other step title, "stick with step 1" rule. */
    font-family: var(--font-heading);
    font-weight: 600;
    fill: var(--text);
    text-anchor: middle;
    dominant-baseline: central;
    opacity: 0;
  }
  :global(.chart-svg .magnetTray) {
    /* Warm-tint fill + drop-shadow for a lifted, physical feel, per Bryony. */
    fill: var(--backgroundTint);
    stroke: var(--grey);
    stroke-width: 1.5;
    opacity: 0;
    filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.2));
  }
  :global(.chart-svg .magnetTrayDividers) {
    opacity: 0;
  }
  :global(.chart-svg .magnetTrayDivider) {
    /* Compartment walls, including left/right edges, per Bryony. */
    stroke: var(--grey);
    stroke-width: 1.5;
  }
  :global(.chart-svg .magnetLetterGroup) {
    opacity: 0;
  }
  :global(.chart-svg .heatmapCellsGroup) {
    /* Step 12 cells, hidden until letters land on the ring, per Bryony's spec. */
    opacity: 0;
  }
  :global(.chart-svg .heatmapCell) {
    stroke: none;
  }
  :global(.chart-svg .heatmapSeparatorsGroup) {
    opacity: 0;
  }
  :global(.chart-svg .heatmapSeparator) {
    /* Lines between letter slices, white, matching Bryony's original. */
    stroke: var(--background);
    stroke-width: 1;
  }
  :global(.chart-svg .magnetLetter) {
    /* Bold caps, one colour per letter, drop-shadow "magnet" feel.
       Weight 600 (not 700) — index.html only loads Fredoka 500/600. */
    font-family: var(--font-heading);
    font-weight: 600;
    text-anchor: middle;
    dominant-baseline: central;
    filter: drop-shadow(1px 2px 1.5px rgba(0, 0, 0, 0.28));
  }
  /* Link hover (Steps 6-7): everything but the hovered photo, its link and
     that link's source + target is dimmed. !important so it beats the
     scroll-driven inline opacities; removing .linkHover restores them. */
  :global(.chart-svg svg.linkHover .senseIcon:not(.hl)),
  :global(.chart-svg svg.linkHover .sightSubIcon:not(.hl)),
  :global(.chart-svg svg.linkHover .linkArrow:not(.hl)),
  :global(.chart-svg svg.linkHover .linkPhotoItem:not(.hl)) {
    opacity: 0.2 !important;
    transition: opacity 0.12s ease;
  }
  :global(.chart-svg .personPanel) {
    /* Hover panel under the diagram (Steps 6-7); hidden until a photo is hovered. */
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.12s ease;
  }
  :global(.chart-svg .personPanelMeasure) {
    visibility: hidden;
  }
  :global(.chart-svg .personPanelName) {
    font-family: var(--font-heading);
    font-weight: 600;
    fill: var(--text);
    text-anchor: middle;
    dominant-baseline: hanging;
  }
  :global(.chart-svg .personPanelRel) {
    font-family: var(--font-body);
    fill: var(--greyDark);
    text-anchor: middle;
    dominant-baseline: hanging;
  }
  :global(.chart-svg .personPanelRelEmph) {
    fill: var(--text);
  }
  :global(.chart-svg .personPanelSep) {
    fill: var(--grey);
  }
  :global(.chart-svg .personPanelQuoteLine) {
    font-family: var(--font-body);
    font-style: italic;
    fill: var(--text);
    text-anchor: middle;
    dominant-baseline: hanging;
  }
  :global(.chart-svg .personTooltip) {
    /* Hidden until raised; pointer-events none so it can't trigger a mouseleave. */
    opacity: 0;
    pointer-events: none;
  }
  :global(.chart-svg .personTooltipBg) {
    /* White bg, grey border, per Bryony's tooltip spec. */
    fill: #fff;
    stroke: var(--grey);
    stroke-width: 1;
  }
  :global(.chart-svg .personTooltipLine) {
    font-family: var(--font-body);
    font-size: var(--text-caption, 15px);
    fill: var(--text);
    text-anchor: start;
    dominant-baseline: hanging;
  }
</style>
