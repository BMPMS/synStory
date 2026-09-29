<script>
  import { onMount } from 'svelte';
  import scrollama from 'scrollama';
  import ChartSvg from './lib/components/ChartSvg.svelte';
  import { people } from './lib/data/people.js';
  import { phase, step1 } from './lib/steps.js';

  let activeIndex = $state(0);
  let stepProgress = $state(0);

  // Once you've scrolled past step 1, treat it as fully revealed rather
  // than snapping back when stepProgress resets for step 2/3/4.
  let revealProgress = $derived(activeIndex === 0 ? stepProgress : 1);

  // Step 2 (the SYN/AESTHESIA "Latin for" beats): 0 before it starts,
  // this step's own progress while it's current, 1 once scrolled past.
  let etymologyProgress = $derived(activeIndex < 1 ? 0 : activeIndex === 1 ? stepProgress : 1);

  // Step 3 (SYNAESTHESIA rising into "What is ___", the senses line +
  // icons, and the closing lines): same pattern, one index further along.
  let titleProgress = $derived(activeIndex < 2 ? 0 : activeIndex === 2 ? stepProgress : 1);

  // Steps 4 and 5 (the 5 quotes, revealed word by word): stretched across
  // TWO scroll-steps instead of one, per Bryony ("it seems a bit
  // rushed") — this only changes how far you have to scroll to move
  // quotesProgress from 0 to 1 (twice as far as before), not the reveal
  // choreography itself (still driven by a single 0–1 quotesProgress,
  // still lives in step4/layoutQuoteReveals in steps.js, untouched).
  // 0 before step 4 starts; across step 4 then step 5, activeIndex-3
  // contributes a whole unit (0 or 1) and stepProgress fills in the
  // current step's own fraction, so the combined value still climbs
  // smoothly from 0 to 1 over both steps combined; frozen at 1 after.
  let quotesProgress = $derived(
    activeIndex < 3 ? 0 : activeIndex > 4 ? 1 : (activeIndex - 3 + stepProgress) / 2
  );

  // Step 6 (after the last quote: everything but the sense icons + the
  // people tiles fades out, the sense icons move into a ring around
  // sight, then its 3 sub-icons + a caption fade in): its own step too —
  // one index further along now that quotes take two steps instead of one.
  let sightProgress = $derived(activeIndex < 5 ? 0 : activeIndex === 5 ? stepProgress : 1);

  // Step 7 (the synaesthesia-relationship arrows + the person-photo fans
  // that sit on them, once the sight scene has settled): one index further.
  let linksProgress = $derived(activeIndex < 6 ? 0 : activeIndex === 6 ? stepProgress : 1);

  // Step 8 ("This is not old news" — everything fades out and the
  // publications line/area chart takes over): one index further again.
  let publicationsProgress = $derived(activeIndex < 7 ? 0 : activeIndex === 7 ? stepProgress : 1);

  // Step 9 (once the chart's drawn, mark 2 specific publications on it,
  // one at a time): one index further again.
  let publicationsMarkersProgress = $derived(activeIndex < 8 ? 0 : activeIndex === 8 ? stepProgress : 1);

  // Step 10 ("Is synesthese brain activity different?" — the publications
  // chart fades out and the brain-regions scene takes over): one index
  // further again.
  let brainProgress = $derived(activeIndex < 9 ? 0 : activeIndex === 9 ? stepProgress : 1);

  // Step 11 ("When do synesthese connections form?" — the brain-regions
  // scene fades out and the new connections scene takes over): one index
  // further again.
  let connectionsProgress = $derived(activeIndex < 10 ? 0 : activeIndex === 10 ? stepProgress : 1);

  // Step 12 ("when do connections form?"'s tray fades out, the magnet
  // letters shrink onto a ring, and the per-respondent heatmap/bar
  // morph builds up in its own 4 beats): one index further again.
  let heatmapProgress = $derived(activeIndex < 11 ? 0 : activeIndex === 11 ? stepProgress : 1);

  onMount(() => {
    const scroller = scrollama();
    scroller
      .setup({ step: '.step', offset: 0.9, progress: true })
      // stepProgress reset here too (not just onStepProgress) — else a
      // brief window pairs the new index with the old step's leftover
      // progress, flashing whatever reads it straight to that value.
      .onStepEnter(({ index, direction }) => {
        activeIndex = index;
        stepProgress = direction === 'down' ? 0 : 1;
      })
      .onStepProgress(({ progress }) => {
        stepProgress = progress;
      });

    function handleResize() {
      scroller.resize();
    }
    window.addEventListener('resize', handleResize);

    return () => {
      scroller.destroy();
      window.removeEventListener('resize', handleResize);
    };
  });
</script>

<div class="scroll-track">
  <div class="pinned">
    <main>
      <ChartSvg
        {people}
        headerText="What do these people have in common?"
        answer={{ lead: "They've all been associated with having", syn: 'SYN', aesthesia: 'AESTHESIA' }}
        progress={revealProgress}
        {etymologyProgress}
        {titleProgress}
        {quotesProgress}
        {sightProgress}
        {linksProgress}
        {publicationsProgress}
        {publicationsMarkersProgress}
        {brainProgress}
        {connectionsProgress}
        {heatmapProgress}
        ariaLabel="Twelve square portraits of well-known people, drifting and bouncing gently within the frame."
      />

      <p
        class="scroll-cue"
        style="opacity: {1 - phase(revealProgress, step1.header.fadeOut.start, step1.header.fadeOut.end)}"
      >
        <span class="scroll-cue-pulse">scroll ↓</span>
      </p>
    </main>
  </div>

  <p class="progress-label">Step {activeIndex + 1} — {Math.round(stepProgress * 100)}%</p>

  <div class="step"></div>
  <div class="step"></div>
  <div class="step"></div>
  <div class="step"></div>
  <div class="step"></div>
  <div class="step"></div>
  <div class="step"></div>
  <div class="step"></div>
  <div class="step"></div>
  <div class="step"></div>
  <div class="step"></div>
  <div class="step"></div>
  <div class="scroll-buffer"></div>
</div>

<!-- Bryony: "will be introduced on the last page" (the Synaesthesia
     Battery Test) — a plain, static section after the scroll-track, not
     part of the pinned/scrollama scene, so it just appears once someone's
     scrolled all the way through the story. Its own standalone app (see
     test.html) — this is only the doorway to it. -->
<section class="testCta">
  <h2 class="testCtaTitle">Curious about your own synaesthesia?</h2>
  <p class="testCtaBody">
    Take the short battery test and see how consistent your own colour
    associations really are.
  </p>
  <a class="testCtaButton" href="/test.html">Take the test</a>
</section>

<style>
  .testCta {
    max-width: 480px;
    margin: 0 auto;
    padding: 96px 24px 120px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  .testCtaTitle {
    font-family: var(--font-heading);
    font-size: var(--text-h3, 30px);
    margin: 0;
    color: var(--text);
  }
  .testCtaBody {
    font-family: var(--font-body);
    font-size: var(--text-body, 16px);
    line-height: 1.5;
    margin: 0;
    color: var(--text);
  }
  .testCtaButton {
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: var(--text-body, 16px);
    padding: 14px 28px;
    border-radius: 999px;
    background: var(--purple);
    color: #fff;
    text-decoration: none;
  }
</style>
