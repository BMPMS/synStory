<script>
  // Standalone battery-test app; shares the story's theme.js/global.css.
  // Fixed to iPhone SE proportions; desktop gets a decorative phone bezel.
  import {
    buildTrialSequence,
    scoreConsistency,
    describeConsistency,
    describeLowVariety,
    buildSpeedTrials,
    isSpeedAnswerCorrect,
    scoreSpeed,
    SPEED_OPTIONS,
    REPEATS_PER_GRAPHEME
  } from './lib/data/graphemeTest.js';
  import { renderShareCard } from './lib/shareCard.js';
  const SHARE_URL = 'https://bmpms.github.io/synStory/test';
  import { supabase, supabaseConfigured } from './lib/supabase.js';

  let screen = $state('intro'); // 'intro' | 'instructions' | 'demo' | 'confirmStart' | 'trial' | 'speedIntro' | 'speed' | 'results'
  let name = $state('');
  // No email/account — honour system instead, so there's nothing
  // personally identifying to store (and no GDPR hassle). Repeating the
  // test soon after a previous go mostly measures memory of your own
  // past answers, not genuine colour association, so this just asks and
  // warns rather than trying to technically enforce anything.
  let hasTakenBefore = $state(null); // null (unanswered) | true | false
  let saveState = $state('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  let aggregate = $state(null); // { count, avgScore } once fetched, for the results footnote
  let shareState = $state('idle'); // 'idle' | 'working' | 'copied' | 'saved'

  let trialSequence = $state([]);
  let trialIndex = $state(0);
  /** @type {Record<string, string[]>} */
  let responsesByGrapheme = $state({});


  // Hand-built colour picker (not native <input type="color">, so it's
  // consistent across browsers): a saturation/brightness square plus a hue
  // bar, like the official Synaesthesia Battery's. Left edge of the square
  // is the greys (white at the top to black at the bottom), so every colour
  // is reachable. Starts neutral (white) each trial.
  let hue = $state(0); // 0-360, from the hue bar
  let sat = $state(0); // 0-1, left to right across the square
  let val = $state(1); // 0-1, bottom to top of the square
  let touched = $state(false); // has the square been used this trial?
  let squareEl = $state();
  let hueEl = $state();
  let greyEl = $state();
  let draggingSquare = false;
  let draggingHue = false;
  let draggingGrey = false;

  function hsvToHex(h, s, v) {
    const c = v * s;
    const hp = (h % 360) / 60;
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

  let currentColor = $derived(hsvToHex(hue, sat, val));

  function resetPicker() {
    hue = 0;
    sat = 0;
    val = 1;
    touched = false;
  }

  const clamp01 = (n) => Math.min(1, Math.max(0, n));

  function updateFromSquareEvent(e) {
    const rect = squareEl.getBoundingClientRect();
    sat = clamp01((e.clientX - rect.left) / rect.width);
    val = 1 - clamp01((e.clientY - rect.top) / rect.height);
    touched = true;
  }
  function onSquarePointerDown(e) {
    draggingSquare = true;
    squareEl.setPointerCapture(e.pointerId);
    updateFromSquareEvent(e);
  }
  function onSquarePointerMove(e) {
    if (draggingSquare) updateFromSquareEvent(e);
  }
  function onSquarePointerUp() {
    draggingSquare = false;
  }

  function updateFromHueEvent(e) {
    const rect = hueEl.getBoundingClientRect();
    hue = clamp01((e.clientY - rect.top) / rect.height) * 359.99;
  }
  function onHuePointerDown(e) {
    draggingHue = true;
    hueEl.setPointerCapture(e.pointerId);
    updateFromHueEvent(e);
  }
  function onHuePointerMove(e) {
    if (draggingHue) updateFromHueEvent(e);
  }
  function onHuePointerUp() {
    draggingHue = false;
  }

  // Tone slider (white -> black), like the official picker's: picks a pure
  // grey, which is the square's left edge, so it simply sets sat to 0.
  function updateFromGreyEvent(e) {
    const rect = greyEl.getBoundingClientRect();
    sat = 0;
    val = 1 - clamp01((e.clientX - rect.left) / rect.width);
    touched = true;
  }
  function onGreyPointerDown(e) {
    draggingGrey = true;
    greyEl.setPointerCapture(e.pointerId);
    updateFromGreyEvent(e);
  }
  function onGreyPointerMove(e) {
    if (draggingGrey) updateFromGreyEvent(e);
  }
  function onGreyPointerUp() {
    draggingGrey = false;
  }
  function onGreyKeyDown(e) {
    const step = e.shiftKey ? 0.1 : 0.03;
    if (e.key === 'ArrowLeft') val = clamp01((sat === 0 ? val : 1) + step);
    else if (e.key === 'ArrowRight') val = clamp01((sat === 0 ? val : 1) - step);
    else return;
    sat = 0;
    touched = true;
    e.preventDefault();
  }

  // Keyboard access: arrows move the square's thumb (shift = bigger steps);
  // up/down on the hue bar moves the hue.
  function onSquareKeyDown(e) {
    const step = e.shiftKey ? 0.1 : 0.03;
    if (e.key === 'ArrowLeft') sat = clamp01(sat - step);
    else if (e.key === 'ArrowRight') sat = clamp01(sat + step);
    else if (e.key === 'ArrowUp') val = clamp01(val + step);
    else if (e.key === 'ArrowDown') val = clamp01(val - step);
    else return;
    touched = true;
    e.preventDefault();
  }
  function onHueKeyDown(e) {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') hue = (hue - step + 360) % 360;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') hue = (hue + step) % 360;
    else return;
    e.preventDefault();
  }

  // Scripted demo: the thumbs animate from neutral to a worked example.
  const DEMO_LETTER = 'A';
  const DEMO_TARGET_HUE = 42; // an orangey yellow
  const DEMO_TARGET_SAT = 1;
  const DEMO_TARGET_VAL = 0.64; // "deep" — darkened
  let demoHue = $state(0);
  let demoSat = $state(0);
  let demoVal = $state(1);
  let demoAnimFrame = null;

  function runDemoAnimation() {
    const durationMs = 1600;
    const start = performance.now();
    function tick(now) {
      const raw = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - raw, 3); // ease-out, settles like a real drag
      demoHue = DEMO_TARGET_HUE * eased;
      demoSat = DEMO_TARGET_SAT * eased;
      demoVal = 1 - (1 - DEMO_TARGET_VAL) * eased;
      demoAnimFrame = raw < 1 ? requestAnimationFrame(tick) : null;
    }
    demoAnimFrame = requestAnimationFrame(tick);
  }

  $effect(() => {
    if (screen === 'demo') {
      demoHue = 0;
      demoSat = 0;
      demoVal = 1;
      runDemoAnimation();
    }
    return () => {
      if (demoAnimFrame) cancelAnimationFrame(demoAnimFrame);
    };
  });

  let demoColor = $derived(hsvToHex(demoHue, demoSat, demoVal));

  let results = $state(null); // { perGrapheme, overallScore } once scored

  const totalTrials = () => trialSequence.length;
  const currentGrapheme = $derived(trialSequence[trialIndex]);
  const trialNumber = $derived(trialIndex + 1);

  // One-off encouragement at quarter marks, replacing the usual count.
  let milestoneLabel = $derived.by(() => {
    const total = totalTrials();
    if (!total) return null;
    if (trialNumber === Math.round(total * 0.25)) return 'Quarter of the way there';
    if (trialNumber === Math.round(total * 0.5)) return 'Halfway there';
    if (trialNumber === Math.round(total * 0.75)) return 'Three-quarters done — nearly there';
    return null;
  });

  // No "~N min left" estimate: it only counted the colour rounds, so it said
  // "less than a minute left" with the whole speed test still to come.
  let progressLabel = $derived(milestoneLabel ?? `${trialNumber} / ${totalTrials()}`);

  function startInstructions() {
    if (!name.trim() || hasTakenBefore !== false) return;
    screen = 'instructions';
  }

  function startTrials() {
    trialSequence = buildTrialSequence();
    trialIndex = 0;
    responsesByGrapheme = {};
    resetPicker();
    screen = 'trial';
  }

  function nextTrial() {
    const grapheme = currentGrapheme;
    const existing = responsesByGrapheme[grapheme] || [];
    // In-memory for now; shaped for real storage later (per grapheme).
    responsesByGrapheme = { ...responsesByGrapheme, [grapheme]: [...existing, currentColor] };

    if (trialIndex + 1 >= totalTrials()) {
      results = scoreConsistency(responsesByGrapheme);
      // The colour test is done and saved; the speed test follows, then
      // the combined results screen.
      // A guard-tripped result (all one colour) isn't saved, so it can't skew
      // the average everyone else is compared to.
      if (!results.lowVariety) saveResults();
      screen = 'speedIntro';
    } else {
      trialIndex += 1;
      resetPicker();
    }
  }

  // --- Speed congruency test ---
  /** @type {{grapheme: string, options: string[], correctIndex: number}[]} */
  let speedTrials = $state([]);
  let speedIndex = $state(0);
  let speedShownAt = 0;
  let speedAnswers = [];
  let speedResults = $state(null); // { total, correctCount, accuracy, medianMs }

  const currentSpeedTrial = $derived(speedTrials[speedIndex]);

  function showSpeedTrial() {
    // Start the clock once the swatches have actually been painted.
    requestAnimationFrame(() => requestAnimationFrame(() => (speedShownAt = performance.now())));
  }

  function startSpeedTest() {
    speedTrials = buildSpeedTrials(responsesByGrapheme);
    speedIndex = 0;
    speedAnswers = [];
    screen = 'speed';
    showSpeedTrial();
  }

  function answerSpeed(clickedIndex) {
    if (screen !== 'speed' || !currentSpeedTrial) return;
    const rt = performance.now() - speedShownAt;
    speedAnswers.push({
      grapheme: currentSpeedTrial.grapheme,
      correct: isSpeedAnswerCorrect(currentSpeedTrial, clickedIndex),
      rt
    });
    if (speedIndex + 1 >= speedTrials.length) {
      speedResults = scoreSpeed(speedAnswers);
      screen = 'results';
    } else {
      speedIndex += 1;
      showSpeedTrial();
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

  // Shares a square picture of the person's own colours (see shareCard.js)
  // plus the link. Uses the native share sheet with the image attached where
  // the browser supports files (most phones); otherwise downloads the PNG so
  // it can be posted or emailed by hand. If the image can't be drawn, falls
  // back to sharing text only. No name, score or raw picks are ever included.
  async function shareResult(bandLabel, perGrapheme, lowVariety) {
    // Always the public address, so a share made while testing locally still
    // points somewhere real.
    const url = SHARE_URL;
    const intro = 'I just took a Synaesthesia Battery Test. What would yours say?';
    const text = `${intro} ${url}`;
    // Where we control the clipboard, paste gives a real link in an email or
    // doc (the native share sheet only takes plain text).
    const copyLink = async () => {
      const html = `${intro} <a href="${url}">${url}</a>`;
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' })
          })
        ]);
      } catch {
        await navigator.clipboard?.writeText(text).catch(() => {});
      }
    };
    shareState = 'working';
    let file = null;
    try {
      const blob = await renderShareCard(
        perGrapheme,
        bandLabel,
        SHARE_URL.replace(/^https?:\/\//, '')
      );
      file = new File([blob], 'my-alphabet-in-colour.png', { type: 'image/png' });
    } catch {
      file = null;
    }

    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        shareState = 'idle';
        return;
      }
      if (file) {
        const href = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = href;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 1000);
        // The picture can't carry a clickable link, so put one on the clipboard.
        copyLink();
        shareState = 'saved';
      } else if (navigator.share) {
        await navigator.share({ title: 'Synaesthesia Battery Test', text });
        shareState = 'idle';
        return;
      } else if (navigator.clipboard) {
        await copyLink();
        shareState = 'copied';
      } else {
        shareState = 'idle';
        return;
      }
    } catch {
      // Share sheet dismissed — nothing to report.
      shareState = 'idle';
      return;
    }
    setTimeout(() => {
      shareState = 'idle';
    }, 3500);
  }

  // Enter/Return finishes a trial the same as clicking Next/Finish —
  // only once a colour's actually been chosen (the square has been used),
  // matching the button's own disabled condition below. Global rather than on the wheel itself, so
  // it works regardless of what has focus.
  function handleTrialKeydown(e) {
    // Speed test: keys 1-6 pick the swatches left to right, top to bottom.
    if (screen === 'speed') {
      const n = Number(e.key);
      if (n >= 1 && n <= (currentSpeedTrial?.options.length ?? 0)) {
        e.preventDefault();
        answerSpeed(n - 1);
      }
      return;
    }
    if (screen !== 'trial' || e.key !== 'Enter' || !touched) return;
    e.preventDefault();
    nextTrial();
  }

  // Scale the fixed phone layout (portrait, or landscape when the window is
  // short — the same 520px rule as the CSS) down to fit the window, never up,
  // so nothing needs to scroll. The bezel only shows on wider windows, so it's
  // included in the size being fitted there.
  let windowW = $state(0);
  let windowH = $state(0);
  let fit = $derived.by(() => {
    if (!windowW || !windowH) return 1;
    const landscape = windowH <= 520 && windowW > windowH; // same rule as the CSS media query
    const framed = windowW >= 700;
    const bezel = framed ? 24 : 0;
    const margin = framed ? 24 : 0;
    const w = (landscape ? 667 : 375) + bezel;
    const h = (landscape ? 375 : 667) + bezel;
    return Math.min(1, (windowW - margin * 2) / w, (windowH - margin * 2) / h);
  });
