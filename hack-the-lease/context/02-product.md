# Product — what we're building

> Shared spec. Edit freely; the prompt rebuilds automatically on push.

## One-liner
A housing matcher that learns what a student *actually* values from a few quick trade-off choices, then ranks Ann Arbor apartments and explains why.

## Onboarding flow (target: ~5 clicks)
1. **Where's your week?** Central / North / Medical / Split / + work spot
2. **People + budget per person** (chips + slider)
3–4. **Two adaptive trade-off cards** (bisection on value of time vs. rent, e.g. "$200/mo cheaper but +20 min walk/day?")
5. **Dealbreakers** grid with must / nice toggles (in-unit laundry, AC, pets; parking only if they drive)
- Auto: lease = Fall 2027, 12 months (editable)
- Confidence meter: "We're 92% sure about your top 3 — refine?"

## Engine
- Weighted score per listing from learned weights (rent, commute time, amenities, dealbreakers).
- Next question = the one that best splits remaining synthetic profiles' top picks (ID3-style). Stop at ~90% agreement.
- Every recommendation shows a plain-English "why" (e.g. "You value your time at ~$18/hr, so B is worth the extra rent").

## Demo script (sensitivity)
Switch classes from mostly Central → mostly North; the #1 apartment flips live.

## Stretch
- Roommate mode: combine weights, show who compromises most, suggest fair rent split.
