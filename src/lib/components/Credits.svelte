<script>
  // Sits as a normal (non-pinned) footer after .scroll-track in App.svelte —
  // once the pinned chart un-sticks at the end of the last step, this is
  // just ordinary static page content underneath it. Order: the project
  // intro, then the two charts, then the photo/attribution credits last.
  import { people } from '../data/people.js';
  import { photoCredits } from '../data/photoCredits.js';
  import { famousQuotes } from '../data/famousQuotes.js';
  import Contributions from './Contributions.svelte';
  import DevTimeStream from './DevTimeStream.svelte';
  import { bmDataIcon } from '../data/bmDataIcon.js';

  const creditedPeople = people.filter((p) => photoCredits[p.name]);
</script>

<footer class="credits">
  <section class="creditsIntro">
    <p>
      This project was created by
      <a class="bmLink" href="https://www.bmdata.co.uk" target="_blank" rel="noopener">
        <svg class="bmIcon" viewBox="0 0 {bmDataIcon.width} {bmDataIcon.height}" aria-hidden="true">
          <path d={bmDataIcon.path} fill={bmDataIcon.color} stroke={bmDataIcon.color} stroke-width="3" />
        </svg>
        BM Data Visualisation</a>. It is an <em>AI Collaboration Experiment</em> working with 3 rules
    </p>
    <div class="creditsRules">
      <p><strong>FOLLOW</strong> my established data visualisation project flow</p>
      <p><strong>DON'T</strong> write a line of code</p>
      <p><strong>DO</strong> everything else <em>(with targeted AI when appropriate)</em></p>
    </div>
  </section>

  <section class="creditsBlock">
    <h3 class="creditsSubheading">How was the work divided?</h3>
    <div class="creditsChart">
      <Contributions />
    </div>
  </section>

  <section class="creditsBlock creditsBlock--spaced">
    <h3 class="creditsSubheading">Time spent</h3>
    <div class="creditsChart">
      <DevTimeStream />
    </div>
  </section>

  <section class="creditsBlock">
    <h3 class="creditsSubheading">Credits</h3>
    <ul class="creditsPhotoList">
      {#each creditedPeople as person (person.name)}
        <li><strong>Photos:</strong> {photoCredits[person.name]}</li>
      {/each}
      <li>
        <strong>Quotes:</strong> articles sourced by Chat GPT &mdash;
        <a href="https://www.theguardian.com/lifeandstyle/2011/dec/05/synaesthesia-hearing-colours-mixing-senses?utm_source=chatgpt.com" target="_blank" rel="noopener">1</a>,
        <a href="https://www.buzzfeed.com/emmayeomans/heres-what-its-like-to-have-time-space-synaesthesia" target="_blank" rel="noopener">2</a>,
        <a href="https://www.theguardian.com/lifeandstyle/2011/dec/05/synaesthesia-hearing-colours-mixing-senses?utm_source=chatgpt.com" target="_blank" rel="noopener">3</a>,
        <a href="https://www.independent.co.uk/news/long_reads/synaesthesia-sound-taste-health-science-brain-a7996766.html" target="_blank" rel="noopener">4</a>,
        <a href="https://www.thesynesthesiatree.com/2021/03/olfactory-visual-synesthesia.html?utm_source=chatgpt.com" target="_blank" rel="noopener">5</a>
      </li>
      <li>
        <strong>Famous Synaesthete Quotes:</strong>
        {#each famousQuotes as q, i (q.name)}<a href={q.source.url} target="_blank" rel="noopener" title="{q.name} — {q.source.label}">{q.initials}</a>{i < famousQuotes.length - 1 ? ', ' : ''}{/each}
      </li>
      <li>
        <strong>Publications:</strong>
        Rouw &amp; Scholte (<a href="https://www.nature.com/articles/nn1906?utm_source=chatgpt.com" target="_blank" rel="noopener">link</a>),
        Witthoft, Winawer &amp; Eagleman (<a href="https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0118996&utm_source=chatgpt.com" target="_blank" rel="noopener">link</a>),
        Root, Dobkins, Ramachandran &amp; Rouw (<a href="https://pubmed.ncbi.nlm.nih.gov/31630649/" target="_blank" rel="noopener">link</a>)
      </li>
    </ul>
  </section>
</footer>

<style>
  .credits {
    background: var(--background, #f7f3ec);
    padding: 40px 24px 64px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    text-align: center;
  }
  /* Bryony: a very subtle divider between the Start Test button above and
     "This project was an AI Collaboration Experiment". (Top padding is
     40px + this 1px line + the 24px gap, so the text sits where it did.) */
  .credits::before {
    content: '';
    width: min(480px, 100%);
    height: 1px;
    background: rgba(182, 182, 179, 0.45);
  }
  .creditsBlock {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 760px;
  }
  .creditsBlock--spaced {
    /* Bryony: "2 line spaces above Time spent" — added on top of
       .credits' own 24px section gap (~28px per line). */
    margin-top: 32px;
  }
  .creditsSubheading {
    font-family: var(--font-heading);
    font-weight: 600;
    /* Bryony: match the main chart's own responsive section-title size
       (Math.max(18, Math.min(28, width*0.036)) in ChartSvg.svelte, same
       as .whyICareCtaTitle) rather than a fixed --text-h3. */
    font-size: clamp(18px, 3.6vw, 28px);
    margin: 0 0 8px;
    color: var(--text);
  }
  .creditsIntro {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    text-align: center;
    font-family: var(--font-body);
    font-size: var(--text-body, 19px);
    line-height: 1.5;
    color: var(--text);
  }
  .creditsIntro p {
    margin: 0;
  }
  .bmLink {
    color: inherit;
    text-decoration: none;
    cursor: pointer;
  }
  .bmLink:hover {
    text-decoration: underline;
  }
  .bmIcon {
    display: inline-block;
    height: 1.1em;
    width: auto;
    vertical-align: -0.2em;
    margin: 0 0.1em;
  }
  .creditsRules {
    /* Bryony: "line space above FOLLOW" / "three line spaces below DO" —
       added on top of .creditsIntro's own 12px gap above and .credits'
       own 24px section gap below; ~28px is one body line-height
       (19px * 1.5). */
    margin: 16px 0 60px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    text-align: center;
  }
  .creditsRules p {
    margin: 0;
  }
  .creditsPhotoList {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
    font-family: var(--font-body);
    font-size: var(--text-caption, 15px);
    line-height: 1.5;
    color: var(--greyDark);
  }
  .creditsPhotoList a {
    color: var(--purple);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .creditsPhotoList a:hover {
    text-decoration-thickness: 2px;
  }
  .creditsChart {
    width: 100%;
    max-width: 760px;
  }
</style>
