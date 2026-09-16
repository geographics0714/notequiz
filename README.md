# NoteQuiz

An offline quiz generator that studies **your own notes**. Point it at a text
file and it will write quiz questions from it, ask you each one, and grade
your answers — entirely on-device, using [Tether's QVAC SDK](https://github.com/tetherto/qvac).

No API key, no cloud calls, no usage bill. The model (`LLAMA_3_2_1B_INST_Q4_0`)
is downloaded once on first run and everything after that runs locally on
your machine.

## What it does / which QVAC function it calls

NoteQuiz calls `loadModel` to load a small local LLM, then calls `completion`
twice per question: once to generate quiz questions from your notes, and
once to grade your typed answer against those notes — all inference happens
on-device.

Grading asks the model for a one-sentence plain-language judgment rather
than a literal "CORRECT"/"INCORRECT" token — at this model size, forcing
that exact token turned out to bias the model toward always answering
"CORRECT" regardless of context. Asking for prose and classifying it
locally (`app.js`, see `classify()`) was far more reliable in testing.

## SDK version

Built and tested with `@qvac/sdk` `0.19.1`.

## Install

Requires Node.js `>= 22.17`.

```bash
npm install
```

## Run

```bash
node app.js [notesFile] [numQuestions]
```

Defaults to the bundled `notes.txt` (a handful of biology facts) and 5
questions:

```bash
node app.js
```

Or quiz yourself on your own notes:

```bash
node app.js my-notes.txt 8
```

The first run downloads the model (roughly 1GB), so it needs an internet
connection once. Every run after that — and all inference — is fully
offline.

### Example session

```
$ node app.js
Loading QVAC model on-device (first run downloads it, ~1GB)...

Model loaded.

Quiz time! 5 question(s), answer in your own words.

Q1: What is the organelle responsible for producing ATP through cellular respiration?
Your answer: the mitochondria
✅ CORRECT — The student answer correctly identifies the mitochondria as the organelle responsible for producing ATP through cellular respiration.

...

Final score: 4/5
```

## Why I built this

Studying from your own notes with an AI quiz partner is genuinely useful,
but sending your notes to a cloud API to do it feels backwards for
something this personal. QVAC runs the whole thing — question generation
and grading — on your own machine, so your notes never leave your laptop.

## License

MIT — see [LICENSE](LICENSE).
