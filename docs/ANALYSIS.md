# Statistical analysis — why ≤ 5 adaptive screens find your place

_Generated 2026-11-20T11:34:36.063Z by `scripts/analysis.ts` · 1000 simulated students · 120 Example listings · 2500 particles · τ = 0.95 · cap 5 screens._
**Everything here is synthetic (Example data).** It shows the algorithm reliably finds what *our model* says is best; it does not show the model matches real students (that needs the survey + hallway test).

## 1. The model in one page

**Student (hidden).** A small Bayesian network: campus → commute mode → needs parking; budget ~ truncated Normal($1150, $260); value of time α ~ LogNormal(median $25/h, σ = 0.6); group size, laundry, pets, AC, quiet and lease flexibility as independent Bernoullis.

**Utility of listing j for student s** (dollars per person per month, higher is better):

`u(s, j) = −cost − α · commuteHours + 0.3 · budget · quality + AC/quiet bonuses − 4 · max(0, cost − budget)`

after hard filters (size, parking, laundry, pets, lease start). The student's "true best" is `argmax_j u(s, j)` — the answer a 17-screen form with perfect information would give.

**Belief.** We keep 2500 sampled students (particles). Each answer is evidence: answered nodes are fixed and each particle is re-weighted by the likelihood of the answer given its sampled parents (likelihood weighting, e.g. weight × P(mode | campus)). Then

`P(best = j | answers) = Σᵢ wᵢ · 1[bestᵢ = j] / Σᵢ wᵢ`

**Which question next.** The one with the largest expected information gain about which listing is best:

`gain(q) = H(best) − Σₐ P(a) · H(best | a)`, with `H = −Σ p log₂ p`.

Questions under 0.03 bits are never shown; dealbreaker items that are ≥ 95% predictable are assumed instead (shown as editable chips).

**Trade-off cards.** Each card offers "$X more per month to save 10 minutes each way", where X is set at the current *posterior median* of α — so every answer halves the remaining probability mass on α (binary search).

**When to stop.** As soon as P(true best ∈ our top 3) ≥ τ = 0.95, or after 5 required screens. That probability is the confidence meter on screen.

## 2. Headline results (production policy: τ = 0.95, cap 5)

| | Result |
|---|---|
| True best in our top 3 | **98.1%** (Wilson 95% CI 97.1%–98.8%) |
| Exact one-sided binomial test, H0: accuracy ≤ 95% | p = 2.9e-7 → reject H0 |
| True best is our #1 | 68.8% |
| Screens used | 3.33 on average (cap 5; Apartment List uses 17) |
| Adaptive vs fixed order, same screens | McNemar b = 242, c = 6, p = 2.4e-50; paired difference 23.6% (bootstrap 95% CI 20.9%–26.2%) |
| Power | n = 253 students would detect 98% vs 95% at α = .05, power .8; we ran 1000 (achieved power ≈ 100%) |

## 3. Why 5 screens are enough: uncertainty falls fast

Starting uncertainty about which of 120 listings is best: **5.90 bits** (≈ 60 equally likely candidates).

| After screen | Mean entropy (bits) | Mean confidence | Adaptive top-3 hit | Fixed-order top-3 hit |
|---|---|---|---|---|
| 0 | 5.90 | 12.9% | 13.0% | 13.0% |
| 1 | 3.64 | 45.0% | 43.1% | 43.1% |
| 2 | 2.17 | 77.8% | 78.1% | 55.9% |
| 3 | 1.40 | 91.3% | 90.2% | 71.2% |
| 4 | 0.79 | 98.6% | 98.5% | 80.0% |
| 5 | 0.54 | 99.6% | 99.2% | 99.3% |

Each screen removes on average 1.14 bits. By screen 3 the remaining uncertainty is about 1.4 bits — a handful of candidates, which is why a **top 3** is the right thing to show.

### Does the engine's predicted gain come true?
Over 4706 screens: predicted 1.127 bits, realized 1.139 bits per screen; correlation r = 0.81. Paired t-test of (realized − predicted): mean 0.012, t = 1.57, p = 0.1168. The forecasts are close to unbiased — the engine knows how much each question will help before asking it. The smallest gain ever shown was 0.032 bits (threshold 0.03).

| Question | Times asked | Predicted gain | Realized gain |
|---|---|---|---|
| group | 1000 | 2.24 | 2.25 |
| deal | 1014 | 1.52 | 1.46 |
| budget | 944 | 0.68 | 0.78 |
| base | 865 | 0.71 | 0.70 |
| mode | 512 | 0.32 | 0.33 |
| card | 371 | 0.28 | 0.30 |

### The order adapts to the student
37 different question orders were used across 1000 students.

| Screen | group | deal | budget | base | mode | card |
|---|---|---|---|---|---|---|
| 1 (n=1000) | 100% | 0% | 0% | 0% | 0% | 0% |
| 2 (n=1000) | 0% | 100% | 0% | 0% | 0% | 0% |
| 3 (n=988) | 0% | 0% | 56% | 41% | 2% | 0% |
| 4 (n=937) | 0% | 0% | 41% | 46% | 9% | 4% |
| 5 (n=781) | 0% | 1% | 1% | 4% | 52% | 43% |

## 4. Choosing τ and the screen cap

| τ | Avg screens | Top-3 hit (95% CI) | Top-1 |
|---|---|---|---|
| 0.8 | 2.67 | 90.8% (88.8%–92.4%) | 57.2% |
| 0.85 | 2.98 | 95.3% (93.8%–96.4%) | 63.2% |
| 0.9 | 3.10 | 96.2% (94.8%–97.2%) | 65.7% |
| 0.95 | 3.33 | 98.1% (97.1%–98.8%) | 68.8% |
| 0.97 | 3.48 | 98.9% (98.0%–99.4%) | 70.6% |
| 0.99 | 3.71 | 99.4% (98.7%–99.7%) | 72.5% |

