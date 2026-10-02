<script>
  // "How long each day took" — the dev-time streamgraph, built outside
  // the app first (as a standalone D3 HTML prototype) then ported in
  // here following the same plain D3 + Svelte pattern as Contributions
  // and ChartSvg: theme.js colours/fonts instead of hard-coded hexes,
  // data pulled from devTimeStream.js (progress/timeline.json durations).
  // Static — no scroll/progress wiring, it just renders once.
  import * as d3 from 'd3';
  import { colors, fonts } from '../theme.js';
  import { stages, THUMBS } from '../data/devTimeStream.js';

  let svgEl;

  $effect(() => {
    const width = 760; // matches .creditsChart's max-width so text renders ~1:1, not shrunk by viewBox scaling
    const margin = { top: 34, right: 35, bottom: 250, left: 96 }; // +28 vs before: CONTENT_SIZE's taller line-height needs more room below the thumbnails
    const plotHeight = 188;
    const height = margin.top + plotHeight + margin.bottom;
    const plotTop = margin.top;
    const plotBottom = height - margin.bottom;
    const centerY = plotTop + plotHeight / 2;
    const xStart = margin.left, xEnd = width - margin.right;
    const THUMB_SIZE = 96; // 50% bigger, per Bryony
    const TITLE_SIZE = 15; // matches theme typeScale.caption — day labels + axis label
    const CONTENT_SIZE = 19; // matches theme typeScale.body — the stat block's own line

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', width)
      .style('max-width', '100%')
      .style('height', 'auto')
      .style('display', 'block');

    const xScale = d3.scalePoint().domain(d3.range(stages.length)).range([xStart, xEnd]).padding(0);
    const maxDuration = d3.max(stages, (d) => d.duration);
    const yScale = d3.scaleLinear().domain([0, maxDuration]).range([0, plotHeight]);

    const area = d3
      .area()
      .x((d, i) => xScale(i))
      .y0((d) => centerY + yScale(d.duration) / 2)
      .y1((d) => centerY - yScale(d.duration) / 2)
      .curve(d3.curveMonotoneX);

    // Vertical guide lines + top day labels + bottom thumbnails.
    stages.forEach((d, i) => {
      const cx = xScale(i);

      svg
        .append('line')
        .attr('x1', cx).attr('x2', cx)
        .attr('y1', plotTop).attr('y2', plotBottom)
        .attr('stroke', colors.grey)
        .attr('stroke-width', 1);

      svg
        .append('text')
        .attr('x', cx).attr('y', plotTop - 12)
        .attr('text-anchor', 'middle')
        .attr('font-family', fonts.body)
        .attr('font-size', TITLE_SIZE)
        .attr('fill', colors.greyDark)
        .text(d.name);

      if (d.thumb) {
        const ty = plotBottom + 14;
        svg
          .append('image')
          .attr('href', THUMBS[d.thumb])
          .attr('x', cx - THUMB_SIZE / 2).attr('y', ty)
          .attr('width', THUMB_SIZE).attr('height', THUMB_SIZE)
          .attr('preserveAspectRatio', 'xMidYMid slice')
          .attr('clip-path', 'inset(0 round 4px)');
      }
    });

    // The stream itself (drawn after guide lines so it covers their middle).
    svg
      .append('path')
      .datum(stages)
      .attr('d', area)
      .attr('fill', colors.purple)
      .attr('fill-opacity', 0.88);

    // Title riding inside the widest part of the stream.
    svg
      .append('text')
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
    const axisPad = 14;
    const axisTop = plotTop + axisPad, axisBottom = plotBottom - axisPad;
    svg
      .append('line')
      .attr('x1', axisX).attr('x2', axisX)
      .attr('y1', axisTop + 7).attr('y2', axisBottom - 7)
      .attr('stroke', colors.greyDark)
      .attr('stroke-width', 1.5);
    svg
      .append('path')
      .attr('d', `M ${axisX - 5},${axisTop + 8} L ${axisX + 5},${axisTop + 8} L ${axisX},${axisTop} Z`)
      .attr('fill', colors.greyDark);
    svg
      .append('path')
      .attr('d', `M ${axisX - 5},${axisBottom - 8} L ${axisX + 5},${axisBottom - 8} L ${axisX},${axisBottom} Z`)
      .attr('fill', colors.greyDark);
    svg
      .append('text')
      .attr('x', axisX - 10).attr('y', centerY)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('font-family', fonts.body)
      .attr('font-size', TITLE_SIZE)
      .attr('fill', colors.grey)
      .text(`${Math.floor(maxDuration / 60)}h`);

    // Total + token/cost stat block, bottom-right — sits below the
    // thumbnail row with a line-height's worth of breathing room.
    const totalMinutes = stages.reduce((sum, d) => sum + d.duration, 0);
    const thumbBottom = plotBottom + 14 + THUMB_SIZE;
    const statY = thumbBottom + 48 + 14;
    const stat = svg.append('g').attr('transform', `translate(${width - margin.right},${statY})`);
    const line1 = stat.append('text').attr('text-anchor', 'end').attr('font-family', fonts.body);
    line1.append('tspan').attr('fill', colors.grey).attr('font-size', CONTENT_SIZE).text('Total ');
    line1.append('tspan').attr('fill', colors.text).attr('font-weight', 700).attr('font-size', CONTENT_SIZE).text(`${Math.round(totalMinutes / 60)}h `);
    line1.append('tspan').attr('fill', colors.grey).attr('font-size', CONTENT_SIZE).text('over ');
    line1.append('tspan').attr('fill', colors.text).attr('font-weight', 700).attr('font-size', CONTENT_SIZE).text(`${stages.length} days`);

    const line2 = stat.append('text').attr('y', 24).attr('text-anchor', 'end').attr('font-family', fonts.body);
    line2.append('tspan').attr('fill', colors.text).attr('font-weight', 700).attr('font-size', CONTENT_SIZE).text('26.5 million tokens');

    const line3 = stat.append('text').attr('y', 48).attr('text-anchor', 'end').attr('font-family', fonts.body);
    line3.append('tspan').attr('fill', colors.grey).attr('font-size', CONTENT_SIZE).text('approx. cost ');
    line3.append('tspan').attr('fill', colors.text).attr('font-weight', 700).attr('font-size', CONTENT_SIZE).text('US$400');
  });
</script>

<svg bind:this={svgEl} role="img" aria-label="Chart: time spent each day building this project, Day 1 through Day 8."></svg>

<style>
  svg {
    display: block;
    margin: 0 auto;
  }
</style>
