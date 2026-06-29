// Quick smoke test of the chord regex and superscript merging logic
const CHORD_RE = /^([A-G][b#]?)(maj|min|dim|aug|m|M)?(\d+)?(\([0-9]+\))?(sus\d*|add\d*)?(\/[A-G][b#]?)?$/;
const SUPERSCRIPT_RE = /^(\d+|sus\d*|maj\d*|add\d*|dim|aug|m|\(\d+\))$/i;

function isChord(t) { return CHORD_RE.test(t.trim()); }

// All these should be TRUE
const shouldPass = [
  'C','G','D','A','E','F','B',
  'Cm','Gm','Dm','Am','Em','Fm','Bm',
  'Cm7','Fm7','Am7','Em7','Gm7','C#m7','F#m7',
  'Cmaj7','Gmaj7','Fmaj7','Dmaj7',
  'C7','G7','D7','A7','F7','B7',
  'Csus','Gsus','Dsus','Asus','Bsus','Fsus',
  'Csus2','Csus4','A7sus','A7sus4','Fsus4',
  'Db','Eb','Ab','Bb','Gb','F#','C#','G#',
  'Db2','Eb2','Ab2','A2','D2',
  'Eb(4)','F(4)','Eb(4)',
  'C/E','G/B','D/F#','A/C#','F/A','Bb/D','Eb/G','Ab/C',
  'A2/C#','D2/F#','Bb/D','Fmaj7/A',
  'Gm7','Bbm','C#m','Fm7','Bb',
];

// All these should be FALSE (lyrics / non-chord words)
const shouldFail = [
  'All','Lord','God','Jesus','Holy','My','Your','In','The',
  'Come','Thou','Fount','Every','Blessing',
  'Praise','Sing','Heart',
];

let pass = 0, fail = 0;
for (const c of shouldPass) {
  if (!isChord(c)) { console.log(`FAIL (should be chord): "${c}"`); fail++; } else pass++;
}
for (const c of shouldFail) {
  if (isChord(c)) { console.log(`FAIL (should NOT be chord): "${c}"`); fail++; } else pass++;
}
console.log(`\nChord regex: ${pass} passed, ${fail} failed`);

// Test superscript regex
const sups = ['7','2','sus','sus4','maj7','(4)','m','add9'];
const nonSups = ['Fm','Ab','D/F#','hello','Lord'];
console.log('\nSuperscript detection:');
for (const s of sups) console.log(`  "${s}" → ${SUPERSCRIPT_RE.test(s) ? 'SUP ✓' : 'NOT SUP ✗'}`);
for (const s of nonSups) console.log(`  "${s}" → ${SUPERSCRIPT_RE.test(s) ? 'SUP ✗' : 'NOT SUP ✓'}`);
