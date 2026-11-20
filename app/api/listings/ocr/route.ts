import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 30;

// POST { image: "data:image/png;base64,..." } → { text, source: 'ai' }
// Transcribes a listing screenshot with Claude vision. The text then goes through the normal
// "Bring any listing" reader, so every value still has to quote a sentence from it.
// Returns 501 when no ANTHROPIC_API_KEY is set; the browser then falls back to on-device OCR (tesseract.js).
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'no_key' }, { status: 501 });
  const b = await req.json().catch(() => ({}));
  const m = String(b.image ?? '').match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m || !(TYPES as readonly string[]).includes(m[1])) return NextResponse.json({ error: 'bad_image' }, { status: 400 });
  if (m[2].length > 7_000_000) return NextResponse.json({ error: 'too_big' }, { status: 413 });
  try {
    const client = new Anthropic({ timeout: 25000, maxRetries: 0 });
    const response = await client.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 3000,
      output_config: { effort: 'low' },
      system: 'You transcribe screenshots of apartment rental listings. Output only the listing text you can read, in reading order, one sentence or line per line. Copy numbers, prices, fees and dates exactly. Do not summarise, guess, or add anything that is not visible. Skip navigation menus, ads and buttons.',
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: m[1] as typeof TYPES[number], data: m[2] } },
        { type: 'text', text: 'Transcribe this listing.' },
      ] }],
    });
    const text = response.content.filter(c => c.type === 'text').map(c => (c as { text: string }).text).join('\n').trim();
    if (!text) return NextResponse.json({ error: 'empty' }, { status: 422 });
    return NextResponse.json({ text, source: 'ai' });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Anthropic.APIError ? `ai_${e.status ?? 'network'}` : 'ai_failed' }, { status: 502 });
  }
}
