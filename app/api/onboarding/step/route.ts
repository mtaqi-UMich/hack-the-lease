import { NextResponse } from 'next/server';
import { step, applyUIAnswer, type Profile } from '@/lib/session';

// POST { profile, answer?: { q: {id,threshold,dollars,items}, value }, sharpen?: boolean }
// → { profile, next_question, gain_table, confidence, top_candidates[9], predicted_prefs[], optional_questions[], ... }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  let profile: Profile = body.profile ?? {};
  if (body.answer?.q) profile = applyUIAnswer(profile, body.answer.q, body.answer.value);
  const out = step(profile, { sharpen: !!body.sharpen });
  return NextResponse.json({
    profile, next_question: out.next, raw_next: out.rawNext, done: out.done, reason: out.reason,
    screen: out.screen, max_screens: out.maxScreens,
    gain_table: out.gain_table, confidence: out.confidence, top_candidates: out.top_candidates,
    predicted_prefs: out.predicted_prefs, optional_questions: out.optional_questions,
    match_count: out.matchCount, alpha_range: out.alphaRange,
    student: { base: out.student.base, mode: out.student.mode, group: out.student.group, budget: Math.round(out.student.budget), parking: out.student.parking },
    example: true,
  });
}
