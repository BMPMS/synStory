import { colors } from '../theme.js';

// Step 12's per-respondent magnet-letter match data — the 326-respondent
// survey Bryony uploaded (untitled (15).json), pre-aggregated into a
// compact per-letter structure (one entry per letter, not the raw
// per-respondent rows) so this stays a small data file, matching the
// project's own convention (brainRegions.js, magnetLetters.js).
//
// Each letter's `codes` is a 326-character string, one character per
// respondent, in the SAME respondent order for every letter — so
// `codes[i]` across all 26 letters describes respondent i's full set of
// answers. One-character colour codes (not full names/hex): r/o/y/g/b/p
// for the 6 Fisher-Price colours (see theme.js), x for anything else
// (including a blank answer). `template` is that letter's own "correct"
// Fisher-Price colour, per magnetLetters.js's own palette cycle (red,
// orange, yellow, green, blue, purple — NOT skipping yellow, unlike
// step3's sense-icon palette, which does). `matchCount` is how many
// respondents' code equals that letter's own template code.

export const nUsers = 326;
export const maxMatchCount = 269;

// One-character response code -> its actual colour. 'x' (anything
// other than the 6 Fisher-Price answers, including blank) reads as a
// neutral grey rather than a 7th hue.
export const codeColor = {
  r: colors.red,
  o: colors.orange,
  y: colors.yellow,
  g: colors.green,
  b: colors.blue,
  p: colors.purple,
  x: colors.grey
};

// Letters in match-count order (most-matched first, ties broken
// alphabetically) — Bryony confirmed this as the colorBar state's own
// row order ("You're instinct is right on the bar order").
export const barLetterOrder = ['A', 'N', 'D', 'E', 'H', 'C', 'J', 'V', 'W', 'P', 'B', 'M', 'S', 'T', 'Z', 'U', 'K', 'F', 'Q', 'I', 'R', 'L', 'X', 'G', 'O', 'Y'];

