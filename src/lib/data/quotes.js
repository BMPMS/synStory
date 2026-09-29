// The 5 synaesthesia quotes, word by word. A word carries a `sense` tag
// (taste/sound/sight/touch/smell) where it's the word describing the
// synaesthetic perception itself — that's "the table" Bryony asked to
// have interpreted: which word in each quote gets coloured by its sense
// and flashes the matching icon as it's revealed. Untagged words render
// in the normal text colour.
export const quotes = [
  {
    words: [
      { text: '“he' }, { text: 'says' },
      { text: 'my', sense: 'sight' }, { text: 'name', sense: 'sight' },
      { text: 'tastes', sense: 'taste' },
      { text: 'of' }, { text: 'sliced', sense: 'taste' }, { text: 'apples”', sense: 'taste' }
    ]
  },
  {
    words: [
      { text: '“Everyone' }, { text: 'knows' }, { text: 'Tuesday', sense: 'sight' }, { text: 'is' },
      { text: 'grey', sense: 'sight' },
      { text: 'with' }, { text: 'a' }, { text: 'tweedy', sense: 'touch' },
      { text: 'texture”', sense: 'touch' }
    ]
  },
  {
    words: [
      { text: '“He’s' }, { text: 'got' }, { text: 'an' }, { text: 'amazing' },
      { text: 'tone', sense: 'sound' },
      { text: 'when' }, { text: 'he' }, { text: 'plays', sense: 'sound' }, { text: 'guitar,', sense: 'sound' },
      { text: 'it’s' }, { text: 'really' }, { text: 'calming' }, { text: 'like' },
      { text: 'a' }, { text: 'burnt', sense: 'smell' },
      { text: 'orangey', sense: 'sight' },
      { text: 'colour”', sense: 'sight' }
    ]
  },
  {
    words: [
      { text: '“Most' }, { text: 'words' }, { text: 'with' }, { text: 'a' }, { text: '‘-ge’', sense: 'sound' },
      { text: 'sound', sense: 'sound' },
      { text: 'in' }, { text: '(such' }, { text: 'as' }, { text: '‘college’', sense: 'sound' },
      { text: 'or' }, { text: '‘message’)', sense: 'sound' }, { text: 'have' }, { text: 'a' }, { text: 'sausage', sense: 'taste' },
      { text: 'flavour”', sense: 'taste' }
    ]
  },
  {
    words: [
      { text: '“A' }, { text: 'certain' },
      { text: 'smell', sense: 'smell' },
      { text: 'I' }, { text: 'will' }, { text: 'experience' }, { text: 'as' }, { text: 'a' }, { text: 'soft', sense: 'touch' },
      { text: 'blue', sense: 'sight' },
      { text: 'circle,', sense: 'sight' }, { text: 'or' }, { text: 'perhaps' }, { text: 'a' }, { text: 'triangle”', sense: 'sight' }
    ]
  }
];
