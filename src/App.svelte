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

  // Step 4 (the 5 quotes, revealed word by word): its own step, since the
  // ~65 words across 5 quotes need more scroll room than step 3 has left.
  let quotesProgress = $derived(activeIndex < 3 ? 0 : activeIndex === 3 ? stepProgress : 1);

  onMount(() => {
    const scroller = scrollama();
    scroller
      .setup({ step: '.step', offset: 0.9, progress: true })
      .onStepEnter(({ index }) => {
        activeIndex = index;
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
        ariaLabel="Ten square portraits of well-known people, drifting and bouncing gently within the frame."
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
</div>
