<script>
  import { onMount } from 'svelte';
  import scrollama from 'scrollama';
  import ChartSvg from './lib/components/ChartSvg.svelte';
  import Credits from './lib/components/Credits.svelte';
  import { people } from './lib/data/people.js';
  import { whyICareIcons } from './lib/data/whyICareIcons.js';
  import { phase, lerp, step1, step12, layoutWeightedReveal } from './lib/steps.js';

  let activeIndex = $state(0);
  let stepProgress = $state(0);

  // Stays fully revealed once scrolled past, rather than snapping back.
  let revealProgress = $derived(activeIndex === 0 ? stepProgress : 1);

  // Step 2: SYN/AESTHESIA "Latin for" beats.
  let etymologyProgress = $derived(activeIndex < 1 ? 0 : activeIndex === 1 ? stepProgress : 1);

  // Step 3: title rises into "What is ___", senses + closing lines.
  let titleProgress = $derived(activeIndex < 2 ? 0 : activeIndex === 2 ? stepProgress : 1);

  // Steps 4-5: 5 quotes, stretched across TWO scroll-steps per Bryony
  // ("felt rushed") — only changes scroll distance, not the choreography.
  let quotesProgress = $derived(
    activeIndex < 3 ? 0 : activeIndex > 4 ? 1 : (activeIndex - 3 + stepProgress) / 2
  );

  // Step 6: icons move into a ring around sight, sub-icons + caption fade in.
  let sightProgress = $derived(activeIndex < 5 ? 0 : activeIndex === 5 ? stepProgress : 1);

  // Step 7: relationship arrows + person-photo fans.
  let linksProgress = $derived(activeIndex < 6 ? 0 : activeIndex === 6 ? stepProgress : 1);

  // Step 8: "This is not old news" — publications chart takes over.
  let publicationsProgress = $derived(activeIndex < 7 ? 0 : activeIndex === 7 ? stepProgress : 1);

  // Step 9: publications chart fades, brain-regions scene takes over.
  // (Bryony: dropped the old pure-scroll "Step 9" — nothing to show there.)
  let brainProgress = $derived(activeIndex < 8 ? 0 : activeIndex === 8 ? stepProgress : 1);

  // Step 10: brain scene fades, connections scene takes over.
  let connectionsProgress = $derived(activeIndex < 9 ? 0 : activeIndex === 9 ? stepProgress : 1);

  // Step 11: tray fades, letters shrink onto ring, heatmap/bar morph.
  let heatmapProgress = $derived(activeIndex < 10 ? 0 : activeIndex === 10 ? stepProgress : 1);

  // Step 12: "Why do I care?" — same pure scroll-position-driven pattern
  // as every other step (reversible: scrolling back up un-reveals it,
  // same as scrolling back out of any other step would).
  let whyICareProgress = $derived(activeIndex < 11 ? 0 : activeIndex === 11 ? stepProgress : 1);

  // "Why do I care?" rebus passage — word/icon-by-word reveal, played once
  // when the section scrolls into view (Bryony: "sync with the scroll").
  // Fisher-Price colour cycle for the "synaesthesia" letters, same hexes
  // as theme.js (colors.red/orange/yellow/green/blue/purple).
  const whyICareFpColors = ['var(--red)', 'var(--orange)', 'var(--yellow)', 'var(--green)', 'var(--blue)', 'var(--purple)'];

  const whyICareParagraphs = [
    [
      { type: 'word', text: 'Years' },
      { type: 'word', text: 'ago,' },
      { type: 'word', text: 'a' },
      { type: 'icon', icon: whyICareIcons.friend, caption: 'friend' },
      { type: 'word', text: 'told' },
      { type: 'word', text: 'me' },
      { type: 'word', text: 'a' },
      { type: 'icon', icon: whyICareIcons.story, caption: 'story' },
      { type: 'word', text: 'of' },
      { type: 'word', text: 'a' },
      { type: 'word', text: 'colleague' },
      { type: 'word', text: 'having' },
      { type: 'word', text: 'a' },
      { type: 'icon', icon: whyICareIcons.eureka, caption: 'eureka moment' },
      { type: 'word', text: 'while' },
      { type: 'word', text: 'reading' },
      { type: 'word', text: 'an' },
      { type: 'icon', icon: whyICareIcons.article, caption: 'article' },
      { type: 'word', text: 'on' },
      { type: 'rainbow', letters: 'synaesthesia', tail: '.' }
    ],
    [
      { type: 'word', text: 'My' },
      { type: 'icon', icon: whyICareIcons.daughter, caption: 'daughter' },
      { type: 'word', text: 'had' },
      { type: 'word', text: 'a' },
      { type: 'word', text: 'vivid' },
      { type: 'icon', icon: whyICareIcons.memory, caption: 'graphic memory' },
      { type: 'word', text: 'from' },
      { type: 'word', text: 'an' },
      { type: 'word', text: 'early' },
      { type: 'word', text: 'age.' }
    ],
    [
      { type: 'word', text: 'When' },
      { type: 'word', text: 'she' },
      { type: 'word', text: 'was' },
      { type: 'word', text: '7,' },
      { type: 'word', text: 'she' },
      { type: 'word', text: 'took' },
      { type: 'word', text: 'the' },
      { type: 'phrase', text: 'Synesthesia Battery Test.' }
    ],
    [
      { type: 'word', text: 'She' },
      { type: 'word', text: 'was' },
      { type: 'word', text: 'a' },
      { type: 'word', text: 'confirmed' },
      { type: 'phrase', text: 'letters + numbers → colour' },
      { type: 'word', text: 'synesthete,' },
      { type: 'italic', text: '(still is.)' }
    ]
  ];

  // Gaps between the 3 passages, measured/verified in the icon-rebus
  // prototype: tight below the "synaesthesia" line, ~1.5 lines of body
  // text above "When she was 7...".
  const whyICareMarginTop = [0, 13, 42, 13];

  // Reveal pacing per token: reuses the old prototype's relative
  // "weight" per type (icon/phrase/rainbow linger longer than a plain
  // word), now spent as a slice of step12.passage's SCROLL range rather
  // than wall-clock time — see layoutWeightedReveal in steps.js. Each
  // token's own {start, end} window (in whyICareProgress units) is
  // stamped on it once, up front; the template just reads it back.
  const whyICareWeights = [];
  whyICareParagraphs.forEach((tokens) => {
    tokens.forEach((t) => {
      whyICareWeights.push(t.type === 'icon' ? 5.5 : t.type === 'rainbow' ? 9 : t.type === 'phrase' ? 3.2 : 1);
    });
  });
  const whyICareWindows = layoutWeightedReveal(whyICareWeights, step12.passage);
  let whyICareWindowIdx = 0;
  whyICareParagraphs.forEach((tokens) => {
    tokens.forEach((t) => {
      t._window = whyICareWindows[whyICareWindowIdx++];
      // The rainbow token's own letters cascade across its window too.
      if (t.type === 'rainbow') {
        t._letterWindows = layoutWeightedReveal(t.letters.split('').map(() => 1), t._window);
      }
    });
  });

  onMount(() => {
    const scroller = scrollama();
    scroller
      .setup({ step: '.step', offset: 0.9, progress: true })
      // Reset here too, else a brief window shows the old step's leftover progress.
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
        {brainProgress}
        {connectionsProgress}
        {heatmapProgress}
        {whyICareProgress}
        ariaLabel="Twelve square portraits of well-known people, drifting and bouncing gently within the frame."
      />

      <p
        class="scroll-cue"
        style="opacity: {1 - phase(revealProgress, step1.header.fadeOut.start, step1.header.fadeOut.end)}"
      >
        <span class="scroll-cue-pulse">scroll ↓</span>
      </p>

      <!-- Step 12: "Why do I care?" title is drawn inside ChartSvg itself
           (matches every other step's title treatment); this is just the
           icon-rebus body text, overlaid statically in front of the
           chart — it only ever changes opacity (via whyICareProgress),
           never position, and reveals/hides reversibly with scroll
           direction exactly like every other step's content. -->
      <div class="whyICareOverlay">
        {#each whyICareParagraphs as tokens, pi}
          <p class="whyICarePassage" style="margin-top: {whyICareMarginTop[pi]}px">
            {#each tokens as t}
              {#if t.type === 'icon'}
                <span
                  class="whyICareToken whyICareIconToken"
                  style="opacity: {phase(whyICareProgress, t._window.start, t._window.end)}; transform: translateY({lerp(8, 0, phase(whyICareProgress, t._window.start, t._window.end))}px)"
                >
                  <svg class="whyICareIconGlyph" viewBox={t.icon.viewBox} aria-hidden="true"><path d={t.icon.path} fill="currentColor" /></svg>
                  <span class="whyICareIconCaption">{t.caption}</span>
                </span>
              {:else if t.type === 'phrase'}
                <span
                  class="whyICareToken whyICarePhrase"
                  style="opacity: {phase(whyICareProgress, t._window.start, t._window.end)}; transform: translateY({lerp(8, 0, phase(whyICareProgress, t._window.start, t._window.end))}px)"
                >{t.text}</span>
              {:else if t.type === 'rainbow'}
                <span class="whyICareRainbow">
                  {#each t.letters.split('') as ch, i}
                    <span
                      class="whyICareLetter"
                      style="color: {whyICareFpColors[i % whyICareFpColors.length]}; opacity: {phase(whyICareProgress, t._letterWindows[i].start, t._letterWindows[i].end)}; transform: translateY({lerp(8, 0, phase(whyICareProgress, t._letterWindows[i].start, t._letterWindows[i].end))}px)"
                    >{ch}</span>
                  {/each}
                  <span class="whyICareTail" style="opacity: {phase(whyICareProgress, t._window.start, t._window.end)}">{t.tail}</span>
                </span>
              {:else if t.type === 'italic'}
                <span
                  class="whyICareToken whyICareItalic"
                  style="opacity: {phase(whyICareProgress, t._window.start, t._window.end)}; transform: translateY({lerp(8, 0, phase(whyICareProgress, t._window.start, t._window.end))}px)"
                >{t.text}</span>
              {:else}
                <span
                  class="whyICareToken whyICareWord"
                  style="opacity: {phase(whyICareProgress, t._window.start, t._window.end)}; transform: translateY({lerp(8, 0, phase(whyICareProgress, t._window.start, t._window.end))}px)"
                >{t.text}</span>
              {/if}
            {/each}
          </p>
        {/each}

      </div>

      <!-- Bryony: "What about you?" doorway to the battery test — pinned
           to the bottom of the pinned scene (not the end of the passage
           above, which varies in height) so it always lands in the same
           spot, with breathing room below it, right where the page
           un-pins into Credits. Fades in once the passage above is
           essentially finished revealing (step12.cta). -->
      <div
        class="whyICareCta"
        style="opacity: {phase(whyICareProgress, step12.cta.fadeIn.start, step12.cta.fadeIn.end)}"
      >
        <p class="whyICareCtaTitle">What about you?</p>
        <p class="whyICareCtaBody">Take the <strong>Synesthesia Battery Test</strong> and find out.</p>
        <a class="whyICareCtaButton" href="/test.html">Start Test</a>
      </div>
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
  <div class="step step--captions-2">
    <p class="stepText">The term SYNAESTHESIA was first used in 1892</p>
    <p class="stepText">Let's focus on two recent publications</p>
  </div>
  <div class="step step--captions-3">
    <p class="stepText">The study had 36 participants.<br /><br />50% <strong>letters+numbers</strong> → <strong>colour</strong> synesthetes<br />50% <strong>controls</strong></p>
    <p class="stepText">They were shown <strong>letters, numbers and symbols</strong> while undergoing <strong>fMRI</strong> scanning.</p>
    <p class="stepText">Synesthetes showed <strong>greater</strong> and <strong>more widespread</strong> brain activation in some interesting areas.</p>
  </div>
  <div class="step step--captions-4">
    <p class="stepText">Do you remember these <strong>Fisher Price Fridge Magnets</strong>? They were very popular in the US in the 80s and 90s.</p>
    <p class="stepText">This study worked with <strong>6,588 US residents</strong> who were proven <strong>letters + numbers → colour</strong> synesthetes.</p>
    <p class="stepText">It found that 6% (396) had <strong>letters + numbers → colour</strong> pairings matching the <strong>Fisher Price Fridge Magnets</strong>.</p>
    <p class="stepText">This association gets even stronger for participants born in the peak popularity period (1975 to 1980).</p>
    <p class="stepText">One participant matched 25 out of 26 letters.</p>
  </div>
  <div class="step">
    <p class="stepText">Decades after exposure, this group still associate letters with these colours learnt in childhood.</p>
  </div>
  <!-- Step 12: "Why do I care?" — see whyICareProgress in <script> and
       the overlay inside <main> above. Plain empty step, same as the 7
       at the top: all of this step's visible content lives in ChartSvg
       (the title) and the whyICareOverlay (the passage), driven purely
       by scroll position via whyICareProgress. -->
  <div class="step"></div>
  <div class="scroll-buffer"></div>
</div>

<Credits />

<style>
  /* Step 12 overlay — "Why do I care?" itself is drawn inside ChartSvg
     (see whyICareTitle there); this is just the icon-rebus passage
     beneath it. Positioned once, centred, and never moved — every token
     inside only ever changes opacity/transform from whyICareProgress,
     exactly like the rest of the pinned chart's own scroll-bound
     content, so it's reversible (scroll up = hides again) by
     construction, with no timers and no CSS transitions to fight the
     scroll position. */
  /* Width/margin matches ChartSvg's own convention used for every text
     element in the chart (width - 48, i.e. 24px each side — see e.g.
     layoutHeader's maxTextWidth, layoutConnections's titleWrapWidth).
     Anchored from the top (not vertically centred) so it starts right
     under the title and grows downward as the CTA is appended below
     the passage, rather than recentring the whole block each time. */
  .whyICareOverlay {
    position: absolute;
    left: 50%;
    top: 110px;
    transform: translateX(-50%);
    width: calc(100% - 48px);
    text-align: center;
    /* The passage itself is non-interactive (sits in front of the
       chart); the CTA button below re-enables pointer-events on
       itself specifically. */
    pointer-events: none;
  }

  /* Each sentence is its own flex-wrap row so inter-passage spacing
     (whyICareMarginTop, set per-passage in App.svelte) is a real,
     independent layout gap rather than a shared row-gap floor. */
  .whyICarePassage {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    row-gap: 8px;
    column-gap: 0.4em;
    margin: 0;
  }

  .whyICareToken {
    font-family: var(--font-body);
  }
  .whyICareWord {
    font-size: var(--text-body, 19px);
    line-height: 1.3;
    color: var(--text);
  }
  .whyICareItalic {
    font-size: var(--text-body, 19px);
    line-height: 1.3;
    font-style: italic;
    color: var(--text);
  }
  .whyICarePhrase {
    font-size: var(--text-body, 19px);
    font-weight: 700;
    line-height: 1.3;
    color: var(--text);
  }

  .whyICareIconToken {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    margin: 0 0.15em;
    /* Visual-only nudge: `position: relative` shifts the rendered box
       without adding to its layout footprint, so it can't inflate the
       row-gap the way a margin would. */
    position: relative;
    top: 7px;
  }
  .whyICareIconGlyph {
    width: 44px;
    height: 44px;
    color: var(--purple);
  }
  .whyICareIconCaption {
    font-family: var(--font-heading);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--greyDark);
    white-space: nowrap;
  }

  /* "synaesthesia" — heading font, one Fisher-Price colour per letter,
     each letter's own opacity/transform driven by its own slice of the
     rainbow token's window (see t._letterWindows in App.svelte). */
  .whyICareRainbow {
    display: inline-block;
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: var(--text-h3, 30px);
    line-height: 1;
  }
  .whyICareLetter {
    display: inline-block;
  }
  .whyICareTail {
    color: var(--text);
    font-family: var(--font-body);
    font-weight: 400;
  }

  /* "What about you?" doorway — anchored to the bottom of the pinned
     scene (main fills .pinned's 100vh) with its own padding, rather than
     flowing below the passage above, so it always lands in the same
     place regardless of how tall the passage renders. */
  .whyICareCta {
    position: absolute;
    left: 50%;
    bottom: 48px;
    transform: translateX(-50%);
    width: calc(100% - 48px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
  }
  .whyICareCtaTitle {
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: var(--text-h3, 30px);
    margin: 0;
    color: var(--text);
  }
  .whyICareCtaBody {
    font-family: var(--font-body);
    font-size: var(--text-body, 19px);
    line-height: 1.5;
    margin: 0;
    color: var(--text);
  }
  .whyICareCtaButton {
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: var(--text-body, 16px);
    padding: 14px 28px;
    border-radius: 999px;
    background: var(--purple);
    color: #fff;
    text-decoration: none;
    pointer-events: auto;
  }
</style>
