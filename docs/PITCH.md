# Pitch — 5 minutes + 5 minutes Q&A

**Deck:** https://claude.ai/artifact/QnDucezQhwveBQXTyZDCWY (private until its owner shares it from the deck’s Share menu; exports to PowerPoint/PDF).
**Live app:** https://hack-the-lease-kappa.vercel.app · demo click path: `docs/DEMO.md` · numbers: `/evidence`, `/analysis`, `docs/ANALYSIS.md` · research: `docs/RESEARCH.md`.
All data on screen is Example (synthetic) — say it once on the cover.

| Time | Slide | One line to land |
|---|---|---|
| 0:00–0:10 | 1 Cover | “Find your place in 5 taps — real cost, real commute, and what you’ll regret.” |
| 0:10–0:40 | 2 Problem | Renters aren’t let down by apartments; they’re surprised. 57% walk away over fees; comparing is 2× harder than finding; 26% regret noise they never checked. |
| 0:40–1:10 | 3 80/20 | Six pains cause most complaints. We go all-in on the money-and-compare ones that decide the lease; maintenance is honestly roadmap. |
| 1:10–1:25 | 4 What we built | 5 taps → compare 3 on true cost → apply once. |
| **1:25–2:10** | **5 LIVE DEMO (45 s)** | Get started → Me + 1 friend → (no must-haves) → $1,150 → Central → Bus → meter 13% → 100%. Compare: one cost dot + Watch-out. **What if… North → #1 flips South U 2BR → Northwood 2BR (89%)**. Central + $1,000 → Lower Town 2BR. |
| 2:10–2:50 | 6 How it works | 2,500 possible students, Bayes re-weighting, ask the max-information-gain question; 5.9 bits → under 1 bit after 4 taps. |
| 2:50–3:25 | 7 Proof | 98.1% true best in top 3 (CI 97.1–98.8%, beats 95% p = 3×10⁻⁷), 3.3 taps vs 17, +24 pts vs fixed order (McNemar p ≈ 10⁻⁵⁰), meter off by 1.4 pts. |
| 3:25–3:50 | 8 Sensitivity | Campus flips #1 for 65%, laundry 66%, −$250 36%, +$10 only 3% (z = 18.3). |
| 3:50–4:25 | 9 Landlords & business | Pre-qualified leads; Ann Arbor check before publish; free to list, pay per qualified lead; landlord isn’t an input — 0 of 1,000 picks changed when names were shuffled. |
| 4:25–4:50 | 10 Close | “We fix the surprise before you sign.” Next: 100-student survey; Hackberry’s real units. Ask: 10 units + one leasing season. |

Backup slides 11–14 for Q&A: hypothesis tests, why τ = 0.95 and 5 taps, assumptions and limits, research sources.

## Likely questions → short answers
- **“Isn’t this all simulated?”** Yes — it proves the algorithm finds what our model says is best, with ~3 taps, and that the meter is honest. Whether the model matches real students is the survey + hallway test (slide 13).
- **“Why not a fixed 5-question form?”** It reaches 99.3% with all 5 questions; adaptive gets 98.1% in 3.3 — the win is taps (slide 12).
- **“Is the 95% meter real?”** Bins are within 3.5 points; ECE 1.4. Hosmer–Lemeshow flags the small gaps at n = 4,326 and we say so (slide 11).
- **“What if students answer wrong?”** 10% wrong answers → 83% top-3, so every answer stays editable and X-reasons feed back.
- **“Does Hackberry get a boost?”** No — landlord isn’t an engine input. 8.3% of listings, 9.0% of #1 picks.
- **“Fair housing?”** Stated preferences and listing facts only; no crime or demographic data; night walk is route facts.
- **“Zillow’s terms?”** Bring any listing is private to the student, never fetches URLs, never enters our inventory.
- **“Business?”** Free for students and for listing; landlords pay per qualified lead (Zillow Rentals’ model); ranking never for sale.
