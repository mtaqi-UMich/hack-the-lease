import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import cache from '@/data/extract-cache.json';
import {
  sanitize, ruleExtract, enforceEvidence, questionsFor, toEngineListing, rankBrought,
  EXTRACT_SCHEMA, EXTRACT_SYSTEM, FIELD_KEYS, FIELD_LABELS, type Extracted, type FieldKey,
} from '@/lib/extract';
import type { Profile } from '@/lib/session';

export const maxDuration = 20;

// POST { text?: string, fields?: {address, rent, price_basis, beds}, answers?: {price_basis?, beds?}, profile?, mode?: 'auto'|'rules'|'cache' }
// Never fetches URLs. Personal data is stripped before any model call. Result is private to this request.
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const profile: Profile = b.profile ?? {};
  let fields: Extracted[]; let source: 'ai' | 'rules' | 'cache' | 'form'; let text = ''; let redactions = 0; let note = '';

  if (b.mode === 'cache' || (!b.text && !b.fields)) {
    fields = cache.fields as Extracted[]; source = 'cache'; text = cache.text; redactions = cache.redactions;
  } else if (b.fields) {
    // 4-field form: the student typed it, so every value is "Listed" with the form as evidence
    source = 'form';
    const f = b.fields as Record<string, unknown>;
    fields = FIELD_KEYS.map(k => {
      const v = f[k]; const has = v !== undefined && v !== null && v !== '';
      return { key: k, label: FIELD_LABELS[k], value: has ? (k === 'rent' || k === 'beds' ? Number(v) : (v as string)) : null, evidence: has ? 'Entered by you' : null, status: has ? 'Listed' : 'Unknown' } as Extracted;
    });
    text = String(f.address ?? '');
  } else {
    const s = sanitize(String(b.text)); text = s.text; redactions = s.redactions;
    if (text.trim() === cache.text.trim()) { fields = cache.fields as Extracted[]; source = 'cache'; }
    else if (process.env.ANTHROPIC_API_KEY && b.mode !== 'rules') {
      try {
        const client = new Anthropic({ timeout: 8000, maxRetries: 0 });
        const response = await client.messages.create({
          model: 'claude-opus-5-5',
          max_tokens: 4000,
          output_config: { effort: 'low', format: { type: 'json_schema', schema: EXTRACT_SCHEMA as unknown as Record<string, unknown> } },
          system: EXTRACT_SYSTEM,
          messages: [{ role: 'user', content: `<listing_text>\n${text}\n</listing_text>` }],
        });
        if (response.stop_reason === 'refusal') throw new Error('refusal');
        const block = response.content.find(c => c.type === 'text');
        const parsed = JSON.parse(block && block.type === 'text' ? block.text : '{}') as { fields: { key: FieldKey; value: Extracted['value']; evidence: string | null }[] };
        fields = enforceEvidence(parsed.fields.map(f => ({ ...f, label: FIELD_LABELS[f.key], status: 'Listed' as const })), text);
        source = 'ai';
      } catch (e) {
        if (e instanceof Anthropic.APIError) note = `AI unavailable (${e.status ?? 'network'}); used our rule-based reader.`;
        else note = 'AI unavailable; used our rule-based reader.';
        fields = enforceEvidence(ruleExtract(text), text); source = 'rules';
      }
    } else { fields = enforceEvidence(ruleExtract(text), text); source = 'rules'; if (!process.env.ANTHROPIC_API_KEY) note = 'No AI key configured; used our rule-based reader.'; }
  }

  // answers to the "ask only when it matters" questions
  for (const [k, v] of Object.entries((b.answers ?? {}) as Record<string, string>)) {
    const f = fields.find(x => x.key === k); if (!f || v == null) continue;
    f.value = k === 'price_basis' ? (/person|bed/i.test(v) ? 'per_bed' : 'per_unit') : k === 'beds' ? Number(v) : v;
    f.evidence = 'Answered by you'; f.status = 'Listed';
  }

  const questions = questionsFor(fields);
  const { listing, missing, hood } = toEngineListing(fields, text);
  const rank = listing && !questions.length ? rankBrought(profile, listing) : null;
  return NextResponse.json({ fields, questions, source, redactions, note, hood, missing, rank, private: true, example: source === 'cache' });
}
