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
    step8,
    step9,
    step10,
    step11,
    windPhase,
    layoutQuoteReveals
  } from '../steps.js';
  import { colors, spacing } from '../theme.js'; // theme's --text-caption/--text-lead CSS vars carry the type scale
  import { senseIcons } from '../data/senseIcons.js';
  import { quotes } from '../data/quotes.js';
  import { personIcon } from '../data/personIcon.js'; // placeholder (Font Awesome user icon) — illustrator's per-person art drops in later, one at a time
  import { sightSubIcons } from '../data/sightSubIcons.js'; // the 3 (placeholder) icons sight "splits into" — letters+numbers, colors, objects
  import { synaesthesiaLinks } from '../data/synaesthesiaLinks.js'; // who has which cross-sense association (step 6)
  import {
    publicationsByDecade,
    publicationsMinYear,
    publicationsMaxYear,
    publicationsByDecadeMaxCount
  } from '../data/publications.js'; // PubMed result counts, binned into decades (step 7 — "let's bin the data into decades")
  import { brainIcon } from '../data/brainIcon.js'; // Bryony's own brain-solid-full.svg upload (step 9)
  import { brainRegions } from '../data/brainRegions.js'; // 4 researched regions, ballpark-placed on brainIcon's own viewBox (step 9)
  import { magnetLetters, magnetRowLengths } from '../data/magnetLetters.js'; // step10's own drawn mock-up of Bryony's Fisher-Price reference photo
  import { magnetResponses, nUsers, maxMatchCount, barLetterOrder, codeColor } from '../data/magnetResponses.js'; // step11's per-respondent match data (see that file's own header comment)

  // Bryony's own link-tooltip copy: "name (bold), relationship (smell ->
  // letters + numbers) ... until the relationship list for this person is
  // done" — aggregated across ALL of a person's edges (synaesthesiaLinks),
  // not just the one edge the hovered photo instance itself belongs to
  // (a person with several links has a separate .linkPhotoItem per edge —
  // see linkPhotoNodes below — but hovering any one of them should show
  // their full list). Plain functions, no component state needed.
  function senseDisplayLabel(key) {
    const subIcon = sightSubIcons.find((s) => s.key === key);
    return subIcon ? subIcon.label : key; // senseIcons.js's own labels (sound/taste/smell/touch) already match the edge keys directly
  }
  // Bryony: reverseLabel (Kandinsky's own colour -> sound direction,
  // opposite this merged edge's from/to) swaps the text only — the edge
  // itself, and its arrow direction, are untouched. edgeKey is returned
  // alongside so a specific photo instance can grey out its OTHER
  // relationships in the tooltip (see the linkPhotoItem hover handler).
  function personRelationships(name) {
    return synaesthesiaLinks
      .filter((e) => e.people.some((p) => p.name === name))
      .map((e) => {
        const p = e.people.find((p) => p.name === name);
        const from = p.reverseLabel ? e.to : e.from;
        const to = p.reverseLabel ? e.from : e.to;
        return { text: `${senseDisplayLabel(from)} → ${senseDisplayLabel(to)}`, edgeKey: `${e.from}-${e.to}` };
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
    publicationsMarkersProgress = 0, // 0–1, marks 2 specific publications on the chart, one at a time, once it's drawn (step8)
    brainProgress = 0, // 0–1, drives the publications chart fading out + the new brain-regions scene (step9)
    connectionsProgress = 0, // 0–1, drives the brain scene fading out + the new "when do connections form?" scene (step10)
    heatmapProgress = 0, // 0–1, drives the tray fading out + the magnet letters moving onto a ring + the per-respondent heatmap/bar morph (step11)
    tileSizeFor = (w) => (w < 420 ? 62 : w < 800 ? 79 : 101),
    edgeMargin = 6,
    labelOffset = 12,
    ariaLabel = 'Portraits of well-known people, drifting and bouncing gently within the frame.'
  } = $props();

  // Wraps a <text> selection onto multiple <tspan> lines at `width`,
  // measuring against the real rendered tspan (so it matches whatever
  // font/weight/letter-spacing CSS gives that element) rather than a
  // separate, easy-to-drift-out-of-sync measurer.
  function wrap(textSelection, width, fontSize) {
    textSelection.each(function () {
      const text = d3.select(this);
      const words = text.text().split(/\s+/).reverse();
      const x = text.attr('x');
      const y = text.attr('y');
      let word;
      let line = [];
      let tspan = text.text(null).append('tspan').attr('x', x).attr('y', y).attr('dy', 0);

      while ((word = words.pop())) {
        line.push(word);
        tspan.text(line.join(' '));
        if (tspan.node().getComputedTextLength() > width) {
          line.pop();
          tspan.text(line.join(' '));
          line = [word];
          if (word.trim() !== '') {
            if (tspan.text().trim() === '') {
              tspan.text(word);
            } else {
              // Bryony: "I think maybe our wrap function is set to two
              // lines max" — she was right about the symptom: every
              // 3rd+ line landed on TOP of the 2nd, because this used to
              // set an explicit y (the text element's own starting y) on
              // EVERY new tspan, which in SVG resets the baseline rather
              // than continuing from the previous line — so dy never
              // actually accumulated past the first wrap. Only the FIRST
              // tspan gets an explicit y; every line after it advances
              // via dy alone, relative to wherever the line before it
              // ended up.
              tspan = text.append('tspan').attr('x', x).attr('dy', fontSize).text(word);
            }
          }
        }
      }
    });
  }

  // The quote bubble's tail — reverse-engineered from Bryony's 5
  // reference SVGs (one per person): not a plain triangle but a smooth
  // "leaf" curve, identical across all 5 — only its horizontal position
  // moves, left to right, as you go from the 1st person's quote to the
  // 5th's. These are its waypoints as (dx, dy) offsets from the tail's
  // own apex, at the reference design's own scale (their box is 471x202)
  // — scaled by the bubble's actual height when drawn, and mirrored for
  // the left half, so one set of numbers covers all 5 positions at any
  // bubble size.
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
  const TAIL_HALF_SPAN = 31.727; // how far the tail's curve reaches out from its own apex, at reference scale

  // Draws one of the 5 bubbles: a rounded rect (x, y, w, h) with that
  // tail cut into its bottom edge. `personT` (0–1) places the tail left
  // to right across the bottom edge's safe range — 0 for the 1st
  // person's quote, 1 for the 5th's, evenly spaced between.
  function bubblePersonPath(x, y, w, h, personT) {
    const scale = h / 202; // the reference design's own box height
    const r = 50 * scale;
    const kappa = 27.614 * scale; // same circular-bezier constant the reference corners use

    const left = x;
    const right = x + w;
    const top = y;
    const bottom = y + h;

    const halfTailSpan = TAIL_HALF_SPAN * scale;
    const safeLeft = left + r + halfTailSpan;
    const safeRight = Math.max(safeLeft, right - r - halfTailSpan);
    const tailX = safeLeft + (safeRight - safeLeft) * personT;

    const P = (dx, dy) => `${(tailX + dx * scale).toFixed(2)} ${(bottom + dy * scale).toFixed(2)}`;
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

  // Inverse of bubblePersonPath's own tail placement above — given a
  // target x (a person icon's real x position), finds the personT that
  // puts the tail as close to it as the bubble's own width allows, so
  // the triangle actually points at the relevant person instead of just
  // sliding 0→1 through the quotes in order.
  function personTForX(targetX, bx, bw, bh) {
    const scale = bh / 202;
    const r = 50 * scale;
    const halfTailSpan = TAIL_HALF_SPAN * scale;
    const safeLeft = bx + r + halfTailSpan;
    const safeRight = Math.max(safeLeft, bx + bw - r - halfTailSpan);
    if (safeRight <= safeLeft) return 0.5;
    return Math.max(0, Math.min(1, (targetX - safeLeft) / (safeRight - safeLeft)));
  }

  let container;
  let svgEl;

  // Exposed by the build effect below once the scene exists, so the second
  // effect can drive it on every scroll tick without rebuilding anything.
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
    // Recomputed by layoutHeader() every resize — how far down the header's
    // reserved band reaches, so tiles never wander under the header text.
    // Falls back to the plain edge margin when there's no header.
    let topMargin = edgeMargin;
    // Driven by sceneApi.setRevealProgress(); read by positionNodes() to
    // blend tiles toward their step1.tilesToCorner targets.
    let currentProgress = 0;
    // Driven by setLinksProgress(); read by positionNodes() to shrink +
    // fade a linked person's bottom tile out as their link photo(s)
    // fly in — set here rather than computed only inside
    // setLinksProgress() because positionNodes() also runs continuously
    // off the bounce simulation's own ticks, which would otherwise
    // overwrite this every frame with the plain step1 (cornerT-only)
    // opacity/scale and undo the fade almost immediately.
    let linksRevealT = 0;
    // Drives the bottom-corner tile shrink/fade for linked people — now
    // tied to the photo fly-in itself (setSightProgress's moveT), so the
    // original tile is gone the same moment its photo leaves, not later.
    let tileShrinkT = 0;
    // Raw step7 (setLinksProgress) t, read fresh on hover for the link
    // photo tooltip's own name-job vs name+senses switch, per Bryony.
    let linksT = 0;
    // Mirrors setSightProgress()'s own revealT (the sub-icon stagger),
    // same reason as linksRevealT above: layoutSight() needs to know on
    // a resize whether that stagger has already finished, and nothing
    // else here remembers it across calls.
    let sightRevealT = 0;

    // The three `.sightLabel` texts, in order: the "splitting into 3"
    // title; then (per Bryony) "So what about the famous synetheses?"
    // once the letters+numbers sub-icon finishes revealing; then the
    // closing sense-to-sense-triggers sentence once the links/people
    // transition finishes. Kept as named constants so layoutSight()
    // (every resize) and setSightProgress()/setLinksProgress() (every
    // scroll tick, only right at each swap) always agree on the exact
    // wording.
    const sightSplitText = 'SIGHT logically splits into 3 sub categories';
    const sightFamousText = 'So what about the famous synetheses?';
    const closingHeaderText = 'What are their sense → sense triggers?';
    // Mirrors which of the 3 texts `.sightLabel` last had set, so
    // setSightProgress()/setLinksProgress() only re-set/re-wrap it right
    // at each swap (not every tick), and layoutSight() can tell the same
    // way on a resize — same pattern as linksRevealT above, needed for
    // the same reason: nothing else here remembers this across calls.
    // One of 'split' | 'famous' | 'closing'.
    let sightHeaderStage = 'split';
    let sightLabelFontSize = 18;
    let sightLabelWrapWidth = 0;
    // step3: senses vs plain lead
    let leadTextShowingSenses = false;

    // step3: senses lead line (needs svg, so lives in this scope not top-level)
    function renderSensesLeadText(baseY) {
      svg.select('.leadText').attr('y', baseY).text(step3.senses.text);
    }
    let cornerTargets = [];
    const cornerGap = 10;
    // The header's own top inset — reused everywhere something needs to
    // sit "at header height" (the title, and now the risen icon row) so
    // they all agree on exactly what that means.
    const topPadding = 40;
    // Set by layoutAnswer() every resize; read by setEtymologyProgress() and
    // setTitleProgress() as the STABLE resting position to animate from —
    // not the live x/y/font-size attrs, which one of those two is usually
    // busy animating. (Named etymWord*, not word*, so they don't shadow
    // layoutAnswer's own local `wordFontSize`/`wordY` consts.)
    let etymSynX = 0;
    let etymSynWidth = 0;
    let etymAesthesiaWidth = 0;
    let etymWordBaselineY = 0;
    let etymWordFontSize = 0;

    // Set by layoutTitle() every resize — where SYNAESTHESIA + "What is"
    // land once step 3's title move finishes.
    let titleFontSize = 0;
    let titleY = 0;
    let whatIsX = 0;
    let synTitleX = 0;
    let aesthesiaTitleX = 0;
    // Set by layoutAnswer() — where the reused lead-text line sits.
    let etymLeadY = 0;
    let etymLeadFontSize = 0;

    // The 5 sense icons — same join-once, reposition-on-resize pattern as
    // the person tiles. x/y/scale/color are filled in by layoutSenses();
    // opacity is driven per-tick by setTitleProgress(); flash is driven
    // per-tick by setQuotesProgress() as sense words are revealed.
    const iconNodes = senseIcons.map((d) => ({ ...d, x: 0, y: 0, scale: 1, color: colors.text, opacity: 0, flash: 0, riseAmt: 0 }));
    let senseGroups;

    // One per quote/person, same join-once pattern as the sense icons —
    // x is filled in by layoutPeopleBubble() every resize, and read by
    // setQuotesProgress() to aim the bubble's tail at the active one.
    const personIconNodes = quotes.map(() => ({ x: 0, y: 0, scale: 1, cropped: false }));
    let personIconGroups;

    // Step 9 intro: 36 participant icons — 18 grapheme-colour synesthetes
    // (left, random Fisher-Price colour each, reusing step3's own
    // skip-yellow palette) + 18 controls (right, plain grey). Colour is
    // picked once at module init — cosmetic only, never needs to change
    // on resize/re-render. Reuses personIconTransform() (cropped: false)
    // for positioning, same as personIconNodes above.
    const participantNodes = Array.from({ length: 36 }, (_, i) => ({
      group: i < 18 ? 'synesthete' : 'control',
      index: i < 18 ? i : i - 18,
      color: i < 18 ? step3.icons.colors[Math.floor(Math.random() * step3.icons.colors.length)] : colors.grey,
      x: 0,
      y: 0,
      scale: 1,
      cropped: false
    }));
    let participantIconGroups;

    // step9 header text: 4 stages, swapped instantly at a threshold, same
    // pattern as pubTitleStage below — Bryony: "We lead with Is synesthese
    // brain activity different - fade in the people... Then [36
    // participants]... Then [letters, numbers + symbols]... Then [while
    // undergoing fMRI scanning]" (the last of which also triggers the
    // scan animation, see setBrainProgress).
    const brainQuestionText = 'Is synesthese brain activity different?';
    const brainIntroText1 = 'The study worked with 36 participants';
    const brainIntroText2 = 'They were shown letters, numbers + symbols';
    const brainScanText = 'while undergoing fMRI scanning';
    // Bryony: "The moment that the people start to fade out and the
    // brain starts to fade in change to: Synesthetes showed greater and
    // more widespread brain activation" — lands at step9.intro.fadeOut.start.
    const brainActivationText = 'Synesthetes showed greater and more widespread brain activation';
    // Bryony: "for the last bit of this section the header should read
    // 'in some interesting areas'" — lands at step9.dots.fadeIn.start,
    // the same moment the 4 region dots (and their new leader-line
    // labels below) start fading in.
    const brainAreasText = 'in some interesting areas';
    let brainTitleStage = 'question'; // 'question' | 'intro1' | 'intro2' | 'scanning' | 'activation' | 'areas'
    function brainTitleTextFor(stage) {
      if (stage === 'intro1') return brainIntroText1;
      if (stage === 'intro2') return brainIntroText2;
      if (stage === 'scanning') return brainScanText;
      if (stage === 'activation') return brainActivationText;
      if (stage === 'areas') return brainAreasText;
      return brainQuestionText;
    }
    // Real rendered top/bottom of the icon row (icons + labels), measured
    // by layoutSenses() via getBBox — used by layoutClosing() to keep the
    // gap below the icons the same as the gap above them.
    let iconsTopY = 0;
    let iconsBottomY = 0;
    // How far the icon row rises during step4.clear — computed by
    // layoutSenses() from the same topPadding the header uses, not a
    // guessed pixel value.
    let iconsRiseBy = 0;
    // The on-screen Y the risen row rests at (topPadding*2 + half the
    // icon size) — set by layoutSenses(); layoutSight() uses this as the
    // ring's own centre, so step 5 "moves the icons to a similar point
    // on the screen" rather than somewhere new.
    let senseRestY = 0;
    // The real top edge of the person-tile cluster — set by
    // layoutPeopleBubble() every resize (it already computes this for
    // its own use); layoutSight() reuses it as the ring's lower bound
    // rather than recomputing the same corner-grid math a second time.
    let tilesTopY = 0;

    // Set by layoutClosing() every resize — where the quotes below it
    // should start.
    let closingSubY = 0;
    let quotesStartY = 0;

    // The bubble's own box, set by layoutPeopleBubble() every resize —
    // read by setQuotesProgress() to redraw just its tail position each
    // tick, without redoing the whole layout pass.
    let bubbleX = 0;
    let bubbleY = 0;
    let bubbleW = 0;
    let bubbleH = 0;

    // Pure timing for the 5 quotes — one equal slice each of whatever's
    // left of quotesProgress after the step4.clear phase, staggered
    // word-by-word within it (see step4 in steps.js). Computed once;
    // doesn't depend on layout, only on the quotes data.
    const quotesLayout = layoutQuoteReveals(quotes, step4);

    // Which progress values, per sense, should "flash" that sense's icon
    // — one entry per sense word across all 5 quotes, at the moment that
    // word finishes fading in. Computed once from quotesLayout.
    const senseFlashCenters = {};
    quotes.forEach((quote, qi) => {
      quote.words.forEach((w, wi) => {
        if (!w.sense) return;
        const center = quotesLayout[qi].words[wi].end;
        (senseFlashCenters[w.sense] ||= []).push(center);
      });
    });

    // Maps each sense name to the Fisher-Price colour its icon was given
    // in layoutSenses() (step3.icons.colors, in senseIcons' own order) —
    // so a quote word gets coloured to match its icon, not a colour of
    // its own.
    const senseColors = Object.fromEntries(
      senseIcons.map((s, i) => [s.label, step3.icons.colors[i % step3.icons.colors.length]])
    );

    let quotesGroups;

    // The 3 icons sight "splits into" — same join-once pattern as the
    // sense/person icons. x/y/scale are filled in by layoutSight(); they
    // only ever fade in, once, during step 5.
    const sightSubIconNodes = sightSubIcons.map((d) => {
      const [, , vbW, vbH] = d.viewBox.split(' ').map(Number);
      return { ...d, vbW, vbH, x: 0, y: 0, scale: 1 };
    });
    let sightSubIconGroups;

    // One entry per (edge, person) — the duplicated photo fan that sits
    // along each relationship arrow. Flattened once from synaesthesiaLinks
    // (which is itself grouped by edge, not by person) since that's the
    // shape buildLinkPhotos()'s D3 join wants. endX/endY/endRotation (each
    // photo's own resting spot on its edge) and startX/startY (shared per
    // PERSON — see personIndexByName below, so someone on several edges
    // has one shared departure point but a separate arrival per edge) are
    // filled in by layoutLinks() every resize; x/y/rotation are what's
    // actually drawn, set every scroll tick by setLinksProgress() as it
    // lerps from the start to the end.
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
    // Bryony: "the idea is that the images move from their position
    // bottom middle to their position on the links (for those that have
    // multiple links they all come from the same place)" — "bottom
    // middle" is wherever a person has actually settled in the main
    // corner-grid tile cluster (`cornerTargets`, indexed the same as
    // `nodes`/`people`), so this just needs each person's own index into
    // that array.
    const personIndexByName = new Map(people.map((p, i) => [p.name, i]));
    // Bryony: "can we work it so the images at the bottom left move,
    // change size (if necessary) and disappear from the bottom - at the
    // moment one is left behind" — every person who has at least one
    // link should shrink + fade out of the bottom corner-grid as their
    // duplicate(s) fly off to it (see positionNodes()), not just sit
    // there permanently dimmed. Currently that's all 12, but computed
    // from the data rather than assumed.
    const linkedPersonNames = new Set(synaesthesiaLinks.flatMap((e) => e.people.map((p) => p.name)));
    let linkGroups;
    let linkPhotoGroups;

    // Step 7's axis ticks — computed once, up top, since both only ever
    // depend on the DATA's fixed min/max (never on width/height), so the
    // exact same tick values hold at every screen size. This still only
    // ever produces a FIXED array for a fixed dataset — important since
    // the tick <g>s are data-joined once in buildPublications() and never
    // need to grow or shrink later; a variable count would mean the
    // join's exit branch sometimes has ticks to drop, and d3's default
    // exit behaviour removes the dropped elements outright (forbidden in
    // this file's own code).
    // Bryony: "More ticks - let's try every 20 years on the 10 unless
    // it's start + finish" — the actual min/max year (1947, 2026) as the
    // first/last ticks, whatever they happen to be, plus round decade
    // years in between, 20 years apart (1950, 1970, 1990, 2010 — never
    // an arbitrary value like 1967).
    const publicationsXTickValues = [publicationsMinYear];
    const firstRoundXTick = Math.ceil(publicationsMinYear / 10) * 10;
    // Bryony: "get rid of the 1820 + 2020 ticks" — a round tick sitting
    // this close to either real endpoint just crowds it rather than
    // adding information, so skip any round tick within half a step (10
    // years) of the min/max year, not only the exact endpoints.
    const xTickEdgeGuard = 10;
    for (let year = firstRoundXTick; year < publicationsMaxYear; year += 20) {
      if (year - publicationsMinYear > xTickEdgeGuard && publicationsMaxYear - year > xTickEdgeGuard) {
        publicationsXTickValues.push(year);
      }
    }
    publicationsXTickValues.push(publicationsMaxYear);

    // Bryony: "add a marker De la synesthésie (1892) when the term was
    // first coined" — a fixed historical reference point, independent of
    // the plotted decade totals. Its x-position as a FRACTION of the
    // chart's width depends only on the data's fixed min/max year (never
    // on layout), so it's computed once here — layoutPublications() uses
    // it for pixel placement, setPublicationsProgress() for reveal timing.
    const publicationsMarkerYear = 1892;
    // Bryony: "term synaesthesia first used" — same 1892 date as the
    // paper itself (her own confirmation: "it's the De la synesthesie
    // paper"), so one marker, one label carrying both facts rather than
    // a second marker sitting on the exact same x-position.
    // Bryony: dropped " — synaesthesia first used" — that fact now lives
    // in the title itself (see publicationsMarkerTitleText below).
    const publicationsMarkerLabel = 'De la synesthésie (1892)';

    // Bryony: "mark 2 publications - Rouw & Scholte (2007) and Witthoft,
    // Winawer & Eagleman (2015)... show label for 1st, then 2nd" — the
    // NEXT step (step8), once the chart itself has fully drawn. Same
    // fixed-array reasoning as above: exactly 2, never joined, indexed
    // by position (see .pubCitation1/.pubCitation2 in the template).
    const publicationsCitations = [
      { year: 2007, label: 'Rouw & Scholte (2007)' },
      { year: 2015, label: 'Witthoft, Winawer & Eagleman (2015)' }
    ];

    // d3's own "nice" rounding for the y domain — computed once here so
    // layoutPublications() (which needs the same domain every resize, to
    // build the real pixel-range scale) and this tick list always agree.
    // The 0 tick is dropped — the x-axis line itself sits at y=0. Scaled
    // to the DECADE totals' own max (a decade sum runs far higher than
    // any single year ever did), now that the line/area plot those.
    const publicationsYNiceScale = d3.scaleLinear().domain([0, publicationsByDecadeMaxCount]).nice();
    const publicationsYDomain = publicationsYNiceScale.domain();
    const publicationsYTickValues = publicationsYNiceScale.ticks(4).filter((v) => v > 0);
    let pubXTickGroups;
    let pubYTickGroups;
    let pubXScale;
    let pubYScale;
    // Set by setPublicationsProgress(); read by layoutPublications() so a
    // resize mid-scroll keeps the line/area's wipe wherever it currently
    // is instead of resetting it — same reasoning as linksRevealT above.
    let pubDrawT = 0;
    // The clip rect's full width at drawT=1 — set by layoutPublications(),
    // read by setPublicationsProgress() every tick so it doesn't have to
    // redo the chart-bounds math just to scale one number.
    let pubChartWidth = 0;
    // Bryony: "Let's focus [on 2 recent publications] replaces This is
    // not old news" — .publicationsTitle is reused for its step8 line
    // the moment that step begins, same "one text element, swapped in
    // place" pattern as .sightLabel's closing-sentence swap. The font
    // size/wrap width are set once in layoutPublications() and stored
    // here so setPublicationsMarkersProgress() can re-wrap after a swap
    // without redoing that layout math.
    const publicationsChartTitleText = 'This is not old news - there is a long publication history.';
    // Bryony: shown once the 1892 marker itself has appeared.
    const publicationsMarkerTitleText = 'The term SYNAESTHESIA was first used in 1892';
    const publicationsMarkersIntroText = "Let's focus on 2 recent publications";
    // 'default' | 'marker' | 'markersIntro' — same one-way-forward,
    // reversible-on-scroll-up pattern as sightHeaderStage elsewhere.
    let pubTitleStage = 'default';
    let pubMarkerT = 0;
    function pubTitleTextFor(stage) {
      if (stage === 'markersIntro') return publicationsMarkersIntroText;
      if (stage === 'marker') return publicationsMarkerTitleText;
      return publicationsChartTitleText;
    }
    let pubTitleFontSize = 18;
    let pubTitleWrapWidth = 0;
    // Same resize-safety purpose as the pair above, for .brainTitle's own swap.
    let brainTitleFontSize = 18;
    let brainTitleWrapWidth = 0;
    // Step 9: "I'd like to color by effect - white to our fisherprice
    // green, d3.scaleLinear() [0,4.8]" + "size by volume d3.scaleSqrt()
    // [0,20] range, [0,100] domain" (range bumped 25% per Bryony's own
    // follow-up, to [0,25], then a further "tiny bit (5px)" to [0,30] —
    // partly to give the dot legend's 2 reference circles a touch more
    // separation between their tops) — fixed scales, computed once,
    // since neither domain nor range depends on layout.
    const brainEffectColorScale = d3.scaleLinear().domain([0, 4.8]).range(['white', colors.green]);
    const brainVolumeRadiusScale = d3.scaleSqrt().domain([0, 100]).range([0, 30]);
    let brainDots;
    // Bryony: "add some labels with lines connecting... to" the region
    // dots — built once in buildBrain() alongside the dots themselves,
    // positioned every resize in layoutBrain().
    let brainDotLabelGroups; // the text (one per ANNOTATION — see below), screen space
    let brainDotLeaderLines; // the leader lines (one per DOT), local/icon space — see buildBrain()
    // Bryony: "do we need 2 Attention + Planning labels - maybe just one
    // but with 2 lines" — the 2 Superior frontal dots (left + right
    // hemisphere) share one label/annotation with 2 leader lines
    // fanning out to both; Parietal-left and Temporal-right each keep
    // their own 1-dot annotation (`targets`: brainRegions keys — region
    // + hemisphere, matching buildBrain()'s own join key — every dot
    // that gets its own leader line).
    //
    // Bryony: "align to left side of right brain" / "align to right
    // side of left brain [...] with a bit of padding", then "by padding
    // I meant about 6px between the edge of the shape stroke and the
    // start of the label text" — the brain icon's own path (see
    // brainIcon.js) is literally 2 separate closed shapes, one per
    // hemisphere: reading the raw coordinates, the left hemisphere's
    // own rightmost point is x=296 and the right hemisphere's own
    // leftmost point is x=344 (they don't meet at a clean x=320 — there's
    // a real ~48-unit gap between them, the drawn fissure). `hemisphere`
    // picks which of those 2 edges a label aligns to; the actual localX
    // (computed in layoutBrain(), since it depends on iconScale — a
    // REAL 6px, not a fixed local-unit guess) adds that edge, half the
    // path's own stroke width (.brainIconPath's stroke-width: 3, same
    // local-unit space as the path), and the 6px gap converted through
    // iconScale. `textAnchor` follows from `hemisphere`: 'right' (the
    // label sits just right of the right hemisphere's left edge) gets
    // 'start' (text flows away, rightward); 'left' gets 'end' (flows
    // away, leftward). `localY` is still a plain local-space coordinate.
    // A leader line still runs from the label to each of its target
    // dot(s), whichever direction (up/down) that dot actually is from
    // the label — see the per-line comparison in layoutBrain().
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
    // Reverse lookup, dot key -> its annotation — built once (the
    // annotations array above is static), used by the leader-line join
    // in buildBrain()/layoutBrain() to find which label each line
    // should run to.
    const brainDotAnnotationByTarget = {};
    brainDotAnnotations.forEach((a) => {
      a.targets.forEach((key) => {
        brainDotAnnotationByTarget[key] = a;
      });
    });
    let magnetLetterGroups; // step10's drawn magnet letters — built once in buildMagnetLetters(), positioned every resize in layoutConnections()
    let heatmapCellGroups; // step11's per-respondent cells (one per letter x respondent) — built once in buildHeatmap(), positioned every resize in layoutHeatmap(), re-ranked/re-coloured every tick in setHeatmapProgress()
    let heatmapMorphGroups; // step11's colorBar-beat aggregate polygons (2 per letter — see buildHeatmap()'s own comment)
    let heatmapCellBandOuterRadius = 0; // the ring's own outer radius (local space) — set by layoutHeatmap(), read by setHeatmapProgress() for the non-match morph polygon's outer edge
    let heatmapSeparatorLines; // step11's 26 slice separators
    const heatmapArc = d3.arc(); // shared generator — every ring cell's 'd' just calls this with fresh radii/angles
    let magnetTrayLetterFontSize = 16; // the tray-stage letter font size, set by layoutConnections() every resize — layoutHeatmap() reads it to size the ring's own shrink
    let heatmapRanksSeeded = false; // seedHeatmapRanks() only needs to run once — the respondent data itself never changes
    let currentHeatmapProgress = 0; // last value setHeatmapProgress() ran with — layoutHeatmap() re-applies it after a resize, same pattern currentProgress uses for setRevealProgress()
    const heatmapColorInterpCache = {}; // 'rawColor|sortedColor' -> d3.interpolateRgb(...), built lazily — only ~49 distinct colour pairs across all 8476 cells, so this avoids re-parsing the same hex pairs on every scroll tick
    // Letter -> its own "correct" Fisher-Price colour (magnetLetters.js's
    // own template colour) — built once, used by setHeatmapProgress() to
    // colour a letter's matching cells.
    const magnetTemplateColorByLetter = {};
    magnetLetters.forEach((d) => {
      magnetTemplateColorByLetter[d.letter] = d.color;
    });
    // Same background-circle radius layoutSight() gives the sense/sub
    // icons — set there, reused here so the arrows start/end at each
    // icon's own circle edge rather than its centre. One place this
    // number lives, so the two never drift apart.
    let iconBgRadius = 0;

    // The ring's own centre + radius, set by layoutSight() every resize
    // — the circle and 3 sub-icons are positioned directly off these;
    // setSightProgress() only ever toggles their opacity, never their
    // geometry.
    let sightCenterX = 0;
    let sightCenterY = 0;
    let sightRadius = 0;

    // Shared by both hover targets below (.personGroup and .linkPhotoItem)
    // — `lines` is an array of {text, bold}, stacked top to bottom,
    // measured via getBBox() (content is genuinely dynamic here — a
    // different line count per person/phase — unlike the brain legend's
    // own fixed, already-known line counts, where the same approach was
    // correctly ruled out as unnecessary maths). Anchored above
    // (anchorX, anchorY) — each caller's own current d.x/d.y — centred
    // horizontally on it and clamped to stay on-canvas left/right.
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

    // Joins nodes onto .person groups. Only the enter branch creates DOM —
    // an update just re-runs the per-node attrs below, no removing and
    // rebuilding the tree.
    function buildScene() {
      // .peopleGroup (set in markup) is the one persistent container;
      // .personGroup is per-node, created here as data joins it.
      const groups = svg
        .select('.peopleGroup')
        .selectAll('.personGroup')
        .data(nodes, (d) => d.name)
        .join((enter) => {
          // Structure only — nest everything under the SAME captured `g`,
          // not appended onto `enter` again each time (that was creating
          // flat siblings instead of one tree per person).
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

      // Data-dependent attrs, outside the join, on the full joined
      // selection (entered + already-existing) — your call, kept.
      groups.select('.tilePattern').attr('id', (d, i) => `tile-photo-${i}`);
      groups.select('.patternImage').attr('href', (d) => d.image);
      groups.select('.personTile').attr('fill', (d, i) => `url(#tile-photo-${i})`);
      groups.select('.personLabel').text((d) => d.name);

      // Bryony: "the initial tooltip (when the name label is shown) is
      // super simple - just their profession... then when the name label
      // disappears this will be name - occupation" — same cornerT the
      // label's own opacity is driven by (positionNodes()), read fresh on
      // every hover rather than cached, so it's always in step with
      // whatever the tile is actually showing right now.
      groups
        .on('mouseenter', function (event, d) {
          // Bryony: switch once they've actually arrived (step1 60%,
          // where tilesToCorner.end already sits), not partway through.
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

    // Sizes, positions and wraps the header, and sets topMargin to keep
    // tiles out of the band it occupies. Re-runs every resize (wrapping
    // depends on the current width, not just first paint) — so it resets
    // the element back to plain text first, since wrap() rebuilds it as
    // <tspan> lines and reading .text() off an already-wrapped element
    // would just read the tspans' text back out, not the original string.
    function layoutHeader() {
      if (!headerText) {
        topMargin = edgeMargin;
        return;
      }
      const fontSize = Math.max(24, Math.min(40, width * 0.04));
      const bottomPadding = 28;
      // Scales with the font itself (not a flat pixel ceiling), so a
      // wide screen — bigger font — gets a wider line before it wraps.
      const maxTextWidth = Math.min(width - 48, fontSize * 24);

      const headerEl = svg
        .select('.headerText')
        .text(headerText)
        .attr('font-size', fontSize)
        .attr('x', width / 2)
        .attr('y', topPadding + fontSize / 2);

      wrap(headerEl, maxTextWidth, fontSize);

      // getBBox rather than assuming one line's height — wrap() may have
      // just made this two or more lines tall.
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

    // Sizing/position does depend on the canvas, so this re-runs on every
    // resize. SYN and AESTHESIA are two separate elements (for whatever
    // etymology animation links them to their Latin/Greek roots later),
    // but need to read as one centred word now — so both get
    // text-anchor:start, and AESTHESIA's x is set to exactly where SYN's
    // measured width ends, with the combined width centred as a unit.
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
      if (leadTextShowingSenses) renderSensesLeadText(etymLeadY);
    }

    // Where SYNAESTHESIA + "What is" land once step 3's title move
    // finishes — the same slot the page header uses, so it reads as one
    // line: "What is SYNAESTHESIA". Widths at the smaller title size are
    // scaled from the already-measured resting widths rather than
    // re-measured — text metrics scale linearly with font-size for the
    // same font/weight.
    function layoutTitle() {
      if (!answer) return;
      titleFontSize = Math.max(24, Math.min(40, width * 0.04)); // same formula as the header
      titleY = topPadding + titleFontSize / 2;

      const scale = titleFontSize / etymWordFontSize;
      const synWidthAtTitle = etymSynWidth * scale;
      const aesthesiaWidthAtTitle = etymAesthesiaWidth * scale;

      const whatIsEl = svg.select('.whatIsText').attr('font-size', titleFontSize).text('What is ');
      const whatIsWidth = whatIsEl.node().getComputedTextLength();

      const combinedWidth = whatIsWidth + synWidthAtTitle + aesthesiaWidthAtTitle;
      whatIsX = width / 2 - combinedWidth / 2;
      synTitleX = whatIsX + whatIsWidth;
      aesthesiaTitleX = synTitleX + synWidthAtTitle;

      whatIsEl.attr('x', whatIsX).attr('y', titleY);

      // "What is SYNAESTHESIA?" — the question mark is its own element
      // (not appended to aesthesiaText's own text) since AESTHESIA is
      // also shown on its own, without a "?", back in step1/step2.
      svg
        .select('.titleQuestion')
        .attr('font-size', titleFontSize)
        .attr('x', aesthesiaTitleX + aesthesiaWidthAtTitle)
        .attr('y', titleY)
        .text('?');
    }

    // Joins the 5 sense icons onto .senseIcon groups — same join-once,
    // reposition-on-resize pattern as the person tiles. Structure only;
    // position/size/colour are set by layoutSenses() below.
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

    // Joins the 5 (placeholder) person icons onto .personIconItem groups
    // — same join-once pattern as buildSenses() above. Position/scale/
    // crop are set by layoutPeopleBubble().
    function buildPeopleIcons() {
      const groups = svg
        .select('.peopleIconsGroup')
        .selectAll('.personIconItem')
        .data(personIconNodes)
        .join((enter) => {
          const g = enter.append('g').attr('class', 'personIconItem');
          g.append('path').attr('class', 'personIconPath').attr('d', personIcon.path);
          return g;
        });

      return groups;
    }

    // Step 9 intro: joins the 36 participant icons onto
    // .participantIconItem groups — same join-once/never-remove pattern
    // as buildPeopleIcons() above. Group labels are plain text content
    // that doesn't depend on size, so (like buildAnswer()) they're set
    // here, once, rather than in the per-resize layout function.
    function buildParticipantIcons() {
      svg.select('.participantLabelLeft').text('18 grapheme–colour synesthetes');
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

    // Joins the 3 sight-splits-into sub-icons onto .sightSubIcon groups
    // — same join-once pattern as buildSenses()/buildPeopleIcons() above.
    // Position/scale are set by layoutSight(). Bryony: "we have a temp
    // label that appears alongside the 3 categories" — `.sightSubIconLabel`
    // is the exact same build-once-text-element pattern buildSenses()
    // uses for `.senseIconLabel`; it fades out with the links (see
    // setLinksProgress()) rather than being removed.
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

    // Joins the 8 relationship edges onto .linkArrow paths — one per
    // edge (not per person; the duplicated photos are their own join
    // below). Geometry is set by layoutLinks(); the arrowhead comes from
    // the <marker> in <defs>, referenced once here rather than drawn by
    // hand per edge.
    function buildLinks() {
      const groups = svg
        .select('.linksGroup')
        .selectAll('.linkArrow')
        .data(synaesthesiaLinks, (d) => `${d.from}-${d.to}`)
        .join((enter) => enter.append('path').attr('class', 'linkArrow').attr('marker-end', 'url(#linkArrowhead)'));

      // Bryony: "we need arrows both ends of colour -> sound sound ->
      // colour" — that pair was merged into a single link (see
      // synaesthesiaLinks.js), so getting an arrowhead at both ends
      // means marker-start too, on this one edge only. The shared
      // marker's orient="auto-start-reverse" (see its own comment in
      // <defs>) makes the same marker asset point correctly outward at
      // either end.
      groups.attr('marker-start', (d) => (d.from === 'sound' && d.to === 'colors' ? 'url(#linkArrowhead)' : null));

      return groups;
    }

    // Joins linkPhotoNodes (one per edge+person) onto .linkPhotoItem
    // groups — same tilePattern-fill technique buildScene() uses for the
    // step1 person tiles (a <pattern><image></pattern> filling a rounded
    // <rect>), so these small photos render exactly like the big ones do.
    // Position/rotation are set by layoutLinks().
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

      // Bryony: "name (bold), relationship (smell -> letters + numbers)
      // ... until the relationship list for this person is done" —
      // personRelationships() aggregates across ALL of this person's
      // edges, not just the one this particular photo instance is on, so
      // hovering any of their photos shows their full list.
      groups
        .on('mouseenter', function (event, d) {
          // Bryony: name - job until step7 40% (once arrived @ link
          // position), then name (bold) + sense -> sense list.
          if (linksT < 0.4) {
            const idx = personIndexByName.get(d.name);
            const profession = idx != null ? people[idx].profession : '';
            showPersonTooltip(d.x, d.y, [{ text: `${d.name} - ${profession}`, bold: false }]);
          } else {
            // Bryony: grey out this person's OTHER relationships — only
            // the one matching this exact photo/edge stays full colour.
            const lines = [
              { text: d.name, bold: true },
              ...personRelationships(d.name).map((r) => ({ text: r.text, bold: false, grey: r.edgeKey !== d.edgeKey }))
            ];
            showPersonTooltip(d.x, d.y, lines);
          }
        })
        .on('mouseleave', hidePersonTooltip);

      return groups;
    }

    // Step 7: the publications-over-time line/area chart. Build-once
    // structure only — the axis tick <g>s are (re)joined here too since
    // their COUNT depends on data that never changes, so this only ever
    // runs the enter branch in practice; position/scale is layoutPublications()'s
    // job, same split as everywhere else in this file. `.pubLine`/`.pubArea`
    // get their real `d` there too — nothing about their shape is
    // progress-driven, only how much of them shows through `.pubDrawClipRect`
    // (see setPublicationsProgress()).
    function buildPublications() {
      const xTicks = svg
        .select('.pubXAxisGroup')
        .selectAll('.pubXTick')
        .data(publicationsXTickValues, (d) => d)
        .join((enter) => {
          // Bryony: "no ticks on the x axis" — just the year text now,
          // no perpendicular tick mark under the baseline.
          const g = enter.append('g').attr('class', 'pubXTick');
          g.append('text').attr('class', 'pubXTickLabel').text((d) => d);
          return g;
        });

      // Bryony: "lets keep all the ticks text anchor middle EXCEPT first
      // (start) + last (end)" — so the two outermost year labels sit
      // fully inside the axis instead of overhanging its ends. Position
      // in the (ascending, fixed) publicationsXTickValues array, not the
      // year value itself: the first/last entries are always minYear/
      // maxYear (see where that array's built).
      xTicks
        .select('.pubXTickLabel')
        .style('text-anchor', (d, i, nodes) => (i === 0 ? 'start' : i === nodes.length - 1 ? 'end' : 'middle'));

      const yTicks = svg
        .select('.pubYAxisGroup')
        .selectAll('.pubYTick')
        .data(publicationsYTickValues, (d) => d)
        .join((enter) => enter.append('text').attr('class', 'pubYTick').text((d) => d));

      svg.select('.pubMarkerLabel').text(publicationsMarkerLabel);
      svg.select('.pubCitation1 .pubCitationLabel').text(publicationsCitations[0].label);
      svg.select('.pubCitation2 .pubCitationLabel').text(publicationsCitations[1].label);

      return { xTicks, yTicks };
    }

    // Step 9's 4 region dots — a fixed array (brainRegions.js), never
    // resized/reordered, so a single .join() here is safe for the same
    // reason the tick arrays above are (see their own comment): d3's
    // default exit behaviour only ever runs if the data's length/keys
    // change, which this array never does.
    function buildBrain() {
      brainDots = svg
        .select('.brainDotsGroup')
        .selectAll('.brainDot')
        .data(brainRegions, (d) => d.region + d.hemisphere)
        .join((enter) => enter.append('circle').attr('class', 'brainDot'));

      // Bryony: "lines same colour as circles and underneath" — lives
      // inside .brainDotsGroup itself (the icon's own local/transformed
      // space, same as the dots), in a group the template places BEFORE
      // .brainDot, so the dots always paint on top of their own line.
      brainDotLeaderLines = svg
        .select('.brainDotLeadersGroup')
        .selectAll('.brainDotLeader')
        .data(brainRegions, (d) => d.region + d.hemisphere)
        .join((enter) => enter.append('line').attr('class', 'brainDotLeader'));

      // One label per ANNOTATION, not per dot — Bryony: "do we need 2
      // Attention + Planning labels - maybe just one but with 2 lines"
      // — see brainDotAnnotations (the 2 Superior frontal dots share a
      // single label with 2 leader lines fanning out to both).
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

    // Step10's own drawn magnet letters (see magnetLetters.js) — one
    // <text> per letter, coloured once here (never changes), positioned
    // in the tray grid every resize by layoutConnections().
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

    // Step11's per-respondent cells — one <path> per (letter, respondent),
    // 26 x 326 = 8476 total, built once here and never rebuilt; every
    // tick only their own 'd'/fill change (see layoutHeatmap() and
    // setHeatmapProgress()) — same "build once, toggle forever" rule as
    // everywhere else in this file. Keyed by letter+index so the join
    // never re-enters once built (the respondent data itself is static).
    // Each is a true annular-sector wedge (d3.arc()), matching Bryony's
    // own original Observable cell (hand-rolled canvas arcs — same
    // shape, ported to an SVG path generator) rather than the rotated
    // rects this used to be.
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
            isMatch: codes[i] === template
          });
        }
      });
      heatmapCellGroups = svg
        .select('.heatmapCellsGroup')
        .selectAll('.heatmapCell')
        .data(cellData, (d) => d.letter + d.i)
        .join((enter) => enter.append('path').attr('class', 'heatmapCell'));

      // The 26 thin white separators between letter slices — Bryony's
      // original drew these on every ring frame (drawSeparators()) and
      // faded them out as the bar morph took over.
      heatmapSeparatorLines = svg
        .select('.heatmapSeparatorsGroup')
        .selectAll('.heatmapSeparator')
        .data(magnetLetters, (d) => d.letter)
        .join((enter) => enter.append('line').attr('class', 'heatmapSeparator'));

      // The colorBar beat's own 52 aggregate polygons (2 per letter: the
      // matched portion, which morphs into that letter's bar, and the
      // non-matched portion, which morphs alongside it but fades to
      // nothing) — see heatmapBuildPolygon()/setHeatmapProgress(). This
      // mirrors the original's drawMorph(), which draws exactly these 2
      // shapes per letter rather than animating all 326 individual cells
      // through the morph.
      const morphData = [];
      Object.keys(magnetResponses).forEach((letter) => {
        morphData.push({ letter, kind: 'match' });
        morphData.push({ letter, kind: 'nonmatch' });
      });
      heatmapMorphGroups = svg
        .select('.heatmapMorphGroup')
        .selectAll('.heatmapMorphPiece')
        .data(morphData, (d) => d.letter + d.kind)
        .join((enter) => enter.append('path').attr('class', 'heatmapMorphPiece'));
    }

    // The outer <g class="personIconItem"> transform — centres the
    // icon's own viewBox (or, when cropped, just its head portion) on
    // (d.x, d.y). Shared by layoutPeopleBubble() (which sets d.x/d.y/
    // d.scale/d.cropped) so there's one place this math lives.
    function personIconTransform(d) {
      const localCenterY = d.cropped ? personIcon.headCropHeight / 2 : 320;
      return `translate(${d.x - 320 * d.scale},${d.y - localCenterY * d.scale}) scale(${d.scale})`;
    }

    // The outer <g class="senseIcon"> transform — position, plus a
    // quotes-driven "flash" scale pulse (d.flash, set by
    // setQuotesProgress()) on top of it. Shared by layoutSenses() (where
    // flash/sightAmt are always 0), setQuotesProgress() (which just
    // re-applies this after mutating d.flash) and setSightProgress()
    // (which re-applies it after mutating d.sightAmt) — one place this
    // math lives, so the three never fall out of sync. d.x/d.y (the row
    // position) are NEVER overwritten — only blended away from, via
    // d.sightAmt — so scrolling back out of step 5 always restores the
    // row exactly, the same way rise/flash already do.
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

    // Looks up a link endpoint's on-screen centre by its node key — the
    // corner senses' own `sightX`/`sightY` (their arrived, step-5 corner
    // position — step 6 only ever runs once that's settled, so these are
    // stable) for 'sound'/'taste', or a sight sub-icon's own x/y for
    // 'colors'/'lettersNumbers'/'objects'. One lookup used by both
    // layoutLinks() (arrow geometry) and nowhere else, so the two node
    // systems (senses vs sub-icons) never have to be told apart twice.
    function nodePos(key) {
      const sub = sightSubIconNodes.find((d) => d.key === key);
      if (sub) return { x: sub.x, y: sub.y };
      const sense = iconNodes.find((d) => d.label === key);
      return { x: sense.sightX, y: sense.sightY };
    }

    // Sizes and evenly spaces the 5 icons in a row below the reused
    // lead-text line, and assigns each its Fisher-Price colour (step3's
    // A–E list) — mutates the same iconNodes objects positionNodes-style,
    // so senseGroups' bound data picks the new values straight up.
    function layoutSenses() {
      if (!answer) return;
      const iconSize = Math.max(40, Math.min(64, width * 0.06));
      const rowMargin = Math.max(edgeMargin, width * 0.08);
      const slot = (width - rowMargin * 2) / iconNodes.length;
      // step3: anchored to risen baseline, matches sensesTextBottom, +80 per your note
      const rowY = etymLeadY - step3.senses.riseBy + etymLeadFontSize * 2.4 + 80;

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
      senseGroups.select('.senseIconLabel').attr('y', (d) => (d.vbH * d.scale) / 2 + labelOffset);

      // Real rendered extent of the whole row (icons + labels), so
      // layoutClosing() can mirror the gap above it exactly rather than
      // guessing at label heights.
      const sensesBox = svg.select('.sensesGroup').node().getBBox();
      iconsTopY = sensesBox.y;
      iconsBottomY = sensesBox.y + sensesBox.height;

      // How far the row needs to rise during step4.clear to land near
      // header height — not flush against topPadding (that put them too
      // far up), but with 2x that clearance above them, per your notes.
      iconsRiseBy = rowY - (topPadding * 2 + iconSize / 2);
      senseRestY = topPadding * 2 + iconSize / 2;
    }

    // "consistently triggers another sense" + the smaller, staggered
    // "(or more than one)" below the icon row — spaced below it by the
    // same gap the senses-text has above it, so the block reads as
    // symmetric around the icons.
    function layoutClosing() {
      if (!answer) return;
      const closingFontSize = etymLeadFontSize;
      const sublineFontSize = closingFontSize * 0.75;

      const sensesTextBottom = etymLeadY - step3.senses.riseBy + etymLeadFontSize / 2;
      // gap measured pre-shift so closing text moves the same +80, not double
      const gapAboveIcons = Math.max(20, iconsTopY - 80 - sensesTextBottom);

      // +30 more, closing lines only per your note — icons stay put
      const closingY = iconsBottomY + gapAboveIcons + closingFontSize / 2 + 30;
      const sublineY = closingY + closingFontSize / 2 + labelOffset + sublineFontSize / 2;

      // Bryony: "let's forget about using the different font if it's too
      // difficult... just FIVE SENSES SENSE in capitals" — step3.closing.line
      // already has "SENSE" capitalised (see steps.js), so this is back to
      // one plain line, same font throughout, no split needed.
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

    // The (placeholder) people illustration + the speech bubble above it
    // — positioned below where the icon row lands once RISEN (not its
    // resting spot; these only ever appear once the icons have moved up).
    // One fixed bubble size for now, per your call — the words go inside
    // it next round.
    function layoutPeopleBubble() {
      if (!answer) return;
      const risenIconsBottomY = iconsBottomY - iconsRiseBy;
      const specUnit = topPadding;
      const tailRatio = 39.86 / 202; // tail depth is always this fraction of the bubble's own height

      // Gap above the bubble: one 4xl (48px) per Setup — Spec.
      bubbleY = risenIconsBottomY + spacing['4xl'];

      // Person icon row: anchored to the BOTTOM — four spec units clear
      // of the person tiles clustered below — rather than sized off
      // whatever was left above the bubble. That way it reliably sits
      // low, using the screen's real height, and the bubble is what
      // stretches to fill the room left between the two.
      const tileHalfSize = (TILE * step1.tilesToCorner.scale) / 2;
      tilesTopY = cornerTargets.length ? Math.min(...cornerTargets.map((t) => t.y)) - tileHalfSize : height;
      const rowBottomY = tilesTopY - spacing['4xl']; // per Setup — Spec: a small (48px) gap above the person tiles

      // Same rowMargin/slot formula layoutSenses() uses for the sense
      // icons, so the two rows line up column for column.
      const rowMargin = Math.max(edgeMargin, width * 0.08);
      const slot = (width - rowMargin * 2) / personIconNodes.length;
      const maxIconWidth = slot * 0.85;
      const desiredHeight = Math.min(slot * 1.1, specUnit * 3.75);

      // Safety net for a genuinely short screen (landscape, mostly): if
      // even a minimal bubble wouldn't fit above a full-size row, crop
      // the row to just the head instead of letting the two collide.
      const minBubbleH = specUnit * 2;
      const spaceForRow = rowBottomY - (bubbleY + minBubbleH * (1 + tailRatio) + spacing['4xl']);
      const cropped = spaceForRow < desiredHeight;
      const scale = cropped
        ? Math.max(20, Math.min(spaceForRow, maxIconWidth)) / personIcon.headCropHeight
        : Math.min(desiredHeight, maxIconWidth) / 640;
      const renderedHeight = (cropped ? personIcon.headCropHeight : 640) * scale;
      const rowY = rowBottomY - renderedHeight / 2;
      const rowTopY = rowBottomY - renderedHeight;

      personIconNodes.forEach((d, i) => {
        d.x = rowMargin + slot * (i + 0.5);
        d.y = rowY;
        d.scale = scale;
        d.cropped = cropped;
      });

      if (personIconGroups) {
        personIconGroups.attr('transform', personIconTransform);
        personIconGroups.select('.personIconPath').attr('clip-path', (d) => (d.cropped ? 'url(#personHeadClip)' : null));
      }

      // Bubble height: fills the space between the bubble's own top
      // (already offset by one 4xl above the icons) and one more 4xl
      // clear of the person icon row — both gaps the same spec token now,
      // not the old asymmetric specUnit guess — then converted from the
      // bubble+tail's combined depth back to just the bubble's own height.
      const available = rowTopY - bubbleY - spacing['4xl'];
      bubbleH = Math.max(minBubbleH, available / (1 + tailRatio));

      const leftmostIconX = rowMargin + slot / 2;
      const rightmostIconX = width - rowMargin - slot / 2;
      const iconSpan = rightmostIconX - leftmostIconX;
      const edgePerBubbleH = (50 + TAIL_HALF_SPAN) / 202; // r + halfTailSpan, per unit of bubbleH

      // Bubble width: exactly wide enough for the tail's safe range to
      // reach the leftmost and rightmost person icons (see above) —
      // centred, so it lines up symmetrically since the row itself is
      // symmetric about the centre.
      const edge = edgePerBubbleH * bubbleH;
      bubbleW = Math.min(width - 32, iconSpan + edge * 2);
      bubbleX = width / 2 - bubbleW / 2;

      svg.select('.quoteBubblePath').attr('d', bubblePersonPath(bubbleX, bubbleY, bubbleW, bubbleH, 0));
    }

    // Joins the 5 quotes onto .quoteLine <text> elements, one <tspan
    // class="quoteWord"> per word, built once and kept forever — only
    // ever opacity 0 for the 4 quotes not currently on screen, never
    // removed. Sense words get their matching Fisher-Price colour baked
    // in here (fixed per word, doesn't change); neutral words fall back
    // to the plain --text colour via .quoteLine's own CSS.
    // Leading/trailing quote-marks and parens on a sense-coloured word
    // (Bryony: "be careful with the quote marks at the end of the
    // quotes, these should always be our standard text colour") stay
    // neutral even though the word itself is tagged — so a tagged
    // word's punctuation is split into its own nested tspan, and only
    // the core word gets the sense fill. Deliberately NOT stripping
    // commas (e.g. "guitar,") — only flagged as quote-marks/parens.
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
              // Exactly ONE .quoteWord-classed element per word, always —
              // wrapAt()'s width measurement and the word-reveal fade both
              // index selectAll('.quoteWord').nodes() positionally, one
              // entry per data word, so punctuation splits go into nested
              // (non-.quoteWord) child tspans of that one element, never
              // sibling .quoteWord tspans.
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

    // Word-wraps + centres each quote independently within the bubble's
    // own box (only one is ever visible at a time, but all 5 are laid
    // out so they're ready the moment their turn comes). All 5 quotes
    // share ONE font size — per Bryony: don't grow huge for a short
    // quote, only shrink the shared size if a longer one needs more
    // room — found by measuring the real rendered tspans (never a
    // throwaway element) and stepping the size down from the usual
    // ideal until every quote's own wrap fits inside the bubble.
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

      // Wraps one quote's words at `fontSize` (measuring the real
      // rendered tspans, so it reflects whatever the font/weight/
      // letter-spacing CSS actually gives them) and reports its line
      // breaks + total block height — doesn't touch x/y, just measures.
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

      // Step the shared size down from the ceiling until every quote's
      // own wrap fits — checked at the same size for all 5, since they
      // share one size (see comment above).
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

      // Position every quote's words from the measurements at the size
      // we landed on — centred horizontally per line, and the whole
      // block centred vertically in the bubble.
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

    // Layout for step 5, per Bryony's reference image + her follow-up
    // tuning: the circle wraps ONLY the 3 sight-splits-into sub-icons
    // (now the same size as the other sense icons), sized to just fit
    // them, sitting dead centre of the space available; sight's own
    // icon floats a small (md) gap above it, like a header for what's
    // inside. The other 4 senses are scattered randomly through the
    // rest of that space, one per quadrant around the circle so they
    // each keep their own roughly-equal patch of canvas rather than
    // clumping together. Pure target-setting, like layoutPeopleBubble()
    // — setSightProgress() is what actually animates the sense icons
    // out to these targets and fades everything else in.
    function layoutSight() {
      if (!answer) return;

      // Caption first — its real rendered bottom (it may wrap to 2+
      // lines) is this composition's own upper bound, the same way
      // layoutHeader() uses the header's bbox to set topMargin.
      const labelFontSize = Math.max(18, Math.min(28, width * 0.036));
      const labelWrapWidth = Math.min(width - 48, labelFontSize * 24);
      // Bryony: "Header should then read [the closing sentence]" once the
      // temp per-icon labels have disappeared and the links/people have
      // arrived, and (per her later request) an intermediate "famous
      // synetheses" header once the letters+numbers sub-icon has finished
      // revealing, before that — reads the same persistent linksRevealT/
      // sightRevealT setLinksProgress()/setSightProgress() already
      // maintain (see their own comments) so a resize at any point in
      // the sequence shows the right one of the 3 texts, rather than
      // reverting to the "splits into 3" title.
      sightHeaderStage = linksRevealT >= 1 ? 'closing' : sightRevealT >= 1 ? 'famous' : 'split';
      const sightHeaderTextFor = { split: sightSplitText, famous: sightFamousText, closing: closingHeaderText };
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

      // The whole composition has to fit in the real band between the
      // caption and the tile cluster.
      const topBound = Math.max(senseRestY, labelBox.y + labelBox.height + spacing['2xl']);
      const bottomBound = tilesTopY - spacing['4xl'];

      // Same icon size layoutSenses() uses — for the 5 sense icons as
      // before, and now for the 3 sub-icons too, per Bryony ("the same
      // size as the other icons").
      const iconSize = Math.max(40, Math.min(64, width * 0.06));
      const subSize = iconSize;

      // The 3 sub-icons, tightly clustered: "objects" on its own above,
      // "letters+numbers"/"colors" side by side below it. Each now gets
      // its own background circle (iconBgRadius below) — the base
      // layout (same shape as before) is scaled UP just enough that no
      // two circles overlap, and never scaled down, so it stays as
      // compact as before whenever the base spacing already had room.
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

      // Bryony: "could the sub category circles (bottom 2) be a little
      // further apart, maybe a 10px gap (you'll have to change the outer
      // circle too)" — added on top of the overlap-avoidance spread
      // above, not instead of it. sightRadius below is derived FROM
      // pairGap (via pairReach), so the outer circle grows to match
      // automatically — nothing else needs to change for that part.
      const extraPairGap = 10;
      const pairGap = basePairGap * spreadScale + extraPairGap;
      const objectsOffset = baseObjectsOffset * spreadScale;
      const pairOffsetY = basePairOffsetY * spreadScale;

      // The circle is sized to just contain the 3 background circles
      // (not just the icon paths) plus a little padding — fitted to
      // them, never the other way round, so it grows with subSize (and
      // the spread above) automatically.
      const objectsReach = objectsOffset + iconBgRadius;
      const pairReach = Math.hypot(pairGap / 2, pairOffsetY) + iconBgRadius;
      sightRadius = Math.max(objectsReach, pairReach) + spacing.lg;

      // Circle + icons centred in the middle of the available space —
      // clamped so it still fits if the band's ever shorter than the
      // circle needs.
      sightCenterX = width / 2;
      sightCenterY = Math.min(
        Math.max(topBound + (bottomBound - topBound) / 2, topBound + sightRadius),
        bottomBound - sightRadius
      );
      // Sight's own icon: a small (md) gap above the circle's own top
      // edge, clamped to stay clear of the caption on a short band.
      const sightIconY = Math.max(topBound + iconSize / 2, sightCenterY - sightRadius - spacing.md - iconSize / 2);

      // The other 4 senses: one at each corner of the available band —
      // clearly separate from the circle and from each other, fixed and
      // deterministic (no reshuffling on resize). Each keeps at least a
      // 6xl clearance from the edge of the available canvas so they're
      // not tight against it.
      const cornerPad = spacing['6xl'];
      const left = edgeMargin + cornerPad + iconSize / 2;
      const right = width - edgeMargin - cornerPad - iconSize / 2;
      const top = topBound + cornerPad + iconSize / 2;
      const bottom = bottomBound - cornerPad - iconSize / 2;
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

      // Bryony: "move them up by about 15px so they sit nicely within
      // their outer circle like they used to" — a direct offset, not a
      // change to the spread/overlap math above (that math is untouched
      // and still sets how far apart the two circles sit from each
      // other; this only lifts both of them the same amount).
      const pairLift = 15;
      const targets = {
        objects: { x: sightCenterX, y: sightCenterY - objectsOffset },
        lettersNumbers: { x: sightCenterX - pairGap / 2, y: sightCenterY + pairOffsetY - pairLift },
        colors: { x: sightCenterX + pairGap / 2, y: sightCenterY + pairOffsetY - pairLift }
      };
      sightSubIconNodes.forEach((d) => {
        const target = targets[d.key];
        d.x = target.x;
        d.y = target.y;
        d.scale = subSize / Math.max(d.vbW, d.vbH);
      });
      // Bryony: "the letters+numbers icon is off centre - just the way
      // the svg path is defined... shift it a bit left" — its own drawn
      // shape isn't centred within its declared viewBox the way the
      // other 2 icons' are, so centring the viewBox itself still looks
      // off. A manual per-icon nudge (local units, pre-scale) rather
      // than touching the shared centring maths every icon relies on.
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
        // Bryony: "centre them below the icon circles" — all 3 now get
        // the same treatment `lettersNumbers` alone used to have: same
        // clearance off iconBgRadius (the circle's own radius, not the
        // icon glyph's height), sitting BELOW, dominant-baseline hanging
        // (the class's own default — see its CSS — so no per-item
        // override needed here any more). Then: "put them a bit closer...
        // about 8/10 pix", then "still way too much padding" even at
        // that — dominant-baseline: hanging itself adds real visual
        // clearance above the glyphs before this pad even starts (a
        // font's "hanging" line sits above where the actual letters
        // begin), so the NUMBER needed to look like an 8/10px gap is
        // smaller than the gap itself. Cut hard rather than by halves.
        const subIconLabelPad = 2;
        const iconCircleClearance = iconBgRadius + subIconLabelPad;
        sightSubIconGroups.select('.sightSubIconLabel').attr('y', iconCircleClearance);
      }
      // Same radius on the 4 corner senses' background circles — "all
      // the same size" per Bryony. Sight itself never gets one
      // (opacity forced to 0 in setSightProgress), so its radius here
      // doesn't matter, but setting it on every node keeps this one
      // line instead of filtering.
      if (senseGroups) senseGroups.select('.senseIconBg').attr('r', iconBgRadius);

      svg.select('.sightCircle').attr('cx', sightCenterX).attr('cy', sightCenterY).attr('r', sightRadius);
    }

    // Step 6: an arrow per relationship (curved, per Bryony — "not really
    // a fan of the zig zag link... curves better"), plus the duplicated
    // photo fan sitting along each one. Runs after layoutSight() every
    // resize, since it reads the sense/sub-icon positions that just set —
    // never runs its own force layout, purely derived from theirs.
    function layoutLinks() {
      if (!answer) return;

      // Same circle radius the background circles use, so arrows start
      // and end at each icon's own circle edge — never its centre, and
      // never buried under the icon artwork.
      // Bryony: "the person icons should be the same size as they are
      // now at the bottom" — TILE * tilesToCorner.scale is exactly the
      // size the people tiles are already sitting at down there (see
      // resize()/layoutPeopleBubble()), so this reuses that number
      // rather than a size derived from the sight icons' own circles.
      // Then: "the people images are going to have to be smaller in
      // mobile so they still fit", and after seeing it live, "they are
      // still too big on mobile. i'd say at least 60% smaller" — tried
      // at the 420px breakpoint first (tileSizeFor's smallest tier
      // only), which Bryony caught as wrong ("Didn't we set the
      // breakpoint at 800"); tried at 800px next, which turned out too
      // aggressive the OTHER way ("tiny weeny" — that's every width
      // below tileSizeFor's own top/desktop tier, not just true mobile).
      // Settled at 600px: 40% of the size (i.e. 60% smaller) below it,
      // back to the original "same size as the bottom tiles" size at
      // and above it — a new breakpoint of its own, not tied to either
      // of tileSizeFor's (tileSizeFor's own 420/800 breakpoints are
      // untouched — Bryony: "keep the original breakpoint for
      // everything else"). Then: "I think we also need a mid point @
      // 1000" — a third tier between 600 and 1000px, at 70% (roughly
      // halfway between the 40% mobile tier and the full 100% above
      // 1000px); worth confirming that midpoint value reads right once
      // it's live. Every spacing derived from photoSize (rowGap,
      // edgeGap, the corner radius) shrinks right along with it.
      const mobilePhotoScale = width < 600 ? 0.4 : width < 1000 ? 0.7 : 1;
      const photoSize = TILE * step1.tilesToCorner.scale * mobilePhotoScale;
      const photoCorner = photoSize * 0.167; // same corner-radius ratio buildScene()'s tiles use (CORNER = TILE * 0.167)
      const pull = iconBgRadius + spacing.xs;

      // Pulling the arrowhead's refX back from its triangle's apex (see
      // arrowRefX, below) to cover the line's own stroke width also
      // pushes the VISIBLE tip forward past the path's own endpoint by
      // this same distance — so an edge's arrow END needs this much
      // extra pullback to compensate, or the visible tip overshoots
      // into the destination icon's own circle. Bryony: "arrow now hits
      // the circle stroke." Only the end gets it — the start has no
      // arrowhead to correct for.
      const linkStrokeWidth = 2.5; // .linkArrow's own stroke-width, kept in sync with the CSS below
      const arrowTipMargin = linkStrokeWidth + 1; // shared with arrowRefX below, so the two stay in sync

      // sight-sight: both ends are one of the 3 sub-icons, clustered
      // tightly inside the circle — needs the most curve so a line
      // doesn't cut straight through the third one. Bidirectional: the
      // reverse edge also exists (e.g. sound→colors AND colors→sound) —
      // needs enough curve that the two arrows read as separate, not one
      // doubled-up line. Everything else gets a gentle curve, per
      // Bryony's general preference over a straight/zigzag line.
      const sightKeys = new Set(['colors', 'lettersNumbers', 'objects']);
      const pairKeys = new Set(synaesthesiaLinks.map((e) => `${e.from}->${e.to}`));

      // Straight by default, per Bryony ("if the links can be straight,
      // make them straight") — curveFraction 0 makes the quadratic
      // bezier below degenerate into an exact straight line (control
      // point = the straight-line midpoint), no special-casing needed.
      // Only the two situations that structurally CAN'T be straight get
      // curve: sight-sight (both ends are sub-icons clustered together —
      // straight would cut across the third one) and bidirectional (the
      // reverse edge also exists — straight would sit the two arrows
      // exactly on top of each other, indistinguishable).
      //
      // Per-edge overrides for one-by-one tuning against the real
      // render, per Bryony ("one by one") — keyed by "from-to", only for
      // edges whose default needs a manual nudge. `flip` mirrors which
      // side it bows to (the default is a fixed rotation, so which side
      // "looks right" depends on that edge's own two node positions);
      // `curveFraction` overrides the depth. Missing either means "use
      // the category default" above.
      const curveOverrides = {
        // Was bowing toward 'colors' (the two sit close together in the
        // cluster) — flipped to swing out the other way instead, and
        // deepened so the arc reads as longer, per Bryony. "Looking
        // good... maybe a bit flatter" — eased the depth back down a
        // touch from the first pass (0.9 -> 0.75).
        // Then, from a reference screenshot: this edge's 3 people
        // (Daniel Tammet, Geoffrey Rush, Vladimir Nabokov) sit left of
        // the line and unrotated instead — `gridRows` [2, 1] (a pair,
        // then a single further out) plus `gridFixed` to switch the
        // photo placement (see `placeGridLeft` in layoutLinks below)
        // from the curve's own tangent/tilt onto plain screen axes: a
        // stacked pair immediately left of the line, vertically centred
        // on it, then the third person further left, centred the same
        // way — no rotation, no overlap.
        'lettersNumbers-objects': { flip: true, curveFraction: 0.75, gridRows: [2, 1], gridFixed: true },
        // "Move down and left (letters), right (colour)... wider curve
        // and longer line", then later "needs to go lower and wider" —
        // this pair sits exactly level (dy=0), so the perpendicular
        // offset below is purely vertical; there's no separate lever for
        // "lower" vs "wider", just how deep the sag is, so both rounds
        // were the same knob: deepened again, 1.1 -> 1.5. Then "now low
        // enough but move the start a bit left and the end a bit right
        // ... flatter": a first attempt nudged p0/p2 by a raw x offset
        // AFTER the circle-edge pullback below, which un-anchors them
        // from the icons' own circles — Bryony caught it ("the lines
        // need to connect to the circles"). `startAngleOffset` /
        // `endAngleOffset` fix this properly: they rotate the exit
        // DIRECTION around the icon's own centre before placing the
        // point at the usual `pull` radius, so the attach point slides
        // along the circle's edge instead of leaving it.
        // "we have to handle the people on the curved lines... could we
        // try and make the line a bit longer and wrap them around the
        // line like they are with the straight lines?" — deepened for
        // more length (1.5 -> 1.9). The along-curve photo trial that
        // followed hid some of the 5 photos behind the line/icons
        // ("you need to see all the pictures"), so photo placement for
        // this edge now uses `gridRows` instead (see layoutLinks below):
        // all 5 sit below the line in two centred rows, 3 then 2.
        // Then: "move the curve (and images) up by about 4xl" —
        // `liftY` shifts the control point up by that many px (see the
        // pass-2 loop below), taking the curve and, since the photo
        // grid is positioned off the curve's own midpoint, the images
        // with it. Confirmed perfect at this point — the reference
        // screenshot that followed was actually about letters+numbers
        // -> objects (see that override above), not this edge.
        'lettersNumbers-colors': {
          curveFraction: 1.9,
          startAngleOffset: 0.5,
          endAngleOffset: -0.5,
          gridRows: [3, 2],
          liftY: -spacing['4xl']
        },
        // Bryony: "a bit crazy... could it curve around the eye and then
        // go straight to sound? it can overlap letters+numbers ->
        // object/shape ... so it's neater" — rather than this edge
        // computing its own bow, it borrows the letters+numbers ->
        // objects edge's own control point outright (`controlFrom`,
        // resolved in the two-pass loop below). Both edges start at the
        // same lettersNumbers node, so sharing a control point means
        // they share the exact same departure line off it — the
        // overlap/join — swinging up past the sight icon the way the
        // objects edge already does, before peeling off toward sound.
        // A quadratic bezier's tail naturally straightens as it nears
        // its own endpoint (it approaches the straight line from the
        // control point to that endpoint), which is what should read as
        // "go straight to sound" at the end. Then "needs to go higher at
        // the start — so it loops around the object/shape circle or the
        // eye icon" (1.6 wasn't enough — "still overlapping the
        // object/shape circle") — `controlScale` stretches the borrowed
        // control point further out along the same line from
        // lettersNumbers (same direction, so the shared departure/"join"
        // is unchanged), which pushes the apex both higher and further
        // out; deepened again, 1.6 -> 2.4. Then "can we make the line go
        // up a bit higher (above object/shape circle) so that there is
        // more space between the line + sound -> object/shape" —
        // deepened again, 2.4 -> 3.0. Only this edge's own control point
        // changes (a fresh object each time, not the borrowed one
        // itself), so letters+numbers -> objects' own curve and photos
        // are untouched.
        // "Daniel Tammett 75% along the letters+ numbers -> sound line" —
        // see `positionT` below (dispatched near `place`/`placeGridBelow`
        // /`placeGridLeft`) — only this edge's photo placement changes;
        // its curve shape (controlFrom/controlScale above) is untouched.
        'lettersNumbers-sound': { controlFrom: 'lettersNumbers-objects', controlScale: 3.0, positionT: 0.75 },
        // Bryony: "taste -> colour... move the end point up - top of the
        // colour circle so it doesn't overlap letters + numbers" (the
        // 345°-on-the-circle version "didn't actually do anything...
        // axe the weird formula" — and was on the wrong edge besides,
        // "smell -> colour was fine, i meant taste -> colour"). Plain
        // direction, no degrees/conversion: straight up from colour's
        // own centre is just { x: 0, y: -1 }.
        // "move Marilyn to the 25% of the line length from taste ->
        // colour" — see `positionT` below.
        'taste-colors': { endDir: { x: 0, y: -1 }, positionT: 0.25 }
      };

      // Pass 1: each edge's own perpendicular-offset control point,
      // keyed by "from-to" so a `controlFrom` override (above) can
      // borrow another edge's control point regardless of array order.
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
        // Rotate the direction 90° to get a perpendicular offset for the
        // control point. Reversing from/to (as the paired edge does)
        // flips this same-signed offset to the opposite absolute side —
        // that's what keeps a bidirectional pair's two arrows apart
        // without needing to special-case which one curves which way.
        // A `flip` override negates it, for a single edge that needs to
        // bow the other way regardless.
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

      // Pass 2: resolve each edge's final control point (its own, or a
      // borrowed one via `controlFrom`), then pull both ends back to the
      // icons' own circle edges along that final curve's shape.
      synaesthesiaLinks.forEach((e) => {
        const key = `${e.from}-${e.to}`;
        const { rawFrom, rawTo } = rawByKey[key];
        const override = curveOverrides[key];
        // `controlFrom` borrows another edge's raw control point;
        // `controlScale` (only meaningful alongside it) stretches that
        // borrowed point further out along the line from this edge's
        // own start, preserving the shared departure direction (the
        // "join") while reaching further/higher than the edge it's
        // borrowed from.
        const borrowed = override?.controlFrom ? ownControlByKey[override.controlFrom] : null;
        const controlScale = override?.controlScale ?? 1;
        const control = borrowed
          ? { x: rawFrom.x + (borrowed.x - rawFrom.x) * controlScale, y: rawFrom.y + (borrowed.y - rawFrom.y) * controlScale }
          : { ...ownControlByKey[key] };

        // `liftY` (px, from theme's spacing scale) is how far the curve
        // itself — the point at its own middle, t=0.5, where the photo
        // grid is centred — should move up. p0/p2 stay pinned to their
        // icon's circle (they're placed by rotating toward wherever the
        // control point ends up, not by a fixed angle, so they barely
        // move), which for a quadratic bezier means the midpoint
        // (0.25*p0 + 0.5*control + 0.25*p2) only gets about half of
        // whatever the control point itself moves — so the control
        // point is shifted by DOUBLE `liftY` to actually deliver a
        // `liftY`-sized lift at the curve's midpoint (verified
        // numerically: within ~1px of the target for this edge's
        // geometry).
        if (override?.liftY) {
          control.y += override.liftY * 2;
        }

        // Shorten the curve at each end, back to the icon's own circle
        // edge, along that end's own tangent toward the control point —
        // keeps the curve's shape, just starts/ends it earlier. An
        // optional per-edge `startAngleOffset`/`endAngleOffset` (radians)
        // then rotates that exit direction around the icon's own centre
        // before placing the point — the attach point slides along the
        // circle instead of leaving it, unlike a raw x/y nudge would.
        const rotate = (dx, dy, theta) =>
          theta ? { x: dx * Math.cos(theta) - dy * Math.sin(theta), y: dx * Math.sin(theta) + dy * Math.cos(theta) } : { x: dx, y: dy };

        // Only 'sound-colors' also gets a marker-start arrowhead (see
        // buildLinks()) — and only that end then needs the same
        // refX-taper compensation p2 always gets below, or it hits the
        // same "arrow overshoots into the circle" bug at this end too.
        const hasStartArrow = e.from === 'sound' && e.to === 'colors';
        const startPull = hasStartArrow ? pull + arrowTipMargin : pull;
        const startDir = rotate(control.x - rawFrom.x, control.y - rawFrom.y, override?.startAngleOffset);
        const startLen = Math.hypot(startDir.x, startDir.y) || 1;
        const p0 = {
          x: rawFrom.x + (startDir.x / startLen) * startPull,
          y: rawFrom.y + (startDir.y / startLen) * startPull
        };

        const endPull = pull + arrowTipMargin;
        // `endAngle` (absolute degrees on the destination circle) skips
        // the tangent-toward-control direction entirely and places p2 at
        // a fixed compass position instead — for the rare edge where the
        // right spot on the circle isn't reachable by nudging the
        // default. The curve still approaches smoothly and the arrow
        // still orients correctly, since both are driven by the actual
        // control/p2 values, whichever way p2 was chosen.
        // `endDir` fixes a plain direction vector straight from the
        // destination icon's own centre — for the rare edge where the
        // right spot on the circle isn't reachable by nudging the
        // default tangent. Otherwise, the usual tangent-toward-control
        // direction (optionally rotated by `endAngleOffset`).
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

      // Arrowhead size, per Bryony ("nice and small" — a previous pass
      // came out "too huge" because of a marker-units bug, see the
      // <marker> element's own comment). Scaled off the same icon-circle
      // scale as everything else here rather than a fixed pixel guess,
      // but with a small multiplier and cap so it stays a modest accent
      // on the line, not a shape of its own.
      const arrowSize = Math.min(16, Math.max(8, iconBgRadius * 0.28));

      // The triangle (viewBox 0–10, apex at local x=10) tapers straight
      // to a zero-width POINT exactly at the apex. Anchoring refX at
      // that apex (10) means the arrowhead's own cross-section, right at
      // the path's endpoint, is narrower than the line's stroke — so the
      // line's full-width butt-capped end sticks out past the triangle's
      // tapering sides right at the point. Bryony: "still not quite
      // right... it's the Ref I think" — she had it: refX needs to sit
      // back from the apex, at whatever local-x position is already at
      // least as wide as the stroke (plus a small anti-aliasing margin),
      // computed from the current arrowSize so it holds at every size
      // rather than one tuned number. Uses the same arrowTipMargin the
      // p2 pullback above compensates for, so the two stay consistent.
      const arrowRefX = 10 * (1 - arrowTipMargin / arrowSize);

      svg
        .select('#linkArrowhead')
        .attr('markerWidth', arrowSize)
        .attr('markerHeight', arrowSize)
        .attr('refX', arrowRefX);

      // Bryony: "aligned at the centre above of their link line (but
      // clearly if > 1 then evenly) apart from Kandinsky who goes
      // below" — a level, centred row sitting just above each edge's
      // curve at its own midpoint, rather than fanned along the curve's
      // length. For a quadratic bezier, the point at t=0.5 is exactly
      // 0.25*P0 + 0.5*C + 0.25*P2, and its tangent is exactly P2 - P0
      // (the two halves' curvature cancels out to the straight chord
      // direction) — true for a straight OR a curved edge, no
      // special-casing needed, though per Bryony this is only tried and
      // true for the straight ones so far.
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

        // Whichever of the two perpendiculars points up the screen
        // (smaller y) is "above" — the row goes there regardless of
        // which way this particular edge happens to lean.
        const perpA = { x: -uy, y: ux };
        const perpB = { x: uy, y: -ux };
        const up = perpA.y <= perpB.y ? perpA : perpB;
        const down = { x: -up.x, y: -up.y };

        // Bryony: "rotate them so the bottom of the image (or top for
        // Kandinsky) lines up with the link line" — the tile's own
        // rect is centred at its group's local origin, so rotating the
        // group tilts the rect to match the line's slope. The bottom
        // edge (above the line) and top edge (Kandinsky, below it) are
        // each other's opposite side of the same centred rect, so one
        // rotation lines up whichever edge faces the line — no separate
        // angle for "above" vs "below". IMPORTANT: this has to be
        // derived from `down` itself, not naively from the tangent's
        // own angle (atan2(uy,ux)) — `down` flips between the tangent's
        // two possible perpendiculars depending on which one the
        // up/down pick above landed on (it can be either, depending on
        // slope direction), and a fixed tangent-angle formula only
        // matched HALF of the possible slopes when checked numerically.
        // Un-rotated, local "down" is (0,1); rotating it to land on the
        // real `down` vector takes exactly this angle.
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

        // Bryony: "the problem is that you need to see all the
        // pictures. let's start by putting them below the line. And
        // instead of following the curve lets have 3 then 2 underneath"
        // — replaces the along-curve trial for this edge: rather than
        // one spot per photo tucked along the curve's own path (where
        // some ended up hidden behind the line/icons), all of them sit
        // below the line in centred rows sized by `gridRows` (e.g.
        // [3, 2] — a row of 3, then a row of 2), each row stacked
        // further from the line than the last by the same `rowGap` used
        // for spacing within a row.
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

        // Bryony (after seeing the flat/rotated grid on the wrong edge
        // first, then correcting to say this is for letters+numbers ->
        // objects): "The 3 images need to be left of the line and not
        // rotated. 2 are immediately left of the line - one on top of
        // the other, no overlap, vertically centred on the line. the
        // 3rd is to the left of the above, centred vertically, no
        // overlap." Plain screen axes this time, not the curve's own
        // tangent/perpendicular (which don't point straight left unless
        // the edge itself happens to run vertically) and no tilt:
        // columns step straight left (-x) from the curve's own
        // midpoint, people within a column stack straight down (+y)
        // centred on that midpoint's y, rotation fixed at 0.
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

        // Bryony: "move Marilyn to the 25% of the line length from
        // taste -> colour and Daniel Tammett 75% along the letters+
        // numbers -> sound line" — places a photo directly ON the
        // curve itself at a fixed parameter t (0 = p0/start, 1 =
        // p2/end), via the same quadratic-bezier formula the curve's
        // own midpoint above already uses (t=0.5 there); `t` is the
        // bezier's own parameter, not true arc length, matching that
        // same approximation. Only meaningful with as many people as t
        // values to give them — both current uses are single-person
        // edges.
        const placeAtT = (people, t) => {
          const omt = 1 - t;
          const x = omt * omt * e.p0.x + 2 * omt * t * e.control.x + t * t * e.p2.x;
          const y = omt * omt * e.p0.y + 2 * omt * t * e.control.y + t * t * e.p2.y;
          // Bryony: "wrong angle... needs to be in line with the link" —
          // this edge borrows another edge's control point (see
          // curveOverrides above) so it bows well away from the straight
          // p0-p2 chord `tiltDeg` is built from; rotation here uses the
          // curve's REAL tangent at this t instead, so it still matches
          // a near-straight edge (like taste-colors) but is also correct
          // for a heavily-bowed one like this.
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
            // Bryony: sit above the line, not on top of it.
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

      // Every photo's shared departure point: wherever ITS PERSON has
      // actually settled in the bottom corner-grid tile cluster, not a
      // per-edge position — so someone on 2+ edges gets one shared start
      // and several different ends. Falls back to its own end position
      // (no travel) if that person can't be found in `people` for some
      // reason, rather than flying in from the origin.
      linkPhotoNodes.forEach((d) => {
        const idx = personIndexByName.get(d.name);
        const target = idx != null ? cornerTargets[idx] : null;
        d.startX = target ? target.x : d.endX;
        d.startY = target ? target.y : d.endY;
      });

      if (linkPhotoGroups) {
        // Resting (pre-scroll) position: right at the start point, same
        // as setLinksProgress(0) would produce — that function is what
        // actually drives x/y/rotation on every scroll tick from here on.
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

    // Step 7: the publications-over-time line/area chart's geometry —
    // title, plot bounds, both scales, both axes' tick positions, and
    // the line/area paths themselves. Pure target-setting like every
    // other layoutX() here: setPublicationsProgress() is what actually
    // reveals it (the x-axis, then the line/area wiping in left to
    // right, then the y-axis, per Bryony's own ordering), never this.
    function layoutPublications() {
      const titleFontSize = Math.max(18, Math.min(28, width * 0.036));
      const titleWrapWidth = Math.min(width - 48, titleFontSize * 30);
      pubTitleFontSize = titleFontSize;
      pubTitleWrapWidth = titleWrapWidth;
      // Resize-safety, same reasoning as sightHeaderStage elsewhere: pick
      // the furthest stage reached so far from the persisted progress.
      pubTitleStage =
        publicationsMarkersProgress <= 0
          ? pubDrawT >= 1
            ? 'marker'
            : 'default'
          : publicationsMarkersProgress < step8.titleSwap
            ? 'marker'
            : 'markersIntro';
      const titleEl = svg
        .select('.publicationsTitle')
        .text(pubTitleTextFor(pubTitleStage))
        .attr('font-size', titleFontSize)
        .attr('x', width / 2)
        .attr('y', topPadding + titleFontSize / 2);
      wrap(titleEl, titleWrapWidth, titleFontSize);
      const titleBox = titleEl.node().getBBox();

      // Plot bounds: below the title (with real clearance, wrap-aware,
      // same pattern layoutSight() uses for its own caption). Bryony:
      // "can we have a more padding around the line chart" — every inset
      // below is one spacing step more generous than it started at.
      // Left no longer needs a big reserve now the y axis moved to the
      // right (see below) — just a plain, modest gutter; right reserves
      // room for the tick numbers plus the axis label sitting further
      // right again.
      const chartTop = titleBox.y + titleBox.height + spacing['4xl'];
      // Bryony: "we need more space at the bottom so this doesn't look
      // weird" — one more spacing step reserved, so the footnote (pinned
      // to the very bottom, see below) has real clearance under the
      // x-axis tick labels instead of crowding them.
      const chartBottom = height - edgeMargin - (spacing['4xl'] + spacing['2xl']);
      const chartLeft = edgeMargin + spacing['2xl'];
      const chartRight = width - edgeMargin - spacing['5xl']; // smaller right margin, per your note

      pubXScale = d3.scaleLinear().domain([publicationsMinYear, publicationsMaxYear]).range([chartLeft, chartRight]);
      pubYScale = d3.scaleLinear().domain(publicationsYDomain).range([chartBottom, chartTop]);
      pubChartWidth = chartRight - chartLeft;

      // x axis: baseline + one tick per publicationsXTickValues entry
      // (fixed array, computed once at the top of the component — see
      // its own comment for why the count never changes).
      svg
        .select('.pubXAxisLine')
        .attr('x1', chartLeft)
        .attr('x2', chartRight)
        .attr('y1', chartBottom)
        .attr('y2', chartBottom);

      if (pubXTickGroups) {
        pubXTickGroups.attr('transform', (d) => `translate(${pubXScale(d)},${chartBottom})`);
        // Bryony: "no ticks on the x axis, text much bigger and closer to
        // the axis line" — no mark to offset past any more, so the label
        // sits right under the baseline with just a small breathing gap.
        pubXTickGroups.select('.pubXTickLabel').attr('y', spacing.sm);
      }

      // y axis: text-only ticks (no marks) plus a baseline of its own —
      // Bryony: "still no y axis line" — a plain vertical hairline at the
      // plot's own right edge (where the axis sits now), matching
      // .pubXAxisLine's grey/1px treatment exactly. Lives inside
      // .pubYAxisGroup so it fades with the ticks/label as one group,
      // same as the x-axis line does inside .pubXAxisGroup.
      svg
        .select('.pubYAxisLine')
        .attr('x1', chartRight)
        .attr('x2', chartRight)
        .attr('y1', chartTop)
        .attr('y2', chartBottom);

      // Bryony: "y axis should be on the right" — ticks now sit to the
      // RIGHT of the plot, extending further right (text-anchor: start,
      // see CSS), and the "Number of publications" label sits just left
      // of THEM (between the plot's own right edge and the tick-number
      // column), aligned to the top rather than centred — see its own
      // comment below.
      if (pubYTickGroups) {
        pubYTickGroups.attr('x', chartRight + spacing.md).attr('y', (d) => pubYScale(d)); // closer to the axis, per your note
      }
      // "label should be black and transformed 180, larger font, aligned
      // top and left of the y axis" — was rotate(-90) sat to the LEFT of
      // the (then left-side) axis; flipped 180° to rotate(90) so it
      // reads correctly now the axis has moved to the right (a rotate(90)
      // local +x runs down the screen, so text-anchor: start — see CSS —
      // starts the label AT yLabelY and reads downward: "aligned top").
      const yLabelX = chartRight + spacing.md - 10; // a bit further left, per your note
      const yLabelY = chartTop;
      svg.select('.pubYAxisLabel').attr('transform', `translate(${yLabelX},${yLabelY}) rotate(90)`);

      // "add a marker De la synesthésie (1892)" — a thin dashed reference
      // line at that year's x-position, full chart height. Kept recessive
      // (grey line, like the axis) since it's an annotation, not one of
      // the plotted data marks. Bryony: "The 3 paper labels should be
      // rotated 180 and left of the line - same as the y axis label" —
      // .pubYAxisLabel is rotate(90), text-anchor start, sitting to the
      // RIGHT of its reference; these sit to the LEFT of their own line
      // instead, so the rotation flips sign (rotate(-90), same "180"
      // relationship Bryony's own earlier request used for the y-axis
      // label itself when IT changed sides) — text-anchor end is what
      // keeps them "aligned top" (their topmost point at chartTop) under
      // that flipped rotation, the mirror image of how start does it for
      // rotate(90) on the right.
      const markerLabelGap = spacing.md;
      const markerX = pubXScale(publicationsMarkerYear);
      svg.select('.pubMarkerLine').attr('x1', markerX).attr('x2', markerX).attr('y1', chartTop).attr('y2', chartBottom);
      svg
        .select('.pubMarkerLabel')
        .attr('transform', `translate(${markerX - markerLabelGap},${chartTop - spacing.md}) rotate(-90)`);

      // "mark 2 publications" — same dashed-line-plus-label shape as the
      // 1892 marker, one per citation; their reveal (one at a time) is
      // step8's job, see setPublicationsMarkersProgress().
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

      // "a little footnote (post 1942 data from PubMed, pre AI generated
      // and cross checked)" — small print, bottom-left of the chart,
      // below the x-axis tick labels. Its download link is now just the
      // "(pre-1942...)" part of this same text (see the template), so
      // it's back to one line, no longer needing the extra headroom a
      // second line would have — sits at the bottom of the reserved band.
      svg.select('.pubFootnote').attr('x', chartLeft).attr('y', height - edgeMargin - 12); // moved up, per your note

      // Line + area: the real, full, stable path — never redrawn by
      // progress. `.pubDrawClipRect`'s WIDTH (not its shape) is the only
      // thing setPublicationsProgress() animates to wipe them in; its
      // x/y/height just need repositioning here to match the current
      // plot bounds, keeping whatever width the current scroll progress
      // (pubDrawT) already reached rather than resetting the wipe on
      // a resize — same reasoning as linksRevealT elsewhere in this file.
      // Bryony: "can the line + area be curveCardinal please".
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

    // Step 9: "Is synesthese brain activity different?" — title +
    // subtitle stacked above brainIcon.js's own path, scaled uniformly
    // (its viewBox is a 640x640 square) to fit whatever room is left
    // below the subtitle. The 4 dots are positioned in the SAME local
    // 640-unit space as the path itself (screenX/screenY are already a
    // 0-100 % of that viewBox — see brainRegions.js), nested inside the
    // icon's own transformed <g> so one translate+scale places both the
    // icon and its dots together — no separate mapping to keep in sync.
    function layoutBrain() {
      const titleFontSize = Math.max(18, Math.min(28, width * 0.036));
      const titleWrapWidth = Math.min(width - 48, titleFontSize * 30);
      brainTitleFontSize = titleFontSize;
      brainTitleWrapWidth = titleWrapWidth;
      // Resize-safety, same reasoning as pubTitleStage below: pick the
      // stage matching however far brainProgress has actually reached.
      brainTitleStage =
        brainProgress < step9.intro.stage1At
          ? 'question'
          : brainProgress < step9.intro.stage2At
            ? 'intro1'
            : brainProgress < step9.intro.stage3At
              ? 'intro2'
              : brainProgress < step9.intro.fadeOut.start
                ? 'scanning'
                : brainProgress < step9.dots.fadeIn.start
                  ? 'activation'
                  : 'areas';
      const titleEl = svg
        .select('.brainTitle')
        .text(brainTitleTextFor(brainTitleStage))
        .attr('font-size', titleFontSize)
        .attr('x', width / 2)
        .attr('y', topPadding + titleFontSize / 2);
      wrap(titleEl, titleWrapWidth, titleFontSize);
      const titleBox = titleEl.node().getBBox();

      // The 2 group labels + 36-icon grid are laid out further down,
      // inside the same left/right background rectangles the brain scene
      // itself uses (Bryony: "keep the background rectangles... make
      // sure these icon groups and headings are contained within them").

      const subtitleFontSize = Math.max(13, Math.min(17, width * 0.018));
      const subtitleWrapWidth = Math.min(width - 48, subtitleFontSize * 44);
      const subtitleEl = svg
        .select('.brainSubtitle')
        .text('Rouw & Scholte (2007) · 18 grapheme-colour synesthetes vs 18 controls')
        .attr('font-size', subtitleFontSize)
        .attr('x', width / 2)
        .attr('y', titleBox.y + titleBox.height + spacing.lg + subtitleFontSize / 2);
      wrap(subtitleEl, subtitleWrapWidth, subtitleFontSize);
      const subtitleBox = subtitleEl.node().getBBox();

      const iconTop = subtitleBox.y + subtitleBox.height + spacing['4xl'];
      const iconBottom = height - edgeMargin - spacing['2xl'];
      const iconMaxWidth = width - (edgeMargin + spacing['4xl']) * 2;
      const iconMaxHeight = iconBottom - iconTop;
      const iconScale = Math.max(0.05, Math.min(iconMaxWidth, iconMaxHeight) / 640);
      const iconX = width / 2 - (640 * iconScale) / 2;
      const brainTransform = `translate(${iconX},${iconTop}) scale(${iconScale})`;
      // Bryony: "keep the background rectangles for left side + right
      // side of the brain and make sure these icon groups and headings
      // are contained within them" — .brainBgGroup carries the SAME
      // transform as .brainIconGroup, so the rects/corner labels and the
      // brain drawing itself always register in exactly the same place;
      // the 2 group headings + 36-icon grid below live inside that same
      // group, in its local 0–640 space (split at 320 to match
      // brainBgRectLeft/Right), so they can never sit outside the rects.
      svg.select('.brainBgGroup').attr('transform', brainTransform);
      svg.select('.brainIconGroup').attr('transform', brainTransform);

      // Converts a LOCAL 0–640 anchor point (same space as the rects/
      // dots) to a real screen coordinate — same approach the dot legend
      // further down already uses, needed here now the headings (below)
      // take a fixed real-px size rather than one that scales with the icon.
      const toScreenX = (lx) => iconX + lx * iconScale;
      const toScreenY = (ly) => iconTop + ly * iconScale;

      // Bryony: "even smaller font (same as Rouw & Scholte) and normal
      // weight" — reuses subtitleFontSize itself (computed above) rather
      // than a separate formula, positioned via toScreenX/Y above rather
      // than scaling with the icon. font-weight is normal by default —
      // .participantLabel's own 600 override was removed below.
      const headingFontSize = subtitleFontSize;
      const headingWrapWidth = Math.max(60, 320 * iconScale - 24);
      const headingLeftEl = svg
        .select('.participantLabelLeft')
        .attr('font-size', headingFontSize)
        .attr('x', toScreenX(160))
        .attr('y', toScreenY(50));
      wrap(headingLeftEl, headingWrapWidth, headingFontSize);
      const headingRightEl = svg
        .select('.participantLabelRight')
        .attr('font-size', headingFontSize)
        .attr('x', toScreenX(480))
        .attr('y', toScreenY(50));
      wrap(headingRightEl, headingWrapWidth, headingFontSize);

      // 18 icons per side, 3 columns × 6 rows, filling the local 320×640
      // half below the heading (a fixed local offset — the heading no
      // longer lives in this local space, see above, so there's nothing
      // to measure it against). Fully responsive for free, since the ONE
      // outer iconScale above already adapts this whole box to the real
      // screen size.
      const localHalfWidth = 320;
      const gridCols = 3;
      const gridRows = 6;
      const gridTop = 110;
      const gridBottom = 620;
      const cellW = localHalfWidth / gridCols;
      const cellH = (gridBottom - gridTop) / gridRows;
      const participantScale = (Math.min(cellW, cellH) * 0.7) / 640;

      participantNodes.forEach((d) => {
        const xOffset = d.group === 'synesthete' ? 0 : localHalfWidth;
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
          // Bryony: "I'd also love the 'bubbles' to pulse slightly. not
          // too in your face" — the actual pulsing is a CSS animation
          // (.brainDot, below), staggered per-dot via this delay so they
          // don't all breathe in unison, which would read as one big
          // flashing shape rather than a subtle, organic effect.
          .style('animation-delay', (d, i) => `${(i % 4) * 0.45}s`);
      }

      // Bryony: "add some labels with lines connecting... to" each
      // region dot, then "no arrowheads" / "lines same colour as
      // circles and underneath" / "do we need 2 Attention + Planning
      // labels - maybe just one but with 2 lines" / "align to left side
      // of right brain... with a bit of padding" — text is positioned
      // per ANNOTATION (brainDotAnnotations: the 2 Superior frontal
      // dots share one label), off the brain's own local midline so it
      // stays a fixed readable size AND lines up with the icon at any
      // scale; leader lines stay 1-per-DOT so 2 lines can fan out from
      // one shared label to its 2 targets.
      if (brainDotLabelGroups && brainDotLeaderLines) {
        // Bryony: "these labels need to change font size with
        // responsiveness like the other ones" — same
        // Math.max(min, Math.min(max, width * factor)) shape as
        // titleFontSize/subtitleFontSize above, rather than a fixed
        // real-px size like the legend's own fine print. Row spacing
        // between the 2 lines scales with it, so they stay
        // proportionally spaced at any size.
        const dotLabelFontSize = Math.max(12, Math.min(15, width * 0.016));
        const labelLineGap = 6; // clears the text before the line starts
        const labelLineSpacing = dotLabelFontSize + 4; // main → sub baseline
        // Bryony: "by padding I meant about 6px between the edge of the
        // shape stroke and the start of the label text" — a REAL 6px,
        // so it's converted through iconScale rather than a fixed
        // local-unit guess (same reasoning as the leader lines' own
        // stroke-width compensation below). Half of .brainIconPath's
        // own stroke-width (3 local units) so the gap is measured from
        // the OUTER edge of the drawn stroke, not the bare path line.
        const brainStrokeHalfWidth = 1.5;
        const hemisphereEdgePaddingLocal = brainStrokeHalfWidth + 6 / iconScale;

        const dotLocalPoint = (d) => ({ x: (d.screenX / 100) * 640, y: (d.screenY / 100) * 640 });

        // Screen-space text position — localX comes off the actual
        // hemisphere edge (see brainDotAnnotations) rather than a fixed
        // coordinate, so it still reads as "just clear of the brain
        // outline" at any icon size; localY stays a plain local-space
        // coordinate, same local -> screen conversion the legend
        // already uses.
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

        // Bryony: "is the placement of the lines logical? If not fix
        // it" — it wasn't: the old version always started a line from
        // the label's fixed "away from text" side (going by textAnchor
        // alone), regardless of where that dot actually is. The
        // frontal label's own right-hand dot sits further right than
        // the label itself (label localX ~350, dot localX ~390), so
        // that line was cutting straight through the "Attention +
        // Planning" text to reach it. Fixed by measuring each label's
        // REAL rendered box (getBBox, after the text is set) and
        // connecting from whichever point on that box's edge is
        // actually nearest the dot, so a line only ever approaches from
        // outside the text, never through it.
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

        // Bryony: "the [frontal] end needs to move right to join the
        // other... line" / Visual Recognition's line should start at
        // "the central horizontal point of Temporal" — ONE shared
        // attachment point per annotation, horizontally centred on its
        // own label box, rather than each line finding its own nearest
        // edge independently (which is what pulled the frontal label's
        // 2 lines apart to opposite edges instead of forking from one
        // shared point). Vertically it still follows whichever edge
        // (top/bottom) is actually nearest this label's own target
        // dot(s), same "is the dot above or below" reasoning as before.
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

        // Leader lines live INSIDE the icon's own transformed group
        // (buildBrain() puts .brainDotLeadersGroup before .brainDot, so
        // the dots always paint on top of their own line). Converted
        // back to local coordinates since the line lives in that
        // transformed space; stroke-width is compensated by 1/iconScale
        // so it stays a constant ~1px regardless of the icon's own
        // current scale. Bryony: "the lines need to be kept within the
        // space also [and] in the icon shape space" — clamped to the
        // icon's own drawn 0-640 local square (same bounds
        // .brainBgRectLeft/Right cover) so a line's "label" end can
        // never be computed past the edge of that space.
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
          const localStartY = Math.max(0, Math.min(640, (lineStart.y - iconTop) / iconScale));
          line
            .attr('x1', localStartX)
            .attr('y1', localStartY)
            .attr('x2', dotLocal.x)
            .attr('y2', dotLocal.y)
            .attr('stroke', brainEffectColorScale(d.effect))
            .attr('stroke-width', 1 / iconScale);
        });
      }

      // --- Dot legend — "really visually simple", tucked into the
      // corners of the background rects themselves (bottom-left of the
      // left/"left side" rect, bottom-right of the right/"right side"
      // one). The BAR and CIRCLES stay in the icon's own local 640-unit
      // space (same as the path/rects/dots) so they scale visually WITH
      // the icon, just like the real dots do. Bryony: "the text is too
      // big on the legends" — the local-space font sizes I'd used there
      // scaled down WITH the icon (so their real on-screen size wasn't
      // fixed/predictable, unlike every other label in this file), which
      // is what made them read oddly big/small depending on screen size.
      // Text is now positioned by converting its local anchor point to a
      // real screen coordinate (toScreenX/Y below) and given a small,
      // fixed, resize-independent size from the type scale
      // (--text-micro, 12px — see theme.js) — same treatment as every
      // other fixed-size label in this file, e.g. .pubFootnote.
      const legendPad = 20; // matches .brainBgLabel's own corner padding

      // Effect: a horizontal bar spanning the real data's own range
      // (3.7-4.8, not the full 0-4.8 scale) — its 2 stop colours come
      // from brainEffectColorScale (a fixed, resize-independent scale),
      // set here rather than inline in the template: template
      // expressions only see top-level script state, not consts
      // declared inside this $effect closure (that mismatch is exactly
      // what broke the build last time — brainEffectColorScale isn't
      // reachable from markup).
      //
      // Bryony: "please move effect down so there is a small padding
      // between the bottom of the left side rect + the last line of the
      // legend" — it's 2 lines at a known 12px, so straight arithmetic
      // from the rect's own bottom edge, no measuring required. Both
      // legend items share the same row height for a single line of
      // this text (a little more than the 12px font itself, for
      // breathing room) so their title/value rows stack consistently.
      const microRowHeight = 16;
      // Bryony: "make the effect rectangle a shorter width - 2/3 of what
      // it is" (was 160).
      const effectBarWidth = Math.round(160 * (2 / 3));
      const effectBarHeight = 16;
      const effectBarScreenX = toScreenX(legendPad);
      const effectBarScreenRight = toScreenX(legendPad + effectBarWidth);
      const effectCaptionLines = 2;
      const effectCaptionFontSize = 12;
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
      // Bryony: "the wrap width can be a bit wider on the labels" — the
      // fixed cap was the bottleneck at normal icon sizes (280*iconScale
      // alone would've allowed more); raised it so the local-space
      // conversion is what governs width instead.
      wrap(effectCaptionEl, Math.min(220, 280 * iconScale), effectCaptionFontSize);

      const effectBarScreenBottom = effectCaptionTop - 8;
      const effectBarScreenTop = effectBarScreenBottom - effectBarHeight * iconScale;
      // Back to local space — the bar itself still lives inside the
      // scaled icon group.
      const effectBarY = (effectBarScreenTop - iconTop) / iconScale;
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
      // Bryony: "add effect + volume legend label titles" — one row up
      // from the values, left-aligned with the bar.
      // Bryony: "move the legend titles (including the new italics bit)
      // up by 8px" — Effect/Volume titles + their new annotations all
      // share this one offset.
      const legendTitleShift = 8;
      const legendTitleY = effectValueScreenY - microRowHeight - legendTitleShift;
      const effectTitleEl = svg
        .select('.brainEffectTitle')
        .text('Effect')
        .attr('x', effectBarScreenX)
        .attr('y', legendTitleY);

      // Bryony: "in the legend after effect can you add 'greater' in
      // grey italic small, normal font" — sits right after the title
      // text itself, same row, same baseline.
      const effectTitleBox = effectTitleEl.node().getBBox();
      svg
        .select('.brainEffectAnnotation')
        .text('greater')
        .attr('x', effectTitleBox.x + effectTitleBox.width + 4)
        .attr('y', legendTitleY);

      // Volume: 2 reference circles from the real data's own range (44
      // and 100 — see brainRegions.js), TO SCALE via the same
      // brainVolumeRadiusScale the dots themselves use, sharing a
      // baseline so the smaller sits fully inside the larger. Bryony:
      // "move the title + circles right so they are right aligned with
      // the right side rectangle (with padding the same as Effect on the
      // left)" — mirrors Effect's own legendPad, but measured in from the
      // RIGHT edge (x=640) instead of the left (x=0), using the large
      // circle's own right edge as the block's rightmost point (its
      // title text is narrower than 2x that radius, so the circle is
      // what actually needs the clearance).
      const volumeLargeR = brainVolumeRadiusScale(100);
      const volumeSmallR = brainVolumeRadiusScale(44);
      const volumeCenterX = 640 - legendPad - volumeLargeR;
      // Circles keep their own existing vertical position (one row below
      // Effect's value row, same as before) — only the title moves per
      // the next comment below.
      const volumeCircleTopScreenY = effectValueScreenY;
      const volumeCircleBottomScreenY = volumeCircleTopScreenY + volumeLargeR * 2 * iconScale;
      const volumeBaselineY = (volumeCircleBottomScreenY - iconTop) / iconScale; // back to local space

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
      // Bryony: "Volume label needs to move down so horizontally aligned
      // with Effect label" — same row as Effect's own title directly
      // (effectValueScreenY - microRowHeight), same idea as the caption
      // alignment below; supersedes the earlier "up by 2 lines" tweak,
      // which turned out to overshoot.
      const volumeTitleY = legendTitleY;
      svg
        .select('.brainVolumeTitle')
        .text('Volume')
        .attr('x', volumeScreenCenterX)
        .attr('y', volumeTitleY);

      // Bryony: "below volume can you add 'more widespread' same font
      // specs", then "move more widespread up a tiny bit" — one row
      // beneath the Volume title, with that row's own gap trimmed down
      // slightly from a full microRowHeight.
      svg
        .select('.brainVolumeAnnotation')
        .text('more widespread')
        .attr('x', volumeScreenCenterX)
        .attr('y', volumeTitleY + microRowHeight - 4);

      // x=350 local (was 380) — shifted left with the rest of the block;
      // the brain path's right lobe tapers to about x=345-370 through
      // this band, so this still keeps clear of it.
      // Bryony: "text on volume needs to be horizontally aligned with
      // Effect text. Effect text is perfect" — same row as Effect's own
      // caption directly, rather than derived from the circles (which
      // don't share Effect's own bottom-up chain any more).
      const volumeCaptionFontSize = 12;
      const volumeCaptionTop = effectCaptionTop;
      const volumeCaptionEl = svg
        .select('.brainVolumeCaption')
        .text('Size of the significant brain region (mm³)')
        .attr('x', toScreenX(350))
        .attr('y', volumeCaptionTop);
      // Bryony: "wrap width for Volume text needs to be a bit bigger" —
      // raised again now the block sits right-aligned near the icon's own
      // right edge, well clear of the brain path's right lobe that the
      // narrower width was originally guarding against. Then: "a little
      // bit more" — raised once more.
      wrap(volumeCaptionEl, Math.min(220, 250 * iconScale), volumeCaptionFontSize);
    }

    // Step 10, just getting the beat on the page for now: a title
    // ("When do synesthese connections form?") over Bryony's reference
    // photo — mirrors layoutBrain()'s own title layout above, then fits
    // the image, aspect-ratio-locked (1022x848, its real pixel size),
    // into the remaining space below it.
    function layoutConnections() {
      const titleFontSize = Math.max(18, Math.min(28, width * 0.036));
      const titleWrapWidth = Math.min(width - 48, titleFontSize * 30);
      const titleEl = svg
        .select('.connectionsTitle')
        .text('When do synesthese connections form?')
        .attr('font-size', titleFontSize)
        .attr('x', width / 2)
        .attr('y', topPadding + titleFontSize / 2);
      wrap(titleEl, titleWrapWidth, titleFontSize);
      const titleBox = titleEl.node().getBBox();

      // Bryony: "how about making your own version of the fisher price
      // magnet box with our header font?" — a drawn tray (rounded rect +
      // 3 compartment-divider lines, echoing the real one's own layout)
      // holding 26 coloured capital letters in the header font, instead
      // of the real reference photo. Fit the same way the photo used to
      // be: aspect-locked to it, within the space below the title.
      const trayTop = titleBox.y + titleBox.height + spacing['4xl'];
      const trayBottom = height - edgeMargin - spacing['2xl'];
      const trayMaxWidth = width - (edgeMargin + spacing['4xl']) * 2;
      const trayMaxHeight = trayBottom - trayTop;
      // Bryony: "current aspect ratio of the container is about 2.4 -
      // lets try shifting to 1.8 keeping the letter font size the same"
      // — a less extreme, more photo-like shape than 2.5. letterFontSize
      // below is sized off trayMaxWidth (the width ceiling), not this
      // tray's own final width, specifically so changing this constant
      // reshapes the tray without also shrinking or growing the letters.
      const trayAspect = 1.8;
      let trayWidth = trayMaxWidth;
      let trayHeight = trayWidth / trayAspect;
      if (trayHeight > trayMaxHeight) {
        trayHeight = trayMaxHeight;
        trayWidth = trayHeight * trayAspect;
      }
      const trayX = width / 2 - trayWidth / 2;
      const trayY = trayTop;
      // Bryony: "too much space top + bottom of the letter tray" — a
      // single trayWidth-based pad applied to both axes reads as a much
      // bigger fraction of the tray's own (shorter) height than of its
      // width, given the tray's wide aspect; split so the vertical pad
      // can be tightened on its own.
      const trayPadX = trayWidth * 0.035;
      // Bryony: "less space at the top" — top and bottom no longer share
      // one value; top is cut well back, bottom stays as it was. Rows
      // still divide innerHeight equally below (rowCount-way split), so
      // this only moves the whole grid up within the tray — it can't make
      // the rows themselves uneven.
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
      // Bryony: "letters should fill as much of the space as possible -
      // depending on dimensions you could have more space top and
      // bottom" — a uniform SQUARE cell, sized by whichever dimension is
      // tighter (7 columns almost always binds before 4 rows do, given
      // the tray's own wide aspect), rather than a stretched rowHeight x
      // colWidth cell that left the letters small with room to spare on
      // all 4 sides. Any leftover space from the OTHER dimension becomes
      // one shared margin (top+bottom, or left+right) around the grid,
      // instead of being smeared thinly into every row/column gap.
      // Bryony: "try and mimic the photo. dimensions/aspect ratio always
      // the same, letters need to be 95% height of each row and wider -
      // too much space in between" — the real tray's own rows/columns run
      // edge to edge with no spare margin (trayAspect above already locks
      // the TRAY's own outer proportions; this is what filled its inside
      // properly). Rectangular cells now, not forced-square ones — a
      // 7-column x 4-row grid over this tray's own aspect is naturally
      // taller than wide per cell, same as the real photo's own
      // compartments, and sizing the font off the ROW height (not the
      // smaller of row/column) is what actually gets letters filling
      // that height AND reading noticeably wider than before, since it's
      // no longer shrunk to fit whichever dimension was tightest.
      const rowCount = magnetRowLengths.length;
      const cellHeight = innerHeight / rowCount;

      // 3 lines between the 4 rows — the tray's own compartment dividers,
      // spanning the full inner width edge to edge, like the real tray's.
      for (let d = 1; d < rowCount; d++) {
        const dividerY = innerY + cellHeight * d;
        svg
          .select(`.magnetTrayDivider${d}`)
          .attr('x1', innerX)
          .attr('x2', innerX + innerWidth)
          .attr('y1', dividerY)
          .attr('y2', dividerY);
      }
      // Bryony: "add a vertical line left and right to mimic the tray
      // edges" (the real photo's tray shows its compartment walls running
      // all the way round, not just between rows) — same line, same
      // style as the horizontal dividers above, just the other way round.
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
        // Bryony: "we need to make sure the letters don't overlap. Once
        // you've found the right aspect ratio and font size we'll be
        // winning" — sizing off row HEIGHT alone (the old `cellHeight *
        // 1.35` guess) was the actual bug: it never checked whether the
        // resulting letters were too WIDE for their own row. Measured the
        // real, loaded Fredoka (headless-browser pixel scan of its actual
        // glyphs, weight 600 — the weight .magnetLetter's CSS now uses;
        // it was requesting 700, a weight this font never loads) rather
        // than guess a multiplier:
        //   - 'M' is the widest letter across the two 7-letter rows, at
        //     ~99.5% of the font-size as its advance width — almost a
        //     full cell's worth of width on its own.
        //   - 'J' and 'Q' are the only letters with a real descender
        //     (tail below the baseline) — about 20% and 15% of the
        //     font-size — so centring them exactly like every other
        //     letter pushes that tail into the row below.
        // Sizing the font against the WIDTH a 7-letter row can actually
        // hold (leaving 'M' a small gap either side) is what stops the
        // horizontal overlap; trayAspect above was widened so that same,
        // width-safe size also fills most of the row's height. Descenders
        // are handled per-letter below, by measuring each glyph's own
        // rendered bbox rather than a guessed nudge.
        const FREDOKA600_MAX_ADVANCE_RATIO = 0.9951; // 'M' — advance width ÷ font-size, the widest letter in a 7-letter row
        const letterWidthClearance = 0.97; // leaves 'M' ~3% of its cell as a gap to its neighbours — Bryony: "font size a bit bigger", tightened from 0.94
        // Bryony: "the aspect ratio v font size doesn't quite translate to
        // mobile? It should be consistent whatever the screen size" —
        // sizing had briefly been pinned to trayMaxWidth (the width
        // ceiling) rather than this tray's own actual innerWidth, so it
        // was reading the wrong number on any screen where the tray is
        // HEIGHT-bound rather than width-bound (trayHeight > trayMaxHeight
        // above, which a narrow/tall phone viewport hits far more often
        // than a wide desktop one) — the letters kept the desktop-shaped
        // tray's size even though the actual tray had shrunk to fit the
        // shorter available height. Using innerWidth directly means the
        // exact same formula always sizes off the tray that's actually on
        // screen, on any device.
        const narrowestRowCellWidth = innerWidth / 7; // the two 7-letter rows are the tight fit; 6-letter rows have room to spare
        const letterFontSize = (narrowestRowCellWidth * letterWidthClearance) / FREDOKA600_MAX_ADVANCE_RATIO;
        const positions = [];
        magnetRowLengths.forEach((rowLength, r) => {
          // Bryony: "last two rows, letters evenly spaced (they have 6
          // not 7)" — each row spreads its OWN letters evenly across the
          // full inner width (innerWidth / that row's own count), rather
          // than sitting in the 7-column grid's own fixed pitch and
          // leaving a gap at the end — rows still all share the same
          // (equal) row height above, only the horizontal spacing here is
          // per-row.
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
          // Bryony: "make sure letters are horizontally aligned in their
          // rows AND there is equal space above and below (in their
          // rows)" — dominant-baseline: central (see .magnetLetter's own
          // CSS) centres on the FONT's own metrics box, not each glyph's
          // actual rendered ink, so it was only ever an approximation —
          // worse for 'J'/'Q' with their descending tails, but present
          // for every letter. Measuring each letter's own real getBBox()
          // once it's actually on the page and re-centring it on its
          // row's target line removes that drift outright, for every
          // letter, instead of guessing at a handful of one-off nudges;
          // since every letter in a row shares the same target line, this
          // also puts them all level with each other.
          .each(function (d, i) {
            const target = positions[i].y;
            const bbox = this.getBBox();
            const visualCenter = bbox.y + bbox.height / 2;
            this.setAttribute('y', target + (target - visualCenter));
          });

        // Step11 (see layoutHeatmap()) needs each letter's own settled
        // tray position as a scale/translate origin — captured straight
        // off the real rendered attrs, right after the baseline
        // correction above, rather than recomputed a second time.
        magnetLetterGroups.each(function (d) {
          d.trayX = parseFloat(this.getAttribute('x'));
          d.trayY = parseFloat(this.getAttribute('y'));
        });
        magnetTrayLetterFontSize = letterFontSize;
      }
    }

    // Step11's own blended transform for a magnet letter — identical in
    // spirit to applyWordHighlight() below (scale/translate around the
    // element's own resting point, only the destination changes): blends
    // from the tray position (d.trayX/d.trayY, set above) through the
    // ring position (d.ringX/d.ringY) and on to the bar-row position
    // (d.barX/d.barY), driven by d.ringAmt then d.barAmt (set every tick
    // by setHeatmapProgress()) — those two beats never overlap in time,
    // so blending them in sequence like this is safe.
    function magnetLetterTransform(d) {
      const t1 = d.ringAmt || 0;
      const t2 = d.barAmt || 0;
      const targetX = lerp(lerp(d.trayX, d.ringX, t1), d.barX, t2);
      const targetY = lerp(lerp(d.trayY, d.ringY, t1), d.barY, t2);
      const s = lerp(1, d.ringScale, Math.max(t1, t2));
      const dx = targetX - d.trayX;
      const dy = targetY - d.trayY;
      return `translate(${dx},${dy}) translate(${d.trayX},${d.trayY}) scale(${s}) translate(${-d.trayX},${-d.trayY})`;
    }

    // 'rawColor|sortedColor' -> a cached d3.interpolateRgb(...) — see
    // heatmapColorInterpCache's own comment above.
    function heatmapCellColor(rawColor, sortedColor, amt) {
      const key = rawColor + '|' + sortedColor;
      let interp = heatmapColorInterpCache[key];
      if (!interp) {
        interp = d3.interpolateRgb(rawColor, sortedColor);
        heatmapColorInterpCache[key] = interp;
      }
      return interp(amt);
    }

    // Every cell's colorOrder-FALSE rank (its plain respondent index) and
    // colorOrder-TRUE rank (matches first, in their own original order,
    // then non-matches, in theirs) plus its raw/sorted colours — none of
    // this depends on layout (screen size), only on the respondent data
    // itself, so it's seeded once (the first time layoutHeatmap() runs)
    // rather than recomputed on every resize.
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
          d.falseRank = d.i;
          d.rawColor = codeColor[d.code] || colors.grey;
          d.sortedColor = d.isMatch ? magnetTemplateColorByLetter[letter] : colors.grey;
        });
      });
    }

    // Step11's ring + bar geometry — computed once per resize and stored
    // on each letter/cell datum (d.ringX/d.ringY/d.ringScale on the
    // letters; d.a0/d.a1/d.ringPitch/etc on the cells; d.geom on the
    // colorBar morph pieces), the same "layout computes targets, set
    // blends between them" split layoutSight()/setSightProgress() and
    // iconTransform() already use — setHeatmapProgress() only ever reads
    // these, never recomputes them.
    // Bryony's original Observable cell used real angular wedges (hand-
    // rolled canvas arcs — she guessed d3.arc()/d3.pie(), which is the
    // right SVG-native equivalent) rather than the rotated-rect spokes
    // this used to be. This rewrite ports that: every cell is a true
    // annular sector (d3.arc()), letters sit in a genuine 26-slice pie
    // with no gaps, and the colorBar beat uses their actual polygon-morph
    // technique (see heatmapBuildPolygon()) instead of a plain rect
    // interpolation.
    const HEATMAP_SLICE_WIDTH = (2 * Math.PI) / 26; // d3.arc's own angle convention: 0 = 12 o'clock, increasing clockwise
    function heatmapLetterStartAngle(letter) {
      return (letter.charCodeAt(0) - 65) * HEATMAP_SLICE_WIDTH; // 'A'.charCodeAt(0) — A's slice starts at the top
    }

    function layoutHeatmap() {
      if (!heatmapCellGroups || !magnetLetterGroups) return;

      // Reuses the exact band layoutConnections() just laid the tray
      // into (below the title, above the bottom margin) — read straight
      // off the tray rect it positioned, rather than recomputing the
      // title height a second time.
      const trayEl = svg.select('.magnetTray');
      const areaX = parseFloat(trayEl.attr('x'));
      const areaY = parseFloat(trayEl.attr('y'));
      const areaWidth = parseFloat(trayEl.attr('width'));
      const areaHeight = parseFloat(trayEl.attr('height'));

      // --- Ring layout (colorOrder false/true beats) ---
      const ringCx = areaX + areaWidth / 2;
      const ringCy = areaY + areaHeight / 2;
      const ringOuterRadius = Math.min(areaWidth, areaHeight) / 2;
      const ringInnerRadius = ringOuterRadius * 0.32;
      const cellBandOuterRadius = ringOuterRadius * 0.86; // leaves room for the letter labels just outside it
      const ringLetterRadius = ringOuterRadius * 0.97;
      heatmapCellBandOuterRadius = cellBandOuterRadius;
      const ringLetterFontSize = Math.max(10, Math.min(16, magnetTrayLetterFontSize * 0.55));
      const ringScale = ringLetterFontSize / magnetTrayLetterFontSize;

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

      // --- Bar layout (colorBar beat) — rows in barLetterOrder ---
      const barLabelInset = Math.max(10, ringLetterFontSize * 0.9); // Bryony's original: "bx = barLeft - 16" — a small fixed gap, scaled here to this ring's own letter size
      const barTop = areaY;
      const barRowPitch = areaHeight / barLetterOrder.length;
      const barRowHeight = barRowPitch * 0.62;
      const barChartLeft = ringCx - cellBandOuterRadius * 0.35 + barLabelInset + 24; // roughly under the ring, matching the original's own left-aligned bar chart
      const barMaxWidth = areaX + areaWidth - barChartLeft;
      const nonMatchRegionWidth = barMaxWidth * 0.15; // Bryony's original: "size * 0.15"

      const barRowIndexByLetter = {};
      barLetterOrder.forEach((letter, idx) => {
        barRowIndexByLetter[letter] = idx;
      });

      // Per-letter geometry that the colorBar morph needs — all of it is
      // fixed once resize/data are known (only the blend amount changes
      // per tick), so it's computed once here rather than every frame.
      const letterGeom = {};
      Object.keys(magnetResponses).forEach((letter) => {
        const a0 = heatmapLetterStartAngle(letter);
        const a1 = a0 + HEATMAP_SLICE_WIDTH;
        const row = barRowIndexByLetter[letter];
        const matchCount = magnetResponses[letter].matchCount;
        const rMatchBoundary = ringInnerRadius + (matchCount / nUsers) * (cellBandOuterRadius - ringInnerRadius);
        const rowTop = barTop + row * barRowPitch + barRowPitch * 0.19;
        const rowBottom = rowTop + barRowHeight;
        const matchedX1 = barChartLeft + (matchCount / maxMatchCount) * barMaxWidth * 0.85;
        // heatmapBuildPolygon works in LOCAL coordinates (relative to
        // .heatmapRingGroup's own translate(ringCx,ringCy) — see above),
        // same space the wedge points themselves are already in, so the
        // bar-side target points need that same offset subtracted out
        // here, once, rather than at every tick.
        letterGeom[letter] = {
          a0,
          a1,
          ringInnerRadius,
          rMatchBoundary,
          rowTop: rowTop - ringCy,
          rowBottom: rowBottom - ringCy,
          barLeftLocal: barChartLeft - ringCx,
          matchedX1: matchedX1 - ringCx,
          nonMatchEnd: matchedX1 + nonMatchRegionWidth - ringCx,
          templateColor: magnetTemplateColorByLetter[letter],
          matchCount
        };
      });

      magnetLetterGroups.each(function (d) {
        const row = barRowIndexByLetter[d.letter];
        d.barX = barChartLeft - barLabelInset;
        d.barY = barTop + row * barRowPitch + barRowPitch / 2;
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

      heatmapMorphGroups.each(function (d) {
        d.geom = letterGeom[d.letter];
      });

      if (!heatmapRanksSeeded) {
        seedHeatmapRanks();
        heatmapRanksSeeded = true;
      }

      // Re-applies whatever progress the scene was already at — a resize
      // mid-scroll must not snap the ring/bar back to their t=0 state.
      setHeatmapProgress(currentHeatmapProgress);
    }

    // Ports Bryony's original buildPolygon() exactly: samples k+1 points
    // along each of a wedge's two curved (radial) edges and slides every
    // sampled point straight toward its matching point on the bar
    // rectangle's corresponding edge, so the curve visibly unrolls into a
    // straight line as `t` goes 0 -> 1, rather than just scaling in
    // place. Coordinates are LOCAL to .heatmapRingGroup's own translate
    // (see layoutHeatmap), so the bar-target x/y — which are in absolute
    // page space — get the ring centre subtracted back out by the caller.
    function heatmapBuildPolygon(a0, a1, r0, r1, bx0, bx1, yb0, yb1, t) {
      const k = 6;
      const pts = [];
      for (let i = 0; i <= k; i++) {
        const f = i / k;
        const ang = a0 + f * (a1 - a0);
        const px = Math.sin(ang) * r0;
        const py = -Math.cos(ang) * r0;
        const qx = bx0;
        const qy = yb0 + f * (yb1 - yb0);
        pts.push([px + (qx - px) * t, py + (qy - py) * t]);
      }
      for (let i = 0; i <= k; i++) {
        const f = i / k;
        const ang = a1 - f * (a1 - a0);
        const px = Math.sin(ang) * r1;
        const py = -Math.cos(ang) * r1;
        const qx = bx1;
        const qy = yb1 - f * (yb1 - yb0);
        pts.push([px + (qx - px) * t, py + (qy - py) * t]);
      }
      return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + ' Z';
    }

    // Grows/nudges/reddens one word (el) per its step2 config, scaling
    // around the word's own start point. Returns how far in each of the
    // three beats (position, colour, label) currently is, so the caller
    // can position the shared caption/label under whichever word is live.
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

      // Where the word's letters actually sit right now — its resting
      // start point, shifted by dx, plus half its (scaled) width.
      const centerX = baseX + dx + (textWidth * s) / 2;

      return { centerX, labelAmt };
    }

    // Step 2: SYN then AESTHESIA take their turn (see step2 in steps.js).
    // The shared caption/label elements just follow whichever word is
    // currently non-zero — the two words' ranges never overlap.
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

    // Step 3: SYNAESTHESIA rises + shrinks into the header's old slot
    // (layoutTitle's numbers), "What is" fades in beside it, the lead
    // line fades out then is reused for "It's when one of your 5
    // senses", the icons stagger in below it, and finally the closing
    // lines fade in below the icons — all timed from step3 in steps.js.
    function setTitleProgress(t) {
      if (!answer) return;
      const titleT = phase(t, step3.title.start, step3.title.end);
      const whatIsT = phase(t, step3.whatIs.fadeIn.start, step3.whatIs.fadeIn.end);
      const leadOutT = phase(t, step3.lead.fadeOut.start, step3.lead.fadeOut.end);
      const sensesT = phase(t, step3.senses.fadeIn.start, step3.senses.fadeIn.end);
      // "They've all been..." is long gone (leadOutT already at 1) by the
      // time senses.fadeIn even starts, so swapping the text right here
      // never happens mid-fade.
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

      // step3: leadText swap — stays put, doesn'''t move position
      if (t > 0) {
        const leadEl = svg.select('.leadText');
        if (showSenses !== leadTextShowingSenses) {
          leadTextShowingSenses = showSenses;
          if (showSenses) renderSensesLeadText(etymLeadY);
          else leadEl.text(answer.lead);
        }
        leadEl.attr('y', etymLeadY);
        leadEl.style('opacity', showSenses ? sensesT : 1 - leadOutT);
      }

      // senseGroups doesn't exist until the first resize has built it —
      // same brief gap personGroups has, guarded the same way.
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

    // Step 4: the 5 quotes, one word at a time (see quotesLayout above).
    // Every word of every quote is re-evaluated each tick — only the
    // quote whose slice contains `t` ever comes out non-zero, so there's
    // no need to track "which quote is current" separately. Sense words
    // also drive a symmetric flash pulse on their matching icon.
    function setQuotesProgress(t) {
      if (!answer) return;

      // Which quote is currently on screen (or most recently was) —
      // quotesLayout's slices never overlap, so the last one whose
      // sliceStart we've reached is the right one. Every quote-scoped
      // effect below (bubble tail, dimmed/lit sense icons, dimmed/lit
      // person icons) reads this SAME value, so they all switch and
      // reset together the moment a new quote's slice begins.
      let activeQuote = 0;
      for (let qi = 0; qi < quotesLayout.length; qi++) {
        if (t >= quotesLayout[qi].sliceStart) activeQuote = qi;
      }

      // The "clear" phase: the title, senses line and both closing lines
      // fade out together, while the icons rise — see step4.clear in
      // steps.js. Reversible like everything else here, so scrolling
      // back up restores them. Guarded the same way as leadText above:
      // at t=0 (not reached yet), fadeOpacity would evaluate to 1 and
      // force all of these visible before step3 has even shown them —
      // only apply it once this stage has actually started.
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
        // Once the row has fully risen into place (clearT reaches 1),
        // each icon rests dimmed at 0.4 and only lights back to full
        // opacity once the ACTIVE quote's own word for its sense has
        // appeared. Recomputed fresh from activeQuote's words every
        // tick — never the other 4 quotes' — so it's automatically
        // dimmed again the instant a new quote's slice starts.
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

      // People illustration + bubble: fade in once, together, right
      // after the clear phase, then stay for the rest of the step.
      const peopleT = phase(t, step4.people.fadeIn.start, step4.people.fadeIn.end);
      svg.select('.peopleIconsGroup').style('opacity', peopleT);
      svg.select('.quoteBubble').style('opacity', peopleT);

      // Dim every person icon except whoever's quote is active right
      // now — composites with the group's own peopleT fade-in above,
      // so it has no visible effect until that's already faded in.
      if (personIconGroups) {
        personIconGroups.style('opacity', (d, i) => (i === activeQuote ? 1 : 0.4));
      }

      // The bubble's tail moves to whichever person's quote-slice we're
      // currently in (or most recently were in) — aimed at that person
      // icon's real x (see personTForX) rather than an even 0→1 slide,
      // so it actually points at them. Only the shape moves; there's
      // no text in it yet.
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

    // Step 5: after the last quote, everything from step 4 except the
    // sense icons + labels and the people tiles fades out, the sense
    // icons move from their row onto the ring layoutSight() computed,
    // and once landed, the circle + its 3 sub-icons + the caption fade
    // in — see step5 in steps.js.
    function setSightProgress(t) {
      if (!answer) return;

      // Reversible the same way clearT is in setQuotesProgress: arriveT
      // and revealT are pure functions of t, so scrolling back up always
      // unwinds everything below — nothing here is ever a one-way switch.
      const arriveT = phase(t, step5.arrive.fadeOut.start, step5.arrive.fadeOut.end);
      const revealT = phase(t, step5.reveal.fadeIn.start, step5.reveal.fadeIn.end);
      // Bryony: "the famous synetheses should only start to fade in AFTER
      // letter+numbers is fully visible" — starts exactly where revealT
      // finishes (see step5.famousHeader's own comment in steps.js).
      const famousT = phase(t, step5.famousHeader.fadeIn.start, step5.famousHeader.fadeIn.end);
      // Bryony: once the header is 100% visible, start moving the photos
      // into their link positions (was setLinksProgress, step6) — same
      // lerp, now driven by this step's own tail end.
      const moveT = phase(t, step5.famousHeader.fadeIn.end, 1);
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
      // Bryony: temp labels fade out earlier now too, same trigger as
      // the people squares starting to move (was setLinksProgress).
      if (sightSubIconGroups) {
        sightSubIconGroups.select('.sightSubIconLabel').style('opacity', 1 - moveT);
      }

      if (senseGroups) {
        // d.sightAmt just blends iconTransform's own output toward
        // d.sightX/d.sightY — it never touches d.x/d.y (the row
        // position layoutSenses() sets), so there's nothing to restore
        // when arriveT eases back to 0.
        iconNodes.forEach((d) => {
          d.sightAmt = arriveT;
        });
        senseGroups.attr('transform', iconTransform).style('opacity', (d) => {
          const arrived = lerp(d.opacity, 1, arriveT);
          // Bryony: "set the other senses to 0.2 for this bit" — dims the
          // 4 non-sight icons while the sub-icons below stagger in; sight
          // itself is left alone. Faded back to full using `moveT` —
          // same header-100%-visible trigger as the photos moving.
          if (d.label === 'sight') return arrived;
          return lerp(lerp(arrived, 0.2, revealT), arrived, moveT);
        });
        // Icons only for this final step — labels fade out with the
        // same arriveT, so they're back the instant you scroll out.
        senseGroups.select('.senseIconLabel').style('opacity', 1 - arriveT);
        // White background circle behind every sense except sight
        // itself, this step only — same arriveT, so it's gone the
        // instant you scroll back out, same as the label swap above.
        senseGroups.select('.senseIconBg').style('opacity', (d) => (d.label === 'sight' ? 0 : arriveT));
      }

      if (t > 0) {
        const fadeOpacity = 1 - arriveT;
        svg.select('.peopleIconsGroup').style('opacity', fadeOpacity);
        svg.select('.quoteBubble').style('opacity', fadeOpacity);
        svg.select('.quotesGroup').style('opacity', fadeOpacity);
      }

      svg.select('.sightCircle').style('opacity', revealT);

      // Bryony: "stagger them in shapes + objects, then color, then
      // letters + numbers" — the group container just needs to be
      // visible once any child might be; each icon's OWN phase (an equal
      // slice of the same overall reveal window, in that order) is what
      // actually gates it, so .sightSubIconsGroup itself no longer
      // carries the fade.
      svg.select('.sightSubIconsGroup').style('opacity', 1);
      if (sightSubIconGroups) {
        const staggerOrder = ['objects', 'colors', 'lettersNumbers'];
        const span = (step5.reveal.fadeIn.end - step5.reveal.fadeIn.start) / staggerOrder.length;
        sightSubIconGroups.style('opacity', (d) => {
          const start = step5.reveal.fadeIn.start + staggerOrder.indexOf(d.key) * span;
          return phase(t, start, start + span);
        });
      }

      // Bryony: "After the letter+number category is fully visible,
      // change the title to [the famous-synetheses text]. At the same
      // time, give them opacity 1 down below, don't move yet." —
      // `lettersNumbers` is deliberately last in staggerOrder above, so
      // this revealT reaching 1 is exactly that moment. Photos fade in
      // here (position untouched — that still only happens in
      // setLinksProgress, step6).
      svg.select('.linkPhotosGroup').style('opacity', revealT);
      sightRevealT = revealT;

      // setLinksProgress() owns the 'closing' stage (and reverting out of
      // it) — this tick's own display stage only ever resolves to
      // 'split'/'famous' here, computed BEFORE using it for opacity below
      // so the famousT fade-in takes over on the very same tick revealT
      // reaches 1, not one tick later. Bryony: "the famous synetheses
      // should only start to fade in AFTER letter+numbers is fully
      // visible" — famousT (see its own comment above) is 0 until just
      // past that point, so the text is invisible for the instant right
      // at the swap and fades up from there, rather than popping in.
      const displayStage = sightHeaderStage === 'closing' ? 'closing' : revealT >= 1 ? 'famous' : 'split';
      svg.select('.sightLabel').style('opacity', displayStage === 'famous' ? famousT : revealT);
      if (displayStage !== 'closing' && displayStage !== sightHeaderStage) {
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

    // Step 6: the relationship arrows fade in — the photo fans already
    // flew in during step5 (setSightProgress), once the header hit 100%.
    function setLinksProgress(t) {
      if (!answer) return;
      linksT = t;
      const revealT = phase(t, step6.reveal.fadeIn.start, step6.reveal.fadeIn.end);
      svg.select('.linksGroup').style('opacity', revealT);
      // Photos fade in + fly in during setSightProgress (step5) now —
      // this function only handles the arrows/links themselves.


      // Bryony: "the header text should change to 'What are...' the
      // moment the synesthete photos start to move" — so this swap fires
      // the instant revealT lifts off 0 (the very start of this step),
      // not once the photos finish arriving. Only re-set/re-wrap
      // `.sightLabel` right at the swap (not every tick) — wrap()
      // rebuilds tspans and measures each word's rendered width, which
      // isn't free. sightHeaderStage is the persistent 3-state flag
      // layoutSight() and setSightProgress() also read/write (see their
      // own comments), so a resize at any point in the sequence keeps
      // whichever of the 3 texts is currently showing.
      const nextStage = revealT > 0 ? 'closing' : sightRevealT >= 1 ? 'famous' : 'split';
      if (nextStage !== sightHeaderStage) {
        sightHeaderStage = nextStage;
        const stageText = { split: sightSplitText, famous: sightFamousText, closing: closingHeaderText };
        const labelEl = svg
          .select('.sightLabel')
          .text(stageText[sightHeaderStage])
          .attr('font-size', sightLabelFontSize)
          .attr('x', width / 2)
          .attr('y', topPadding + sightLabelFontSize / 2);
        wrap(labelEl, sightLabelWrapWidth, sightLabelFontSize);
      }

      // Bryony: "can we work it so the images at the bottom left move,
      // change size (if necessary) and disappear from the bottom - at
      // the moment one is left behind" — same revealT drives the linked
      // people's own bottom tiles shrinking + fading out (see
      // positionNodes()); stored on linksRevealT since positionNodes()
      // also runs off the bounce simulation's own continuous ticks and
      // needs to read it there, then re-run once here so the change is
      // visible immediately rather than waiting for the next tick.
      linksRevealT = revealT;
      if (personGroups) positionNodes();
    }

    // Step 7: everything fades out, the new title fades in, then the
    // chart builds up in the three beats Bryony asked for — "I'd like
    // the x axis to appear first then the line and area animate in left
    // to right then the y axis." Each beat gets its own slice of `t`
    // (see step7 in steps.js); the line/area's own SHAPE never changes
    // here (layoutPublications() already drew the real, full path) —
    // only how much of it shows through `.pubDrawClipRect`, whose width
    // this animates from 0 up to pubChartWidth.
    function setPublicationsProgress(t) {
      const storyFadeT = phase(t, step7.storyFadeOut.start, step7.storyFadeOut.end);
      svg.select('.storyGroup').style('opacity', 1 - storyFadeT);
      // Bryony: tooltips were still firing on invisible person tiles /
      // link photos once the story fades out here — opacity alone
      // doesn't stop them being hovered, they need pointer-events off
      // too. Then: "tooltips are still triggering after step 8" — this
      // toggle alone never actually worked, because .personGroup/
      // .linkPhotoItem each set their OWN pointer-events: auto (needed
      // so they're hoverable at all — the root <svg> defaults every-
      // thing to pointer-events: none), and an element's own explicit
      // value always wins over whatever an ancestor like .storyGroup is
      // set to. Toggling those 2 classes directly is what actually
      // disables them.
      svg.select('.storyGroup').style('pointer-events', storyFadeT >= 1 ? 'none' : null);
      svg.selectAll('.personGroup, .linkPhotoItem').style('pointer-events', storyFadeT >= 1 ? 'none' : null);

      const titleT = phase(t, step7.title.fadeIn.start, step7.title.fadeIn.end);
      svg.select('.publicationsTitle').style('opacity', titleT);

      const xAxisT = phase(t, step7.xAxis.fadeIn.start, step7.xAxis.fadeIn.end);
      svg.select('.pubXAxisGroup').style('opacity', xAxisT);

      // Bryony: "the line/area reveal is taking too long" — ends with
      // buffer before this step itself ends (see step7.draw's comment).
      // Title/marker all live in setPublicationsMarkersProgress; the
      // y-axis (below) now finishes at the same instant as the line.
      const drawT = phase(t, step7.draw.start, step7.draw.end);
      pubDrawT = drawT;
      svg.select('.pubDrawClipRect').attr('width', pubChartWidth * drawT);

      // Bryony: "the y axis... should start appearing around step 8 75%
      // ... both that and the line reveal should end at the same time" —
      // moved here from setPublicationsMarkersProgress so it shares this
      // step's own timeline with the draw instead of step8's.
      const yAxisT = phase(t, step7.yAxis.fadeIn.start, step7.yAxis.fadeIn.end);
      svg.select('.pubYAxisGroup').style('opacity', yAxisT);
      svg.select('.pubFootnote').style('opacity', yAxisT);
    }

    // Step 8: once the chart's fully drawn, mark 2 specific publications
    // on it, one at a time. Bryony: "show label for 1st, then 2nd.." —
    // each fades in on its own turn and then just stays, same as every
    // other progressive reveal in this file (nothing here fades back out).
    function setPublicationsMarkersProgress(t) {
      // Bryony: the line AND the y-axis already finished by the end of
      // step7 (its OWN step, see setPublicationsProgress), so just the
      // marker goes right at the front of THIS step — header swaps to
      // the 1892 text the instant it starts (t leaves 0).
      const markerT = phase(t, step8.marker.fadeIn.start, step8.marker.fadeIn.end);
      svg.select('.pubMarker').style('opacity', markerT);
      pubMarkerT = markerT;

      // "Let's focus [on 2 recent publications]" replaces the 1892 text
      // — swaps at step8.titleSwap (Bryony: "wait till step 9 50%"), same
      // re-wrap-on-swap pattern as .sightLabel above: only touch it right
      // at each swap, not every tick.
      const nextStage = t <= 0 ? 'default' : t < step8.titleSwap ? 'marker' : 'markersIntro';
      if (nextStage !== pubTitleStage) {
        pubTitleStage = nextStage;
        const titleEl = svg
          .select('.publicationsTitle')
          .text(pubTitleTextFor(pubTitleStage))
          .attr('font-size', pubTitleFontSize)
          .attr('x', width / 2)
          .attr('y', topPadding + pubTitleFontSize / 2);
        wrap(titleEl, pubTitleWrapWidth, pubTitleFontSize);
      }

      const citation1T = phase(t, step8.citation1.fadeIn.start, step8.citation1.fadeIn.end);
      svg.select('.pubCitation1').style('opacity', citation1T);

      const citation2T = phase(t, step8.citation2.fadeIn.start, step8.citation2.fadeIn.end);
      svg.select('.pubCitation2').style('opacity', citation2T);
    }

    // Step 9: fades the entire publications chart out (title, axes,
    // line/area, both citation markers — everything already faded IN by
    // steps 7/8 lives under one .publicationsGroup, so one opacity here
    // takes it all out together), then brings in the new brain scene in
    // order — title, subtitle, icon, dots.
    function setBrainProgress(t) {
      const chartFadeT = phase(t, step9.chartFadeOut.start, step9.chartFadeOut.end);
      svg.select('.publicationsGroup').style('opacity', 1 - chartFadeT);

      const titleT = phase(t, step9.title.fadeIn.start, step9.title.fadeIn.end);
      svg.select('.brainTitle').style('opacity', titleT);
      // Bryony: "I want to keep the Rouw & Scholte text throughout" —
      // same fade-in ramp as the title above it, and (like the title)
      // never fades back out for the rest of this step.
      svg.select('.brainSubtitle').style('opacity', titleT);

      // Bryony: "We lead with Is synesthese brain activity different...
      // Then [36 participants]... Then [letters, numbers + symbols]...
      // Then [while undergoing fMRI scanning]" — the header carries all
      // 4 stages in order, same swap-once-per-threshold pattern as
      // pubTitleStage above.
      const nextTitleStage =
        t < step9.intro.stage1At
          ? 'question'
          : t < step9.intro.stage2At
            ? 'intro1'
            : t < step9.intro.stage3At
              ? 'intro2'
              : t < step9.intro.fadeOut.start
                ? 'scanning'
                : t < step9.dots.fadeIn.start
                  ? 'activation'
                  : 'areas';
      if (nextTitleStage !== brainTitleStage) {
        brainTitleStage = nextTitleStage;
        const titleEl = svg.select('.brainTitle').text(brainTitleTextFor(brainTitleStage));
        wrap(titleEl, brainTitleWrapWidth, brainTitleFontSize);
      }

      // Step 9 intro: the 2 group labels + 36 participant icons fade in
      // right after the question lands, then fade back out before the
      // brain scene proper takes over. Math.min rather than subtracting
      // fadeOut from fadeIn so the fade-in ramp isn't affected until
      // fadeOut actually starts.
      const introFadeInT = phase(t, step9.intro.fadeIn.start, step9.intro.fadeIn.end);
      const introFadeOutT = phase(t, step9.intro.fadeOut.start, step9.intro.fadeOut.end);
      const introT = Math.min(introFadeInT, 1 - introFadeOutT);
      svg.select('.participantLabelLeft').style('opacity', introT);
      svg.select('.participantLabelRight').style('opacity', introT);
      svg.select('.participantIconsGroup').style('opacity', introT);
      // Bryony: "keep the background rectangles... contained within
      // them" — the rects/corner labels fade in WITH the intro (same
      // ramp, introFadeInT) but never fade back out with it, since
      // they're also the brain icon's own backdrop a moment later.
      // introFadeInT stays at 1 once reached (phase() clamps), so this
      // alone gives "fades in, then stays" for free.
      svg.select('.brainBgGroup').style('opacity', introFadeInT);

      // Bryony: "add some cool animation which scanned the people icons
      // left to right" — a soft light sweeps across the full local
      // 0-640 width (both groups) while the header reads "while
      // undergoing fMRI scanning"; each icon brightens briefly as the
      // sweep passes its own x position. Faded in/out over its own first/
      // last 8% so the bar doesn't just pop in and out at the edges.
      const scanRawT = phase(t, step9.intro.scan.start, step9.intro.scan.end);
      const scanSpan = step9.intro.scan.end - step9.intro.scan.start;
      const scanFadeInT = phase(t, step9.intro.scan.start, step9.intro.scan.start + scanSpan * 0.08);
      const scanFadeOutT = phase(t, step9.intro.scan.end - scanSpan * 0.08, step9.intro.scan.end);
      const scanOpacity = Math.min(scanFadeInT, 1 - scanFadeOutT);
      const scanX = scanRawT * 640;
      svg
        .select('.brainScanBar')
        .attr('x', scanX - 45)
        .style('opacity', scanOpacity);
      if (participantIconGroups) {
        const scanHalfWidth = 70; // local units either side of the beam that "light up"
        participantIconGroups.style('filter', (d) => {
          if (scanOpacity <= 0) return null;
          const dist = Math.abs(d.x - scanX);
          const glow = Math.max(0, 1 - dist / scanHalfWidth) * scanOpacity;
          return glow > 0.03 ? `brightness(${(1 + glow * 0.9).toFixed(2)})` : null;
        });
      }

      const brainT = phase(t, step9.brain.fadeIn.start, step9.brain.fadeIn.end);
      svg.select('.brainIconGroup').style('opacity', brainT);
      // Bryony: "show left side + right side at this point too" — these
      // stayed hidden through the participant-icon intro (see CSS), now
      // fade in on the same beat as the brain drawing itself.
      svg.selectAll('.brainBgLabel').style('opacity', brainT);

      // The legend lives inside .brainDotsGroup itself (see the
      // template) fades in on the same beat as the dots it explains, no
      // separate opacity line needed — but the legend's TEXT half now
      // lives in its own screen-space group (.brainLegendTextGroup, see
      // the template), so that one still needs its own line here.
      const dotsT = phase(t, step9.dots.fadeIn.start, step9.dots.fadeIn.end);
      svg.select('.brainDotsGroup').style('opacity', dotsT);
      svg.select('.brainLegendTextGroup').style('opacity', dotsT);
      // Bryony: "add some labels with lines connecting and end arrows"
      // to the region dots — same reveal beat as the dots themselves.
      svg.select('.brainDotLabelsGroup').style('opacity', dotsT);
    }

    function setConnectionsProgress(t) {
      const chartFadeT = phase(t, step10.chartFadeOut.start, step10.chartFadeOut.end);
      svg.select('.brainGroup').style('opacity', 1 - chartFadeT);

      const titleT = phase(t, step10.title.fadeIn.start, step10.title.fadeIn.end);
      svg.select('.connectionsTitle').style('opacity', titleT);

      const trayT = phase(t, step10.tray.fadeIn.start, step10.tray.fadeIn.end);
      svg.select('.magnetTray').style('opacity', trayT);
      svg.select('.magnetTrayDividers').style('opacity', trayT);
      svg.select('.magnetLetterGroup').style('opacity', trayT);
    }

    // Step11: the tray fades out while its 26 letters shrink onto a ring,
    // then the per-respondent cells build up around that ring in 3 more
    // beats (see step11 in steps.js for exactly what each one does).
    // connectionsProgress freezes at 1 once scrolled into this step (see
    // App.svelte), so setConnectionsProgress above no longer re-runs —
    // safe for this function to keep driving .magnetTray/.magnetLetterGroup's
    // own opacity/position from here on without the two fighting.
    function setHeatmapProgress(t) {
      currentHeatmapProgress = t;
      if (!heatmapCellGroups || !magnetLetterGroups) return;

      const ringAmt = phase(t, step11.trayToRing.start, step11.trayToRing.end);
      // Only touch the tray/dividers once step11 has actually started
      // (t > 0). heatmapProgress sits at exactly 0 for the whole rest of
      // the story (see App.svelte's own derivation), including at page
      // load and every resize before the user has ever scrolled here —
      // and this function runs directly from layoutHeatmap() on every
      // one of those resizes, not just from its own scroll effect. At
      // t=0, ringAmt is ALSO 0, so "1 - ringAmt" was forcing the tray
      // back to fully opaque regardless of where the story actually was
      // — overriding both the CSS default (opacity: 0) and step10's own
      // fade-in (setConnectionsProgress). Bryony: "the magnet tray needs
      // to default to invisible." Leaving it alone at t=0 hands the tray
      // fully back to setConnectionsProgress, which already gets this
      // right on its own.
      if (t > 0) {
        svg.select('.magnetTray').style('opacity', 1 - ringAmt);
        svg.select('.magnetTrayDividers').style('opacity', 1 - ringAmt);
      }

      const barAmt = phase(t, step11.colorBar.start, step11.colorBar.end);
      magnetLetterGroups.each(function (d) {
        d.ringAmt = ringAmt;
        d.barAmt = barAmt;
      });
      magnetLetterGroups.attr('transform', magnetLetterTransform);

      const cellsT = phase(t, step11.cellsFadeIn.start, step11.cellsFadeIn.end);
      const colorOrderAmt = phase(t, step11.colorOrderTrue.start, step11.colorOrderTrue.end);

      // The colorBar beat swaps the 8476 individual wedges for 52
      // aggregate polygons (heatmapMorphGroups) — the same discrete swap
      // Bryony's original makes at u=1: drawCells(1) and drawMorph(0)
      // draw pixel-identical shapes, since sorting has already grouped
      // every match/non-match together by then, so the swap itself is
      // invisible rather than a crossfade.
      const morphActive = barAmt > 0;
      svg.select('.heatmapCellsGroup').style('opacity', morphActive ? 0 : cellsT);
      svg.select('.heatmapSeparatorsGroup').style('opacity', morphActive ? 0 : cellsT);
      svg.select('.heatmapMorphGroup').style('opacity', morphActive ? cellsT : 0);

      heatmapCellGroups.each(function (d) {
        const rank = lerp(d.falseRank, d.trueRank, colorOrderAmt);
        // Plain (unpadded) bin edges, per-respondent — matches the
        // original's own radiusAt()/radiusBoundaries — with a small
        // overlap added to the OUTER edge only, same as their own
        // "r1 = r0 + cellH + 0.4 // slight overlap hides seams".
        const r0 = d.ringInnerRadius + rank * d.ringPitch;
        const r1 = d.ringInnerRadius + (rank + 1) * d.ringPitch + d.cellOverlap;
        this.setAttribute('d', heatmapArc({ innerRadius: r0, outerRadius: r1, startAngle: d.a0, endAngle: d.a1 }));
        this.style.fill = heatmapCellColor(d.rawColor, d.sortedColor, colorOrderAmt);
      });

      if (morphActive) {
        heatmapMorphGroups.each(function (d) {
          const g = d.geom;
          if (d.kind === 'match') {
            this.setAttribute(
              'd',
              heatmapBuildPolygon(g.a0, g.a1, g.ringInnerRadius, g.rMatchBoundary, g.barLeftLocal, g.matchedX1, g.rowTop, g.rowBottom, barAmt)
            );
            this.style.fill = g.templateColor;
            this.style.opacity = 1;
          } else {
            this.setAttribute(
              'd',
              heatmapBuildPolygon(
                g.a0,
                g.a1,
                g.rMatchBoundary,
                heatmapCellBandOuterRadius,
                g.matchedX1,
                g.nonMatchEnd,
                g.rowTop,
                g.rowBottom,
                barAmt
              )
            );
            this.style.fill = colors.grey;
            this.style.opacity = 1 - barAmt;
          }
        });
      }
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

    // Deterministic, evenly-spaced starting positions (a ring around the
    // centre) so nobody spawns exactly on top of anybody else.
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

    // Belt-and-braces against a tile tunnelling past the walls on a sudden
    // radius change and appearing to vanish.
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
      // Bryony: "can we work it so the images at the bottom left move,
      // change size (if necessary) and disappear from the bottom - at
      // the moment one is left behind" — on top of the usual step1
      // corner-grid scale/position, a linked person's own tile also
      // shrinks to nothing as `tileShrinkT` (driven by setSightProgress,
      // in step with their link photo(s) flying in) goes 0 -> 1, so
      // nothing's left sitting there once they've "moved" on to the
      // links. Scoped to `linkedPersonNames` rather than everyone, even
      // though that's currently all 12, so an unlinked person (if the
      // data ever has one) stays put.
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
        edgeMargin
      });

      // layoutHeader sets topMargin, which seedPositions/clampToBounds
      // both need — must run before either of them.
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
        ({ xTicks: pubXTickGroups, yTicks: pubYTickGroups } = buildPublications());
        buildBrain();
        participantIconGroups = buildParticipantIcons();
        buildMagnetLetters();
        buildHeatmap();
      } else {
        clampToBounds();
      }

      // Needs to run on firstRun too, not just when the tile size changes
      // later — otherwise the very first tiles are built with no size.
      if (firstRun || tileChanged) applyTileSize();

      layoutAnswer();
      layoutTitle();
      layoutSenses();
      layoutClosing();
      layoutPeopleBubble();
      layoutQuotes();
      layoutSight();
      layoutLinks();
      layoutPublications();
      layoutBrain();
      layoutConnections();
      layoutHeatmap();

      // Bryony: "the 3 sub category sight circles are visible from the
      // start - should only appear at the right time." They were built
      // just above with no opacity set (SVG default: fully visible), and
      // the setSightProgress $effect further down is meant to hide them
      // at t=0 — but that effect can fire before this whole firstRun
      // block ever runs (ResizeObserver's first callback, and so this
      // build, happens asynchronously after mount), so it was finding
      // sightSubIconGroups still undefined and skipping them, with
      // nothing ever re-syncing them once they actually existed. Calling
      // it once, right after they're built and laid out, closes that gap.
      if (firstRun) {
        setSightProgress(sightProgress);
      }

      startSimulation();
      positionNodes();
    }

    // Debounced so a live resize doesn't restart the simulation on every
    // intermediate pixel — the first observation runs immediately.
    let resizeTimer;
    let firstObservation = true;
    const observer = new ResizeObserver(([entry]) => {
      const rect = entry.contentRect;
      if (firstObservation) {
        firstObservation = false;
        resize(rect);
        return;
      }
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => resize(rect), 120);
    });
    observer.observe(container);

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
      setPublicationsMarkersProgress,
      setBrainProgress,
      setConnectionsProgress,
      setHeatmapProgress
    };

    return () => {
      clearTimeout(resizeTimer);
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
    sceneApi.setPublicationsMarkersProgress(publicationsMarkersProgress);
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
</script>

<div class="chart-svg" bind:this={container}>
  <svg bind:this={svgEl} role="img" aria-label={ariaLabel}>
    <defs>
      <!-- step 4/5 heads -->
      <clipPath id="personHeadClip">
        <rect x="0" y="0" width="640" height="340" />
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
        >Data source: PubMed <a href="/chatGPTPublications.csv" download="chatGPTPublications.csv"
          ><tspan class="pubFootnoteLink">(pre-1942 AI researched + cross checked)</tspan></a
        ></text
      >
    </g>
    <!-- Step 9: 2007 article -->
    <g class="brainGroup">
      <!-- Bryony: "I want the text change (...) to be the header text
           changing" — brainTitle itself now carries the step9-intro
           messages before settling on the real question (see
           setBrainProgress/brainTitleStage); "I want to keep the Rouw &
           Scholte text throughout" — brainSubtitle shares the title's
           own fade-in and never fades back out. -->
      <text class="brainTitle"></text>
      <text class="brainSubtitle"></text>
      <!-- Bryony: "keep the background rectangles... make sure these icon
           groups and headings are contained within them" — the rects
           fade in with the intro and STAY (see setBrainProgress's
           introFadeInT) rather than waiting for the brain icon itself;
           the 18+18 participant icons live inside this same group, in
           its local space, so they can never sit outside the rects.
           "hide the left side + right side labels" — .brainBgLabel is
           hidden via CSS below, left in the markup rather than deleted. -->
      <g class="brainBgGroup">
        <rect class="brainBgRect brainBgRectLeft" x="0" y="0" width="320" height="640"></rect>
        <rect class="brainBgRect brainBgRectRight" x="320" y="0" width="320" height="640"></rect>
        <text class="brainBgLabel brainBgLabelLeft" x="20" y="20">left side</text>
        <text class="brainBgLabel brainBgLabelRight" x="620" y="20">right side</text>
        <g class="participantIconsGroup"></g>
        <!-- Bryony: "add some cool animation which scanned the people
             icons left to right" — a soft vertical light sweeps across
             the whole 0-640 local width (both groups) during
             step9.intro.scan (see setBrainProgress); on top of the icons
             in paint order, ignores pointer events since it's decorative. -->
        <defs>
          <linearGradient id="brainScanGradient" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stop-color="var(--blue)" stop-opacity="0"></stop>
            <stop offset="50%" stop-color="var(--blue)" stop-opacity="0.4"></stop>
            <stop offset="100%" stop-color="var(--blue)" stop-opacity="0"></stop>
          </linearGradient>
        </defs>
        <rect class="brainScanBar" y="0" width="90" height="640" fill="url(#brainScanGradient)"></rect>
      </g>
      <!-- Headings take a fixed real-px size (see layoutBrain's
           toScreenX/Y), so they live outside the scaled .brainBgGroup
           above rather than inside its local coordinate space. -->
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
          <!-- Bryony: "lines same colour as circles and underneath" —
               placed here, before .brainDot gets appended in
               buildBrain(), so every dot always paints on top of its
               own leader line. -->
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
      <!-- Bryony: "add some labels with lines connecting... to" each
           region dot — one label per ANNOTATION (brainDotAnnotations),
           built in buildBrain(), positioned every resize in
           layoutBrain() (screen space, same as the legend above, so the
           text stays a fixed real size — no arrowheads, per Bryony). -->
      <g class="brainDotLabelsGroup"></g>
    </g>

    <!-- Step 10: 2015 publication -->
    <g class="connectionsGroup">
      <text class="connectionsTitle"></text>
      <rect class="magnetTray"></rect>
      <g class="magnetTrayDividers">
        <line class="magnetTrayDivider magnetTrayDivider1"></line>
        <line class="magnetTrayDivider magnetTrayDivider2"></line>
        <line class="magnetTrayDivider magnetTrayDivider3"></line>
        <line class="magnetTrayDivider magnetTrayEdgeLeft"></line>
        <line class="magnetTrayDivider magnetTrayEdgeRight"></line>
      </g>
      <!-- Step 12: the tray's own 26 letters (magnetLetterGroup, below)
           shrink onto a ring built from these — placed BEFORE
           magnetLetterGroup so the letters always paint on top, same
           document-order trick as the brain dot leader lines. All 3
           children share one translate(ringCx,ringCy) transform (set in
           layoutHeatmap) so their own path math can stay in simple
           ring-centred local coordinates. -->
      <g class="heatmapRingGroup">
        <g class="heatmapCellsGroup"></g>
        <g class="heatmapSeparatorsGroup"></g>
        <g class="heatmapMorphGroup"></g>
      </g>
      <g class="magnetLetterGroup"></g>
    </g>

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
    font-style: italic; /* Bryony: "put (or more than one) in italics" */
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
    /* Bryony: "can the quote paths be white fill please" — was the page's
       own ivory background tint (var(--background)), same literal-#fff
       treatment .sightSubIconBg already uses for the same "a plain white
       card" look. */
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
    /* Bryony: "the big background circle enclosing the 3 sub category
       circles... remove the stroke and make the fill a slightly
       darker hue than the background... accessible but subtle, not
       confused with the link lines" — `backgroundTint` (theme.js) is
       exactly that: background's own hue, ~8% darker, so this circle
       reads as a shade of the page rather than an outlined ring, and
       stays clearly distinct from the grey link lines. */
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
    /* Bryony: "make them 15px and centre them below the icon circles,
       also color them the fisher price purple see how it looks" — 15px
       is the type scale's own --text-caption step (theme.js), so this
       stays in step with every other fixed-size label rather than a
       magic number; --purple is the same accent .sightSubIconPath
       itself already uses. */
    font-family: var(--font-body);
    font-size: var(--text-caption, 15px);
    fill: var(--purple, #6a488c);
    text-anchor: middle;
    dominant-baseline: hanging;
  }
  :global(.chart-svg .sightLabel) {
    /* Bryony: "disconnect with the header font on the last few steps -
       stick with the same as step 1" — matches .headerText now (Fredoka,
       weight 600), not the body serif. */
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
    /* butt, not round: a round cap draws a small semicircle PAST the
       path's own endpoint in the direction of travel — and the
       arrowhead's tip sits exactly at that endpoint (marker-end,
       orient="auto") — so the round cap poked a sliver of line out past
       the arrow's point. Bryony: "you can see the line emerging from
       the end of the arrow." Butt ends the stroke exactly at the
       endpoint, right where the tip is. */
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
    /* Bryony: "lets take away any stroke/outline in all cases" — was a
       thin background-colour edge so overlapping photos in the fan
       still read as separate cards; dropped altogether, everywhere,
       rather than just thinned or made conditional. */
    stroke: none;
  }
  :global(.chart-svg .publicationsTitle) {
    /* Bryony: "disconnect with the header font on the last few steps -
       stick with the same as step 1" — matches .headerText now (Fredoka,
       weight 600), not the body serif. */
    font-family: var(--font-heading);
    font-weight: 600;
    fill: var(--text);
    text-anchor: middle;
    dominant-baseline: central;
    opacity: 0;
  }
  /* Step 7's axes: each group's own opacity (set by setPublicationsProgress())
     covers its ticks + label together — see the template comment.
     `.pubXAxisLine` is a grey hairline per the dataviz skill ("gridlines /
     axes: one-step-off-surface gray, hairline, recessive"); the y-tick
     numbers use `grey` too (never a live opacity on top of it — that
     would fight the group's own JS-driven fade) so they read as muted
     without contending with the fade-in. The x-tick text and the y-axis
     label are each a deliberately different, specific colour per Bryony
     (see their own rules below), not this shared muted grey.
   */
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
    /* Bryony: "no ticks on the x axis, text much bigger and closer to
       the axis line" — bumped from the shared caption size up to lead
       size. Kept `text`, not `grey`, now that it's this prominent — a
       muted grey at this size read as unfinished rather than "clean". */
    font-family: var(--font-body);
    font-size: var(--text-lead, 24px);
    font-variant-numeric: tabular-nums;
    fill: var(--text);
    text-anchor: middle;
    dominant-baseline: hanging;
  }
  :global(.chart-svg .pubYTick) {
    font-family: var(--font-body);
    /* Bryony: "make the y axis ticks a bit darker... and bigger - same
       as x" — matches .pubXTickLabel's size exactly now, and `text`
       (from the palette) instead of the lighter `grey`. */
    font-size: var(--text-lead, 24px);
    font-variant-numeric: tabular-nums;
    fill: var(--text);
    /* Bryony: "y axis should be on the right" — numbers now sit to the
       right of the plot and read left-to-right away from it, so anchor
       start (was end, when they sat left of the axis reading toward it). */
    text-anchor: start;
    dominant-baseline: central;
  }
  :global(.chart-svg .pubYAxisLabel) {
    /* Bryony: "label should be black and transformed 180, larger font,
       aligned top and left of the y axis" — literal black (not the
       `text` ink token) since she named the colour specifically, same
       as the quote bubble's literal white; text-anchor start (was
       middle) is what makes it start AT its y and read downward instead
       of centring on it — see layoutPublications()'s own comment for the
       rotate(-90) -> rotate(90) half of this. */
    font-family: var(--font-body);
    font-size: var(--text-lead, 24px);
    fill: #000;
    text-anchor: start;
    dominant-baseline: hanging;
  }
  :global(.chart-svg .pubLine) {
    /* Fisher-Price blue, per Bryony — the dataviz skill's own line spec:
       2px, round join/cap. Never opacity-driven (the clip-path wipe is
       the reveal mechanism), so a plain, permanent full-strength stroke. */
    fill: none;
    stroke: var(--blue);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  :global(.chart-svg .pubArea) {
    /* "Area fill: the series hue at ~10% opacity (a wash, never a
       saturated block)" per the dataviz skill — a flat, permanent value
       (not progress-driven, same reasoning as .pubLine above). */
    fill: var(--blue);
    stroke: none;
    opacity: 0.1;
  }
  :global(.chart-svg .pubMarker) {
    opacity: 0;
  }
  :global(.chart-svg .pubMarkerLine) {
    /* Recessive, like the axis line — this is an annotation, not one of
       the plotted marks. Dashed so it reads as a reference, not data. */
    stroke: var(--grey);
    stroke-width: 1;
    stroke-dasharray: 4 3;
  }
  :global(.chart-svg .pubMarkerLabel) {
    font-family: var(--font-body);
    font-size: var(--text-caption, 15px);
    /* Bryony: "please could the paper label fill be the grey instead" —
       back to `grey` (recessive/footnote-style), not `text`. */
    fill: var(--grey);
    /* Bryony: "The 3 paper labels should be rotated 180 and left of the
       line - same as the y axis label" — rotate(-90) is applied via the
       transform set in layoutPublications() (mirrors .pubYAxisLabel's
       rotate(90)); text-anchor end is what keeps the label "aligned
       top" under that flipped rotation — see the comment there. */
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
    /* Bryony: "please could the paper label fill be the grey instead" —
       see .pubMarkerLabel above. */
    fill: var(--grey);
    /* Bryony: "The 3 paper labels should be rotated 180 and left of the
       line - same as the y axis label" — see .pubMarkerLabel above. */
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
    /* Bryony: "could the download link just be on the pre-1942 part of
       the data source label, no need for an extra line" — same grey as
       the rest of the footnote; underline is the only cue this part,
       unlike the rest of the sentence, is clickable. */
    text-decoration: underline;
    cursor: pointer;
  }
  :global(.chart-svg .brainTitle) {
    /* Matches .publicationsTitle/.headerText — Fredoka, weight 600, per
       Bryony's "stick with the same as step 1" rule for every step
       title, not just the publications one. */
    font-family: var(--font-heading);
    font-weight: 600;
    fill: var(--text);
    text-anchor: middle;
    dominant-baseline: central;
    opacity: 0;
  }
  :global(.chart-svg .brainSubtitle) {
    /* Citation-style subtitle — same recessive grey as the pub-chart's
       own citation/marker labels, smaller than the title. */
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
    /* Bryony: "normal weight - it looks like they might be bold?" — no
       font-weight override, so it inherits normal same as .brainSubtitle. */
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
    /* Bryony: "brain fill is white" + "light stroke which is our grey" —
       matches the approved preview exactly. */
    fill: #fff;
    stroke: var(--grey);
    stroke-width: 3;
  }
  :global(.chart-svg .brainBgRect) {
    /* "our darker background" — backgroundTint, per the preview. */
    fill: var(--backgroundTint);
  }
  :global(.chart-svg .brainBgRectLeft) {
    opacity: 1;
  }
  :global(.chart-svg .brainBgRectRight) {
    opacity: 0.5;
  }
  :global(.chart-svg .brainBgLabel) {
    /* Bryony: "hide the left side + right side labels" during the
       participant intro, then "show left side + right side at this
       point too" — opacity is driven by brainT in setBrainProgress,
       same beat as the brain drawing itself, rather than a permanent hide. */
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
    /* Bryony: "let's remove the stroke" — fill/radius are set per-dot in
       layoutBrain() (colour by effect, size by volume), never here. */
    stroke: none;
    /* Bryony: "I'd also love the 'bubbles' to pulse slightly. not too in
       your face but a little bit", then "make the pulsing of the green
       dots a bit more obvious" — same gentle, slow scale breathe,
       staggered per-dot (see layoutBrain()'s own animation-delay), just
       a bigger amplitude (all these dots are shades of green, from
       brainEffectColorScale's white→green range — there's no other
       colour in this scene). transform-box/-origin so each dot scales
       around its OWN centre, not the svg's (0,0) origin. */
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
    /* Bryony: "add some labels... Attention + Planning" etc, then "make
       the text below the same size" — both lines share one size, set in
       layoutBrain() (dotLabelFontSize) rather than fixed here, same
       reasoning as .brainTitle/.brainSubtitle above: "font size with
       responsiveness like the other ones". The sub line stays grey as
       the visual "aside" of the pair. */
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
    /* Bryony: "no arrowheads" / "lines same colour as circles and
       underneath" — stroke colour + width are set per-line in
       layoutBrain() (colour matches that dot's own fill, width
       compensated for the icon's current scale); fill:none is the only
       thing that always holds. */
    fill: none;
  }
  :global(.chart-svg .brainEffectValue),
  :global(.chart-svg .brainEffectCaption),
  :global(.chart-svg .brainVolumeValue),
  :global(.chart-svg .brainVolumeCaption) {
    /* Bryony: "the text is too big on the legends... we might have to
       make a smaller one" — the smallest step in the type scale
       (--text-micro, 12px — theme.js), same fixed real size regardless
       of how big or small the icon itself is currently rendered (see
       layoutBrain()'s own comment on why this text lives in screen
       space now, not the icon's scaled local space). */
    font-family: var(--font-body);
    font-size: var(--text-micro, 12px);
    fill: var(--grey);
  }
  :global(.chart-svg .brainEffectValue) {
    /* Sits just above the bar — Bryony gave the exact 2 values (3.7,
       4.8) and no separate heading, so these ARE the legend's labels.
       Default (alphabetic) baseline, not hanging: the label's baseline
       sits right at its y, so the text itself reads ABOVE the bar
       rather than down into it. */
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
    /* Size-only legend item — deliberately uncoloured (fill: none) so it
       never reads as also encoding the Effect legend's colour meaning. */
    fill: none;
    stroke: var(--grey);
    stroke-width: 1.5;
  }
  :global(.chart-svg .brainEffectTitle),
  :global(.chart-svg .brainVolumeTitle) {
    /* Bryony: "add effect + volume legend label titles" — a heading for
       each legend visual, set apart from its grey value/caption text
       (heading font, weight, --text colour) but still at the same fixed
       micro size so it doesn't compete with the chart's real titles.
       Default (alphabetic) baseline: each one's y was computed in
       layoutBrain() as a baseline sitting one row above its value line. */
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
    /* Bryony: "'greater' in grey italic small, normal font" / "'more
       widespread' same font specs" — echoes the activation header text
       ("...greater and more widespread brain activation"), same fixed
       micro size as the rest of the legend, but italic to read as an
       aside rather than a label. */
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
    /* "just below the top of the circle" — sits inside its own circle,
       near the top, so hanging (grows downward from y) is right here,
       unlike the Effect value labels above. */
    font-variant-numeric: tabular-nums;
    text-anchor: middle;
    dominant-baseline: hanging;
  }
  :global(.chart-svg .connectionsTitle) {
    /* Matches .brainTitle/.publicationsTitle/.headerText — same "stick
       with the same as step 1" rule for every step title. */
    font-family: var(--font-heading);
    font-weight: 600;
    fill: var(--text);
    text-anchor: middle;
    dominant-baseline: central;
    opacity: 0;
  }
  :global(.chart-svg .magnetTray) {
    /* The tray body — same warm-tint fill as every other "shade of the
       page" shape in this file, with a grey outline for definition
       ("some lines/shading" — the outline + dividers are the lines, this
       fill + the letters' own drop-shadow are the shading). Bryony:
       "some sort of shading or drop shadow style effect might be good"
       (looking at the real photo again — its tray sits raised off the
       surface behind it) — a soft drop-shadow gives the whole tray that
       same lifted, physical-object feel, on top of the letters' own. */
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
    /* The tray's own compartment walls, echoing the real photo's — now
       left/right edges (.magnetTrayEdgeLeft/Right) as well as the
       between-row dividers, per Bryony's "add a vertical line left and
       right to mimic the tray edges". */
    stroke: var(--grey);
    stroke-width: 1.5;
  }
  :global(.chart-svg .magnetLetterGroup) {
    opacity: 0;
  }
  :global(.chart-svg .heatmapCellsGroup) {
    /* Step 12's per-respondent cells (see buildHeatmap()/setHeatmapProgress())
       — hidden until the letters have (mostly) landed on the ring, per
       Bryony's own 4-beat spec: "the colorOrder false view appears" only
       once the ring itself is in place. */
    opacity: 0;
  }
  :global(.chart-svg .heatmapCell) {
    stroke: none;
  }
  :global(.chart-svg .heatmapSeparatorsGroup) {
    opacity: 0;
  }
  :global(.chart-svg .heatmapSeparator) {
    /* The thin lines between letter slices — Bryony's original drew
       these in white over the coloured wedges. */
    stroke: var(--background);
    stroke-width: 1;
  }
  :global(.chart-svg .heatmapMorphGroup) {
    /* The colorBar beat's own 52 aggregate polygons — hidden until that
       beat starts (see setHeatmapProgress()), when they swap in for the
       individual cells above. */
    opacity: 0;
  }
  :global(.chart-svg .heatmapMorphPiece) {
    stroke: none;
  }
  :global(.chart-svg .magnetLetter) {
    /* Bryony: "make your own version of the fisher price magnet box with
       our header font" — bold caps in the same face every other title in
       this file uses, one flat colour per letter (set once in
       buildMagnetLetters(), never re-set — see that function's own
       comment), with a soft drop-shadow for a raised, "magnet" feel.
       weight 600, not 700 — index.html only loads Fredoka 500/600, so 700
       was never a real weight here (the letter-width measurements used to
       size these letters were taken at 600 to match). */
    font-family: var(--font-heading);
    font-weight: 600;
    text-anchor: middle;
    dominant-baseline: central;
    filter: drop-shadow(1px 2px 1.5px rgba(0, 0, 0, 0.28));
  }
  :global(.chart-svg .personTooltip) {
    /* Hidden until showPersonTooltip() raises it; pointer-events: none so
       hovering the tooltip itself (it can sit right over the cursor)
       never fires a mouseleave on the tile/photo underneath it. */
    opacity: 0;
    pointer-events: none;
  }
  :global(.chart-svg .personTooltipBg) {
    /* Bryony: "white background, grey border on tooltip, small text". */
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
