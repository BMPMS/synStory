// Raw data behind the "who did what" credits chart — converted straight
// from Bryony's own chart.csv (columns: PROCESS, HUMAN, CLAUDE, CHAT GPT,
// OBSERVABLE). A blank cell in the original CSV means "not applicable to
// this process", kept here as `null` and treated as 0 when drawn — same
// rule the original Observable version used.
export const creditsContributions = [
  { process: 'Story concept + editorial', HUMAN: 100, CLAUDE: 0, 'CHAT GPT': null, OBSERVABLE: null },
  { process: 'Data + interpretation', HUMAN: 70, CLAUDE: 0, 'CHAT GPT': 30, OBSERVABLE: 0 },
  { process: 'Research + validation', HUMAN: 70, CLAUDE: 0, 'CHAT GPT': 30, OBSERVABLE: null },
  { process: 'Tech + code spec', HUMAN: 100, CLAUDE: 0, 'CHAT GPT': null, OBSERVABLE: null },
  { process: 'Visual identity', HUMAN: 100, CLAUDE: 0, 'CHAT GPT': null, OBSERVABLE: null },
  { process: 'Chart choice + design', HUMAN: 100, CLAUDE: 0, 'CHAT GPT': null, OBSERVABLE: null },
  { process: 'Responsiveness strategy', HUMAN: 100, CLAUDE: 0, 'CHAT GPT': null, OBSERVABLE: null },
  { process: 'Writing the code', HUMAN: 0, CLAUDE: 90, 'CHAT GPT': null, OBSERVABLE: 10 }
];

// Column groups — Human stands alone; the three AI tools share a tinted
// section background, same split as the Observable original.
export const creditsSections = [
  { name: 'Human', agents: ['HUMAN'], tinted: false },
  { name: 'AI', agents: ['CLAUDE', 'CHAT GPT', 'OBSERVABLE'], tinted: true }
];

export const creditsAgentLabels = {
  HUMAN: 'Me',
  CLAUDE: 'Claude',
  'CHAT GPT': 'Chat GPT',
  OBSERVABLE: 'Observable'
};
