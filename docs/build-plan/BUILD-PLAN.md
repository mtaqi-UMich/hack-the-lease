# Hack the Lease — build plan (demo Fri Nov 20, 5:00 PM)

## Context
The repo `mtaqi-UMich/hack-the-lease` holds a full spec (`docs/PRD.md`), 9 approved screen designs (`design/*.dc.html`), and a working JS engine (`prototype/engine.js`, 13/13 tests pass — checked at 5:22 AM). KICKOFF.md asks for a Next.js + TS app on Vercel that implements every PRD section, ~200 tests, a 1,000-student simulation report, and a demo script. It is 5:30 AM, so there are ~11.5 h. Rubric: works 35%, framing 30%, evidence 20%, UX 15%. Must show decision sensitivity live and label all data "Example".

## Setup (step 0)
- Re-clone to `Documents\hack-the-lease` (`git -c core.longpaths=true clone`), move this session there. Push straight to `main` after each step.
- **Needs you:** (a) GitHub write access for whichever account the first push prompts for; (b) `vercel login` at deploy time; (c) your `ANTHROPIC_API_KEY` in `.env.local` / Vercel env if you want the live AI call — never committed. Without a key the cached example is used.

## Build order (PRD steps 1–10) — time boxes, ✅ = ships by 5 PM, ⏭ = later/roadmap
| # | Step | By 5 PM | Later | Time box |
|---|---|---|---|---|
| 1 | Scaffold Next.js App Router + TS + Tailwind + Vitest at repo root (keep `prompt` scripts and the Action untouched). Port `engine.js` → `lib/engine/` (rng, geo/commute, population, utility, infoGain, engine, simulate). Port T1–T13 to Vitest. | ✅ | — | 6:00–7:30 |
| 2 | `lib/types.ts` Listing schema (PRD 2.4); `scripts/gen-listings.ts` → `data/listings.json` (120 listings, seed 42, 12 hoods, ~8 fictional landlords + "Hackberry Lane" units, per-bed/per-unit, fees, utilities, app fee, applications-open date). `data/commute.json` precomputed walk/bike/bus per listing → campus; bus uses a **documented synthetic timetable stand-in labelled "Estimated"** (GTFS fetch attempted once; if it fails we don't burn time). `lib/db/schema.ts` (Postgres-ready, unused). | ✅ | Real GTFS/OSRM, Supabase | 7:30–8:30 |
| 3 | Onboarding: Main → Onboarding (engine-chosen required screens, ≤5, live confidence meter, "Something else matters? Add it" link) → IdCard → Results with "Sharpen my matches" card + scorecard drawer. `POST /api/onboarding/step`. | ✅ | .ics import | 8:30–10:15 |
| 4 | Compare: 3 aligned cards, true monthly cost w/ Listed/Estimated/Unknown breakdown, regret line (≥15 min/trip or ≥$75), time-vs-money sentence, top-5 + must-have rows (night walk route facts, Night Owl zone, TransLoc coverage, laundry, quiet), roommate-risk row, X sheet with reason chips + bench (6 by P(best), ≤2/building, reason updates α/budget, widen when dry). Badge computed in engine/API, **not rendered**. `GET /api/compare`, `POST /api/bench/next`. | ✅ | Phone swipe polish | 10:15–12:15 |
| 5 | Map page (Leaflet+OSM if tiles load, else stylised SVG from design) + 2 niche chips (Grocery, Bus stop) from synthetic POIs; `GET /api/poi`. | ✅ 2 chips | All 6 chips | 12:15–13:00 |
| 6 | Bring any listing: paste + 4-field form; `POST /api/listings/extract` with Anthropic JSON-schema output, evidence sentence per field, Unknown for missing, never fetches URLs, strips emails; cached example used when no key / timeout. | ✅ paste + cache | Screenshot, NuExtract, invite landlord | 13:00–13:45 |
| 7 | Apply: pre-qualify (`POST /api/prequalify`) + universal application mock submit (`POST /api/applications`). | ✅ | Screening, e-sign | 13:45–14:15 |
| 8 | Landlord: leads inbox (`GET /api/landlord/leads`) + listing form with compliance check (`POST /api/landlord/listing-check`: fee ≤$50 & refundable, required fees in rent, utilities disclosed, no criminal-history question, deposit ≤1.5× rent). | ✅ one screen | Full product | 14:15–14:45 |
| 9 | Tests → ~200 Vitest cases (table-driven suites: scenario 60, compare/bench 30, bring-listing 30, landlord 20, robustness 30, fairness 15, speed 15). `scripts/simulate.ts` (1,000 students) → `reports/validation.{md,json}`: H1 Wilson CI, H2, H3 McNemar, H4 reliability+ECE, priors ±20%, 10% wrong answers. `/evidence` page + what-if table (budget $1,000 vs $1,800; North vs Central). | ✅ | Load test at 200 concurrent | runs in background from ~11:00; finish 14:45–15:30 |
| 10 | Deploy to Vercel; `docs/DEMO.md` (click path, sensitivity moment, evidence page); verify cached fallback for every network call; rehearse in the browser at 390px and desktop. | ✅ | — | 15:30–16:30 |

Cut order if behind schedule: Map Leaflet → stylised map; niche chips → 1; scorecard drawer → read-only; robustness suite trimmed. Onboarding → Compare → sensitivity → Evidence never get cut.

## Engine decisions (logged in `context/01-decisions.md`, PRD wins for logic, design wins for UI)
- Stop rule: up to 5 required screens, early stop at P(top-3) ≥ τ = **0.95** (prototype default was 0.9; brief says 0.95).
- Engine keeps prototype behaviour; ported tests run on the prototype listing set (seed 7) for parity; the app uses the richer seed-42 `data/listings.json`.
- Walk speed 12.5 min/km × 1.3 detour; bus = walk to stop + timetable wait + ride + walk; MRide bus $0.
- Confidence badge exists in engine/API only (cut from Compare UI).
- Listing count 120 (decision log said ~30; brief/PRD say ~120).

## Files
- `app/` routes: `/`, `/onboarding`, `/id`, `/results`, `/compare`, `/map`, `/bring`, `/apply`, `/landlord`, `/evidence`, `app/api/**/route.ts`
- `components/` ported from each `design/*.dc.html` (`renderVals()` → props); shared `Nav`, `Pill`, `Card`, `ExampleBadge`; Tailwind theme tokens from the SpendLess palette.
- `lib/engine/*` (pure TS, shared), `lib/cost.ts`, `lib/compare.ts`, `lib/bench.ts`, `lib/compliance.ts`, `lib/extract.ts`, `lib/stats.ts` (Wilson, McNemar, ECE)
- `data/listings.json`, `data/commute.json`, `data/poi.json`, `data/extract-cache.json`
- `tests/*.test.ts`, `scripts/{gen-listings,gen-commute,simulate}.ts`, `reports/validation.{md,json}`, `docs/DEMO.md`
- Untouched: `context/` (except 01-decisions), `scripts/build-prompt.mjs`, `.github/workflows/build-prompt.yml`, `prototype/` (kept as reference).

## Verification (every step)
`npm test` green, `npm run build` passes, `npm run simulate` runs, then commit + push to main. UI steps are checked in the built-in browser at 390px and desktop against the design file. Final: click the full demo path on the Vercel URL with network calls blocked to confirm the fallbacks.
