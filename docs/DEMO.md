# Demo script — 5 minutes (Fri Nov 20, 5:00 PM, Ross R0230)

**Live:** https://hack-the-lease-kappa.vercel.app (evidence: `/evidence`, landlord: `/landlord`)

All data on screen is **Example** (synthetic). Say it once at the start; every card is labelled.

**Before you start (2 min before):** open the deployed URL in a fresh private window (or click **Get started**, which resets). Keep a second tab on `/evidence`, a third on `/landlord`. Phone (390 px) works too; desktop shows Compare best.

---

## 0:00 — The problem (30 s)
> "Students pick housing on Zillow-style filters: 17 screens on Apartment List, then tab-hopping, and the price you see isn't what you pay. We built a student-first marketplace for Ann Arbor that learns how you actually live in about 5 taps — and shows the real monthly cost, the real commute, and what you'll regret before you sign."

## 0:30 — Onboarding: 5 taps, live confidence meter (75 s)
Home → **Get started**. Point at the meter under the progress bar.

| Screen (engine picks the order) | Tap | Meter |
|---|---|---|
| Who are you living with? | **Me + 1 friend** | 13% → 37% |
| What won't you compromise on? | tap nothing (or **In-unit laundry**) → Continue | → ~49% |
| What can you spend? | leave **$1,150**, **Can stretch a bit** | → ~69% |
| Where are most of your classes? | **Central Campus** | → ~93% |
| How will you get to class? | **Bus (free with MCard)** | → 100% |

> "Notice it never asked about parking — 'bus' predicts you don't need it. Each question is the one with the highest expected information gain; the small line under the button shows the bits."

Lands on the **housing ID** → point at "Time is worth about $X–$Y an hour" (learned, not asked) → **Show my top 3**.

## 1:45 — Compare (60 s)
**Compare side by side.** Walk one card top to bottom:
- **True monthly cost**, each line with a dot: green = Listed, teal = Estimated, grey = Unknown — ask.
- **Commute** from timetables (Estimated) and hours a week.
- **Watch out** line (only when the gap is ≥ 15 min a trip or ≥ $75 a month).
- **Time vs money**: "Costs $X more but gives back Y hours — about $Z an hour. You value your time at ~$W, so it's (not) worth it."

Hit **X on #1 → "Too far" → Show me the next best match.** Toast: "Swapped in … — N min closer. Got it — your time is worth at least $…". The reason is a free extra answer.

## 2:45 — THE SENSITIVITY MOMENT (45 s) ← the brief's hard requirement
On the **What if…** bar (top of Compare or Results):
1. Tap **North** → #1 flips **South U 2BR → Northwood 2BR (89% chance it's your #1)**.
2. Tap **Central** again, then drag budget to **$1,000** → #1 becomes **Lower Town 2BR**.
> "One input changes, the recommendation changes, in the direction you'd expect — and we can tell you why."

## 3:30 — Bring any listing (30 s)
Results → **Add a listing from elsewhere** → **Try the Example listing**.
> "Paste any listing. We strip emails and phone numbers, never fetch a URL, and every value shows the exact sentence it came from — or it's marked Unknown. Then it's scored like everything else: 'This would rank #2 for you.'" (Pre-read example: works offline.)

## 4:00 — Landlord side (25 s) — for Reid
`/landlord` → leads arrive pre-qualified (budget, move-in, why they ranked you). **New listing · 2** → two Ann Arbor problems flagged ($40 amenity fee outside rent, utilities not disclosed) → **Fix 2 items and publish**.
> "Landlords pay per qualified lead; ranking is never for sale."

## 4:25 — Evidence (35 s) — for the 20%
`/evidence`:
- **H1** 98.1% of 1,000 simulated students get their full-information best in our top 3 (95% CI 97.1–98.8%) in **3.3 taps** on average.
- **H3** adaptive order 98.1% vs a fixed order 74.5% at the same number of taps — McNemar p ≈ 10⁻⁵⁰.
- **H4** confidence meter off by only 1.4 points.
- 213 automated tests. Honest limit: these prove the algorithm finds what our model says is best; the survey + hallway test is next.

---

## Q&A crib
- **"Isn't the data fake?"** Yes, all Example. Hackberry's real units drop in through the same schema (`lib/types.ts`, Postgres schema in `lib/db/schema.ts`). Real Haven on Geddes prices are in `data/validation/` for checking our numbers.
- **"How do you know the model matches real students?"** We don't yet — priors are invented. Robustness: priors ±20% still 97–99% top-3; 10% wrong answers drops to 83%, which is why every answer stays editable and X-reasons feed back.
- **"Why not just 5 fixed questions?"** A fixed order needs all 5 to reach 99.3%; adaptive gets 98.1% in 3.3 taps on average.
- **"Fair housing?"** Ranking uses stated preferences + listing facts only; no crime or demographic data; night walk = route facts (lit streets, walk minutes, last bus). Tested in `tests/fairness.test.ts`.
- **"Zillow terms?"** Bring-any-listing is private to the student, never enters our inventory, we never fetch URLs.
- **Roommates?** Out of scope today; "Match me" already routes to per-bed buildings with individual leases.

## If something breaks
- AI call slow/down → the Example listing is pre-read (no network). Without `ANTHROPIC_API_KEY` pasted text uses the rule-based reader.
- Map tiles blocked → map switches to the stylised map automatically.
- Everything else runs on bundled Example data — no database, no external calls.
- Local fallback: `npm run dev` → http://localhost:3000.
