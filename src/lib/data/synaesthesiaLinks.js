// The 9 documented cross-sense associations for this group of 12, and
// who has each one — from Bryony's quotes table (textures = touch,
// visual/spatial forms = objects; no new categories). Node keys match the ones
// already used elsewhere in the app: the corner senses' own `label`
// (senseIcons.js — only 'sound' and 'taste' are ever an endpoint here)
// and the 3 sight sub-icons' own `key` (sightSubIcons.js — 'colors',
// 'lettersNumbers', 'objects'). Aggregated by edge, not by person, since
// that's what the arrows/photo-fans in ChartSvg actually render.
import { people } from './people.js';

const byName = Object.fromEntries(people.map((p) => [p.name, p]));

function person(name) {
	const p = byName[name];
	if (!p) throw new Error(`synaesthesiaLinks: no person named "${name}" in people.js`);
	return p;
}

const edges = [
	// Kandinsky's own direction is colour -> sound, reverse of this
	// merged edge's from/to — reverseLabel flips his tooltip text only.
	{ from: 'sound', to: 'colors', names: ['Lorde', 'Billy Joel', 'David Hockney', 'Pharrell Williams', 'Lady Gaga', 'Billie Eilish', { name: 'Wassily Kandinsky', reverseLabel: true }] },
	{ from: 'sound', to: 'touch', names: ['Lorde'] }, // Lorde's "texture"
	{ from: 'sound', to: 'objects', names: ['David Hockney'] }, // Hockney's "visual forms"
	{ from: 'smell', to: 'colors', names: ['Billie Eilish'] },
	{ from: 'smell', to: 'objects', names: ['Billie Eilish'] },
	{ from: 'lettersNumbers', to: 'colors', names: ['Daniel Tammet', 'Geoffrey Rush', 'Richard Feynman', 'Vladimir Nabokov'] },
	{ from: 'lettersNumbers', to: 'objects', names: ['Daniel Tammet', 'Geoffrey Rush', 'Vladimir Nabokov'] }, // Rush's "spatial forms"
	{ from: 'lettersNumbers', to: 'touch', names: ['Daniel Tammet'] },
	{ from: 'lettersNumbers', to: 'taste', names: ['Tilda Swinton'] }
];

export const synaesthesiaLinks = edges.map((e) => ({
	from: e.from,
	to: e.to,
	people: e.names.map((n) => (typeof n === 'string' ? person(n) : { ...person(n.name), reverseLabel: n.reverseLabel }))
}));
