<script>
  // "How long each day took" — the dev-time streamgraph, built outside
  // the app first (as a standalone D3 HTML prototype) then ported in
  // here following the same plain D3 + Svelte pattern as Contributions
  // and ChartSvg: theme.js colours/fonts instead of hard-coded hexes,
  // data pulled from devTimeStream.js (progress/timeline.json durations).
  // Static — no scroll/progress wiring, it just renders once. Drawn with
  // joins only (see d3Layer.js): elements are created once and updated in
  // place; the SVG is never cleared and nothing is ever removed.
  import * as d3 from 'd3';
  import { colors, fonts } from '../theme.js';
  import { layer, one } from '../d3Layer.js';
  import { stages, THUMBS } from '../data/devTimeStream.js';

  let svgEl;

  // Bryony: "I think I might remove this bit" (Total 38h over 8 days / tokens /
  // nominal cost). Hidden for now; flip to true to bring it back.
  const SHOW_STATS = false;
  // Bryony: smooth the curve by skipping the "step" on these days — the
  // stream is drawn through the other days only (Day 2, Day 5 and Day 6
  // here = indices 1, 4 and 5). Guide lines/labels/thumbnails stay on every day.
  const SKIP_IN_CURVE = new Set([1, 4, 5]);
  // Bryony: the y scale is 10 hours wide, so the widest day has padding.
  const Y_SCALE_MINUTES = 10 * 60;

  $effect(() => {
    const width = 760; // matches .creditsChart's max-width so text renders ~1:1, not shrunk by viewBox scaling
    const margin = { top: 34, right: 35, bottom: SHOW_STATS ? 250 : 130, left: 96 }; // +28 vs before: CONTENT_SIZE's taller line-height needs more room below the thumbnails
    const plotHeight = 188;
    const height = margin.top + plotHeight + margin.bottom;
    const plotTop = margin.top;
    const plotBottom = height - margin.bottom;
    const centerY = plotTop + plotHeight / 2;
    const xStart = margin.left, xEnd = width - margin.right;
    const THUMB_SIZE = 96; // 50% bigger, per Bryony
    const TITLE_SIZE = 17; // one step up from typeScale.caption (15) — day labels + axis label, same size as the Credits grid labels
    const CONTENT_SIZE = 19; // matches theme typeScale.body — the stat block's own line

    const svg = d3.select(svgEl);
    svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', width)
      .style('max-width', '100%')
      .style('height', 'auto')
      .style('display', 'block');

    const xScale = d3.scalePoint().domain(d3.range(stages.length)).range([xStart, xEnd]).padding(0);
    const maxDuration = d3.max(stages, (d) => d.duration);
    const yScale = d3.scaleLinear().domain([0, Y_SCALE_MINUTES]).range([0, plotHeight]);
    const curveStages = stages.map((d, i) => ({ ...d, i })).filter((d) => !SKIP_IN_CURVE.has(d.i));
    const days = stages.map((d, i) => ({ ...d, i }));

    const area = d3
      .area()
      .x((d) => xScale(d.i))
      .y0((d) => centerY + yScale(d.duration) / 2)
      .y1((d) => centerY - yScale(d.duration) / 2)
      .curve(d3.curveMonotoneX);

    // Vertical guide lines + top day labels + bottom thumbnails.
    layer(svg, 'line', 'guide', days)
      .attr('x1', (d) => xScale(d.i)).attr('x2', (d) => xScale(d.i))
      .attr('y1', plotTop).attr('y2', plotBottom)
      .attr('stroke', colors.grey)
      .attr('stroke-width', 1);

    layer(svg, 'text', 'dayLabel', days)
      .attr('x', (d) => xScale(d.i)).attr('y', plotTop - 12)
      .attr('text-anchor', 'middle')
      .attr('font-family', fonts.body)
      .attr('font-size', TITLE_SIZE)
      .attr('fill', colors.greyDark)
      .text((d) => d.name);

    layer(svg, 'image', 'dayThumb', days.filter((d) => d.thumb))
      .attr('href', (d) => THUMBS[d.thumb])
      .attr('x', (d) => xScale(d.i) - THUMB_SIZE / 2).attr('y', plotBottom + 14)
      .attr('width', THUMB_SIZE).attr('height', THUMB_SIZE)
      .attr('preserveAspectRatio', 'xMidYMid slice')
      .attr('clip-path', 'inset(0 round 4px)');

    // The stream itself (drawn after guide lines so it covers their middle).
    layer(svg, 'path', 'stream', [curveStages])
      .attr('d', area)
      .attr('fill', colors.purple)
      .attr('fill-opacity', 0.88);

    // Title riding inside the widest part of the stream.
    one(svg, 'text', 'streamTitle')
      .attr('x', (xStart + xEnd) / 2).attr('y', centerY)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-family', fonts.body)
      .attr('font-weight', 700)
      .attr('font-size', 26)
      .attr('fill', '#ffffff')
      .text('Collaboration Time');

    // Y-axis: single full-height line, arrows both ends, labelled with the
    // longest day's own duration (rounded down).
    const axisX = margin.left - 42;
    // Bryony: the arrows reach the top and bottom of the widest section
    // (a little more than the "8h" label says).
    const axisTop = centerY - yScale(maxDuration) / 2, axisBottom = centerY + yScale(maxDuration) / 2;
    one(svg, 'line', 'axisLine')
      .attr('x1', axisX).attr('x2', axisX)
      .attr('y1', axisTop + 7).attr('y2', axisBottom - 7)
      .attr('stroke', colors.greyDark)
      .attr('stroke-width', 1.5);
    one(svg, 'path', 'axisArrowTop')
      .attr('d', `M ${axisX - 5},${axisTop + 8} L ${axisX + 5},${axisTop + 8} L ${axisX},${axisTop} Z`)
      .attr('fill', colors.greyDark);
    one(svg, 'path', 'axisArrowBottom')
      .attr('d', `M ${axisX - 5},${axisBottom - 8} L ${axisX + 5},${axisBottom - 8} L ${axisX},${axisBottom} Z`)
      .attr('fill', colors.greyDark);
    one(svg, 'text', 'axisLabel')
      .attr('x', axisX - 10).attr('y', centerY)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('font-family', fonts.body)
      .attr('font-size', TITLE_SIZE)
      .attr('fill', colors.grey)
      .text(`${Math.floor(maxDuration / 60)}h`);

    // Total + token/cost stat block, bottom-right — sits below the
    // thumbnail row with a line-height's worth of breathing room. Only
    // shown when SHOW_STATS is on (otherwise its group is hidden, not removed).
    const totalMinutes = stages.reduce((sum, d) => sum + d.duration, 0);
    const thumbBottom = plotBottom + 14 + THUMB_SIZE;
    const statY = thumbBottom + 48 + 14;
    const grey = (text) => ({ text, fill: colors.grey });
    const strong = (text) => ({ text, fill: colors.text, bold: true });
    const statLines = [
      { y: 0, pieces: [grey('Total '), strong(`${Math.round(totalMinutes / 60)}h `), grey('over '), strong(`${stages.length} days`)] },
      { y: 24, pieces: [strong('26.5 million tokens')] },
      { y: 48, pieces: [grey('nominal token cost '), strong('US$400')] }
    ];
    const stat = layer(svg, 'g', 'stat', SHOW_STATS ? [0] : [])
      .attr('transform', `translate(${width - margin.right},${statY})`);
    const statText = layer(stat, 'text', 'statLine', statLines)
      .attr('y', (d) => d.y)
      .attr('text-anchor', 'end')
      .attr('font-family', fonts.body);
    layer(statText, 'tspan', 'statPiece', (d) => d.pieces)
      .attr('fill', (p) => p.fill)
      .attr('font-weight', (p) => (p.bold ? 700 : null))
      .attr('font-size', CONTENT_SIZE)
      .text((p) => p.text);
  });
</script>

<svg bind:this={svgEl} role="img" aria-label="Chart: time spent each day building this project, Day 1 through Day 8."></svg>

<style>
  svg {
    display: block;
    margin: 0 auto;
  }
</style>
