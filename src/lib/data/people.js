// The "famous folk" believed to have synaesthesia, used in step 1 and
// reused wherever the story needs this same group again. Photos are
// pre-cropped to exact squares — see ChartSvg.
import davidHockney from '../assets/people/david-hockney.png';
import wassilyKandinsky from '../assets/people/wassily-kandinsky.jpg';
import vladimirNabokov from '../assets/people/vladimir-nabokov.jpg';
import richardFeynman from '../assets/people/richard-feynman.jpg';
import billieEilish from '../assets/people/billie-eilish.png';
import ladyGaga from '../assets/people/lady-gaga.png';
import pharrellWilliams from '../assets/people/pharrell-williams.jpg';
import billyJoel from '../assets/people/billy-joel.jpg';
import lorde from '../assets/people/lorde.png';
import geoffreyRush from '../assets/people/geoffrey-rush.png';
import marilynMonroe from '../assets/people/marilyn-monroe.png';
import danielTammet from '../assets/people/daniel-tammet.png';

// `profession` — Bryony's own tooltip copy: "just their profession", then
// later "name - occupation" once the step1 tile label has faded out (see
// ChartSvg's personGroup hover handler).
export const people = [
	{ name: 'David Hockney', image: davidHockney, profession: 'artist' },
	{ name: 'Wassily Kandinsky', image: wassilyKandinsky, profession: 'artist' },
	{ name: 'Vladimir Nabokov', image: vladimirNabokov, profession: 'writer' },
	{ name: 'Richard Feynman', image: richardFeynman, profession: 'scientist' },
	{ name: 'Billie Eilish', image: billieEilish, profession: 'singer' },
	{ name: 'Lady Gaga', image: ladyGaga, profession: 'singer' },
	{ name: 'Pharrell Williams', image: pharrellWilliams, profession: 'singer' },
	{ name: 'Billy Joel', image: billyJoel, profession: 'singer' },
	{ name: 'Lorde', image: lorde, profession: 'singer' },
	{ name: 'Geoffrey Rush', image: geoffreyRush, profession: 'actor' },
	{ name: 'Marilyn Monroe', image: marilynMonroe, profession: 'actor' },
	{ name: 'Daniel Tammet', image: danielTammet, profession: 'writer' }
];
