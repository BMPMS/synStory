// One best quote per famous synaesthete, with where it came from — from
// Bryony's table. The quote text isn't wired into the story yet (she'll
// bring those in later); for now this feeds the Credits footer, which
// lists each source by the person's initials.
//
// `highlights` marks the words in each quote that describe the sense side
// of the relationship (matched by exact text, every occurrence; `sense` is
// an edge key: sound / taste / smell / touch / lettersNumbers / colors /
// objects). The hover panel tints them with that sense's colour — a first
// pass at tagging, edit freely.
//
// `relationships` is Bryony's own wording for each person's sense -> sense
// link, kept here as written. The drawn edges live in synaesthesiaLinks.js.
// `source.url` has the "?utm_source=chatgpt.com" tracking tag stripped.
export const famousQuotes = [
	{
		name: 'Lorde',
		initials: 'L',
		relationships: 'sound → colours / textures',
		quote: '“You pick a chord then all of a sudden there’s this flood of a different colour or a different texture.”',
		highlights: [{ text: 'chord', sense: 'sound' }, { text: 'colour', sense: 'colors' }, { text: 'texture', sense: 'touch' }],
		source: { label: 'NME', url: 'https://www.nme.com/news/music/lorde-synaesthesia-explained-2069855' }
	},
	{
		name: 'Billy Joel',
		initials: 'BJ',
		relationships: 'sound → colours',
		quote: '“When I think of different types of melodies which are slower or softer, I think in terms of blues or greens.”',
		highlights: [{ text: 'melodies', sense: 'sound' }, { text: 'blues', sense: 'colors' }, { text: 'greens', sense: 'colors' }],
		source: { label: 'NME', url: 'https://www.nme.com/blogs/nme-blogs/meet-the-famous-musicians-with-synaesthesia-a-condition-that-means-you-hear-colours-14511' }
	},
	{
		name: 'David Hockney',
		initials: 'DH',
		relationships: 'sound → colours / visual forms',
		quote: '“I know visually when the color or the lines [of a set] fit the music.”',
		highlights: [{ text: 'color', sense: 'colors' }, { text: 'lines', sense: 'objects' }, { text: 'music', sense: 'sound' }],
		source: { label: 'American University', url: 'https://www.american.edu/magazine/article/science-of-synesthesia.cfm' }
	},
	{
		name: 'Pharrell Williams',
		initials: 'PW',
		relationships: 'sound → colours',
		quote: '“When you’re hearing music, you see it in color.”',
		highlights: [{ text: 'hearing music', sense: 'sound' }, { text: 'color', sense: 'colors' }],
		source: { label: 'GBH', url: 'https://www.wgbh.org/news/2013-12-31/pharrell-williams-on-juxtaposition-and-seeing-sounds' }
	},
	{
		name: 'Lady Gaga',
		initials: 'LG',
		relationships: 'sound → colours',
		quote: '“When I write songs I hear melodies, and I hear lyrics but I also see colours … I see sounds like a wall of colours.”',
		highlights: [{ text: 'melodies', sense: 'sound' }, { text: 'lyrics', sense: 'sound' }, { text: 'sounds', sense: 'sound' }, { text: 'colours', sense: 'colors' }],
		source: { label: 'Research source quoting Gaga', url: 'https://www.researchgate.net/publication/353584648_Cultural_Studies_and_Space_in_Contemporary_Narratives' }
	},
	{
		name: 'Billie Eilish',
		initials: 'BE',
		relationships: 'sound → colours; smell → colours / objects',
		quote: '“Every choice I make, fashion-wise, hair-wise and musically, I always want things to sound like a certain smell.”',
		highlights: [{ text: 'musically', sense: 'sound' }, { text: 'sound', sense: 'sound' }, { text: 'smell', sense: 'smell' }],
		source: { label: 'Yahoo Style UK', url: 'https://uk.style.yahoo.com/billie-eilishs-synaesthesia-inspired-her-101500043.html' } // tracking params (guccounter, guce_referrer…) stripped
	},
	{
		name: 'Wassily Kandinsky',
		initials: 'WK',
		relationships: 'colours → sound',
		quote: '“The sound of colours is so definite that it would be hard to find anyone who would try to express bright yellow in the bass notes, or dark lake in the treble.”',
		highlights: [{ text: 'sound', sense: 'sound' }, { text: 'colours', sense: 'colors' }, { text: 'bright yellow', sense: 'colors' }, { text: 'bass notes', sense: 'sound' }, { text: 'dark lake', sense: 'colors' }, { text: 'treble', sense: 'sound' }],
		source: { label: 'Project Gutenberg – Concerning the Spiritual in Art', url: 'https://www.gutenberg.org/cache/epub/5321/pg5321-images.html' }
	},
	{
		name: 'Daniel Tammet',
		initials: 'DT',
		relationships: 'letters + numbers → colours / objects / touch',
		quote: '“In my mind, numbers and words are far more than squiggles of ink on a page. They have form, color, texture and so on.”',
		highlights: [{ text: 'numbers and words', sense: 'lettersNumbers' }, { text: 'form', sense: 'objects' }, { text: 'color', sense: 'colors' }, { text: 'texture', sense: 'touch' }],
		source: { label: 'Scientific American', url: 'https://www.scientificamerican.com/article/savants-cognition-thinking/' }
	},
	{
		name: 'Geoffrey Rush',
		initials: 'GR',
		relationships: 'letters + numbers → colours / spatial forms',
		quote: '“Monday for me is kind of a pale blue… Tuesday is acid green, Wednesday is a deep purple-y darkish color.”',
		highlights: [{ text: 'Monday', sense: 'lettersNumbers' }, { text: 'Tuesday', sense: 'lettersNumbers' }, { text: 'Wednesday', sense: 'lettersNumbers' }, { text: 'pale blue', sense: 'colors' }, { text: 'acid green', sense: 'colors' }, { text: 'deep purple-y darkish color', sense: 'colors' }],
		source: { label: 'Psychology Today', url: 'https://www.psychologytoday.com/za/blog/sensorium/201408/geoffrey-rush-his-synesthesia' }
	},
	{
		name: 'Richard Feynman',
		initials: 'RF',
		relationships: 'letters + numbers → colours',
		quote: '“When I see equations, I see the letters in colors—I don’t know why. As I’m talking, I see … light-tan j’s, slightly violet-bluish n’s, and dark brown x’s flying around.”',
		highlights: [{ text: 'equations', sense: 'lettersNumbers' }, { text: 'letters', sense: 'lettersNumbers' }, { text: 'colors', sense: 'colors' }, { text: 'light-tan', sense: 'colors' }, { text: 'j’s', sense: 'lettersNumbers' }, { text: 'violet-bluish', sense: 'colors' }, { text: 'n’s', sense: 'lettersNumbers' }, { text: 'dark brown', sense: 'colors' }, { text: 'x’s', sense: 'lettersNumbers' }],
		source: { label: 'University of Toronto', url: 'https://www.artsci.utoronto.ca/news/colourful-language-u-t-psychologists-discover-enhanced-language-learning-synesthetes' }
	},
	{
		name: 'Vladimir Nabokov',
		initials: 'VN',
		relationships: 'letters + numbers → colours / objects',
		quote: '“The long a of the English alphabet … has for me the tint of weathered wood, but a French a evokes polished ebony.”',
		highlights: [{ text: 'long a', sense: 'lettersNumbers' }, { text: 'alphabet', sense: 'lettersNumbers' }, { text: 'tint', sense: 'colors' }, { text: 'weathered wood', sense: 'objects' }, { text: 'French a', sense: 'lettersNumbers' }, { text: 'polished ebony', sense: 'objects' }],
		source: { label: 'The Nabokovian', url: 'https://thenabokovian.org/sites/default/files/2018-01/NABOKV-L-0012225___body.html' }
	},
	{
		name: 'Tilda Swinton',
		initials: 'TS',
		relationships: 'letters + numbers → taste',
		quote: '“The word ‘word’ is a sort of gravy. Table is a slightly dry cake. Tomato is not actually tomato, it’s lemony.”',
		highlights: [{ text: '‘word’', sense: 'lettersNumbers' }, { text: 'Table', sense: 'lettersNumbers' }, { text: 'Tomato', sense: 'lettersNumbers' }, { text: 'tomato', sense: 'lettersNumbers' }, { text: 'gravy', sense: 'taste' }, { text: 'dry cake', sense: 'taste' }, { text: 'lemony', sense: 'taste' }],
		source: { label: 'Teacher Created Materials source', url: 'https://www.teachercreatedmaterials.com/hubfs/Sample%20Pages%20and%20Look%20Insides%20PDFs/21145s-1.pdf' }
	}
];
