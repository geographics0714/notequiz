# Answer key for `notes.txt`

For reviewers checking that grading output matches the source notes. The app
generates question wording fresh each run (via `completion()`), so match by
topic rather than exact phrasing.

| Note in `notes.txt` | Canonical correct answer |
|---|---|
| Mitochondria produces ATP through cellular respiration | **the mitochondria** |
| Photosynthesis occurs in chloroplasts, converts CO2 + H2O into glucose + O2 using light | **photosynthesis occurs in the chloroplasts, converting carbon dioxide and water into glucose and oxygen using light** |
| DNA's four nucleotide bases | **adenine, thymine, guanine, and cytosine** |
| The heart's four chambers | **left atrium, right atrium, left ventricle, right ventricle** |
| Osmosis | **movement of water across a semipermeable membrane from an area of low solute concentration to an area of high solute concentration** |

## Known limitation, disclosed up front

Grading is done by a small on-device model (`LLAMA_3_2_1B_INST_Q4_0`) that
writes a one-sentence judgment, which the app then classifies locally (see
`classify()` in `app.js`). This is deliberately lightweight — it correctly
handles direct negation (e.g. "does not accurately address" → INCORRECT,
verified in `test_classify.mjs`) but can be lenient on **partial answers**
phrased with hedging language like "partially addresses X, but doesn't
mention Y" — the classifier's plain positive-keyword match ("addresses")
can outweigh a soft, non-negated qualifier later in the same sentence. This
is a known judgment-quality tradeoff of a small, fast, fully local model,
not a self-contradiction bug (the specific bug where the app's verdict
flatly contradicted its own stated explanation — e.g. explanation says
"does not accurately describe X" but scored CORRECT — was reported and
fixed in commit `6fab2fb`, covered by `test_classify.mjs`).

## How to verify

```bash
npm start
```
Answer each question using the table above (matched by topic) to see
consistent ✅ CORRECT results, or answer "i dont know" to any question to
see a consistent ❌ INCORRECT result with an explanation.
