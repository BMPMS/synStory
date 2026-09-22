<script>
  import * as d3 from 'd3';
  import forceBounce from 'd3-force-bounce';
  import forceSurface from 'd3-force-surface';
  import { phase, lerp, cornerGridTargets, step1, step2, step3, step4, windPhase, layoutQuoteReveals } from '../steps.js';
  import { colors } from '../theme.js'; // theme's --text-caption/--text-lead CSS vars carry the type scale
  import { senseIcons } from '../data/senseIcons.js';
  import { quotes } from '../data/quotes.js';

  let {
    people,
    headerText = null, // shown until it fades out; tiles are kept clear of it
    answer = null, // { lead, syn, aesthesia } — omit to render tiles with no reveal text
    progress = 0, // 0–1, drives the header/answer/tiles reveal — see steps.js
    etymologyProgress = 0, // 0–1, drives the SYN/AESTHESIA "Latin for" beats (step2)
    titleProgress = 0, // 0–1, drives SYNAESTHESIA rising into the header slot, the senses
    // line + icons, and the closing lines (step3)
    quotesProgress = 0, // 0–1, drives the 5 quotes revealing word by word (step4)
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
    const iconNodes = senseIcons.map((d) => ({ ...d, x: 0, y: 0, scale: 1, color: colors.text, opacity: 0, flash: 0 }));
    let senseGroups;
    // Real rendered top/bottom of the icon row (icons + labels), measured
    // by layoutSenses() via getBBox — used by layoutClosing() to keep the
    // gap below the icons the same as the gap above them.
    let iconsTopY = 0;
    let iconsBottomY = 0;

    // Set by layoutClosing() every resize — where the quotes below it
    // should start.
    let closingSubY = 0;
    let quotesStartY = 0;

    // Pure timing for the 5 quotes — one equal slice of quotesProgress
    // each, staggered word-by-word within it (see step4 in steps.js).
    // Computed once; doesn't depend on layout, only on the quotes data.
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
      const topPadding = 40;
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
      titleY = 40 + titleFontSize / 2; // same topPadding as the header

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
          g.append('path').attr('class', 'senseIconPath');
          g.append('text').attr('class', 'senseIconLabel');
          return g;
        });

      groups.select('.senseIconPath').attr('d', (d) => d.path);
      groups.select('.senseIconLabel').text((d) => d.label);

      return groups;
    }

    // The outer <g class="senseIcon"> transform — position, plus a
    // quotes-driven "flash" scale pulse (d.flash, set by
    // setQuotesProgress()) on top of it. Shared by layoutSenses() (where
    // flash is always 0) and setQuotesProgress() (which just re-applies
    // this after mutating d.flash), so the two never fall out of sync.
    function iconTransform(d) {
      const flash = d.flash || 0;
      return `translate(${d.x},${d.y}) scale(${1 + flash * step4.flashScale})`;
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

    // Word-wraps + centres each quote independently (only one is ever
    // visible at a time, but all 5 are laid out so they're ready the
    // moment their turn comes). Each word gets its own x/y — measured off
    // the real, already-appended tspans (never a throwaway element) — so
    // wrapping and per-word reveal/highlight can both work off the same
    // real DOM.
    function layoutQuotes() {
      if (!answer || !quotesGroups) return;
      const fontSize = Math.max(22, Math.min(34, width * 0.055)); // bigger than the lead text
      const lineHeight = fontSize * 1.4;
      const maxWidth = Math.min(width - 48, fontSize * 26);
      const spaceWidth = fontSize * 0.28;
      const centerX = width / 2;

      quotesGroups.attr('font-size', fontSize).each(function () {
        const tspanNodes = d3.select(this).selectAll('.quoteWord').nodes();
        const widths = tspanNodes.map((n) => n.getComputedTextLength());

        // Pass 1: decide line breaks from a running cursor.
        const lines = [];
        let lineStart = 0;
        let cursor = 0;
        widths.forEach((w, i) => {
          const addW = (i === lineStart ? 0 : spaceWidth) + w;
          if (cursor + addW > maxWidth && i > lineStart) {
            lines.push({ start: lineStart, end: i });
            lineStart = i;
            cursor = w;
          } else {
            cursor += addW;
          }
        });
        lines.push({ start: lineStart, end: widths.length });

        // Pass 2: position each word, centring every line on its own
        // width.
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
              .attr('y', quotesStartY + li * lineHeight);
          }
        });
      });
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

      svg
        .select('.leadText')
        .text(showSenses ? step3.senses.text : answer.lead)
        .attr('y', showSenses ? etymLeadY - step3.senses.riseBy : etymLeadY)
        .style('opacity', showSenses ? sensesT : 1 - leadOutT);

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
      if (!answer || !quotesGroups) return;

      quotesGroups.each(function (quote, qi) {
        const layout = quotesLayout[qi];
        const wordNodes = d3.select(this).selectAll('.quoteWord').nodes();
        quote.words.forEach((w, wi) => {
          const wordLayout = layout.words[wi];
          const amt = windPhase(t, wordLayout, { start: layout.fadeStart, end: layout.fadeEnd });
          wordNodes[wi].style.opacity = amt;
        });
      });

      if (senseGroups) {
        iconNodes.forEach((d) => {
          const centers = senseFlashCenters[d.label] || [];
          let flash = 0;
          centers.forEach((center) => {
            const amt = Math.max(0, 1 - Math.abs(t - center) / step4.flashHalfWidth);
            if (amt > flash) flash = amt;
          });
          d.flash = flash;
        });
        senseGroups.attr('transform', iconTransform);
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
        quotesGroups = buildQuotes();
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
      layoutQuotes();

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
      setQuotesProgress
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
</script>

<div class="chart-svg" bind:this={container}>
  <svg bind:this={svgEl} role="img" aria-label={ariaLabel}>
    <text class="headerText"></text>
    <g class="peopleGroup"></g>
    <g class="answerGroup">
      <text class="leadText"></text>
      <text class="synText"></text>
      <text class="aesthesiaText"></text>
      <text class="etymologyCaption"></text>
      <text class="etymologyLabel"></text>
      <text class="whatIsText"></text>
    </g>
    <g class="sensesGroup"></g>
    <text class="closingLine"></text>
    <text class="closingSubline"></text>
    <g class="quotesGroup"></g>
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
  :global(.chart-svg .whatIsText) {
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
</style>
