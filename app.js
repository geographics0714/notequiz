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

async function ask(modelId, prompt) {
  const result = completion({
    modelId,
    history: [{ role: 'user', content: prompt }],
    stream: true,
  });
  let text = '';
  for await (const token of result.tokenStream) {
    text += token;
  }
  return text.trim();
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

  console.log(`Quiz time! ${questions.length} question(s), answer in your own words.\n`);

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`Q${i + 1}: ${q}`);
    const answer = await rl.question('Your answer: ');

    const gradePrompt =
      `You are a strict but fair grading assistant. Using ONLY the notes below as ground truth, ` +
      `decide if the student's answer is correct.\n\n` +
      `NOTES:\n${notes}\n\n` +
      `QUESTION: ${q}\n` +
      `STUDENT ANSWER: ${answer}\n\n` +
      `Respond with exactly one word on the first line — CORRECT or INCORRECT — ` +
      `then a one-sentence explanation on the next line.`;

    const verdict = await ask(modelId, gradePrompt);
    const isCorrect = /^correct/i.test(verdict.trim());
    if (isCorrect) score++;

    console.log(isCorrect ? '✅ ' + verdict : '❌ ' + verdict);
    console.log('');
  }

  console.log(`Final score: ${score}/${questions.length}`);

  rl.close();
  await unloadModel({ modelId });
  await close();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
