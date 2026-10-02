<script>
  // "Who did what, and how much" — the credits contribution chart,
  // converted from Bryony's original Observable/D3 notebook into this
  // project's own style: plain D3 + Svelte (same pattern as ChartSvg),
  // theme.js colours/fonts instead of hard-coded hexes and system fonts,
  // and simple drawn icons instead of a Font Awesome import. Static —
  // no scroll/progress wiring, it just renders once.
  import * as d3 from 'd3';
  import { colors } from '../theme.js';
  import { creditsContributions, creditsSections, creditsAgentLabels } from '../data/creditsContributions.js';

  let svgEl;

  // Simple hand-drawn glyphs (no icon library) — a person silhouette for
  // the Human section, a friendly rounded-rect face for the AI section.
  function drawPersonIcon(g) {
    g.append('circle').attr('cy', -9).attr('r', 7).attr('fill', colors.greyDark);
    g.append('path')
      .attr('d', 'M -11 10 C -11 -2, 11 -2, 11 10 Z')
      .attr('fill', colors.greyDark);
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
    const pad = 6;
    const sectionGap = 20;
    const rowH = 42;
    const margin = { top: 117, right: 24, bottom: 24, left: 280 };
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
    const top = margin.top - 71;
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
    sec.each(function (d) {
      const g = d3.select(this).append('g').attr('transform', `translate(${d.x + d.w / 2},${margin.top - 44})`);
      if (d.name === 'Human') drawPersonIcon(g);
      else drawRobotIcon(g);
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
      .attr('font-family', 'var(--font-heading)')
      .attr('font-weight', 600)
      .attr('font-size', 13)
      .attr('fill', colors.text)
      .text((d) => creditsAgentLabels[d]);

    // Row labels
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
      .attr('font-size', 14)
      .attr('fill', colors.text)
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
    g.append('title').text((d) => `${d.process}\n${creditsAgentLabels[d.agent]}: ${d.value}%`);

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
    lg.append('text').attr('x', lw + 6).attr('y', lh).attr('font-size', 15).text('100%');
  });
</script>

<svg bind:this={svgEl} role="img" aria-label="Chart: percent contribution to each part of this project, by who did it."></svg>

<style>
  svg {
    display: block;
    margin: 0 auto;
  }
</style>