export const magnetResponses = {
  A: { template: 'r', matchCount: 269, codes: 'rrrrrrrrrrorrrrrrgrrrrrrrrrrrrrrrrrrxrrrrrrrxrrrrrrrrrrrrrxrrrrrrrrrrrrrrrrrrxrrorrrrrrrrrrrrrrrrrrrrrrrrrrrrgxrrrrgrrrrorgrrrrrrrrrrrbrrrrrrrbrrrrryrorrrrrrrrrrrprrrrrrgrrrrrrrrrryrrxrbrrrrrrrrrrrxprrrryrrrrrrrrrrrrrryxrxrrygrbrrrrrrrrrrrrrrgryrrrxxgrrbrrrxgrbgrrorbrrrgyrxrrrrrgrxryrrrrrrxxrrrrrrrrgxbrrrrrrrrrrrrorgrrgrrrro' },
  B: { template: 'o', matchCount: 208, codes: 'oooooooooooooooooboooooooooooooooooooooooooooooooooooogooooooooooooorooooooboooooooxooobooooobxooooboooxoobooooyooooooooooooooyoooooooyobbboyororbooogopxoobbooooboooobobprbbboxoboooooxoogyboobobobboooboobbbybxbbooxboogroooooogorbobobyxoxxgoyoxxoboboxoorobybbxobyxoobopoxxxbobbbxxooxoboogooooobbbbbobxrxogybgyooroxbooxooooxbobb' },
  C: { template: 'y', matchCount: 238, codes: 'yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyryyyyyyyyyyyyyyyygyyyyyyyyyyyyyyyyyoyygyyyyyyyxyyyyyyyyybyyyyxooyxyyyyyybyxyyoyoyoyyyyyoyyxyxbybryyyyyygxyyyyygyyyyyyyxyyyyyyyryygyxyyoyyoyyxyyyyyyyyyryorbyxryyyyyyyoyyybyyxoybbyyyyyxgygyyobyyyyryyyxxyxxxyxyxxybyyyoyyyyyyyxryyyyyyopxygyryyyoyyyyyyboybyypyoyyyyybbyboybyoybyyborbyxyyybobyyyybyyyyy' },
  D: { template: 'g', matchCount: 251, codes: 'gggggggggggggggggggggggggggggggggggggggxggggggggggxgggggggggggxggggggggggggggggggggbgggggggggxxgggggggxggggggggggxgggggggggggggbggbggrggrgggggggggbggbrggggggggxgggbggggbgggggygggggxgpgggggbggggggggggxggggxrggggggobryxbggbxgbbgpygggggggbgggggxpgggxgggrgxogxgxogggxpxgogggxggggggbgxggoggrxgggggopgxrrggxxrggggoggrgggygyrooggrpbg' },
  E: { template: 'b', matchCount: 243, codes: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbxbbbbbbgbbbbbpbbbbbbbbbbgbbbbbbbbbbbybbxbbbbbbrxbbbgbbxbbxbbpbbbbbbbbbbbbbrbbbbbbbbxobbxxbbxxbgbbbxbbbbbgbbxbbbbxbbybbbxbbpbbbbgbygbbbxbpbbbxxgbbbbbgbbbbbbbpbbbbbobbbrbxbbbgbbrbbbgbgbbbbgbxbxbxbbbbxxrboxxxbbybbbbxpggbbxbbpxbrobbbbbrbbxbbbbgbbgybbbgbbbxxbxxbbybbbxbbbxxbybropb' },
  F: { template: 'p', matchCount: 175, codes: 'ppppppppppppppbppppppppppppppppppppppppppppppgxppppxgbbpbpppppppxppxgbpbppppppppppppbpppgppbpppppbbppbpxxxpbpbxgppppppbxppxxppppxppppppppppxbpppbbpppypgbbbbogppppprbbrpbpppppbpgpxppxppgxpbbbpbbpgxypbxpgppgppgopbpopbpggpxgxxxpbgpgppxbpbxbbppobbxogoxbgbpgxpbppbpxbprxxybogppbbprpoppxxbxbgpbbppxgyogxxgrpxgxbxxgbxbbpgpxpgppxbopgo' },
  G: { template: 'r', matchCount: 98, codes: 'rrrrrrrrrrrrrrrrrrrrgrxrxpxgrrgrrgrxyrxgrrrgyrrxrgrgyorrrorgxprgrgpyrrpxxporgrprygxrggggxoxrrrgrprrgggxorxgxorggrbropoxgoroxgbggxrrgoxrorxrxbrrrrrggrxrgoxroogoroorrgxggxgrgxggpbgxorxrbgxbroggggoggogrggoggggggoxpgggxogxbgpgpgxgrpbobxgoprbgggrgorgogrxxrxgbprxxrpggxgrxpgoxrrgxxgprroxggpprrbgggrgygoxggxpggxbgopobgrgrxgproobbggox' },
  H: { template: 'o', matchCount: 241, codes: 'oooooooooooooooooooooooooooooooooooyooooooyoooooooooooooooooooooooooooooooxooooooooooyyyoooooooooooyooooooyoyoooooooorxooooooooooogyoyxyoooxgxroooooooooyoroogooopxoooooooooooooboooyoyooyoxxxooyoooooxooooooxoooogyooooobroooxoooropybooyyoboxoyyoxoyyooyrorooooxxoooooyooooooooyxooooyoxoyogoxgopxxxoxoooooroxogoooxryxryxoroxoooyoo' },
  I: { template: 'y', matchCount: 142, codes: 'yyyyyyyyyyyyyxyyyyyyyyybyoyyyyxxyyyxyyxxxyyxyyxyyxyybyyyybxxyyoyyyxyyyxxxyyyyxxxpyxxyyxyxyyxyoyxoxxyxxyyxyyyxyyyxoxyxxxxyxyyyyybxoybbyyxbxyyyxyyxyxxxyxyyxrxxxxbxrxooxyoyxxybxbxyoxbbxyxbxyxyxxyxbyxxxxyxyxoxxyyxxyxpyyyyyxyxxybxoybyxxyxxxbyxyxyxbxyxbxxxxxxyyxoxyxyxoxxxxyxxxxxxxoxxxxyyxxxyyxbyyxbyyxyxybxyyxgbygbxybxxxxxyxyyxxbxx' },
  J: { template: 'g', matchCount: 234, codes: 'gggggggggggggggggggggggggggggggggggggpggygggggggggggggggggggggggggggpggggggbgggggrggoggggoggggbrggggggggoggogggggggobggggbyxrgggggogggggggxggggggggpggggggxggggrgrgrggggggggggggygxggxygyyggybpggopgggggggggggpgxgggggxpxggygggbgoogygpggoggggggggggpgopgyxggbrxgggpbggxggbggyoggpggpgrybgggpyoxppxxgoggxgggyxgpgyogpggrbgxoxxybggbggx' },
  K: { template: 'b', matchCount: 182, codes: 'bbbbbbbbbbbbbbbppbbpbbbbbbbbbbbbbppbbpbbbbbbbgbbpbbbbbbbbbbbbbbbrbbpbbbbbpbbbxbpgbbbbpbbypbbbbbbbbbpbpbxxxbbbpbbpbbpppbbpxbgbpxbbbbbpbbbxbbbbbbbbbypxbbxbybbpbbbxygprbgbbpbxxbbpbbboybbrpxbrbypxbbxbbxgpbbbbpbpxpppxpoxbbbrpybppbbbrpppxbxbxbbpbxppbpxxyypborbrobbbpppbxbpbrbppppbbygyobrxxoprgbppxxrbbpxggbpboxgbybbxxbgobxbbpbxbbopx' },
  L: { template: 'p', matchCount: 118, codes: 'ppppppppppppbpppbppbppppppppppppxoypppppppppppxpbxpppbpbbppyyxpxypbppbppxxpypbxbgbxyypppxboxbpxpxbbypppxpxyppbbbgxbbxxpppxbgbpybgbbppbggyxxxpobbbyxppbgxygrbgbbpxpgpbbypbpxxpxpppopxpxxyprbgyygbbxobybgpgyxbpbxgxxppoprypbxbbxpppoppyprxbbypbxrbobbxbxppgpxgpryxyybpypbxxxxybbyprpbypyygypbbxbgggbpygypxbgyoyxpxyxxyppxxroryxbxpyypypg' },
  M: { template: 'r', matchCount: 203, codes: 'rrrrrrrrrrrrrrrrrrrrrrrxrrrrbbrrrrrrxrrrrrrrxrrxrrrrrrrbbxrroprbrprrrbrrrrrbprbrrrrbrbrrrrrxrrrrxbrrxbxrrrrrrrrrrrxrrpxgrrrrxbbxbbrbxrxxxrrrxbrxrbrrrrrprrrrrrxrprrrorrprxrrrrorbrxbrxorrrxrrrbxrbxrxxrxoxbrxbrbrxxxbxrprryrrxppxrbrrxrxrrbrrprxxrrrbrxrrrbbrprxrrxprrxorrrxrrrrrbxrgrrxrrbrbxrrrrrbrrbrrrxxrgbrbrrbrxpxrrrbbrbbrbrrrb' },
  N: { template: 'o', matchCount: 264, codes: 'ooooooooooooorooooooooooooooooooooooooooooyooooooooooooyoooooooooooooooooooooooooooooooooooooooooooooooooooyooooooxoooxoooooooooyoooooxobooooooooyrooooxxoooooxyoooooooooxyoooooooogooooooooooooooooooooooxooooxooooooooooxoxoxoxooooxooooogxooxoooxoyooooorogoxxooogoobgoooxooxooorooooorooxgorooooboborpxoooooxoborgoxoogoxrygbxooox' },
  O: { template: 'y', matchCount: 87, codes: 'yyyyyyyyppypyypyyyyyybyyxyybyyxxyyrxyyxyxoxxyyxyyoxxyyyxbyxxxxxybyxxyxxxyypyxxxyxyxxbygyxyxxbyxxxxxyxxxbxxyxxxxyxxxxoxxyyxbbyxxrxxyyyoxxxxyybxyxxyxxxxxbxxgxyxypxbxyoxboxxxxxxyxxbxbxxgxxxxxyooyxyyxxxxxxbxoxpyxxxyxyxxyxyxxxxooxbxbxxoxxxxbbxyxxxyxoybxxbypxxxxbxxxxxbxxxxyxbxxxxxbxxxxbxxxxyxxxxbxyyoxxpoxxxxxyxxrxxyyrxxxxxxybxxyxx' },
  P: { template: 'g', matchCount: 212, codes: 'ggggggggggggggggggggggggggggggggggggggggggggggggygogbgggggggggoygpggxgpgggbggggoxggggbggggggggggggggxgxpggggggggpgggggggggggggggxyobbogxgbgxgggggggogobxgbgxgxgxggggggrpogggggxbppoggxgggggoggxggbggypggppxgxggggggxggxypgggpypggbogpxgggggpgbggroypxgbxbxrxggxgxoyggggxbgggoxggggxpogpbryggrxbbboxoggggxypbggggoggggxgxgpgoppgpxgoypg' },
  Q: { template: 'b', matchCount: 152, codes: 'bbbbbbbbbbbbbbbbbbpbbbbbbbxbppbbbbbbbpxbbxbbpgbbppbbbbbbppbpxbbbpbbpbbxbxbbbbbppbxxbbpppbxpbbobxbbxpbppbbxpbbbxbpbbxrpbgxxbbxbxbbgbppbbbbbpxbpxxbbbxxbbpbxppbxxxxbxpbxbpppxxppypybpbxpxbxxbxpxbxbbgpboxpbpppxbpbbpbxbxxbpxbbbrpbbobpbppbpbbbgbppbbpxprbxxbbxyypbgbbxpbybpxxpbbxppxxbpxpxpyxpbbbxbpbppbppxbbppxgxogbprxxpxxxpxoxxxpbbxb' },
  R: { template: 'p', matchCount: 140, codes: 'ppppppppppppppppppppppppppgppbpxbppppbpppprpppxprpgbpbbrbxprpxgpppbprxpppxbprpprprrpbpppxbrprbppxrbrpppxpxrppbobpprbppprppbpxppbpgbbxpppxpbrpbgrrbrpgppxrbrppopxppxxxbrpbrrpxppxbbxpppppppbxpprbbrgbyprrrgpbpxxrrorprxproprbrxprbgxpprpxbxrrxpbrxrprgxpxbpprxbpppgxgprbrxrpbxrpxrpbbpxrxrxxgpgxrrorprxrrpxrrppxxgxpbopxbrgbpprgrpbgrbp' },
  S: { template: 'r', matchCount: 202, codes: 'rrrrrrrrrrrrrrrrrrrorrxrrrrorrrrrrrrxrryrrrrxbrprrrrrrbrrogrxrrbxxrrrrrxoxyrrxbxgbxrrrxxrrrxyorrrrbyxrrrrryxbyrrbyrrrrxrxrrrbyorrrrrorrbrgrrrrxrrrrrrrgrrrrrrrrggrrrrxgprrryrorrrprxrrrxrrorrxrrrrrroprgrxrrrrxrxxxrgrrrryryyrbyrrbyprbyrrrrrrryrrrrrrgyrrgyrryggrrxrxoxrxrpyrxporxoyyyrrbrrxxyroyxrgxyrroyxxrrrrrrbxrxrrrxrrrrbrryyrr' },
  T: { template: 'o', matchCount: 200, codes: 'oooooooooooooooooooooooooooooooooooooooooooboooooooooooooobrooooooyoooooogoyyoooooooobopooooroxoooooooooyoyoxoooobooxoxbyoooooboxooboyogoooxoyoxgyogooxoyoogboxoopxoogyoryooooggooxoxyoxxoooxoooyobxogxooxoooxoobygogyogbboooobooyggoxoxooyyyoxxyoooogxbogoooogooxoooyooogxxygogorxobgooxgyxrgbrbgxoxxoooxxbooxoooyyxobbggyoxgxgxyobob' },
  U: { template: 'y', matchCount: 199, codes: 'yyyyyyyyyyyyyyyyyyyygyyyyyyyyyyyyyoyyyyyooyyyyyyyyyyyyyyyyyyyyyyyyyyyybyyybyyoxoxyyyoyyyyxoooyyoxyyyxxyxxyyoyyoyyybxyyyyoxoyyoybyggyooyyyoyyyyyoxyyyooyyyxryypoyxbyyoyyyyyyxyxyyybypyyxyyyoyyyyyxypoyyyyooybyyyooyoobyyyoryyyyypbyyyoxoooxyygxyyyybybxgyxyygyyyypxooxoxyxxyxoyxxpyyyoyxygoxyyyryopxoypybyyyoxyoyyxbyoooprxyoxpyyboxobx' },
  V: { template: 'g', matchCount: 226, codes: 'gggggggggggggggggggggggggggggggggggggggggxgggggggggggggggggggggbggggggggpgpgxggggggxgogxgggggpxgggggygggggggggggbggggggggggpggggggoogpgggopgygpgggggggpggxgggggpgggxgggxgggpxgxggbgxggbgygxgxgrbggggggggpgggggpgggppggxpggggpggpggggrgogbgpggxpgrppggggxxgrgrgggoxgyggogggppggggrgxbpypbygygpgppgpxogbpgopgxgogpxxgoobgrxggyxgyygbxpbg' },
  W: { template: 'b', matchCount: 217, codes: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbrbbbbbbbbbbxbbbbbbbbbbbbbbbbbbbbbpbbbbbbbpbbbbbgbbbbxbbbbbobbpbpbbbbbbbxbbbbbprbpbgbbpbrbbgbbpbbrypbbbbbxbyppxbbbxpbbbbbrbpbxbbropxxbbbbbbxxoxpbpbgpxobyrbbbbxbxbbpbobobybbbbbbpbxbxxppbbpbxbbrbbrrbbxbxbxbbgbgbpxbybbbpbbbbrbobbxbxrbbbxxxbxpbxbbbybobbbxbbxbppbbbopyxbbbxggxbrxbpbxbxbbbbbprxbbrxb' },
  X: { template: 'p', matchCount: 101, codes: 'pppppppppppppppbppbpbxppppppoppybpppppppxpppppxppxbpxbbxbpppxxbxpbbporbxpxpbxbpppbxxbpppxxxppppxbpbpxxbxxppxxbbbbbxxpxpxpbpxxypbgbopppxpxpxxbxpxxbbxxxxpxxrxbbxxxogxxxobppxxxppxpbbxpbxpgxrxxrxbxxxxxxgxbpxrxpbbxxxxpxxrxbxxbxgpbbxrpppxxxxxbxbxxxpxppxxxxxxxxrbxxbxxxxxxxpxxxxxxxboxpxxxxxoxxoxpbxbrpxpxxxbxxxxopxbxxprxxxpxxpbxxxpxx' },
  Y: { template: 'r', matchCount: 68, codes: 'rrrrrrrrrrrrrrrrryrrroxoxxxyoxrrxxroxrxyrxxyxrryxryoyyxrroorrxyyyxboypyxyyroxybpryyxgoyyxroxyyoxxxryyxxryoyxxxyxryyrorryxrgryyyyxyryyoxyxyyxyrxryoyrxyxyyrrxyxgryrgrrxryygxygyyyybryyrxyxroryyyyyyyxxygyyoybyxxoboxxpyryyyrryxyygbyorxyxoxpyyoyxoypygpyoxpyoxyyxyyyxxyrrrxyybbppyxxyoyyoyyxoyyxxypxogobbxyyrpxxoyxxborgyyoyorxxxypxyxg' },
  Z: { template: 'o', matchCount: 200, codes: 'oooooooooooooooooorooooooooooooooooooxoooooropoxoooooooooooooooooboroxoxxooooooooooooooooroooooooooyooooooyoxooooboooororxorooooobgoooooogxooyorrybyoyxoyoyoxoooxooxooobroyxyxxoyboxpooxgoooyrxoxxgoooooogrbgxbooopxpoyxxbxyooporopxooooooxyyobxoxbxproroobyooyxxobpxoooooooxxoxoxooopxoyoooxogxxbxoobxryogoxoxopoxorxpxooxoxooroxxrox' },
};
