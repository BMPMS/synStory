<script>
  // The Synaesthesia Battery Test — a standalone companion app to the
  // story (separate entry point, see test.html/test-main.js/vite.config.js),
  // sharing the story's own theme.js/global.css so it reads as the same
  // visual identity without being a route inside App.svelte.
  //
  // Fixed to iPhone SE proportions (portrait or landscape — see the
  // --phone-w/--phone-h media query below) with no further
  // responsiveness; on a wider (desktop) viewport it sits inside a
  // decorative phone-frame bezel on the story's own background instead
  // of stretching to fill the page.
  import {
    buildTrialSequence,
    scoreConsistency,
    describeConsistency,
    REPEATS_PER_GRAPHEME
  } from './lib/data/graphemeTest.js';

  let screen = $state('intro'); // 'intro' | 'instructions' | 'demo' | 'trial' | 'results'
  let name = $state('');

  let trialSequence = $state([]);
  let trialIndex = $state(0);
  /** @type {Record<string, string[]>} */
  let responsesByGrapheme = $state({});

  // Bryony: "make sure we show progress, time or whatever other best
  // practice... to incentivize people to finish — without overcrowding" —
  // recorded once when the trials begin, then used to derive a live
  // "~N min left" estimate from the subject's own actual pace so far
  // (rather than a guessed constant), and to surface a one-off
  // encouragement line at the quarter/half/three-quarter marks. Both
  // fold into the single existing progress line rather than adding new
  // UI elements.
  let testStartTime = $state(0);

  // Bryony: "could we have one which shows the whole spectrum... I
  // suspect we can't suggest hues" — a hue/saturation WHEEL (white
  // centre, full colour at the rim, hue by angle) rather than the native
  // <input type="color"> picker, whose own UI varies by OS/browser (the
  // plain slider she got on macOS Safari isn't the same polished wheel
  // iOS shows). Built by hand so it's one consistent, on-brand widget
  // everywhere, and so the starting position is always dead centre —
  // neutral, no colour suggested — every single trial.
  let hue = $state(0); // 0-360
  let sat = $state(0); // 0-1, distance from centre
  let wheelEl = $state();
  let draggingWheel = false;

  // Bryony: "I'm not sure you can get a brown on the wheel?" — right:
  // with brightness pinned at 1 the wheel could only reach TINTS (white
  // blended with a hue), never the darker SHADES that browns, olives,
  // navy, maroon etc. actually are. Fixed with no second control and no
  // extra gesture: the same radius that used to carry only saturation
  // now carries the whole white -> pure hue -> black journey. Inner
  // half (t 0 - 0.5) is unchanged — white at centre fading into the
  // pure hue at the half-radius ring; outer half (t 0.5 - 1) is new —
  // that same pure hue darkening down to black at the rim. Still one
  // white, neutral starting point; still one drag. The one colour
  // family still out of reach is a true neutral grey short of black
  // itself, since every point on this path short of the very rim still
  // carries some of its hue.
  function hueRadiusToHex(h, t) {
    let s, v;
    if (t <= 0.5) {
      s = t / 0.5;
      v = 1;
    } else {
      s = 1;
      v = 1 - (t - 0.5) / 0.5;
    }
    const c = v * s;
    const hp = h / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r = 0,
      g = 0,
      b = 0;
    if (hp < 1) {
      r = c;
      g = x;
    } else if (hp < 2) {
      r = x;
      g = c;
    } else if (hp < 3) {
      g = c;
      b = x;
    } else if (hp < 4) {
      g = x;
      b = c;
    } else if (hp < 5) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }
    const m = v - c;
    const toByte = (channel) => Math.round((channel + m) * 255);
    return '#' + [r, g, b].map((channel) => toByte(channel).toString(16).padStart(2, '0')).join('');
  }

  let currentColor = $derived(hueRadiusToHex(hue, sat));

  // Shared by the real wheel's thumb and the demo wheel's animated one
  // below — same hue/radius -> on-screen-position maths either way.
  function hueRadiusToXYPercent(h, t) {
    const rad = (h * Math.PI) / 180;
    return { x: Math.sin(rad) * t * 50, y: -Math.cos(rad) * t * 50 };
  }
  const thumbPos = $derived.by(() => hueRadiusToXYPercent(hue, sat));

  function resetWheel() {
    hue = 0;
    sat = 0;
  }

  function updateFromWheelEvent(e) {
    const rect = wheelEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const radius = rect.width / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    sat = Math.min(1, dist / radius);
    hue = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  }
  function onWheelPointerDown(e) {
    draggingWheel = true;
    wheelEl.setPointerCapture(e.pointerId);
    updateFromWheelEvent(e);
  }
  function onWheelPointerMove(e) {
    if (draggingWheel) updateFromWheelEvent(e);
  }
  function onWheelPointerUp() {
    draggingWheel = false;
  }

  // Keyboard access to the wheel — left/right rotate hue, up/down move
  // in/out (saturation), shift for bigger steps.
  function onWheelKeyDown(e) {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft') {
      hue = (hue - step + 360) % 360;
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      hue = (hue + step) % 360;
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      sat = Math.min(1, sat + 0.05);
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      sat = Math.max(0, sat - 0.05);
      e.preventDefault();
    }
  }

  // Bryony: "a quick demo before you start... show the cursor moving,
  // walk through what they do" — a scripted, non-interactive playback
  // on its own screen between the instructions and the real trials: the
  // wheel's own thumb animates itself out from the neutral centre to a
  // worked example ("for me A is like a deep orangey yellow"), using
  // the exact same hue/radius -> colour and -> position maths as a real
  // drag, so what's demonstrated is genuinely how it behaves.
  const DEMO_LETTER = 'A';
  const DEMO_TARGET_HUE = 42; // an orangey yellow
  const DEMO_TARGET_RADIUS = 0.68; // "deep" — into the darkening outer half
  let demoHue = $state(0);
  let demoSat = $state(0);
  let demoAnimFrame = null;

  function runDemoAnimation() {
    const durationMs = 1600;
    const start = performance.now();
    function tick(now) {
      const raw = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - raw, 3); // ease-out — settles in like a real drag
      demoHue = DEMO_TARGET_HUE * eased;
      demoSat = DEMO_TARGET_RADIUS * eased;
      demoAnimFrame = raw < 1 ? requestAnimationFrame(tick) : null;
    }
    demoAnimFrame = requestAnimationFrame(tick);
  }

  $effect(() => {
    if (screen === 'demo') {
      demoHue = 0;
      demoSat = 0;
      runDemoAnimation();
    }
    return () => {
      if (demoAnimFrame) cancelAnimationFrame(demoAnimFrame);
    };
  });

  let demoColor = $derived(hueRadiusToHex(demoHue, demoSat));
  const demoThumbPos = $derived.by(() => hueRadiusToXYPercent(demoHue, demoSat));

  let results = $state(null); // { perGrapheme, overallScore } once scored

  const totalTrials = () => trialSequence.length;
  const currentGrapheme = $derived(trialSequence[trialIndex]);
  const trialNumber = $derived(trialIndex + 1);

  // Recomputed fresh each time trialIndex changes (that read is what
  // makes this reactive) from the subject's OWN average pace so far —
  // not a guessed constant — so it gets more accurate as the test goes
  // on. Needs a couple of completed trials before it's stable enough to
  // show; before that it's just null and the plain count shows instead.
  let remainingTimeLabel = $derived.by(() => {
    if (trialIndex < 3) return null;
    const elapsedMs = Date.now() - testStartTime;
    const avgMsPerTrial = elapsedMs / trialIndex;
    const remainingTrials = totalTrials() - trialIndex;
    const remainingMs = avgMsPerTrial * remainingTrials;
    const mins = Math.round(remainingMs / 60000);
    if (mins <= 0) return 'less than a minute left';
    if (mins === 1) return '~1 min left';
    return `~${mins} min left`;
  });

  // A one-off encouragement at the quarter marks, shown in place of the
  // usual count for just that single trial — a nudge to keep going
  // without adding any new UI of its own.
  let milestoneLabel = $derived.by(() => {
    const total = totalTrials();
    if (!total) return null;
    if (trialNumber === Math.round(total * 0.25)) return 'Quarter of the way there';
    if (trialNumber === Math.round(total * 0.5)) return 'Halfway there';
    if (trialNumber === Math.round(total * 0.75)) return 'Three-quarters done — nearly there';
    return null;
  });

  let progressLabel = $derived(
    milestoneLabel ??
      `${trialNumber} / ${totalTrials()}${remainingTimeLabel ? ' · ' + remainingTimeLabel : ''}`
  );

  function startInstructions() {
    if (!name.trim()) return;
    screen = 'instructions';
  }

  function startTrials() {
    trialSequence = buildTrialSequence();
    trialIndex = 0;
    responsesByGrapheme = {};
    testStartTime = Date.now();
    resetWheel();
    screen = 'trial';
  }

  function nextTrial() {
    const grapheme = currentGrapheme;
    const existing = responsesByGrapheme[grapheme] || [];
    // Bryony: name/scores/email get real storage later — for now this
    // stays an in-memory object, but shaped exactly as that will need:
    // one array of responses per grapheme, keyed by the grapheme itself.
    responsesByGrapheme = { ...responsesByGrapheme, [grapheme]: [...existing, currentColor] };

    if (trialIndex + 1 >= totalTrials()) {
      results = scoreConsistency(responsesByGrapheme);
      screen = 'results';
    } else {
      trialIndex += 1;
      resetWheel();
    }
  }

  function restart() {
    screen = 'intro';
    trialSequence = [];
    trialIndex = 0;
    responsesByGrapheme = {};
    results = null;
  }
