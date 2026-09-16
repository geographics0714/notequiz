// NoteQuiz — an offline quiz generator that studies your own notes.
// Everything runs on-device via Tether's QVAC SDK: no API key, no network calls for inference.

import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  loadModel,
  completion,
  unloadModel,
  close,
  LLAMA_3_2_1B_INST_Q4_0,
} from '@qvac/sdk';

const NOTES_PATH = process.argv[2] || 'notes.txt';
const NUM_QUESTIONS = Number(process.argv[3] || 5);

function progressBar(p) {
  const mb = (n) => (n / 1e6).toFixed(1);
  output.write(`\rDownloading model: ${p.percentage.toFixed(0)}% (${mb(p.downloaded)}/${mb(p.total)} MB)  `);
}

async function ask(modelId, prompt, options = {}) {
  const result = completion({
    modelId,
    history: [{ role: 'user', content: prompt }],
    stream: true,
    kvCache: false,
    ...options,
  });
  let text = '';
  for await (const token of result.tokenStream) {
    text += token;
  }
  return text.trim();
}

// A small on-device model asked to output a literal CORRECT/INCORRECT token is
// unreliable (it strongly favors "CORRECT" regardless of context). So instead we
// only ask it to explain its judgment in plain language, then classify that
// explanation locally by looking for the telltale phrases it consistently uses.
const GRADE_SYSTEM_PROMPT =
  'You are a fair grading assistant. Using ONLY the notes as ground truth, write exactly one ' +
  'sentence judging whether the student answer correctly addresses the question. A brief but ' +
  'accurate answer counts as correct even if informally phrased. A blank answer, "I don\'t know", ' +
  'an off-topic answer, or one that contradicts the notes is wrong. Do not use the words CORRECT ' +
  'or INCORRECT in your sentence — describe the judgment in plain language instead.';

// Judgment words the model tends to use, and the negators that can precede them
// and flip their polarity (e.g. "does NOT accurately describe" is a negative
// verdict even though it contains "accurately"; "does NOT contradict" is a
// positive verdict even though it contains "contradict"). A bare keyword match
// with no negation check is not enough — it gets fooled by exactly this.
const NEGATOR = "(?:not|n't|no|never|without|fails?\\s+to)";
const POSITIVE_WORD = '(?:correct(?:ly)?|accurate(?:ly)?|match(?:es)?|address(?:es)?)';
const NEGATIVE_WORD = '(?:incorrect(?:ly)?|inaccurate(?:ly)?|wrong|contradict(?:s)?|off-?topic)';

const NEGATED_POSITIVE = new RegExp(`\\b${NEGATOR}\\b(?:\\s+\\S+){0,3}?\\s+${POSITIVE_WORD}\\b`, 'i');
const NEGATED_NEGATIVE = new RegExp(`\\b${NEGATOR}\\b(?:\\s+\\S+){0,3}?\\s+${NEGATIVE_WORD}\\b`, 'i');
const PLAIN_POSITIVE = new RegExp(`\\b${POSITIVE_WORD}\\b`, 'i');
const PLAIN_NEGATIVE = new RegExp(`\\b${NEGATIVE_WORD}\\b`, 'i');

function classify(reasoning) {
  // Check negated forms first — they override the plain (unnegated) reading of
  // the same keyword, which is exactly the case that broke the naive version.
  if (NEGATED_POSITIVE.test(reasoning)) return false;
  if (NEGATED_NEGATIVE.test(reasoning)) return true;
  if (PLAIN_NEGATIVE.test(reasoning)) return false;
  if (PLAIN_POSITIVE.test(reasoning)) return true;
  return false;
}

async function grade(modelId, notes, question, answer) {
  const result = completion({
    modelId,
    history: [
      { role: 'system', content: GRADE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `NOTES:\n${notes}\n\nQUESTION: ${question}\nSTUDENT ANSWER: ${answer || '(blank)'}`,
      },
    ],
    stream: true,
    kvCache: false,
    generationParams: { predict: 80, temp: 0 },
  });
  let text = '';
  for await (const token of result.tokenStream) {
    text += token;
  }
  const feedback = text.trim() || '(no explanation given)';
  return { correct: classify(feedback), feedback };
}

async function main() {
  let notes;
  try {
    notes = await readFile(NOTES_PATH, 'utf-8');
  } catch {
    console.error(`Could not read notes file "${NOTES_PATH}". Usage: node app.js [notesFile] [numQuestions]`);
    process.exit(1);
  }

  console.log('Loading QVAC model on-device (first run downloads it, ~1GB)...\n');
  const modelId = await loadModel({
    modelSrc: LLAMA_3_2_1B_INST_Q4_0,
    modelType: 'llm',
    modelConfig: { ctx_size: 4096 },
    onProgress: progressBar,
  });
  output.write('\n\nModel loaded.\n\n');

  const genPrompt =
    `Generate exactly ${NUM_QUESTIONS} short quiz questions based ONLY on the notes below. ` +
    `Output one question per line, no numbering, no extra commentary, no blank lines.\n\n` +
    `NOTES:\n${notes}`;

  const raw = await ask(modelId, genPrompt);
  const questions = raw
    .split('\n')
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, NUM_QUESTIONS);

  if (questions.length === 0) {
    console.error('The model did not return any questions. Try again or check your notes file.');
    await unloadModel({ modelId });
    await close();
    process.exit(1);
  }

  const rl = createInterface({ input, output });
  let score = 0;
  let answered = 0;

  console.log(`Quiz time! ${questions.length} question(s), answer in your own words.\n`);

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`Q${i + 1}: ${q}`);
    let answer;
    try {
      answer = await rl.question('Your answer: ');
    } catch {
      console.log('\nInput closed, ending quiz early.');
      break;
    }
    answered++;

    const { correct, feedback } = await grade(modelId, notes, q, answer);
    if (correct) score++;

    console.log((correct ? '✅ CORRECT — ' : '❌ INCORRECT — ') + feedback);
    console.log('');
  }

  console.log(`Final score: ${score}/${answered}`);

  rl.close();
  await unloadModel({ modelId });
  await close();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
