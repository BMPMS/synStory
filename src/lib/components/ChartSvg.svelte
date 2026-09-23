<script>
  import * as d3 from 'd3';
  import forceBounce from 'd3-force-bounce';
  import forceSurface from 'd3-force-surface';
  import { phase, lerp, cornerGridTargets, step1, step2, step3, step4, step5, step6, windPhase, layoutQuoteReveals } from '../steps.js';
  import { colors, spacing } from '../theme.js'; // theme's --text-caption/--text-lead CSS vars carry the type scale
  import { senseIcons } from '../data/senseIcons.js';
  import { quotes } from '../data/quotes.js';
  import { personIcon } from '../data/personIcon.js'; // placeholder (Font Awesome user icon) — illustrator's per-person art drops in later, one at a time
  import { sightSubIcons } from '../data/sightSubIcons.js'; // the 3 (placeholder) icons sight "splits into" — letters+numbers, colors, objects
  import { synaesthesiaLinks } from '../data/synaesthesiaLinks.js'; // who has which cross-sense association (step 6)

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
              tspan = text.append('tspan').attr('x', x).attr('y', y).attr('dy', fontSize).text(word);
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
    // shape buildLinkPhotos()'s D3 join wants. x/y/rotation are filled in
    // by layoutLinks() every resize.
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
        rotation: 0
      }))
    );
    let linkGroups;
    let linkPhotoGroups;
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

    // Joins the 3 sight-splits-into sub-icons onto .sightSubIcon groups
    // — same join-once pattern as buildSenses()/buildPeopleIcons() above.
    // Position/scale are set by layoutSight().
    function buildSightSubIcons() {
      const groups = svg
        .select('.sightSubIconsGroup')
        .selectAll('.sightSubIcon')
        .data(sightSubIconNodes, (d) => d.key)
        .join((enter) => {
          const g = enter.append('g').attr('class', 'sightSubIcon');
          g.append('circle').attr('class', 'sightSubIconBg');
          g.append('path').attr('class', 'sightSubIconPath').attr('d', (d) => d.path);
          return g;
        });

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

      return groups;
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
      const rowY = etymLeadY + etymLeadFontSize * 2.4;

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
      const gapAboveIcons = Math.max(20, iconsTopY - sensesTextBottom);

      const closingY = iconsBottomY + gapAboveIcons + closingFontSize / 2;
      const sublineY = closingY + closingFontSize / 2 + labelOffset + sublineFontSize / 2;

      svg
        .select('.closingLine')
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
              el.append('tspan')
                .attr('class', 'quoteWord')
                .text(w.text)
                .style('fill', w.sense ? senseColors[w.sense] : null);
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
      const labelEl = svg
        .select('.sightLabel')
        .text('Sight logically splits into letters + numbers, colors and objects')
        .attr('font-size', labelFontSize)
        .attr('x', width / 2)
        .attr('y', topPadding + labelFontSize / 2);
      wrap(labelEl, Math.min(width - 48, labelFontSize * 24), labelFontSize);
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

      const pairGap = basePairGap * spreadScale;
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
      if (sightSubIconGroups) {
        sightSubIconGroups.attr('transform', (d) => `translate(${d.x},${d.y})`);
        sightSubIconGroups
          .select('.sightSubIconPath')
          .attr('transform', (d) => `translate(${-(d.vbW * d.scale) / 2},${-(d.vbH * d.scale) / 2}) scale(${d.scale})`);
        sightSubIconGroups.select('.sightSubIconBg').attr('r', iconBgRadius);
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
      const photoSize = TILE * step1.tilesToCorner.scale;
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
        'lettersNumbers-objects': { flip: true, curveFraction: 0.75 },
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
        'lettersNumbers-colors': { curveFraction: 1.5, startAngleOffset: 0.5, endAngleOffset: -0.5 },
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
        // out; deepened again, 1.6 -> 2.4.
        'lettersNumbers-sound': { controlFrom: 'lettersNumbers-objects', controlScale: 2.4 },
        // Bryony: "taste -> colour... move the end point up - top of the
        // colour circle so it doesn't overlap letters + numbers" (the
        // 345°-on-the-circle version "didn't actually do anything...
        // axe the weird formula" — and was on the wrong edge besides,
        // "smell -> colour was fine, i meant taste -> colour"). Plain
        // direction, no degrees/conversion: straight up from colour's
        // own centre is just { x: 0, y: -1 }.
        'taste-colors': { endDir: { x: 0, y: -1 } }
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
          : ownControlByKey[key];

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
            d.x = midX + ux * fanIndex * rowGap + dir.x * edgeGap;
            d.y = midY + uy * fanIndex * rowGap + dir.y * edgeGap;
            d.rotation = tiltDeg;
          });
        };

        place(
          e.people.filter((p) => !belowNames.has(p.name)),
          up
        );
        place(
          e.people.filter((p) => belowNames.has(p.name)),
          down
        );
      });

      if (linkPhotoGroups) {
        linkPhotoGroups.attr('transform', (d) => `translate(${d.x},${d.y}) rotate(${d.rotation})`);
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

      // leadText is reused across stages (step1's "They've all been..."
      // becomes step3's "It's when one..."). At t=0 — this stage's own
      // "not reached yet" resting value — 1 - leadOutT evaluates to 1,
      // which would force it visible even before step1 has revealed it.
      // Only take over once this stage has actually started; before
      // that, leave whatever setRevealProgress already set alone.
      if (t > 0) {
        svg
          .select('.leadText')
          .text(showSenses ? step3.senses.text : answer.lead)
          .attr('y', showSenses ? etymLeadY - step3.senses.riseBy : etymLeadY)
          .style('opacity', showSenses ? sensesT : 1 - leadOutT);
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
      // is a pure function of t, so scrolling back up always unwinds it
      // — nothing here is ever a one-way switch.
      const arriveT = phase(t, step5.arrive.fadeOut.start, step5.arrive.fadeOut.end);

      if (senseGroups) {
        // d.sightAmt just blends iconTransform's own output toward
        // d.sightX/d.sightY — it never touches d.x/d.y (the row
        // position layoutSenses() sets), so there's nothing to restore
        // when arriveT eases back to 0.
        iconNodes.forEach((d) => {
          d.sightAmt = arriveT;
        });
        senseGroups.attr('transform', iconTransform).style('opacity', (d) => lerp(d.opacity, 1, arriveT));
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

      const revealT = phase(t, step5.reveal.fadeIn.start, step5.reveal.fadeIn.end);
      svg.select('.sightCircle').style('opacity', revealT);
      svg.select('.sightSubIconsGroup').style('opacity', revealT);
      svg.select('.sightLabel').style('opacity', revealT);
    }

    // Step 6: the relationship arrows + photo fans just fade in together
    // once the sight scene has settled — layoutLinks() already did all
    // the geometry, every resize, so there's nothing else to (re)compute
    // here, just the one opacity.
    function setLinksProgress(t) {
      if (!answer) return;
      const revealT = phase(t, step6.reveal.fadeIn.start, step6.reveal.fadeIn.end);
      svg.select('.linksGroup').style('opacity', revealT);
      // Photos were paused here per Bryony ("leave the photos where
      // they are for the moment... links and arrow first") while the
      // links/arrows were being placed; now revealed the same way the
      // lines are — same phase(), so both land at opacity 1 together
      // once the edge has fully reached its own end position.
      svg.select('.linkPhotosGroup').style('opacity', revealT);
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
      personGroups.attr('transform', (d, i) => {
        const target = cornerTargets[i] || d;
        const x = lerp(d.x, target.x, cornerT);
        const y = lerp(d.y, target.y, cornerT);
        const s = lerp(1, step1.tilesToCorner.scale, cornerT);
        return `translate(${x},${y}) scale(${s})`;
      });
      personGroups.select('.personTile').style('opacity', lerp(1, step1.tilesToCorner.tileOpacity, cornerT));
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
      setLinksProgress
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
</script>

<div class="chart-svg" bind:this={container}>
  <svg bind:this={svgEl} role="img" aria-label={ariaLabel}>
    <defs>
      <!-- Crops a person icon to just its head/neck (see personIcon.js's
           headCropHeight) when there isn't room for the whole figure. -->
      <clipPath id="personHeadClip">
        <rect x="0" y="0" width="640" height="340" />
      </clipPath>
      <!-- Step 6's relationship-arrow arrowhead — one shared marker,
           referenced by every .linkArrow via marker-end (and, on the one
           bidirectional sound<->colour edge, marker-start too — see
           buildLinks()), sized (small,
           per Bryony) in layoutLinks(). markerUnits="userSpaceOnUse" is
           the important bit: the SVG default (markerUnits="strokeWidth")
           multiplies every marker dimension by the path's own
           stroke-width, so the arrow rendered 2.5x (.linkArrow's
           stroke-width) bigger than the numbers set in JS ever said —
           that's what made an earlier pass look "huge" regardless of the
           size chosen there. refX is ALSO set dynamically in
           layoutLinks() (not left at the values below, which are just
           the pre-first-layout fallback) — see the comment there for
           why: this triangle tapers to a zero-width point at its own
           apex, and anchoring the path's endpoint exactly there left the
           line's stroke visibly wider than the arrowhead right at the
           tip. refY stays fixed at 5 — the triangle's width is centred
           on y=5 at every local-x, so it never needs adjusting.
           orient="auto-start-reverse": as marker-end it behaves exactly
           like plain "auto" (points along the direction of travel); as
           marker-start it's automatically rotated 180° from that, so
           the very same triangle asset points correctly outward at
           EITHER end without needing a second, mirrored marker. -->
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
    </defs>
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
  </svg>
</div>

<style>
  .chart-svg {
    width: 100%;
    height: 100%;
    position: relative;
    user-select: none;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
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
    fill: var(--background);
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
    fill: none;
    stroke: var(--grey);
    stroke-width: 1.5;
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
  :global(.chart-svg .sightLabel) {
    font-family: var(--font-body);
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
    /* A thin background-colour edge so overlapping photos in the fan
       still read as separate cards, the same way a real photo stack
       would. */
    stroke: var(--background);
    stroke-width: 2;
  }
</style>
