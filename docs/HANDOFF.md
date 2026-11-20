# Handoff: everything in one place

Everything from the build lives in this repo. Clone it and you have the lot:

```bash
git clone https://github.com/mtaqi-UMich/hack-the-lease.git
```

Then follow "Start here" in the [README](../README.md) to run it, and open Claude Code in the folder. It reads `CLAUDE.md` and `context/` on its own.

| What | Where |
|---|---|
| Live app (redeploys on every push to `main`) | https://hack-the-lease-kappa.vercel.app |
| Original build brief | [`KICKOFF.md`](../KICKOFF.md) |
| Product spec | [`docs/PRD.md`](PRD.md) |
| Build plan Claude followed (steps, time boxes, cut order) | [`docs/build-plan/BUILD-PLAN.md`](build-plan/BUILD-PLAN.md) |
| Team decisions, newest first | [`context/01-decisions.md`](../context/01-decisions.md) |
| Screen designs | `design/*.dc.html` |
| App code | `app/`, `components/`, `lib/` (engine in `lib/engine/`) |
| Example (synthetic) data | `data/` |
| 230 tests | `tests/` |
| 1,000-student validation | [`reports/validation.md`](../reports/validation.md), page `/evidence` |
| Full statistical analysis (hypothesis tests, calibration, τ and 5-tap justification, Monte Carlo) | [`docs/ANALYSIS.md`](ANALYSIS.md), `reports/analysis.json`, page `/analysis` |
| Renter-pain Pareto research mapped to features | [`docs/RESEARCH.md`](RESEARCH.md) |
| Pitch script and Q&A answers | [`docs/PITCH.md`](PITCH.md) |
| 5-minute demo click path | [`docs/DEMO.md`](DEMO.md) |
| Pitch deck source (14 slides with speaker notes) | [`docs/deck/`](deck/): `deck.json` sets the order and `slides/*.html` hold the slides |
| Original JS engine prototype | `prototype/` |

## The pitch deck

The deck itself is a Claude artifact: https://claude.ai/artifact/QnDucezQhwveBQXTyZDCWY

- **Its owner has to share it** (Share menu on the deck) before anyone else can open it.
- **To get a file:** from the deck you can export to PowerPoint or PDF. Drop the export into `docs/deck/` so the repo has a copy too.
- **For Claude:** `docs/deck/` is the editable source, so Claude can rebuild or change slides from it.

## Not in the repo, on purpose

- **The raw chat transcript.** This repo is public and the transcript holds private details, so it stays on the laptop that built it. Everything decided in the chat is in `context/01-decisions.md` and the docs above.
- **Secrets.** `ANTHROPIC_API_KEY` goes in `.env.local` locally or in Vercel's environment variables. Never commit it.
- **Vercel access.** The project belongs to the `mtaqi-2422` Vercel account. You don't need it: just push to `main` and the live site updates.

## To push changes

You need collaborator access on the GitHub repo (repo owner → Settings → Collaborators). A bot commits rebuilt prompt files whenever `context/` changes, so run `git pull --rebase` before you push.
