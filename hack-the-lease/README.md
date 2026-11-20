# Hack the Lease 🏠

Our hackathon project for Hackberry Lane: a tool that helps students pick housing based on how they actually live.

## How the shared "brain" works

```
context/                     ← YOU EDIT THESE
  00-challenge.md            the brief, rubric, deadline
  01-decisions.md            what we've agreed (decision log)
  02-product.md              the product spec
  10-app-advisor.md          how the website's AI should behave
  thinking-taqi.md           Taqi's current thinking
  thinking-<partner>.md      partner's current thinking

        │  git push  →  GitHub Action runs scripts/build-prompt.mjs
        ▼

CLAUDE.md                    ← Claude Code reads this automatically (imports all context/)
prompt/TEAM_PROMPT.md        ← everything; paste into a Claude/ChatGPT chat or Project
prompt/APP_PROMPT.md         ← only product + advisor rules; used by the website's AI
prompt/systemPrompt.js       ← `import { APP_PROMPT } from "./prompt/systemPrompt.js"`
prompt/systemPrompt.json     ← same, for Python backends
```

**Never edit the generated files by hand.** Edit `context/`, push, and the prompt rebuilds itself within ~30 seconds.

## Daily workflow

```bash
git pull                       # get your partner's latest thinking
# edit context/thinking-<you>.md (or 02-product.md, 01-decisions.md)
npm run prompt                 # optional: rebuild locally to preview
git add -A && git commit -m "update thinking" && git push
```

- Changed your mind about something? → `thinking-<you>.md`
- Both agreed on something? → add a line to `01-decisions.md`
- Changing what the app does? → `02-product.md`
- Changing how the in-app AI talks? → `10-app-advisor.md`

Working with Claude Code in this repo? It already sees all of this through `CLAUDE.md`, so just `git pull` first.

## Using the prompt in the website

See `web/example-api.js`. Two options:
1. **Build-time import** (default): `import { APP_PROMPT } from "./prompt/systemPrompt.js"`. Updates whenever the site redeploys (Vercel redeploys on every push automatically if the repo is connected).
2. **Live fetch**: read `prompt/APP_PROMPT.md` from `raw.githubusercontent.com` at request time. Updates instantly, but needs a public repo.

Put `ANTHROPIC_API_KEY` in Vercel env vars / `.env` — never commit it.

## Setup for the partner
1. Accept the GitHub collaborator invite.
2. `git clone https://github.com/<owner>/hack-the-lease.git`
3. Rename `context/thinking-partner.md` → `context/thinking-<yourname>.md`, fill it in, push.
