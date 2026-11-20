/* Pre-extracts the demo listing so "Bring any listing" works offline and can't be broken by a slow AI call.
 *   npx tsx scripts/gen-extract-cache.ts */
import { readFileSync, writeFileSync } from 'node:fs';
import { sanitize, ruleExtract, enforceEvidence, questionsFor } from '../lib/extract';

const raw = readFileSync('data/extract-example.txt', 'utf8');
const { text, redactions } = sanitize(raw);
const fields = enforceEvidence(ruleExtract(text), text);
writeFileSync('data/extract-cache.json', JSON.stringify({ raw, text, redactions, fields, questions: questionsFor(fields) }, null, 2));
console.log(fields.filter(f => f.status === 'Listed').map(f => `${f.key}=${JSON.stringify(f.value)}`).join('\n'), `\nredactions: ${redactions}`);
