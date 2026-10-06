<script>
  // "Who did what, and how much" — the credits contribution chart,
  // converted from Bryony's original Observable/D3 notebook into this
  // project's own style: plain D3 + Svelte (same pattern as ChartSvg),
  // theme.js colours/fonts instead of hard-coded hexes and system fonts,
  // and simple drawn icons instead of a Font Awesome import. Static —
  // no scroll/progress wiring, it just renders once.
  import * as d3 from 'd3';
  import { colors } from '../theme.js';
  import { bmDataIcon } from '../data/bmDataIcon.js';
  import { creditsContributions, creditsSections, creditsAgentLabels } from '../data/creditsContributions.js';

  let svgEl;

  // The BM Data mark (same shape as the favicon) for the human column; a
  // simple hand-drawn friendly rounded-rect face for the AI section.
  function drawPersonIcon(g) {
    const scale = 30 / bmDataIcon.width;
    g.append('path')
      .attr('d', bmDataIcon.path)
      .attr('transform', `translate(${(-bmDataIcon.width * scale) / 2},${(-bmDataIcon.height * scale) / 2 - 2}) scale(${scale})`)
      .attr('fill', bmDataIcon.color)
      .attr('stroke', bmDataIcon.color)
      .attr('stroke-width', 3);
  }
  function drawRobotIcon(g) {
    g.append('rect').attr('x', -11).attr('y', -11).attr('width', 22).attr('height', 18).attr('rx', 5).attr('fill', colors.greyDark);
    g.append('line').attr('x1', 0).attr('y1', -11).attr('x2', 0).attr('y2', -16).attr('stroke', colors.greyDark).attr('stroke-width', 2);
    g.append('circle').attr('cx', 0).attr('cy', -17).attr('r', 2).attr('fill', colors.greyDark);
    g.append('circle').attr('cx', -5).attr('cy', -3).attr('r', 2).attr('fill', '#fff');
    g.append('circle').attr('cx', 5).attr('cy', -3).attr('r', 2).attr('fill', '#fff');
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
    svg.selectAll('*').remove();
    svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', width)
      .style('max-width', '100%')
      .style('height', 'auto');

    // Section backgrounds + one hand-drawn icon per section — the rect
    // starts well above the icon's own top edge so it has real padding
    // above the robot's antenna, not just a snug fit.
    const top = margin.top - 75;
    const bottom = margin.top + rows.length * rowH + 6;
    const sec = svg.append('g').selectAll('g').data(sections).join('g');
    sec
      .filter((d) => d.tinted)
      .append('rect')
      .attr('x', (d) => d.x)
      .attr('y', top)
      .attr('width', (d) => d.w)
      .attr('height', bottom - top)
      .attr('rx', 10)
      .attr('fill', colors.backgroundTint);
    const BM_URL = 'https://www.bmdata.co.uk';
    // The human column (icon + its "BM Data" label) links to the BM Data site.
    const makeLink = (parent) =>
      parent
        .append('a')
        .attr('href', BM_URL)
        .attr('target', '_blank')
        .attr('rel', 'noopener')
        .attr('aria-label', 'BM Data Visualisation (opens in a new tab)')
        .style('cursor', 'pointer');
    sec.each(function (d) {
      const pos = `translate(${d.x + d.w / 2},${margin.top - 48})`;
      if (d.name === 'Human') {
        const g = makeLink(d3.select(this)).append('g').attr('transform', pos);
        drawPersonIcon(g);
      } else {
        const g = d3.select(this).append('g').attr('transform', pos);
        drawRobotIcon(g);
      }
    });

    // Column labels
    svg
      .append('g')
      .selectAll('text')
      .data(agents)
      .join('text')
      .attr('x', (d) => colX.get(d) + cw / 2)
      .attr('y', margin.top - 12)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'var(--font-body)')
      .attr('font-size', LABEL_SIZE)
      .attr('fill', colors.greyDark)
      .text((d) => creditsAgentLabels[d]);
    // Move the human column's label inside a link too.
    svg.selectAll('text').filter((d) => d === 'HUMAN').each(function () {
      const link = makeLink(d3.select(this.parentNode));
      this.parentNode.insertBefore(link.node(), this);
      link.node().appendChild(this);
      d3.select(this).style('cursor', 'pointer');
    });

    // Row labels — Bryony: match the day labels in the Time Spent chart
    // (and the credits caption text) exactly: body font, caption size,
    // greyDark, not the darker/heavier look this had before.
    svg
      .append('g')
      .selectAll('text')
      .data(rows)
      .join('text')
      .attr('x', margin.left - 14)
      .attr('y', (d) => y(d) + y.bandwidth() / 2)
      .attr('text-anchor', 'end')
      .attr('dy', '0.35em')
      .attr('font-family', 'var(--font-body)')
      .attr('font-size', LABEL_SIZE)
      .attr('fill', colors.greyDark)
      .text((d) => d);

    // Grid cells
    const g = svg
      .append('g')
      .selectAll('g')
      .data(long)
      .join('g')
      .attr('transform', (d) => `translate(${colX.get(d.agent)},${y(d.process)})`);
    g.append('rect')
      .attr('width', cw)
      .attr('height', y.bandwidth())
      .attr('rx', 6)
      .attr('fill', (d) => color(d.value))
      .attr('stroke', colors.grey);

    // Instant tooltip instead of a native <title> (which waits a second or
    // more to appear). Page-colour box with a light-grey border so it
    // can't be mistaken for a heat-map cell (their borders are grey); caption-size body font. Tap also shows it on touch.
    const tip = svg.append('g').attr('class', 'cellTip').style('opacity', 0).style('pointer-events', 'none');
    const tipBg = tip.append('rect').attr('rx', 4).attr('fill', colors.background).attr('stroke', colors.grey);
    const tipText = tip.append('text').attr('font-family', 'var(--font-body)').attr('font-size', 15);
    const tipLine = 18;
    function showTip(d) {
      const lines = [
        { text: d.process, bold: true },
        { text: `${creditsAgentLabels[d.agent]}: ${d.value}%`, bold: false }
      ];
      tipText.selectAll('tspan').remove();
      lines.forEach((l, i) => {
        tipText
          .append('tspan')
          .attr('x', 0)
          .attr('y', (i + 1) * tipLine - 5)
          .attr('font-weight', l.bold ? 700 : 400)
          .attr('fill', colors.text)
          .text(l.text);
      });
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
    // The hovered cell also thickens its outline a touch (raised first so
    // neighbours can't cover the wider stroke) and the cursor is a pointer.
    const setCell = (el, wide) =>
      d3.select(el).select('rect').transition().duration(120).attr('stroke-width', wide ? 2.5 : 1);
    const hideTip = () => tip.style('opacity', 0);
    g.style('cursor', 'pointer')
      .on('mouseenter', function (e, d) {
        d3.select(this).raise();
        tip.raise();
        setCell(this, true);
        showTip(d);
      })
      .on('mouseleave', function () {
        setCell(this, false);
        hideTip();
      })
      .on('click', (e, d) => {
        e.stopPropagation();
        showTip(d);
      });
    svg.on('click', hideTip);

    // Legend: a 0-100% gradient bar, sitting clear of the tinted AI rect
    // above it (not overlapping it) — right-aligned over the grid. Just the
    // "100%" end is labelled (the bar's own white end already reads as 0).
    const lw = 90;
    const lh = 8;
    const lx = gridEnd - lw - 40;
    const legendY = top - 24;
    const gradId = `creditsGrad-${Math.round(Math.random() * 1e6)}`;
    const grad = svg.append('defs').append('linearGradient').attr('id', gradId);
    grad.append('stop').attr('offset', '0%').attr('stop-color', color(0));
    grad.append('stop').attr('offset', '100%').attr('stop-color', color(100));
    const lg = svg.append('g').attr('transform', `translate(${lx},${legendY})`).attr('font-family', 'var(--font-body)').attr('fill', colors.greyDark);
    lg.append('rect').attr('width', lw).attr('height', lh).attr('rx', 2).attr('fill', `url(#${gradId})`).attr('stroke', colors.grey);
    lg.append('text').attr('x', lw + 6).attr('y', lh).attr('font-size', LABEL_SIZE).text('100%');
  });
</script>

<svg bind:this={svgEl} role="img" aria-label="Chart: percent contribution to each part of this project, by who did it."></svg>

<style>
  svg {
    display: block;
    margin: 0 auto;
  }
</style>
