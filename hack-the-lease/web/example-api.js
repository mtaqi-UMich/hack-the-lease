// Example: how the website uses the shared prompt.
// Works as a Vercel / Next.js API route (rename to app/api/advisor/route.js or pages/api/advisor.js)
// or any Node server. Needs ANTHROPIC_API_KEY in your environment (never commit it).

import { APP_PROMPT } from "../prompt/systemPrompt.js";

// Option A (default): build-time import above — prompt updates on every redeploy.
// Option B: fetch live from GitHub so it updates without redeploying (repo must be public):
// const APP_PROMPT = await fetch(
//   "https://raw.githubusercontent.com/<owner>/hack-the-lease/main/prompt/APP_PROMPT.md"
// ).then((r) => r.text());

export async function POST(req) {
  const { messages, listings } = await req.json();

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5-5",
      max_tokens: 800,
      system: `${APP_PROMPT}\n\n## Listings (synthetic)\n${JSON.stringify(listings)}`,
      messages,
    }),
  });

  const data = await res.json();
  return Response.json({ reply: data.content?.[0]?.text ?? "", raw: data });
}