</script>

<svelte:window
  onkeydown={handleTrialKeydown}
  bind:innerWidth={windowW}
  bind:innerHeight={windowH}
/>

<div class="page">
  <div class="phoneScreen" style="transform: scale({fit})">
    {#if screen === 'intro'}
      <div class="screenContent introScreen centredScreen">
        <h1 class="title">Synaesthesia Battery Test</h1>
        <p class="body">Do letters and numbers make you see colours?</p>
        <p class="body">Take the test to check how consistent your own colour associations are.</p>
        <a class="storyLink" href={import.meta.env.BASE_URL}>Read the story behind this test →</a>
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
          <p class="fieldHint">Wrong answer, sorry.</p>
          <p class="fieldHint">
            For a meaningful result, leave at least <strong>6 months</strong> between attempts.
          </p>
        {:else}
          <button
            class="primaryButton"
            disabled={!name.trim() || hasTakenBefore === null}
            onclick={startInstructions}
          >
            Continue
          </button>
        {/if}
      </div>
    {:else if screen === 'instructions'}
      <div class="screenContent centredScreen">
        <h2 class="subtitle">How it works</h2>
        <p class="body bodyGap">
          You'll see 36 letters and numbers, each shown
          {REPEATS_PER_GRAPHEME} times in a random order — 108 rounds in total.
        </p>
        <p class="body">Pick whichever colour feels right. Don't overthink it.</p>
        <p class="body">Then there's a quick speed test.</p>
        <button class="primaryButton" onclick={() => (screen = 'demo')}>Start</button>
      </div>
    {:else if screen === 'demo'}
      <div class="screenContent demoScreen">
        <div class="screenChrome">
          <p class="demoLabel">Here's an example</p>
          <p class="colorHint demoQuote">"For me, {DEMO_LETTER} is like a deep orangey yellow."</p>
        </div>

        <div class="trialRow">
          <div class="picker demoPicker" aria-hidden="true">
            <div class="pickerMain">
            <div class="svSquare" style="--hue: {demoHue}">
              <div
                class="pickerThumb"
                style="left: {demoSat * 100}%; top: {(1 - demoVal) * 100}%; background: {demoColor}"
              ></div>
            </div>
            <div class="hueBar">
              <div class="hueThumb" style="top: {(demoHue / 360) * 100}%"></div>
            </div>
            </div>
            <div class="greyBar">
              <div class="greyThumb greyThumbIdle" style="left: {(1 - demoVal) * 100}%"></div>
            </div>
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
      <div class="screenContent centredScreen">
        <h2 class="subtitle">One thing before you start</h2>
        <p class="body">This takes 10–15 minutes</p>
        <p class="body">108 rounds<br />short speed test</p>
        <p class="body">Start to finish, with no way to pause partway through.</p>
        <p class="body">Worth making sure you've got the time before you dive in.</p>
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
        </div>

        <div class="trialRow">
          <div class="picker">
            <div class="pickerMain">
            <div
              class="svSquare"
              style="--hue: {hue}"
              bind:this={squareEl}
              onpointerdown={onSquarePointerDown}
              onpointermove={onSquarePointerMove}
              onpointerup={onSquarePointerUp}
              onpointercancel={onSquarePointerUp}
              onkeydown={onSquareKeyDown}
              role="slider"
              tabindex="0"
              aria-label="Choose how pale, bright or dark the colour is"
              aria-valuetext={currentColor}
              aria-valuenow={Math.round(sat * 100)}
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div
                class="pickerThumb"
                style="left: {sat * 100}%; top: {(1 - val) * 100}%; background: {currentColor}"
              ></div>
            </div>
            <div
              class="hueBar"
              bind:this={hueEl}
              onpointerdown={onHuePointerDown}
              onpointermove={onHuePointerMove}
              onpointerup={onHuePointerUp}
              onpointercancel={onHuePointerUp}
              onkeydown={onHueKeyDown}
              role="slider"
              tabindex="0"
              aria-label="Choose the hue"
              aria-valuenow={Math.round(hue)}
              aria-valuemin="0"
              aria-valuemax="360"
            >
              <div class="hueThumb" style="top: {(hue / 360) * 100}%"></div>
            </div>
            </div>
            <div
              class="greyBar"
              bind:this={greyEl}
              onpointerdown={onGreyPointerDown}
              onpointermove={onGreyPointerMove}
              onpointerup={onGreyPointerUp}
              onpointercancel={onGreyPointerUp}
              onkeydown={onGreyKeyDown}
              role="slider"
              tabindex="0"
              aria-label="Choose a grey, from white to black"
              aria-valuenow={Math.round((1 - val) * 100)}
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div class="greyThumb" class:greyThumbIdle={sat > 0} style="left: {(1 - val) * 100}%"></div>
            </div>
          </div>

          <div class="graphemeStage">
            <span class="grapheme" style="color: {currentColor}">{currentGrapheme}</span>
          </div>
        </div>

        <button class="primaryButton" disabled={!touched} onclick={nextTrial}>
          {trialIndex + 1 >= totalTrials() ? 'Finish' : 'Next'}
        </button>
        <p class="keyHint">or press Return</p>
      </div>
    {:else if screen === 'speedIntro'}
      <div class="screenContent centredScreen">
        <h2 class="subtitle">Now, a speed test</h2>
        <p class="body">
          Colour test done! One more part, a few more minutes.
        </p>
        <p class="body">
          You'll see a letter or number, with {SPEED_OPTIONS} colours underneath. Tap the one
          you chose for it as quickly as you can. Don't stop to think — go with
          your first instinct.
        </p>
        <button class="primaryButton" onclick={startSpeedTest}>Start</button>
      </div>
    {:else if screen === 'speed'}
      <div class="screenContent speedScreen">
        <div class="progressTrack">
          <div class="progressFill" style="width: {((speedIndex + 1) / speedTrials.length) * 100}%"></div>
        </div>
        <p class="progressLabel">{speedIndex + 1} / {speedTrials.length}</p>
        <p class="colorHint">Tap the colour you chose for this</p>
        <div class="speedGrapheme" aria-live="polite">{currentSpeedTrial.grapheme}</div>
        <div class="speedGrid">
          {#each currentSpeedTrial.options as option, i (speedIndex + '-' + i)}
            <button
              type="button"
              class="speedSwatch"
              style="background: {option}"
              aria-label="Colour {i + 1}"
              onclick={() => answerSpeed(i)}
            ></button>
          {/each}
        </div>
      </div>
    {:else if screen === 'results'}
      {@const band = results.lowVariety ? describeLowVariety() : describeConsistency(results.overallScore)}
      <div class="screenContent resultsScreen">
        <h2 class="subtitle">Nice work, {name}!</h2>
        <p class="scoreLabel">{band.label}</p>
        <p class="body resultsDetail">
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

        <h3 class="resultsSubheading">Speed test</h3>
        <p class="body">
          <strong>{speedResults.correctCount} of {speedResults.total}</strong> correct{#if speedResults.medianMs != null}, typically in <strong>{(speedResults.medianMs / 1000).toFixed(1)}s</strong>{/if}.
        </p>

        <p class="footnote">
          This is a fun, informal version of the
          <a class="inlineLink" href="https://synesthete.ircn.jp/" target="_blank" rel="noopener">real test</a>
          — not a diagnostic tool.
        </p>
        {#if results.lowVariety}
          <!-- not saved, nothing to say -->
        {:else if supabaseConfigured}
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

        <button
          class="shareLink"
          type="button"
          disabled={shareState === 'working'}
          onclick={() => shareResult(band.label, results.perGrapheme, results.lowVariety)}
        >
          {shareState === 'working' ? 'Making your picture…' : 'Share your result →'}
        </button>
        {#if shareState === 'saved'}
          <p class="fieldHint">Picture saved, and the link is copied — post or email them anywhere!</p>
        {:else if shareState === 'copied'}
          <p class="fieldHint">Copied — paste it anywhere!</p>
        {/if}

        <a class="storyLink" href={import.meta.env.BASE_URL}>Read the story behind this test →</a>
      </div>
    {/if}
  </div>
</div>

<style>
  /* Portrait phone by default; landscape (667x375) whenever height is
     genuinely scarce — same rule everywhere. Each is a fixed design that is
     scaled to fit the window (see `fit` in the script), never reflowed. */
  :root {
    --phone-w: 375px;
    --phone-h: 667px;
    --wheelSize: 188px;
    /* The square must also leave room for the hue bar beside it. */
    --pickerSize: calc(var(--wheelSize) * 1.2);
  }
  @media (max-height: 520px) and (orientation: landscape) {
    :root {
      --phone-w: 667px;
      --phone-h: 375px;
      --wheelSize: 176px;
      --pickerSize: var(--wheelSize);
    }
  }

  .page {
    height: 100dvh;
    width: 100%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--background);
  }

  .phoneScreen {
    position: relative;
    width: var(--phone-w);
    height: var(--phone-h);
    flex: none;
    transform-origin: center center;
    overflow: hidden;
    background: var(--background);
  }

  /* Desktop-only: a real iPhone SE viewport never reaches this width. */
  @media (min-width: 700px) {
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

  /* One step down from body, for the sentence under the result label. */
  .resultsDetail {
    font-size: var(--text-caption, 14px);
  }

  .centredScreen {
    text-align: center;
  }

  /* An extra line of space after the paragraph (Bryony). */
  .bodyGap {
    margin-bottom: 1.5em;
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
  .introScreen .textInput {
    text-align: center;
  }
  .inlineLink {
    color: var(--purple);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  /* The two links at the foot of the results: same look, midway between
     caption and body size. */
  .storyLink,
  .shareLink {
    font-family: var(--font-body);
    font-size: calc((var(--text-caption, 14px) + var(--text-body, 16px)) / 2);
    color: var(--purple);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .shareLink {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
  }
  .shareLink:disabled {
    cursor: default;
    opacity: 0.6;
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
    /* 8px less at the bottom: the block above was nudged down, and this
       keeps the button clear of the sliders on short phones. */
    padding-bottom: 20px;
  }

  /* display: contents makes this wrapper invisible in portrait; the
     landscape override below is what actually repositions it. */
  .screenChrome {
    display: contents;
  }
  .progressTrack {
    /* One line of space above; the label stays right beside the bar. */
    margin: calc(var(--text-body, 16px) * 1.5) 0 0;
    height: 6px;
    border-radius: 3px;
    background: var(--backgroundTint);
    overflow: hidden;
  }
  .progressFill {
    height: 100%;
    background: var(--purple);
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
    /* Nudged down (Bryony; 20px in total once the 4px from the smaller bottom padding below is counted): the picker, sliders and letter together. */
    transform: translateY(16px);
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }
  .graphemeStage {
    flex: 0 0 calc(var(--wheelSize) * 0.8);
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .grapheme {
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: calc(var(--wheelSize) * 0.58 * 1.2 * 1.2);
    line-height: 1;
    transition: color 0.1s ease;
    /* Soft shadow keeps pale colours readable against the warm-ivory bg. */
    text-shadow:
      0 0 1px rgba(0, 0, 0, 0.25),
      0 2px 6px rgba(0, 0, 0, 0.12);
  }
  /* Official-style picker: a saturation/brightness square plus a hue bar. */
  .picker {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .pickerMain {
    display: flex;
    gap: 12px;
    align-items: stretch;
    height: var(--pickerSize);
  }
  /* Tone slider: white -> black, the width of the square. */
  .greyBar {
    position: relative;
    width: var(--pickerSize);
    height: 24px;
    touch-action: none;
    cursor: pointer;
    border: 1px solid var(--grey);
    border-radius: 6px;
    background: linear-gradient(to right, #fff, #000);
  }
  .greyBar:focus-visible {
    outline: 3px solid var(--purple);
    outline-offset: 2px;
  }
  .greyThumb {
    position: absolute;
    top: -4px;
    bottom: -4px;
    width: 8px;
    border-radius: 4px;
    border: 2px solid #fff;
    box-shadow:
      0 0 0 1.5px rgba(0, 0, 0, 0.35),
      0 1px 3px rgba(0, 0, 0, 0.25);
    transform: translateX(-50%);
    cursor: grab;
  }
  /* Greyed back while the colour isn't a pure grey. */
  .greyThumbIdle {
    opacity: 0.45;
  }
  .svSquare {
    position: relative;
    width: var(--pickerSize);
    height: var(--pickerSize);
    touch-action: none;
    cursor: pointer;
    border: 1px solid var(--grey);
    border-radius: 6px;
    /* x = saturation (white -> pure hue), y = brightness (full -> black). */
    background:
      linear-gradient(to top, #000, rgba(0, 0, 0, 0)),
      linear-gradient(to right, #fff, hsl(var(--hue) 100% 50%));
  }
  .hueBar {
    position: relative;
    width: 28px;
    touch-action: none;
    cursor: pointer;
    border: 1px solid var(--grey);
    border-radius: 6px;
    background: linear-gradient(to bottom, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  }
  /* Pressing anywhere on a track starts a drag, so show it as a grab. */
  .svSquare:active,
  .hueBar:active,
  .greyBar:active,
  .svSquare:active .pickerThumb,
  .hueBar:active .hueThumb,
  .greyBar:active .greyThumb {
    cursor: grabbing;
  }
  .svSquare:focus-visible,
  .hueBar:focus-visible {
    outline: 3px solid var(--purple);
    outline-offset: 2px;
  }
  .pickerThumb {
    position: absolute;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 3px solid #fff;
    box-shadow:
      0 0 0 1.5px rgba(0, 0, 0, 0.35),
      0 1px 3px rgba(0, 0, 0, 0.25);
    transform: translate(-50%, -50%);
    cursor: grab;
  }
  .hueThumb {
    position: absolute;
    left: -4px;
    right: -4px;
    height: 8px;
    border-radius: 4px;
    border: 2px solid #fff;
    box-shadow:
      0 0 0 1.5px rgba(0, 0, 0, 0.35),
      0 1px 3px rgba(0, 0, 0, 0.25);
    transform: translateY(-50%);
    cursor: grab;
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
    font-size: var(--text-body, 16px);
    color: var(--purple);
    text-align: center;
    /* Bryony: "Here's an example" goes down a line height. */
    margin: calc(var(--text-body, 16px) * 1.5) 0 0;
  }
  .demoQuote {
    font-style: italic;
  }
  .demoPicker .svSquare,
  .demoPicker .hueBar,
  .demoPicker .greyBar,
  .demoPicker .pickerThumb,
  .demoPicker .hueThumb,
  .demoPicker .greyThumb {
    /* Playback only, no drag handlers — shouldn't invite a click. */
    cursor: default;
    pointer-events: none;
  }

  /* Every portrait screen (phone, tablet, desktop): colour panel above the
     letter top-to-bottom (`column`), chrome pinned to its own top strip, per
     Bryony's reference screenshots. Landscape overrides this further down. */
  @media screen {
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

  /* Placed after the min-width block so it wins the cascade whenever height
     is scarce, regardless of width — covers a real phone rotated too. */
  @media (max-height: 520px) and (orientation: landscape) {
    /* Landscape: the picker + sliders block is centred in the space from the
       top of the screen down to the start of the button (the progress/caption
       chrome is overlaid at the top, so there's no top padding). */
    .screenContent.trialScreen,
    .screenContent.demoScreen {
      padding-top: 0;
    }
    .trialRow {
      transform: none;
      margin-bottom: -8px; /* the 8px flex gap above the button */
    }
    .grapheme {
      font-size: calc(var(--wheelSize) * 0.58 * 1.2 * 1.2 * 1.5);
    }
    /* The progress bar (test) and "Here's an example" (demo) span the area
       above the big letter: they start just right of the picker panel
       (24px margin + 220px panel + 16px gap = 260px, i.e. 236px plus the
       chrome's own 24px side padding). */
    .trialScreen .screenChrome,
    .demoScreen .screenChrome {
      left: 236px;
    }
    .demoLabel {
      font-size: var(--text-lead, 24px);
    }
    /* The 1.5x letter is tall: nudge it down so it clears the example caption. */
    .demoScreen .graphemeStage {
      transform: translateY(14px);
    }
    .progressTrack {
      margin: 0;
    }
    /* Colour test only: the bar sits 10px lower. */
    .trialScreen .progressTrack {
      margin-top: 10px;
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
  .resultsSubheading {
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: var(--text-body, 16px);
    color: var(--greyDark);
    margin: 12px 0 0;
  }

  /* --- speed test --- */
  .speedScreen {
    align-items: stretch;
  }
  .speedGrapheme {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: clamp(80px, 150px, 160px);
    line-height: 1;
    color: var(--text);
  }
  .speedGrid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  .speedSwatch {
    aspect-ratio: 1 / 1;
    border-radius: 12px;
    border: 1px solid rgba(0, 0, 0, 0.18);
    cursor: pointer;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
  }
  .speedSwatch:active {
    transform: scale(0.96);
  }
  .speedSwatch:focus-visible {
    outline: 3px solid var(--purple);
    outline-offset: 2px;
  }
  /* Landscape frame is only 375px tall: smaller type and tighter spacing so
     every screen fits without scrolling. */
  @media (max-height: 520px) and (orientation: landscape) {
    .phoneScreen {
      --text-body: 14px;
      --text-lead: 19px;
      --text-h3: 22px;
      --text-caption: 12px;
    }
    .screenContent {
      padding: 14px 24px;
      gap: 8px;
    }
    .title {
      margin: 0;
    }
    .bodyGap {
      margin-bottom: 0.75em;
    }
  }
  @media (max-height: 520px) and (orientation: landscape) {
    .speedScreen {
      overflow-y: auto;
    }
    .speedGrapheme {
      flex: 0 0 auto;
      font-size: 72px;
    }
    .speedGrid {
      grid-template-columns: repeat(6, 1fr);
      transform: translateY(12px);
    }
  }
</style>
