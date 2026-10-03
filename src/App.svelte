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
  // Touch screens (no hover) are told to click instead of hover.
  let touchOnly = $state(false);

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
      { type: 'word', text: 'a', breakAfter: true },
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
      { type: 'phrase', text: 'Synaesthesia Battery Test.' }
    ],
    [
      { type: 'word', text: 'She' },
      { type: 'word', text: 'was' },
      { type: 'word', text: 'a' },
      { type: 'word', text: 'confirmed' },
      { type: 'phrase', text: 'grapheme-colour' },
      { type: 'word', text: 'synaesthete' },
      { type: 'italic', text: '(still is).' }
    ]
  ];

  // Bryony: this layout is the one she likes, so every line is fixed: each
  // passage is split into explicit lines (a token with breakAfter ends a
  // line), and a line never wraps. Instead the whole block is scaled down
  // (whyICareScale, below) until its widest line fits the screen.
  const whyICareLines = whyICareParagraphs.map((tokens) => {
    const lines = [[]];
    tokens.forEach((t) => {
      lines[lines.length - 1].push(t);
      if (t.breakAfter) lines.push([]);
    });
    return lines;
  });
  let whyICareScale = $state(1);
  let whyICareOverlayEl;
  let whyICareCtaEl;

  // Gaps between the 3 passages, measured/verified in the icon-rebus
  // prototype: tight below the "synaesthesia" line, ~1.5 lines of body
  // text above "When she was 7...".
  // Bryony: slightly bigger gap above "When she was 7", and the SAME gap
  // between the end of the passage and "What about you?".
  const whyICareGap = 80;
  const whyICareMarginTop = [0, 13, whyICareGap, 13];

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
    const noHover = window.matchMedia('(hover: none)');
    touchOnly = noHover.matches;
    const onNoHoverChange = (e) => (touchOnly = e.matches);
    noHover.addEventListener('change', onNoHoverChange);

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

    // Scale the "Why do I care?" block so its widest line fits the width
    // and the whole block (plus the CTA) fits the height. Everything in it
    // is sized from --why-scale, so measured size / current scale = size
    // at scale 1. Never above 1; floored so it stays legible.
    function fitWhyICare() {
      const overlay = whyICareOverlayEl;
      const cta = whyICareCtaEl;
      if (!overlay || !cta) return;
      const s0 = whyICareScale || 1;
      let naturalWidth = 0;
      overlay.querySelectorAll('.whyICareLine').forEach((line) => {
        naturalWidth = Math.max(naturalWidth, line.getBoundingClientRect().width / s0);
      });
      const naturalHeight = overlay.getBoundingClientRect().height / s0;
      const availWidth = overlay.clientWidth;
      const scene = overlay.offsetParent ? overlay.offsetParent.clientHeight : window.innerHeight;
      const availHeight = scene - overlay.offsetTop - 48 - 24; // the CTA is inside the overlay now
      if (!naturalWidth || !naturalHeight) return;
      const next = Math.max(0.45, Math.min(1, availWidth / naturalWidth, availHeight / naturalHeight));
      if (Math.abs(next - s0) > 0.002) whyICareScale = next;
    }
    fitWhyICare();
    requestAnimationFrame(fitWhyICare);
    document.fonts?.ready.then(fitWhyICare);

    function handleResize() {
      scroller.resize();
      fitWhyICare();
    }
    window.addEventListener('resize', handleResize);

    return () => {
      noHover.removeEventListener('change', onNoHoverChange);
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
      <div class="whyICareOverlay" bind:this={whyICareOverlayEl} style="--why-scale: {whyICareScale}">
        {#each whyICareLines as lines, pi}
          <p class="whyICarePassage" style="margin-top: calc({whyICareMarginTop[pi]}px * var(--why-scale))">
            {#each lines as line}
            <span class="whyICareLine">
            {#each line as t}
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
            </span>
            {/each}
          </p>
        {/each}

        <!-- Bryony: "What about you?" doorway to the battery test — sits the
             same distance (whyICareGap) below the end of the passage as
             "When she was 7" sits below the rebus, so it follows the
             passage rather than the bottom of the screen. Fades in once the
             passage is essentially finished revealing (step12.cta). -->
        <div
          class="whyICareCta"
          bind:this={whyICareCtaEl}
          style="margin-top: calc({whyICareGap}px * var(--why-scale)); opacity: {phase(whyICareProgress, step12.cta.fadeIn.start, step12.cta.fadeIn.end)}"
        >
          <p class="whyICareCtaTitle">What about you?</p>
          <p class="whyICareCtaBody">Take the <strong>Synaesthesia Battery Test</strong> and find out.</p>
          <a class="whyICareCtaButton" href="/test.html">Start Test</a>
        </div>
      </div>

    </main>
  </div>

  <p class="progress-label">Step {activeIndex + 1} — {Math.round(stepProgress * 100)}%</p>

  <div class="step"></div>
  <div class="step"></div>
  <div class="step"></div>
  <div class="step"></div>
  <div class="step"></div>
  <!-- Step 6: "So what about our famous synaesthetes?" — captions scroll
       over a held scene (beats in step5 of steps.js, heights in
       .step--sight in global.css). -->
  <div class="step step--sight">
    <p class="stepText"><strong>Sight</strong> splits into 3 sub groups: <strong>colour</strong>, <strong>grapheme</strong>, <strong>shapes&nbsp;+&nbsp;objects</strong></p>
    <p class="stepText"><strong>Grapheme</strong> is the academic term for <strong>letters</strong>, <strong>numbers</strong>, <strong>symbols</strong> or <strong>words</strong></p>
    <p class="stepText">Some of our <strong>famous synaesthetes</strong> have only one relationship, others have several.</p>
  </div>
  <!-- Step 7: header swaps to "What are their sense → sense triggers?"; one
       caption tells people how to explore (wording follows the device —
       see touchOnly in <script>). Taller than a plain step so there's
       scroll left to hover around after the caption has passed. -->
  <div class="step step--hover">
    <p class="stepText">
      <strong>{touchOnly ? 'Click' : 'Hover'}</strong> {touchOnly ? 'on' : 'over'} the pictures to find out more.
      <span class="stepNote">There is not a quote for every sense → sense relationship</span>
    </p>
  </div>
  <div class="step step--captions-2">
    <p class="stepText">The <strong>publication history</strong> goes back over 200 years.<br /><br />The term <strong>synaesthesia</strong> was first used in 1892.</p>
    <p class="stepText">While <strong>sound → colour</strong> is the most popular relationship amongst our famous synaesthetes, <strong>grapheme → colour</strong> is the most documented and studied relationship.<br /><br />Let's focus on <strong>two recent publications</strong>.</p>
  </div>
  <div class="step step--captions-3">
    <p class="stepText">The study had 36 participants.<br /><br />50% <strong>grapheme-colour</strong> synaesthetes<br />50% <strong>controls</strong></p>
    <p class="stepText">They were shown letters, numbers and symbols while undergoing <strong>fMRI</strong> scanning.</p>
    <p class="stepText">Synaesthetes showed <strong>greater</strong> and <strong>more widespread</strong> brain activation in some interesting areas.</p>
  </div>
  <div class="step step--captions-4">
    <p class="stepText">Do you remember these <strong>Fisher Price Fridge Magnets</strong>? They were very popular in the US in the 80s and 90s.</p>
    <p class="stepText">This study worked with <strong>6,588 US residents</strong> who were proven <strong>grapheme-colour</strong> synaesthetes.</p>
    <p class="stepText">It found that 6% had <strong>grapheme-colour</strong> pairings matching at least 10 of the <strong>Fisher Price Fridge Magnets</strong>.</p>
    <p class="stepText">This association gets even stronger for participants born in the <strong>peak popularity</strong> period (<strong>1975 to 1980</strong>).</p>
    <p class="stepText">One participant matched 25 out of 26 letters.</p>
  </div>
  <div class="step">
    <p class="stepText">The evidence suggests that some synaesthetes develop and consolidate their <strong>grapheme → colour</strong> associations in <strong>early childhood</strong>.<br /><br />There was another study using different stimuli in 2019 <span class="stepAside">(Root, Dobkins, Ramachandran, Rouw)</span> which confirmed this theory further.</p>
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
    flex-direction: column;
    align-items: center;
    row-gap: calc(8px * var(--why-scale, 1));
    margin: 0;
    /* Everything below is sized from --why-scale (set from JS in App's
       fitWhyICare), so the block shrinks as one on narrow screens. */
    font-size: calc(var(--text-body, 19px) * var(--why-scale, 1));
  }
  /* A line never wraps (Bryony's fixed layout); it is as wide as its own
     content, and the scale above is what makes that fit the screen. */
  .whyICareLine {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: center;
    column-gap: 0.4em;
    width: max-content;
    white-space: nowrap;
  }

  .whyICareToken {
    font-family: var(--font-body);
  }
  .whyICareWord {
    font-size: 1em;
    line-height: 1.3;
    color: var(--text);
  }
  .whyICareItalic {
    font-size: 1em;
    line-height: 1.3;
    font-style: italic;
    color: var(--text);
  }
  .whyICarePhrase {
    font-size: 1em;
    font-weight: 700;
    line-height: 1.3;
    color: var(--text);
  }

  .whyICareIconToken {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: calc(2px * var(--why-scale, 1));
    margin: 0 0.15em;
    /* Visual-only nudge: `position: relative` shifts the rendered box
       without adding to its layout footprint, so it can't inflate the
       row-gap the way a margin would. */
    position: relative;
    top: calc(7px * var(--why-scale, 1));
  }
  .whyICareIconGlyph {
    width: calc(44px * var(--why-scale, 1));
    height: calc(44px * var(--why-scale, 1));
    color: var(--purple);
  }
  .whyICareIconCaption {
    font-family: var(--font-heading);
    font-size: calc(11px * var(--why-scale, 1));
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
    /* Bryony: same size as the rest of the passage ("When she was 7"). */
    font-size: 1em;
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

  /* "What about you?" doorway — flows straight after the passage (it is
     inside .whyICareOverlay), spaced by the same gap as "When she was 7". */
  .whyICareCta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
  }
  .whyICareCtaTitle {
    font-family: var(--font-heading);
    font-weight: 600;
    /* Bryony: match the main chart's own responsive section-title size
       (Math.max(18, Math.min(28, width*0.036)) in ChartSvg.svelte) rather
       than a fixed --text-h3. */
    font-size: clamp(18px, 3.6vw, 28px);
    margin: 0;
    color: var(--text);
  }
  .whyICareCtaBody {
    font-family: var(--font-body);
    /* Bryony: same size as the passage text above ("When she was 7"),
       so it shrinks with it on small screens. */
    font-size: calc(var(--text-body, 19px) * var(--why-scale, 1));
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
