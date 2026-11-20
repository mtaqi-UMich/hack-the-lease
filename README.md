# Hack the Lease 🏠

Our hackathon project for Hackberry Lane: a tool that helps students pick housing based on how they actually live.

**Live app:** https://hack-the-lease-kappa.vercel.app — redeploys automatically on every push to `main`.
All listings, landlords and students in the app are synthetic (**Example** data).

## Start here (new laptop, ~5 minutes)

```bash
git clone https://github.com/mtaqi-UMich/hack-the-lease.git
cd hack-the-lease
npm install
npm run dev          # http://localhost:3000
npm test             # 230 tests, ~20 s
```

Windows PowerShell blocks `npm`/`npx` scripts on some laptops ("running scripts is disabled"). Use `npm.cmd` / `npx.cmd` instead — nothing else changes. If `git clone` fails with "Filename too long": `git config --global core.longpaths true`.

Optional: create `.env.local` with `ANTHROPIC_API_KEY=...` to let "Bring any listing" read pasted listings with Claude. Without it the rule-based reader and the cached example still work. Never commit `.env*`.

Then open Claude Code in this folder — it reads `CLAUDE.md` (all of `context/`) automatically.

| Command | What it does |
|---|---|
| `npm run dev` | local app |
| `npm test` | all Vitest suites (engine parity, scenarios, compare, bring-listing, landlord, robustness, fairness, speed, stats) |
| `npm run simulate` | 1,000-student validation → `reports/validation.{md,json}` (≈ 4 min) → shown on `/evidence` |
| `npm run analysis` | deep statistical analysis → `reports/analysis.json`, `docs/ANALYSIS.md` (≈ 8 min) → shown on `/analysis` |
| `npm run gen:data` | regenerate the 120 Example listings (seed 42) |
| `npm run prompt` | rebuild `CLAUDE.md` / `prompt/*` from `context/` |

### Where things are
| Path | What |
|---|---|
| `app/` | pages: `/` `/onboarding` `/id` `/results` `/compare` `/map` `/bring` `/apply` `/landlord` `/evidence` `/analysis`, and `app/api/*` |
| `lib/engine/` | the adaptive Bayesian engine (TypeScript port of `prototype/engine.js`) |
| `lib/session.ts` `lib/compare.ts` `lib/cost.ts` | student profile ↔ engine, compare cards and bench, true monthly cost |
| `lib/extract.ts` `lib/compliance.ts` `lib/apply.ts` | Bring any listing, Ann Arbor rules, pre-qualify and leads |
| `data/` | Example listings, landlords, commute table, cached extraction |
| `docs/` | `PRD.md`, `DEMO.md` (5-min script), `PITCH.md` (deck outline), `ANALYSIS.md` (stats), `RESEARCH.md` (renter pain Pareto) |
| `design/` | approved screen designs (visual spec) |

### Deploying
Push to `main` → Vercel builds and publishes within ~2 minutes (project `hack-the-lease` on Vercel). Pull requests get preview URLs. Check a build: `npx vercel ls` (after `npx vercel login`).

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
