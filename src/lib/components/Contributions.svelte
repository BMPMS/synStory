<script>
  // "Who did what, and how much" — the credits contribution chart,
  // converted from Bryony's original Observable/D3 notebook into this
  // project's own style: plain D3 + Svelte (same pattern as ChartSvg),
  // theme.js colours/fonts instead of hard-coded hexes and system fonts,
  // and simple drawn icons instead of a Font Awesome import. Static —
  // no scroll/progress wiring, it just renders once.
  //
  // Drawn with joins only (see d3Layer.js): every element is created once
  // and later runs just update it — the SVG is never cleared and no element
  // is ever removed.
  import * as d3 from 'd3';
  import { colors } from '../theme.js';
  import { layer, one } from '../d3Layer.js';
  import { bmDataIcon } from '../data/bmDataIcon.js';
  import { creditsContributions, creditsSections, creditsAgentLabels } from '../data/creditsContributions.js';

  let svgEl;

  const BM_URL = 'https://www.bmdata.co.uk';

  // The BM Data mark (same shape as the favicon) for the human column.
  function drawPersonIcon(g) {
    const scale = 30 / bmDataIcon.width;
    one(g, 'path', 'bmMark')
      .attr('d', bmDataIcon.path)
      .attr('transform', `translate(${(-bmDataIcon.width * scale) / 2},${(-bmDataIcon.height * scale) / 2 - 2}) scale(${scale})`)
      .attr('fill', bmDataIcon.color)
      .attr('stroke', bmDataIcon.color)
      .attr('stroke-width', 3);
  }
  // A simple hand-drawn friendly rounded-rect face for the AI section.
  function drawRobotIcon(g) {
    one(g, 'rect', 'robotBody').attr('x', -11).attr('y', -11).attr('width', 22).attr('height', 18).attr('rx', 5).attr('fill', colors.greyDark);
    one(g, 'line', 'robotAerial').attr('x1', 0).attr('y1', -11).attr('x2', 0).attr('y2', -16).attr('stroke', colors.greyDark).attr('stroke-width', 2);
    one(g, 'circle', 'robotTip').attr('cx', 0).attr('cy', -17).attr('r', 2).attr('fill', colors.greyDark);
    layer(g, 'circle', 'robotEye', [-5, 5]).attr('cx', (d) => d).attr('cy', -3).attr('r', 2).attr('fill', '#fff');
  }

  $effect(() => {
    const rows = creditsContributions.map((d) => d.process);
    const agents = creditsSections.flatMap((s) => s.agents);
    const long = creditsContributions.flatMap((d) =>
      agents.map((a) => ({ process: d.process, agent: a, value: Number.isFinite(d[a]) ? d[a] : 0 }))
    );

    const cw = 78;
    const pitch = 90;
    const pad = 10; // clearance so the 17px "Observable" label sits inside the tinted panel
    const sectionGap = 20;
    const rowH = 42;
    const LABEL_SIZE = 17; // one step up from typeScale.caption — matches the Time spent chart's day/axis labels
    const margin = { top: 121, right: 24, bottom: 24, left: 218 };
    const height = margin.top + rows.length * rowH + margin.bottom;

    // Sections laid out left to right, each sized to the agents it holds.
    const sections = creditsSections.map((s) => ({ ...s }));
    let cursor = margin.left;
    for (const s of sections) {
      s.x = cursor;
      s.w = s.agents.length * pitch - (pitch - cw) + 2 * pad;
      cursor += s.w + sectionGap;
    }
    const gridEnd = cursor - sectionGap;
    const width = gridEnd + margin.right;
    const colX = new Map(sections.flatMap((s) => s.agents.map((a, i) => [a, s.x + pad + i * pitch])));

    const y = d3.scaleBand(rows, [margin.top, margin.top + rows.length * rowH]).padding(0.08);
    const color = d3.scaleLinear([0, 100], ['#ffffff', colors.purple]).clamp(true);

    const svg = d3.select(svgEl);
    svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', width)
      .style('max-width', '100%')
      .style('height', 'auto');

    // The human column (icon + its "BM Data" label) links to the BM Data
    // site; the same <a> elements exist for every column but only that one
    // has an href, so the others are inert.
    const linkAttrs = (sel) =>
      sel
        .attr('href', (d) => (d === 'HUMAN' || d.name === 'Human' ? BM_URL : null))
        .attr('target', (d) => (d === 'HUMAN' || d.name === 'Human' ? '_blank' : null))
        .attr('rel', (d) => (d === 'HUMAN' || d.name === 'Human' ? 'noopener' : null))
        .attr('aria-label', (d) => (d === 'HUMAN' || d.name === 'Human' ? 'BM Data Visualisation (opens in a new tab)' : null))
        .style('cursor', (d) => (d === 'HUMAN' || d.name === 'Human' ? 'pointer' : null));

    // Section backgrounds + one icon per section — the rect starts well
    // above the icon's own top edge so it has real padding above the
    // robot's antenna, not just a snug fit.
    const top = margin.top - 75;
    const bottom = margin.top + rows.length * rowH + 6;
    layer(svg, 'rect', 'sectionBg', sections.filter((d) => d.tinted))
      .attr('x', (d) => d.x)
      .attr('y', top)
      .attr('width', (d) => d.w)
      .attr('height', bottom - top)
      .attr('rx', 10)
      .attr('fill', colors.backgroundTint);
    const iconLinks = linkAttrs(layer(svg, 'a', 'sectionIcon', sections));
    const iconGroups = one(iconLinks, 'g', 'sectionIconG').attr('transform', (d) => `translate(${d.x + d.w / 2},${margin.top - 48})`);
    iconGroups.each(function (d) {
      if (d.name === 'Human') drawPersonIcon(d3.select(this));
      else drawRobotIcon(d3.select(this));
    });

    // Column labels
    const colLinks = linkAttrs(layer(svg, 'a', 'colLabel', agents));
    one(colLinks, 'text', 'colLabelText')
      .attr('x', (d) => colX.get(d) + cw / 2)
      .attr('y', margin.top - 12)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'var(--font-body)')
      .attr('font-size', LABEL_SIZE)
      .attr('fill', colors.greyDark)
      .style('cursor', (d) => (d === 'HUMAN' ? 'pointer' : null))
      .text((d) => creditsAgentLabels[d]);

    // Row labels — body font, label size, greyDark.
    layer(svg, 'text', 'rowLabel', rows)
      .attr('x', margin.left - 14)
      .attr('y', (d) => y(d) + y.bandwidth() / 2)
      .attr('text-anchor', 'end')
      .attr('dy', '0.35em')
      .attr('font-family', 'var(--font-body)')
      .attr('font-size', LABEL_SIZE)
      .attr('fill', colors.greyDark)
      .text((d) => d);

    // Grid cells
    const g = layer(svg, 'g', 'cell', long).attr('transform', (d) => `translate(${colX.get(d.agent)},${y(d.process)})`);
    one(g, 'rect', 'cellRect')
      .attr('width', cw)
      .attr('height', y.bandwidth())
      .attr('rx', 6)
      .attr('fill', (d) => color(d.value))
      .attr('stroke', colors.grey);

    // Legend: a 0-100% gradient bar, sitting clear of the tinted AI rect
    // above it (not overlapping it) — right-aligned over the grid. Just the
    // "100%" end is labelled (the bar's own white end already reads as 0).
    const lw = 90;
    const lh = 8;
    const lx = gridEnd - lw - 40;
    const legendY = top - 24;
    const gradId = 'creditsGrad';
    const grad = one(one(svg, 'defs', 'chartDefs'), 'linearGradient', 'legendGradient').attr('id', gradId);
    layer(grad, 'stop', 'gradStop', [0, 100])
      .attr('offset', (d) => `${d}%`)
      .attr('stop-color', (d) => color(d));
    const lg = one(svg, 'g', 'legend').attr('transform', `translate(${lx},${legendY})`).attr('font-family', 'var(--font-body)').attr('fill', colors.greyDark);
    one(lg, 'rect', 'legendBar').attr('width', lw).attr('height', lh).attr('rx', 2).attr('fill', `url(#${gradId})`).attr('stroke', colors.grey);
    one(lg, 'text', 'legendLabel').attr('x', lw + 6).attr('y', lh).attr('font-size', LABEL_SIZE).text('100%');

    // Instant tooltip instead of a native <title> (which waits a second or
    // more to appear). Page-colour box with a light-grey border so it
    // can't be mistaken for a heat-map cell (their borders are grey);
    // caption-size body font. Tap also shows it on touch. Created last, so
    // it paints on top of everything.
    const tip = one(svg, 'g', 'cellTip').style('opacity', 0).style('pointer-events', 'none');
    const tipBg = one(tip, 'rect', 'cellTipBg').attr('rx', 4).attr('fill', colors.background).attr('stroke', colors.grey);
    const tipText = one(tip, 'text', 'cellTipText').attr('font-family', 'var(--font-body)').attr('font-size', 15);
    const tipLine = 18;
    function showTip(d) {
      const lines = [
        { text: d.process, bold: true },
        { text: `${creditsAgentLabels[d.agent]}: ${d.value}%`, bold: false }
      ];
      layer(tipText, 'tspan', 'cellTipLine', lines)
        .attr('x', 0)
        .attr('y', (l, i) => (i + 1) * tipLine - 5)
        .attr('font-weight', (l) => (l.bold ? 700 : 400))
        .attr('fill', colors.text)
        .text((l) => l.text);
      const bb = tipText.node().getBBox();
      const padX = 10;
      const padY = 7;
      const tw = bb.width + padX * 2;
      const th = lines.length * tipLine + padY * 2;
      tipBg.attr('x', -padX).attr('y', -padY).attr('width', tw).attr('height', th);
      const cx = colX.get(d.agent) + cw / 2;
      const bx = Math.max(4, Math.min(width - 4 - tw, cx - tw / 2));
      const by = Math.max(4, y(d.process) - th - 3);
      tip.attr('transform', `translate(${bx + padX},${by + padY})`).style('opacity', 1);
    }
    // The hovered cell also thickens its outline a touch (no re-ordering
    // needed: the gaps between cells are wider than the extra stroke) and
    // the cursor is a pointer.
    const setCell = (el, wide) =>
      d3.select(el).select('rect').transition().duration(120).attr('stroke-width', wide ? 2.5 : 1);
    const hideTip = () => tip.style('opacity', 0);
    g.style('cursor', 'pointer')
      .on('pointerenter', function (e, d) {
        if (e.pointerType !== 'mouse') return; // touch uses the tap below
        setCell(this, true);
        showTip(d);
      })
      .on('pointerleave', function (e) {
        if (e.pointerType !== 'mouse') return;
        setCell(this, false);
        hideTip();
      })
      .on('click', (e, d) => {
        e.stopPropagation();
        showTip(d);
      });
    svg.on('click', hideTip);
  });
</script>

<svg bind:this={svgEl} role="img" aria-label="Chart: percent contribution to each part of this project, by who did it."></svg>

<style>
  svg {
    display: block;
    margin: 0 auto;
  }
</style>
