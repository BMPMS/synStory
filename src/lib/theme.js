// Visual identity — locked 2026-09-22 ("Warm Ivory").
// Single source of truth for colour + type. Change a value here and it
// updates everywhere it's imported — in Svelte components, in D3 code,
// and (via applyThemeVars) as CSS custom properties on <html>.

export const colors = {
	background: '#F7F3EC',
	text: '#2B2A28',

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

// The type scale from Setup, as actual values (this had only ever lived
// in the visual-system mockup until now). Px sizes, smallest to largest.
export const typeScale = {
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
