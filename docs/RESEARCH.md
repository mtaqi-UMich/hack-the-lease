# Why we built it this way — renter pain research (Pareto)

_Compiled Nov 20, 2026 from secondary sources: large review-analysis studies (one of 1.5M reviews, one of 2M+ reviews), national renter surveys (Zillow, Apartments.com, NAA, Buildium, NLIHC, Fannie Mae, J Turner) and Reddit / app-store complaints. Reddit and ApartmentRatings were not scraped directly. **Before quoting a number on stage, keep the source name with it** — the figures below carry the attribution the research gave; several items still need their exact report links added._

## The 80/20: six issues cause most of the pain

| # | Issue | Size of the problem | Evidence |
|---|---|---|---|
| 1 | Unresponsive staff, poor service | Customer service appears in **55%** of 1–2★ reviews; **66%** of 2M+ reviews mention it; **78%** of renters move on within 3 days without a tour reply | Review analyses |
| 2 | Slow or poor maintenance | **25%** unhappy with repairs; **39%** say better follow-through is the #1 improvement (Buildium 2026) | Surveys |
| 3 | Hidden fees, unclear total cost | **76.9%** of renters at large companies pay at least one junk fee; **57%** drop a rental if fees push the total above the ad; **56.4%** would leave a bad review over surprise fees | Surveys |
| 4 | Inaccurate / stale listings | Already-rented listings, outdated photos and info, missing fee details (NAA); **99%** want unit-specific info | Survey + qualitative |
| 5 | Scams and low trust | **43.1%** have seen a suspected fraudulent listing; **9.1%** of 18–29-year-olds lost money; only **0.6%** fully trust listing sites | Surveys |
| 6 | Upfront costs and deposits | Nearly **half** name upfront costs as a top challenge (Fannie Mae); **84%** paid an application fee, **66%** applied 2+ times; **26%** denied their deposit | Surveys |

**The pattern:** the top problems are about trust, transparency and responsiveness, not the apartment itself. Renters feel surprised by costs and kept in the dark.

Two findings shape our product more than any other:
- **Comparing is the hardest part, not finding.** Renters name evaluating and comparing properties as their biggest pain nearly **2×** as often as finding listings, because of hidden fees, inconsistent pricing and missing details.
- **People regret what they didn't check.** The top regrets after signing are rent (26%), noise (26%) and safety (21%), yet noise and safety weren't in renters' top five considerations while searching.

## How each pain point maps to what we built

| Pain (rank) | What Hack the Lease does today | Where in the app | Strength |
|---|---|---|---|
| **3. Hidden fees** | One normalised *true monthly cost* per person: rent + required fees + utilities + parking + transport + laundry, each line labelled **Listed / Estimated / Unknown**. "No surprise fees" is a must-have filter. Landlord listing check refuses required fees outside rent (Ann Arbor ORD-26-04). | Compare cost rows; `/landlord` check; `lib/cost.ts`, `lib/compliance.ts` | **Strong** |
| **Comparing is 2× harder than finding** | Three places side by side with aligned rows, a time-vs-money sentence, and an X button that brings the next best match using your reason. | `/compare`, `lib/compare.ts` | **Strong** |
| **Regret: rent, noise, safety** | A **"Watch out"** line names each place's biggest downside for *you* (≥ 15 min a trip or ≥ $75 a month); *Quiet* and *Night walk* rows (route facts: lit streets, walk minutes, last bus — no crime data) on every card. | Compare "Before you sign" and "Your must-haves" | **Strong** |
| **6. Upfront costs** | 30-second pre-qualify with no SSN and no fee; one universal application reused across landlords; application fee capped at $50 and refundable; deposit ≤ 1.5× rent flagged. | `/apply`, `/landlord` | **Strong** |
| **4. Stale / inaccurate listings** | `verified_at` on every listing (Verified badge within 7 days); applications-open date (150-day rule); unknown fields shown as Unknown and pre-filled into the landlord message. | Compare header, Message sheet | Medium |
| **5. Scams, low trust** | Neutral ranking (landlord is not an input — tested); Bring any listing never fetches URLs, strips emails/phones and shows the exact sentence behind every value. | `/bring`, `/analysis` neutrality | Medium |
| **1. Unresponsive staff** | Landlords get pre-qualified leads with budget, move-in date and *why* the student ranked them, so they can reply fast; the Message button pre-fills every open question. | `/landlord` leads, Message sheet | Partial — reply-time badge on the roadmap |
| **2. Maintenance** | Not addressed (we are pre-lease). | — | Roadmap: verified-tenant maintenance ratings per building |
| **Students: early signing, guarantors, flexible leases, roommates** | Applications-open date; non-August start as a must-have; pre-qualify routes "no US credit" to guarantor options; "Match me" routes to per-bed individual leases with roommate matching. | Onboarding, `/apply` | Strong |

## What this means for the pitch

> "Renters don't leave because of the apartment. They leave because they feel ignored and surprised. We fix the surprise before you sign."

1. Lead with **hidden fees + comparing**: the two biggest pain points we solve completely, and the most visible on screen (true monthly cost with labels).
2. Use the **regret** finding to justify the Watch-out line and the night-walk and quiet rows: we surface what students forget to check.
3. For Reid (operates leases): pre-qualified leads, honest listings, Ann Arbor compliance built in. Fewer unqualified inquiries means faster replies, which addresses pain #1 from the landlord side.
4. Be upfront: maintenance (#2) is post-lease and on the roadmap.

## Roadmap ranked by pain addressed
1. Reply-time badge + instant tour booking (pain #1, #4).
2. Verified-unit photos with timestamps (pain #4, #5).
3. Verified-tenant maintenance ratings per building (pain #2).
4. Move-in/move-out condition photos for deposit protection (pain #6).
