# Validation report — Hack the Lease adaptive onboarding

_Generated 2026-11-20T11:00:42.016Z · 1000 simulated students · 120 Example listings · 2500 particles · τ = 0.95 · ≤ 5 required screens._
**All listings and students are synthetic (Example data).** Simulations show the algorithm finds what our model says is best with few questions; they do not show the model matches real students — that needs the survey and hallway test.

| Claim | Result | Bar | Pass |
|---|---|---|---|
| **H1** Same answer as the long form (top 3) | 98.1% (95% CI 97.1%–98.8%) · top-1 68.8% · 3.33 screens on average | ≥ 95% | ✅ |
| **H2** Optional questions help | top-1 68.8% → 73.0%; top-3 98.1% → 99.6%; +0.46 questions | top-1 rises, top-3 doesn’t drop | ✅ |
| **H3** Order matters | adaptive 98.1% vs fixed order 74.5% at the same clicks · McNemar b=242, c=6, p=2.35e-50 | adaptive better, p < 0.05 | ✅ |
| **H4** Confidence meter is honest | ECE 1.4 points over 4326 screens | ≤ 5 points | ✅ |

Fixed order with all 5 screens: top-3 99.3%. Screens used: 2 → 198, 3 → 362, 4 → 356, 5 → 84.

## H4 reliability table (every screen of every student)

| Confidence shown | Screens | Mean confidence | Actual top-3 hit |
|---|---|---|---|
| 0.0%–20.0% | 1000 | 12.9% | 13.0% |
| 20.0%–40.0% | 463 | 37.6% | 36.9% |
| 40.0%–60.0% | 510 | 46.7% | 50.2% |
| 60.0%–80.0% | 736 | 69.8% | 66.7% |
| 80.0%–90.0% | 409 | 84.2% | 82.9% |
| 90.0%–95.0% | 227 | 92.8% | 90.7% |
| 95.0%–100.0% | 981 | 98.9% | 98.2% |

## Robustness

| Scenario | n | Top-3 hit (95% CI) | Top-1 |
|---|---|---|---|
| Priors +20% (students richer, value time more, more North) | 300 | 97.0% (95% CI 94.4%–98.4%) | 67.0% |
| Priors −20% (students poorer, value time less, more Central) | 300 | 99.0% (95% CI 97.1%–99.7%) | 75.7% |
| 10% of answers wrong | 300 | 83.0% (95% CI 78.3%–86.8%) | 59.3% |
| Different population: North Campus only | 300 | 99.0% (95% CI 97.1%–99.7%) | 80.0% |
| Different population: drivers only | 300 | 99.3% (95% CI 97.6%–99.8%) | 86.7% |

## What-if: how the decision changes when one input changes

| Change | #1 | #2 | #3 |
|---|---|---|---|
| Baseline: 2 people, Central, bus, $1,150 | Geddes 2BR · $1,165 · 20 min | South U 2BR · $1,278 · 5 min | Old West Side 2BR · $981 · 26 min |
| Budget $1,000 | Lower Town 2BR · $1,086 · 18 min | Old West Side 2BR · $981 · 26 min | Geddes 2BR · $1,165 · 20 min |
| Budget $1,800 | South U 2BR · $1,537 · 8 min | Geddes 2BR · $1,379 · 19 min | Water Hill 2BR · $1,355 · 30 min |
| Classes on North Campus | Northwood 2BR · $1,172 · 10 min | Geddes 2BR · $1,165 · 23 min | Plymouth Rd 2BR · $1,088 · 23 min |
| Classes on Medical Campus | Geddes 2BR · $1,108 · 17 min | Geddes 2BR · $1,165 · 20 min | Northwood 2BR · $1,172 · 16 min |
| Walks instead of bus | South U 2BR · $1,278 · 5 min | Burns Park 2BR · $1,189 · 20 min | Old West Side 2BR · $981 · 26 min |
| In-unit laundry is a must | South U 2BR · $1,278 · 5 min | Lower Town 2BR · $1,086 · 18 min | Old West Side 2BR · $981 · 26 min |
| Values time highly (≥ $40/h) | South U 2BR · $1,278 · 5 min | Geddes 2BR · $1,165 · 20 min | Lower Town 2BR · $1,086 · 18 min |
| Match me with roommates | South U 3BR · $1,092 · 10 min | South U 4BR · $1,205 · 14 min | Downtown 5BR · $884 · 19 min |

_Runtime 251 s. Reproduce: `npm run simulate`._
