// Visual identity — locked 2026-09-22 ("Warm Ivory").
// Single source of truth for colour + type. Change a value here and it
// updates everywhere it's imported — in Svelte components, in D3 code,
// and (via applyThemeVars) as CSS custom properties on <html>.

export const colors = {
	background: '#F7F3EC',
	text: '#2B2A28',

	// A subtle fill for shapes that need to read as "a shade of the
	// page" rather than an outlined line/stroke — background's own hue
	// and saturation, lightness dropped ~8%. Bryony: "make the fill a
	// slightly darker hue than the background... accessible but
	// subtle, not confused with the link lines" (which use `grey`
	// below) — added to the palette per her own request rather than
	// left as a one-off literal in component CSS.
	backgroundTint: '#EBE1CF',

	// Started as the exact section-title grey from the Setup spec
	// (docs/milestones/setup-spec.pdf) — colour-picked from the
	// rendered PDF: #868580. Lightened from there per Bryony ("a
	// lighter grey would be amazing"), so this is no longer the literal
	// spec value. Used as the outline for the quote bubbles and the
	// sight-scene circles.
	grey: '#B6B6B3',

	// accents — mapped to the Fisher-Price magnetic letter research
	blue: '#196AAD',
	red: '#D25241',
	yellow: '#E6DF5A',
	orange: '#ED9435',
	green: '#3C9C4B',
	purple: '#6A488C'
};

export const fonts = {
	heading: "'Fredoka', system-ui, sans-serif", // capitals & titles
	body: "'Literata', Georgia, serif" // reading text
};

// The spacing scale from Setup — Spec (docs/milestones/setup-spec.pdf),
// read off the actual chart there (measured, not guessed): 8 named
// steps, px values, smallest to largest.
export const spacing = {
	xs: 2,
	sm: 4,
	md: 8,
	lg: 12,
	xl: 16,
	'2xl': 24,
	'3xl': 32,
	'4xl': 48,
	// Extends the measured Setup-spec steps, continuing its alternating
	// x1.333 / x1.5 progression (not itself read off the spec chart —
	// added 2026-09 for layouts that needed more room than 4xl gave).
	'5xl': 64,
	'6xl': 96
};

// The type scale from Setup, as actual values (this had only ever lived
// in the visual-system mockup until now). Px sizes, smallest to largest.
export const typeScale = {
	// Bryony: "the text is too big on the legends... we might have to
	// make a smaller one" — one step below caption, for small in-chart
	// annotations (the brain step's dot-legend labels) that read fine
	// even at caption size's own smallest use.
	micro: 12,
	caption: 15,
	body: 19,
	lead: 24,
	h3: 30,
	h2: 38,
	h1: 48,
	display: 64
};

// Copies colors/fonts/typeScale onto :root as CSS custom properties
// (--background, --text, --blue, --font-heading, --text-lead, ...) so CSS
// never has to duplicate the values above. Call once at app start, before
// mount.
export function applyThemeVars(root = document.documentElement) {
	for (const [name, value] of Object.entries(colors)) {
		root.style.setProperty(`--${name}`, value);
	}
	root.style.setProperty('--font-heading', fonts.heading);
	root.style.setProperty('--font-body', fonts.body);
	for (const [name, px] of Object.entries(typeScale)) {
		root.style.setProperty(`--text-${name}`, `${px}px`);
	}
}
