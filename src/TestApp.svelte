<script>
  // Standalone battery-test app; shares the story's theme.js/global.css.
  // Fixed to iPhone SE proportions; desktop gets a decorative phone bezel.
  import {
    buildTrialSequence,
    scoreConsistency,
    describeConsistency,
    REPEATS_PER_GRAPHEME
  } from './lib/data/graphemeTest.js';
  import { supabase, supabaseConfigured } from './lib/supabase.js';

  let screen = $state('intro'); // 'intro' | 'instructions' | 'demo' | 'trial' | 'results'
  let name = $state('');
  // No email/account — honour system instead, so there's nothing
  // personally identifying to store (and no GDPR hassle). Repeating the
  // test soon after a previous go mostly measures memory of your own
  // past answers, not genuine colour association, so this just asks and
  // warns rather than trying to technically enforce anything.
  let hasTakenBefore = $state(null); // null (unanswered) | true | false
  let saveState = $state('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  let aggregate = $state(null); // { count, avgScore } once fetched, for the results footnote
  let shareState = $state('idle'); // 'idle' | 'copied' — only used by the clipboard fallback below

  let trialSequence = $state([]);
  let trialIndex = $state(0);
  /** @type {Record<string, string[]>} */
  let responsesByGrapheme = $state({});

  // Trial start time, used to derive a live "~N min left" estimate.
  let testStartTime = $state(0);

  // Hand-built hue/saturation wheel, not native <input type="color">,
  // so it's consistent across browsers and starts neutral each trial.
  let hue = $state(0); // 0-360
  let sat = $state(0); // 0-1, distance from centre
  let wheelEl = $state();
  let draggingWheel = false;

  // Bug fix: fixed brightness=1 meant no shades (browns, navy) were
  // reachable. Radius now carries white -> hue -> black in one drag:
  // inner half tints, outer half shades. True neutral grey still unreachable.
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

  // Shared by the real wheel's thumb and the demo wheel's animated one.
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

  // Keyboard access: left/right rotate hue, up/down move saturation.
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

  // Scripted demo: thumb animates from neutral centre to a worked example.
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
      const eased = 1 - Math.pow(1 - raw, 3); // ease-out, settles like a real drag
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

  // Recomputed from the subject's own average pace, more accurate over time.
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

  // One-off encouragement at quarter marks, replacing the usual count.
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
    if (!name.trim() || hasTakenBefore === null) return;
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
    // In-memory for now; shaped for real storage later (per grapheme).
    responsesByGrapheme = { ...responsesByGrapheme, [grapheme]: [...existing, currentColor] };

    if (trialIndex + 1 >= totalTrials()) {
      results = scoreConsistency(responsesByGrapheme);
      screen = 'results';
      saveResults();
    } else {
      trialIndex += 1;
      resetWheel();
    }
  }

  // Persists the finished attempt — fully anonymous, just a score and the
  // per-grapheme colour picks, nothing identifying anyone.
  async function saveResults() {
    if (!supabaseConfigured) return;
    saveState = 'saving';
    const { error } = await supabase
      .from('attempts')
      .insert({ overall_score: results.overallScore, per_grapheme: results.perGrapheme });
    saveState = error ? 'error' : 'saved';
    if (!error) fetchAggregate();
  }

  // Anonymous aggregate across everyone's attempts (the attempts table has
  // no email/name on it at all), just for a "you're one of N" footnote.
  async function fetchAggregate() {
    const { data, error } = await supabase.from('attempts').select('overall_score');
    if (error || !data || !data.length) return;
    const avgScore = data.reduce((sum, row) => sum + Number(row.overall_score), 0) / data.length;
    aggregate = { count: data.length, avgScore };
  }

  // Native share sheet (iOS/Android/most mobile browsers) where it's
  // available — which is the common case here, since this app is phone-
  // shaped to begin with. Falls back to copying the same text + link, for
  // desktop browsers that don't support navigator.share. Shares the band
  // label only (e.g. "highly consistent"), never the score or the actual
  // colour picks.
  function shareResult(bandLabel) {
    const text = `I just found out I'm a "${bandLabel.toLowerCase()}" letters + numbers → colour synaesthete (or not!) according to this quick colour test — curious what you'd get?`;
    const url = `${window.location.origin}/test.html`;
    if (navigator.share) {
      navigator.share({ title: 'Synaesthesia Battery Test', text, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(`${text} ${url}`);
      shareState = 'copied';
      setTimeout(() => {
        shareState = 'idle';
      }, 2500);
    }
  }

  // Enter/Return finishes a trial the same as clicking Next/Finish —
  // only once a colour's actually been chosen (sat === 0 means the wheel
  // is still at its untouched neutral centre), matching the button's own
  // disabled condition below. Global rather than on the wheel itself, so
  // it works regardless of what has focus.
  function handleTrialKeydown(e) {
    if (screen !== 'trial' || e.key !== 'Enter' || sat === 0) return;
    e.preventDefault();
    nextTrial();
  }
</script>

<svelte:window onkeydown={handleTrialKeydown} />

<div class="page">
  <div class="phoneScreen">
    {#if screen === 'intro'}
      <div class="screenContent introScreen">
        <h1 class="title">Synaesthesia Battery Test</h1>
        <p class="body">
          Do letters and numbers make you see colours? This short test checks how
          consistent your own colour associations are — the same test researchers use
          to study <strong>letters + numbers → colour</strong> synaesthesia.
        </p>
        <a class="storyLink" href="/">Read the story behind this test →</a>
        <label class="fieldLabel" for="nameInput">Your name</label>
        <input
          id="nameInput"
          class="textInput"
          type="text"
          bind:value={name}
          placeholder="e.g. Bryony"
          onkeydown={(e) => e.key === 'Enter' && startInstructions()}
        />
        <span class="fieldLabel">Have you taken this test before?</span>
        <div class="toggleGroup" role="radiogroup" aria-label="Have you taken this test before?">
          <button
            type="button"
            class="toggleButton"
            class:toggleButtonActive={hasTakenBefore === false}
            aria-pressed={hasTakenBefore === false}
            onclick={() => (hasTakenBefore = false)}
          >
            No, first time
          </button>
          <button
            type="button"
            class="toggleButton"
            class:toggleButtonActive={hasTakenBefore === true}
            aria-pressed={hasTakenBefore === true}
            onclick={() => (hasTakenBefore = true)}
          >
            Yes, I have
          </button>
        </div>
        {#if hasTakenBefore}
          <p class="fieldHint">
            This measures how <em>consistent</em> your colour choices are — if you
            remember your old answers you'll likely just repeat them instead of
            reacting freshly, which inflates the score. For a meaningful result,
            leave at least <strong>6 months</strong> between attempts.
          </p>
        {/if}
        <button
          class="primaryButton"
          disabled={!name.trim() || hasTakenBefore === null}
          onclick={startInstructions}
        >
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

        <button class="primaryButton" onclick={() => (screen = 'confirmStart')}>
          Got it — start
        </button>
      </div>
    {:else if screen === 'confirmStart'}
      <div class="screenContent">
        <h2 class="subtitle">One thing before you start</h2>
        <p class="body">
          This takes at least 5 minutes — 108 rounds, start to finish, with no way
          to pause partway through. Worth making sure you've got the time before
          you dive in.
        </p>
        <button class="primaryButton" onclick={startTrials}>Yes, I'm ready</button>
        <button
          class="secondaryButton"
          type="button"
          onclick={() => (screen = 'instructions')}
        >
          Not yet
        </button>
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
        <p class="keyHint">or press Return</p>
      </div>
    {:else if screen === 'results'}
      {@const band = describeConsistency(results.overallScore)}
      <div class="screenContent resultsScreen">
        <h2 class="subtitle">Nice work, {name}!</h2>
        <p class="scoreLabel">{band.label}</p>
        <p class="body">
          {band.detailBefore}{#if band.detailBold}<strong>{band.detailBold}</strong>{/if}{band.detailAfter}
        </p>

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
        </p>
        {#if supabaseConfigured}
          {#if saveState === 'saved' && aggregate}
            <p class="footnote">
              Saved — you're one of {aggregate.count} people who've taken this so far
              (average score {aggregate.avgScore.toFixed(1)}).
            </p>
          {:else if saveState === 'saved'}
            <p class="footnote">Saved — thanks for taking part.</p>
          {:else if saveState === 'error'}
            <p class="footnote">
              Your result couldn't be saved (connection issue) — everything above is
              still accurate for you.
            </p>
          {:else}
            <p class="footnote">Saving your result…</p>
          {/if}
        {:else}
          <p class="footnote">Results aren't saved anywhere yet.</p>
        {/if}

        <button class="secondaryButton" type="button" onclick={() => shareResult(band.label)}>
          Share your result
        </button>
        {#if shareState === 'copied'}
          <p class="fieldHint">Copied — paste it anywhere!</p>
        {/if}

        <a class="storyLink" href="/">Read the story behind this test →</a>
      </div>
    {/if}
  </div>
</div>

<style>
  /* Bug fix: `orientation: landscape` (width>height) fired on nearly every
     desktop window regardless of actual height. Switched to max-height so
     portrait shows whenever height allows, landscape only when height is
     genuinely scarce — same rule everywhere, per Bryony. */
  :root {
    --phone-w: 375px;
    --phone-h: 667px;
    /* Wheel sized off viewport height so it grows with available space. */
    --wheelSize: clamp(220px, 34dvh, 340px);
  }
  @media (max-height: 520px) {
    :root {
      --phone-w: 667px;
      --phone-h: 375px;
      /* Width is ample in landscape; wheel sized directly off height instead. */
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

  /* Desktop-only: a real iPhone SE viewport never reaches this width. */
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
  .fieldHint {
    font-family: var(--font-body);
    font-size: var(--text-micro, 12px);
    color: var(--grey);
    margin: 2px 0 0;
  }
  .storyLink {
    font-family: var(--font-body);
    font-size: var(--text-caption, 14px);
    color: var(--purple);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .secondaryButton {
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: var(--text-body, 16px);
    padding: 10px 20px;
    border-radius: 999px;
    border: none;
    background: transparent;
    color: var(--greyDark);
    text-decoration: underline;
    cursor: pointer;
  }
  .keyHint {
    font-family: var(--font-body);
    font-size: var(--text-micro, 12px);
    color: var(--grey);
    text-align: center;
    margin: -8px 0 0;
  }
  .toggleGroup {
    display: flex;
    gap: 8px;
  }
  .toggleButton {
    flex: 1;
    font-family: var(--font-body);
    font-size: var(--text-caption, 14px);
    padding: 10px 12px;
    border-radius: 10px;
    border: 1.5px solid var(--grey);
    background: #fff;
    color: var(--text);
    cursor: pointer;
  }
  .toggleButtonActive {
    border-color: var(--purple);
    background: var(--purple);
    color: #fff;
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

  /* display: contents makes this wrapper invisible in portrait; the
     landscape override below is what actually repositions it. */
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

  /* column-reverse flips DOM order (wheel-then-letter) visually in portrait;
     landscape switches to a row. --wheelSize keeps both explicitly sized
     so the wheel stays circular under crowding. */
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
    /* Soft shadow keeps pale colours readable against the warm-ivory bg. */
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
    /* Matches hueRadiusToHex(): white/black overlays carve the hue ring
       into white -> hue -> black, inner/outer half respectively. */
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
    /* Playback only, no drag handlers — shouldn't invite a click. */
    cursor: default;
  }

  /* Desktop/tablet: wheel-then-letter top-to-bottom (`column`), chrome
     pinned to its own top strip, per Bryony's reference screenshots. */
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

  /* Placed after min-width block so it wins the cascade whenever height
     is scarce, regardless of width — covers a real phone rotated too. */
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
