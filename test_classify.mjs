// Quick standalone test of the classify() logic from app.js, using the exact
// failure cases a reviewer reported plus other adversarial phrasings.

const NEGATOR = "(?:not|n't|no|never|without|fails?\\s+to)";
const POSITIVE_WORD = '(?:correct(?:ly)?|accurate(?:ly)?|match(?:es)?|address(?:es)?)';
const NEGATIVE_WORD = '(?:incorrect(?:ly)?|inaccurate(?:ly)?|wrong|contradict(?:s)?|off-?topic)';

const NEGATED_POSITIVE = new RegExp(`\\b${NEGATOR}\\b(?:\\s+\\S+){0,3}?\\s+${POSITIVE_WORD}\\b`, 'i');
const NEGATED_NEGATIVE = new RegExp(`\\b${NEGATOR}\\b(?:\\s+\\S+){0,3}?\\s+${NEGATIVE_WORD}\\b`, 'i');
const PLAIN_POSITIVE = new RegExp(`\\b${POSITIVE_WORD}\\b`, 'i');
const PLAIN_NEGATIVE = new RegExp(`\\b${NEGATIVE_WORD}\\b`, 'i');

function classify(reasoning) {
  if (NEGATED_POSITIVE.test(reasoning)) return false;
  if (NEGATED_NEGATIVE.test(reasoning)) return true;
  if (PLAIN_NEGATIVE.test(reasoning)) return false;
  if (PLAIN_POSITIVE.test(reasoning)) return true;
  return false;
}

const cases = [
  // The two cases the reviewer explicitly reported:
  ['The explanation says the answer does not accurately describe photosynthesis.', false],
  ['The student correctly answers that mitochondria produce ATP through cellular respiration.', true],

  // Other negation patterns worth guarding against:
  ['The answer does not contradict the notes and correctly identifies the mitochondria.', true],
  ['This is not incorrect, the student identified the right organelle.', true],
  ['The student answer does not address the question about photosynthesis.', false],
  ['The student fails to address the key point about DNA bases.', false],
  ['The answer is completely off-topic and unrelated to the question.', false],
  ['The answer accurately matches what the notes say about the heart chambers.', true],
  ['The response is wrong because it names the wrong organelle.', false],
  ['The student answer correctly addresses the question by identifying the mitochondria.', true],
];

let pass = 0;
for (const [text, expected] of cases) {
  const got = classify(text);
  const ok = got === expected;
  pass += ok ? 1 : 0;
  console.log(`${ok ? 'PASS' : 'FAIL'}  expected=${expected} got=${got}  :: ${text}`);
}
console.log(`\n${pass}/${cases.length} passed`);
if (pass !== cases.length) process.exit(1);
