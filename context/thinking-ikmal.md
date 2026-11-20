# Ikmal's current thinking

> Write here freely: ideas, doubts, what you're working on, what you want Claude to keep in mind.
> Anything here goes into the shared prompt on the next push. Agreed decisions go in 01-decisions.md.

## Working on now
- Reviewing the brief against our plan; my earlier handoff doc scoped a shortlist-comparison site with a "Compare my Monday from these two apartments" day view.

## Ideas / opinions
- **Keep the Monday day-view as the signature moment.** Side-by-side departure, return, travel time and connection slack (next start − previous end − travel). Negative slack = missed connection. It complements the trade-off cards: cards learn weights, the day view makes the cost of a commute concrete.
- **Show the "why" with real numbers.** Example from my hand-check: Central apt $900/mo vs North apt $970/mo, with a 1 Central / 4 North week the North apt saves 2 h 10 min/week for $70/mo more. Quick weekly travel = sum of visits/week × (out + return).
- **Two sensitivity demos:** (1) flip the weekly Central/North split, (2) mark Private bedroom as Must have and a listing drops out with the reason shown.
- **Keep unknown ≠ no.** A missing amenity on a must-have means "Needs verification", not a confirmed match. Keep "unasked", "skipped", "doesn't matter" and "listing field unknown" as four separate states.
- **Adaptive question rule (MVP):** ask only if some plausible answer would change eligibility or the top pick; skip it if the leading options already agree. This matches the ID3-style next-question idea in 02-product.md.
- **SVM:** worth mentioning in Q&A as a later option, but we have no labelled student choices to train on, so rules and learned weights are the honest choice for now.
- **Add Kerrytown and the UgLi as destinations** (the brief names them), alongside Central and North.
- **Include one listing priced exactly at the budget** to show the "at budget passes" rule.
- **Roommates:** out of scope for the MVP unless time allows; have a one-line answer ready for Q&A.

## Open questions
- Which travel mode do we use for the bundled travel-time table, and are the times directional?
- Do we have any verified Haven on Geddes data (rent, fees, amenities), or is everything synthetic and labelled?
- Do the decision log's trade-off cards and my shortlist/day-view plan fit in one 5-minute demo, or do we cut one?