</script>

<div class="page">
  <div class="phoneScreen">
    {#if screen === 'intro'}
      <div class="screenContent introScreen">
        <h1 class="title">Synaesthesia Battery Test</h1>
        <p class="body">
          Do letters and numbers make you see colours? This short test checks how
          consistent your own colour associations are — the same test researchers use
          to study grapheme-colour synaesthesia.
        </p>
        <label class="fieldLabel" for="nameInput">Your name</label>
        <input
          id="nameInput"
          class="textInput"
          type="text"
          bind:value={name}
          placeholder="e.g. Bryony"
          onkeydown={(e) => e.key === 'Enter' && startInstructions()}
        />
        <button class="primaryButton" disabled={!name.trim()} onclick={startInstructions}>
          Continue
        </button>
      </div>
    {:else if screen === 'instructions'}
      <div class="screenContent">
        <h2 class="subtitle">How it works</h2>
        <p class="body">
          You'll see 36 letters and numbers, each shown {REPEATS_PER_GRAPHEME} times in a
          random order — 108 rounds in total.
        </p>
        <p class="body">
          For each one, pick whichever colour feels right. Don't overthink it, and it's
          completely fine if your answer changes between rounds — that's exactly what
          this measures.
        </p>
        <button class="primaryButton" onclick={() => (screen = 'demo')}>Start</button>
      </div>
    {:else if screen === 'demo'}
      <div class="screenContent demoScreen">
        <div class="screenChrome">
          <p class="demoLabel">Here's an example</p>
          <p class="colorHint demoQuote">"For me, {DEMO_LETTER} is like a deep orangey yellow."</p>
        </div>

        <div class="trialRow">
          <div class="colorWheel demoWheel" aria-hidden="true">
            <div
              class="wheelThumb"
              style="left: calc(50% + {demoThumbPos.x}%); top: calc(50% + {demoThumbPos.y}%); background: {demoColor}"
            ></div>
          </div>

          <div class="graphemeStage">
            <span class="grapheme" style="color: {demoColor}">{DEMO_LETTER}</span>
          </div>
        </div>

        <button class="primaryButton" onclick={startTrials}>Got it — start</button>
      </div>
    {:else if screen === 'trial'}
      <div class="screenContent trialScreen">
        <div class="screenChrome">
          <div class="progressTrack">
            <div class="progressFill" style="width: {(trialNumber / totalTrials()) * 100}%"></div>
          </div>
          <p class="progressLabel">{progressLabel}</p>
          <p class="colorHint">Tap or drag on the wheel to choose a colour</p>
        </div>

        <div class="trialRow">
          <div
            class="colorWheel"
            bind:this={wheelEl}
            onpointerdown={onWheelPointerDown}
            onpointermove={onWheelPointerMove}
            onpointerup={onWheelPointerUp}
            onpointercancel={onWheelPointerUp}
            onkeydown={onWheelKeyDown}
            role="slider"
            tabindex="0"
            aria-label="Choose a colour"
            aria-valuetext={currentColor}
            aria-valuenow={Math.round(hue)}
            aria-valuemin="0"
            aria-valuemax="360"
          >
            <div
              class="wheelThumb"
              style="left: calc(50% + {thumbPos.x}%); top: calc(50% + {thumbPos.y}%); background: {currentColor}"
            ></div>
          </div>

          <div class="graphemeStage">
            <span class="grapheme" style="color: {currentColor}">{currentGrapheme}</span>
          </div>
        </div>

        <button class="primaryButton" disabled={sat === 0} onclick={nextTrial}>
          {trialIndex + 1 >= totalTrials() ? 'Finish' : 'Next'}
        </button>
      </div>
    {:else if screen === 'results'}
      {@const band = describeConsistency(results.overallScore)}
      <div class="screenContent resultsScreen">
        <h2 class="subtitle">Nice work, {name}!</h2>
        <p class="scoreLabel">{band.label}</p>
        <p class="body">{band.detail}</p>

        <div class="swatchGrid">
          {#each results.perGrapheme as row (row.grapheme)}
            <div class="swatchCell">
              <span class="swatchGrapheme">{row.grapheme}</span>
              <div class="swatchTrio">
                {#each row.colors as color, i (i)}
                  <span class="swatchDot" style="background: {color}"></span>
                {/each}
              </div>
            </div>
          {/each}
        </div>

        <p class="footnote">
          This is a fun, informal version of the real test — not a diagnostic tool.
          Results aren't saved anywhere yet.
        </p>
        <button class="primaryButton" onclick={restart}>Try again</button>
      </div>
    {/if}
  </div>
</div>

<style>
  /* Bryony: "it needs to work on landscape as well — portrait if the
     height is there, otherwise landscape." This used to switch on
     `orientation: landscape` (pure width > height), which matches almost
     any desktop browser window too — those are nearly always wider than
     tall, even ones with plenty of vertical room to spare — so the
     "landscape" shape kept firing on desktop when it shouldn't have.
     Switching on available HEIGHT instead: the stacked (portrait) shape
     is used whenever there's enough height to show it properly — a phone
     held upright, a tablet in landscape, most desktop windows — and the
     side-by-side (landscape) shape only kicks in once height is
     genuinely scarce, around a real phone's rotated height or a desktop
     window resized short. One rule, works the same everywhere. */
  :root {
    --phone-w: 375px;
    --phone-h: 667px;
    /* Bryony: "the wheel should take up much more of the space...
       maximum space use please" — then "I want the wheel and letter to
       be bigger": sized as a share of the actual viewport height rather
       than a fixed guess, so it grows wherever more height is on offer
       (a taller phone, a tablet held upright, a roomy desktop window)
       while staying safely within range on a small phone. */
    --wheelSize: clamp(220px, 34dvh, 340px);
  }
  @media (max-height: 520px) {
    :root {
      --phone-w: 667px;
      --phone-h: 375px;
      /* Landscape keeps the wheel and letter side by side, so width is
         ample here — height is the scarce resource by definition of
         this breakpoint, so the wheel is sized against it directly:
         bigger than before, still leaving room for the pinned-top
         chrome and the button below. */
      --wheelSize: clamp(200px, 50dvh, 300px);
    }
  }

  .page {
    min-height: 100dvh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--background);
  }

  .phoneScreen {
    position: relative;
    width: var(--phone-w);
    height: var(--phone-h);
    max-width: 100vw;
    max-height: 100dvh;
    overflow: hidden;
    background: var(--background);
  }

  /* Desktop-only decoration — a real iPhone SE viewport never reaches
     this width in either orientation, so this only ever fires when the
     page is being viewed on something bigger than the phone itself. */
  @media (min-width: 700px) {
    .page {
      padding: 48px;
      box-sizing: border-box;
    }
    .phoneScreen {
      border-radius: 46px;
      border: 12px solid var(--grey);
      box-shadow:
        0 40px 70px rgba(0, 0, 0, 0.32),
        0 0 0 2px rgba(0, 0, 0, 0.08);
    }
  }

  .screenContent {
    box-sizing: border-box;
    height: 100%;
    width: 100%;
    padding: 28px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
  }

  .title {
    font-family: var(--font-heading);
    font-size: var(--text-h3, 30px);
    margin: 12px 0 0;
    color: var(--text);
    text-align: center;
  }
  .subtitle {
    font-family: var(--font-heading);
    font-size: var(--text-lead, 24px);
    margin: 12px 0 0;
    color: var(--text);
  }
  .body {
    font-family: var(--font-body);
    font-size: var(--text-body, 16px);
    line-height: 1.5;
    margin: 0;
    color: var(--text);
  }

  .fieldLabel {
    font-family: var(--font-body);
    font-size: var(--text-caption, 14px);
    color: var(--text);
    margin-top: 8px;
  }
  .textInput {
    font-family: var(--font-body);
    font-size: var(--text-body, 16px);
    padding: 10px 12px;
    border-radius: 10px;
    border: 1.5px solid var(--grey);
    background: #fff;
    color: var(--text);
  }

  .primaryButton {
    margin-top: auto;
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: var(--text-body, 16px);
    padding: 14px 20px;
    border-radius: 999px;
    border: none;
    background: var(--purple);
    color: #fff;
    cursor: pointer;
  }
  .primaryButton:disabled {
    background: var(--grey);
    cursor: not-allowed;
  }

  /* --- trial screen (also used by the demo screen) --- */
  .trialScreen,
  .demoScreen {
    align-items: stretch;
  }

  /* The progress bar (trial screen) and the drag hint (both screens) —
     "instructions" Bryony wants at the top, out of the wheel's way. In
     portrait `display: contents` makes this wrapper invisible to layout,
     so its children just take their place at the top of the normal
     flex column, in document order, same as if there were no wrapper.
     The landscape override below is what actually changes behaviour. */
  .screenChrome {
    display: contents;
  }
  .progressTrack {
    height: 6px;
    border-radius: 3px;
    background: var(--backgroundTint);
    overflow: hidden;
  }
  .progressFill {
    height: 100%;
    background: var(--blue);
    transition: width 0.2s ease;
  }
  .progressLabel {
    font-family: var(--font-body);
    font-size: var(--text-caption, 14px);
    color: var(--grey);
    margin: 0;
  }

  /* Portrait: letter above, wheel below (Bryony: "portrait letter should
     be above, wheel below, maximum space use please") — the DOM order is
     always wheel-then-letter (unchanged, still what "keep it on the left"
     means in landscape below), so column-reverse is what flips it
     visually here without needing two different markups. Landscape
     switches back to a row — wheel on the left, letter on the right —
     per that earlier request. Either way both children share
     --wheelSize as an explicit size (not a % or an aspect-ratio
     auto-derivation flexbox could distort under crowding), so the wheel
     can never end up non-circular and the letter's box is guaranteed
     the same size as the wheel's, not just visually close to it. */
  .trialRow {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }
  .graphemeStage {
    flex: 0 0 var(--wheelSize);
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .grapheme {
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: calc(var(--wheelSize) * 0.72);
    line-height: 1;
    transition: color 0.1s ease;
    /* A pale/near-white pick is a perfectly valid answer on this wheel,
       but would otherwise vanish against the page's own warm-ivory
       background — a soft shadow keeps the glyph readable at every
       saturation without changing the colour it displays. */
    text-shadow:
      0 0 1px rgba(0, 0, 0, 0.25),
      0 2px 6px rgba(0, 0, 0, 0.12);
  }
  .colorWheel {
    flex-shrink: 0;
    width: var(--wheelSize);
    height: var(--wheelSize);
    border-radius: 50%;
    position: relative;
    touch-action: none;
    cursor: pointer;
    border: 1px solid var(--grey);
    /* White at the centre, the pure hue at half-radius, black at the
       rim — matching hueRadiusToHex() above exactly. Three flat layers:
       a black overlay fades in from half-radius to solid black at the
       edge (darkens the outer half only), a white overlay fades out
       over the inner half (whitens it, leaves the outer half alone),
       and the hue ring underneath is full-strength everywhere — the
       two overlays are what carve white -> hue -> black out of it. */
    background:
      radial-gradient(circle at center, rgba(0, 0, 0, 0) 50%, #000 100%),
      radial-gradient(circle at center, #fff 0%, rgba(255, 255, 255, 0) 50%),
      conic-gradient(from 0deg, red, yellow, lime, cyan, blue, magenta, red);
  }
  .wheelThumb {
    position: absolute;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 3px solid #fff;
    box-shadow:
      0 0 0 1.5px rgba(0, 0, 0, 0.35),
      0 1px 3px rgba(0, 0, 0, 0.25);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  .colorHint {
    font-family: var(--font-body);
    font-size: var(--text-caption, 14px);
    color: var(--text);
    text-align: center;
    margin: 0;
  }

  /* --- demo screen --- */
  .demoLabel {
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: var(--text-caption, 14px);
    color: var(--purple);
    text-align: center;
    margin: 0;
  }
  .demoQuote {
    font-style: italic;
  }
  .demoWheel {
    /* Playback only, not a real control — no drag handlers, so it
       shouldn't invite a click the way the real one does. */
    cursor: default;
  }

  /* Bryony: "adjust the proportions like this" (reference screenshots:
     wheel above the letter, progress chrome pinned to its own strip at
     the top) — for a roomy, wide-enough screen (desktop/tablet, real
     phone never reaches 700px wide in either orientation) show the
     wheel-then-letter DOM order top-to-bottom as-is (`column`, not
     portrait's own `column-reverse`, which is specifically for an
     actual portrait phone's "letter above, wheel below"), with the same
     pinned-top chrome strip the height-scarce breakpoint below also
     uses. Phone size and wheel size aren't touched here — they already
     come from the (now viewport-height-relative) :root values above, so
     they grow on their own wherever there's more height to give. */
  @media (min-width: 700px) {
    .trialScreen,
    .demoScreen {
      padding-top: 64px;
    }
    .screenChrome {
      display: flex;
      flex-direction: column;
      gap: 4px;
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      padding: 8px 24px 0;
      box-sizing: border-box;
    }
    .trialRow {
      flex-direction: column;
    }
  }

  /* Bryony: "it needs to work on landscape as well — portrait if the
     height is there, otherwise landscape." Placed AFTER the min-width
     block above so it wins the cascade whenever height is actually
     scarce, even on a wide/desktop-width window that's been resized
     short — "otherwise landscape" applies regardless of width. Also
     covers a real phone rotated: .screenChrome (the progress bar plus
     the drag hint on the trial screen, or the heading plus quote on the
     demo screen) comes out of the flex column entirely and sits as its
     own thin strip pinned to the very top of the phone frame, so none
     of it counts against the wheel/letter row's share of the available
     height. .trialScreen and .demoScreen get matching extra top padding
     so their own content starts below that strip instead of under it. */
  @media (max-height: 520px) {
    .trialScreen,
    .demoScreen {
      padding-top: 64px;
    }
    .screenChrome {
      display: flex;
      flex-direction: column;
      gap: 4px;
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      padding: 8px 24px 0;
      box-sizing: border-box;
    }
    .trialRow {
      flex-direction: row;
    }
    .graphemeStage {
      flex: 1;
      min-width: 0;
      width: auto;
      height: var(--wheelSize);
    }
  }

  /* --- results screen --- */
  .scoreLabel {
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: var(--text-lead, 24px);
    color: var(--purple);
    margin: 0;
  }
  .swatchGrid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 8px;
  }
  .swatchCell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .swatchGrapheme {
    font-family: var(--font-heading);
    font-size: var(--text-micro, 12px);
    color: var(--text);
  }
  .swatchTrio {
    display: flex;
    gap: 2px;
  }
  .swatchDot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .footnote {
    font-family: var(--font-body);
    font-size: var(--text-micro, 12px);
    color: var(--grey);
    margin: 0;
  }
</style>
