<script>
  // Sits as a normal (non-pinned) footer after .scroll-track in App.svelte —
  // once the pinned chart un-sticks at the end of the last step, this is
  // just ordinary static page content underneath it. Order: the project
  // intro, then the two charts, then the photo/attribution credits last.
  import { people } from '../data/people.js';
  import { photoCredits } from '../data/photoCredits.js';
  import Contributions from './Contributions.svelte';
  import DevTimeStream from './DevTimeStream.svelte';

  const creditedPeople = people.filter((p) => photoCredits[p.name]);
</script>

<footer class="credits">
  <section class="creditsIntro">
    <p>
      This story was an experiment working in collaboration with AI agents
      sticking to 3 fundamental rules.
    </p>
    <div class="creditsRules">
      <p>FOLLOW a traditional project management flow</p>
      <p><strong>DON'T</strong> write a line of code</p>
      <p><strong>DO</strong> everything else (with targeted AI when appropriate)</p>
    </div>
  </section>

  <section class="creditsBlock">
    <h3 class="creditsSubheading">How was the work divided?</h3>
    <div class="creditsChart">
      <Contributions />
    </div>
  </section>

  <section class="creditsBlock">
    <h3 class="creditsSubheading creditsSubheading--plain">Time spent</h3>
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
        <strong>Publications:</strong>
        Rouw &amp; Scholte (<a href="https://www.nature.com/articles/nn1906?utm_source=chatgpt.com" target="_blank" rel="noopener">link</a>),
        Witthoft, Winawer &amp; Eagleman (<a href="https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0118996&utm_source=chatgpt.com" target="_blank" rel="noopener">link</a>)
      </li>
    </ul>
  </section>
</footer>

<style>
  .credits {
    background: var(--background, #f7f3ec);
    padding: 64px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    text-align: center;
  }
  .creditsBlock {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 760px;
  }
  .creditsSubheading {
    font-family: var(--font-heading);
    font-weight: 600;
    /* Bryony: match the "What about you?" title's size exactly
       (.whyICareCtaTitle, var(--text-h3)) rather than --text-lead. */
    font-size: var(--text-h3, 30px);
    margin: 0 0 8px;
    color: var(--text);
  }
  .creditsSubheading--plain {
    font-size: var(--text-body, 19px);
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
  .creditsRules {
    margin: 0;
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
