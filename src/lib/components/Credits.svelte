<script>
  // Sits as a normal (non-pinned) footer after .scroll-track in App.svelte —
  // once the pinned chart un-sticks at the end of the last step, this is
  // just ordinary static page content underneath it.
  //
  // The "who did what" contribution chart (converted from the Observable
  // original) is deliberately NOT here yet — Bryony asked to hold off on
  // that part until later. This is just the section's home and its first
  // real content (photos), so it exists to build on rather than a mockup.
  import { people } from '../data/people.js';

  const photoNames = people.map((p) => p.name).join(', ');
</script>

<footer class="credits">
  <h2 class="creditsHeading">Credits</h2>

  <section class="creditsBlock">
    <h3 class="creditsSubheading">Photos</h3>
    <p class="creditsPending">
      Sources for the photos of {photoNames} are still being added here.
    </p>
  </section>

  <!-- Next: the "who did what" contribution chart, converted from the
       Observable original into this project's own D3 + Svelte style. -->
</footer>

<style>
  .credits {
    background: var(--backgroundTint, #ebe1cf);
    padding: 64px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    text-align: center;
  }
  .creditsHeading {
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: var(--text-h2, 38px);
    margin: 0;
    color: var(--text);
  }
  .creditsBlock {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 640px;
  }
  .creditsSubheading {
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: var(--text-lead, 24px);
    margin: 0;
    color: var(--text);
  }
  .creditsPending {
    font-family: var(--font-body);
    font-size: var(--text-caption, 15px);
    line-height: 1.5;
    margin: 0;
    color: var(--greyDark);
  }
</style>