| Cap (τ = 0.95) | Avg screens | Top-3 hit | Top-1 |
|---|---|---|---|
| 1 | 1.00 | 43.1% | 17.0% |
| 2 | 2.00 | 78.1% | 44.2% |
| 3 | 2.80 | 90.0% | 58.2% |
| 4 | 3.24 | 97.5% | 67.8% |
| 5 | 3.33 | 98.1% | 68.8% |
| 6 | 3.35 | 98.2% | 68.8% |
| 7 | 3.35 | 98.2% | 68.9% |
| 8 | 3.35 | 98.2% | 69.0% |

τ = 0.95 with a cap of 5 sits at the knee: tighter τ costs extra taps for little accuracy; a cap above 5 is almost never reached.

## 5. Is the confidence meter honest?

| Meter shows | Screens | Mean shown | Actually right |
|---|---|---|---|
| 0%–20% | 1000 | 12.9% | 13.0% |
| 20%–40% | 463 | 37.6% | 36.9% |
| 40%–60% | 510 | 46.7% | 50.2% |
| 60%–80% | 736 | 69.8% | 66.7% |
| 80%–90% | 409 | 84.2% | 82.9% |
| 90%–95% | 227 | 92.8% | 90.7% |
| 95%–100% | 981 | 98.9% | 98.2% |

- Expected calibration error: **1.4 points** (bar ≤ 5).
- Hosmer–Lemeshow: χ² = 353.8, df = 8, p < 1e-15 (H0: calibrated). With 4,326 screens the test detects even small gaps: every bin above is within 3.5 points of reality, and the ECE (1.4 points) measures how large the miscalibration actually is. We report the rejection rather than hide it.
- Brier score 0.139 vs 0.242 for a constant forecast → skill 42.6%.

## 6. Do the trade-off cards learn what your time is worth?
For 709 students who saw at least one card, the median error in α (as a factor) went from **×1.46** before the cards to **×1.13** after. Wilcoxon signed-rank: z = 18.77, p < 1e-15.

| Cards seen | Students | Median error before | Median error after |
|---|---|---|---|
| 1 | 287 | ×1.43 | ×1.27 |
| 2 | 203 | ×1.35 | ×1.12 |
| 3 | 219 | ×1.69 | ×1.07 |

## 7. Decision sensitivity: big changes move the pick, tiny ones don't

| Change to the student | Students | #1 pick changed |
|---|---|---|
| Budget +$10 (trivial) | 1000 | 3.3% |
| Value of time ×1.05 (trivial) | 1000 | 2.5% |
| Budget −$250 | 1000 | 35.7% |
| Budget +$250 | 1000 | 41.3% |
| Campus Central ↔ North | 1000 | 64.5% |
| Walk ↔ bus | 1000 | 27.0% |
| In-unit laundry toggled | 999 | 65.7% |
| Value of time ×2 | 1000 | 28.8% |

Budget −$250 vs budget +$10: two-proportion z = 18.3, p < 1e-15. The recommendation responds to real changes in how a student lives and is stable under noise.

**What drives the #1 pick** (average share of the score): rent 63%, commute time 18%, quality 7%, extras 3%, over-budget penalty 9%.

## 8. Neutral marketplace
Landlord is not an input to the engine. Randomly permuting landlord labels across all 120 listings changed **0 of 1000** #1 picks.

| Landlord (fictional) | Share of listings | Share of #1 picks |
|---|---|---|
| Hackberry Lane | 8.3% | 9.0% |
| Maize & Blue Rentals | 18.3% | 20.1% |
| Arbor Property Co. | 12.5% | 9.3% |
| Huron View Living | 11.7% | 19.9% |
| Kerry Lane Homes | 14.2% | 10.9% |
| Packard PM | 3.3% | 1.1% |
| Northwood Residential | 11.7% | 9.2% |
| J. Lee (house owner) | 7.5% | 8.7% |
| M. Patel (house owner) | 12.5% | 11.8% |

Differences come from location, price and features, not from who the landlord is.

## 9. Engineering: is 2500 particles enough, and is it fast?

| Particles | SD of confidence across seeds | #1 agrees with a 20,000-particle reference | ms per step |
|---|---|---|---|
| 250 | 0.98 pts | 96.8% | 1.5 |
| 500 | 0.82 pts | 97.6% | 2.8 |
| 1000 | 0.59 pts | 98.4% | 5.7 |
| 2500 | 0.33 pts | 99.2% | 14.3 |
| 5000 | 0.24 pts | 100.0% | 27.2 |

Monte Carlo error falls as particles^-0.50 (theory: −0.5). At 2500 particles the confidence meter wobbles by about 0.3 points between seeds, and we fix the seed so judges see the same answer twice.

- One engine step: p50 15.9 ms, p95 30.1 ms (server).
- Effective sample size after likelihood weighting: mean 1980 of 2500 (79%), minimum 438 — the weights never collapse, so the posterior stays well estimated.

## 10. Assumptions and limits
- Priors (campus mix, budgets, value of time, amenity rates) are invented. Robustness runs in `reports/validation.md` shift them ±20% and still reach 97–99% top-3; 10% wrong answers drops it to ~83%.
- "True best" is defined by our utility function; if real students weigh things differently, accuracy against *their* choices will be lower. Next: a ~100-student survey and a 15-minute hallway test.
- Commute uses a synthetic timetable stand-in (Estimated), not TheRide GTFS.

_Runtime 371 s. Reproduce: `npx tsx scripts/analysis.ts`._
