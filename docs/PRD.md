# Hack the Lease — Student Rental Marketplace PRD

Nov 20, 2026 · @Taqiuddin Tarmidi

## Summary

We are building a **student-first rental marketplace** — a new Zillow for college towns, starting in Ann Arbor. It is landlord-neutral: every landlord lists the same way and ranks only on fit. Hackberry Lane is the launch partner and first landlord, not the only one.

The product keeps the same architecture as the earlier plan, with one big change: we now own both sides of the market, so we also need a **landlord product** (listing, leads, applications) and a way to fill the site with listings on day one.

| Side | Who | What they do | Friction we remove |
| --- | --- | --- | --- |
| Renter, phase 1 | Students | 5 required adaptive questions, optional extras | 17 fixed screens on Apartment List |
| Renter, phase 2 | Students | Compare 3 places side by side, swap any one | Tab-hopping; per-bed vs per-unit price confusion |
| Renter, phase 3 | Students | Pre-qualify, one universal application, e-sign | Re-typing the same application for every landlord |
| Landlord | Property managers, small landlords | List once in a structured, honest format; get pre-qualified leads | Unqualified inquiries; manual screening; fee-disclosure rules |

**What changed from the previous version**

- Hackberry is no longer prioritised in rankings or in the X-button bench. The bench is the next best matches from the whole marketplace.
- New sections: positioning and business model, the landlord (supply) side, and a decision on the Cmd+A paste feature.
- Onboarding keeps 5 required questions and adds an optional "sharpen my matches" path, from the comment on the earlier draft.

**Latest additions (Nov 20, 02:45):** a "What won't you compromise on?" screen, an optional schedule-import button, the student housing ID card, and five new card elements — true monthly cost with Listed / Estimated / Unknown labels, real commute from bus timetables, a "what you'll regret" line, a time-vs-money sentence, and a "how sure are we" badge.

*All listings and student profiles in the current prototype are synthetic.*

## Positioning and business model

We win by being **narrow and deep**: student renters in one college town first, where Zillow is broad and shallow. Students search free; landlords pay, the same model that funds Zillow Rentals.

### Why there is room next to Zillow

- Rentals are Zillow's fastest-growing business: [up 26% to $220M in Q3 2026, now 30% of group revenue](https://www.onlinemarketplaces.com/?p=105754). The market is real and paid for by landlords.
- Zillow's own rentals lead says [renters search across multiple websites because no single place has every listing — "there's no MLS for rentals"](https://newsletter.rismedia.com/news/view/126525/). That fragmentation is our opening.
- Students have needs a general site ignores: per-bed vs per-unit pricing, roommate matching, guarantors, the academic-year lease cycle, and Ann Arbor's leasing rules.

### How we differ

|  | Zillow / Apartments.com | Us |
| --- | --- | --- |
| Search | Filters and a map; you do the sorting | 5 questions, then a ranked top 3 with reasons |
| Price | Whatever the landlord typed | One normalised "your cost per person per month" |
| Lease structure | Rarely shown | Required fields: per bed or unit, individual or joint, roommate matching |
| Students | One audience among many | The only audience |
| Landlord leads | Many unqualified inquiries | Pre-qualified renters with a known budget, move-in date and guarantor status |

### Who pays

The model follows Zillow's: [keep access free for consumers and charge landlords and other professionals for leads, ads and software](https://www.sharetribe.com/how-to-build/how-does-zillow-make-money/). Options, in the order we would test them:

1. **Free basic listings** for every landlord, to build supply fast.
2. **Pay per qualified lead** — the landlord pays only when a pre-qualified student starts an application.
3. **Landlord software subscription** — applications inbox, roommate matching for per-bed buildings, fee-compliance checker.
4. **Screening pass-through** — the application fee covers the screening report; never above Ann Arbor's $50 cap.

Ranking is never for sale. Paid placement, if any, is clearly labelled "Sponsored" and kept outside the top 3.

### Hackberry Lane's role

Hackberry is our **launch partner and first landlord**: real units to seed the site, and the first customer for the landlord tools. For the hackathon pitch: "We built the marketplace your units deserve to be on — one that sends you students who already fit and can already afford the place."

## High-level architecture

_Architecture diagram: see the live PRD doc (https://claude.ai/artifact/Dz7mQe8rTKmNd2prBhFF9a)._

The ranking engine sits between the two sides: it turns student answers into a top 3 and ranks every landlord's listings on fit alone. The universal application carries pre-qualified students to landlords' inbox. Screening, e-signature and property-management feeds are partners we connect to, not systems we build.

## Renter phase 1 — Onboarding

Every student answers **5 required screens**, chosen live by the engine. Anyone who wants a sharper match can add more, but nothing beyond the 5 is ever required.

### 1.1 Required question bank (the engine picks 5)

| Screen | Answer type | What it sets |
| --- | --- | --- |
| Who are you living with? | Alone / Match me with roommates / My group of N | group size; individual vs joint lease |
| Where does your week happen? | Central / North / Medical / Split | commute destination |
| How do you get around? | Walk / Bus / Bike / Drive | commute mode, parking need |
| Max rent per person | Slider $600–$2,000 | budget |
| Trade-off card | Yes / No | value of your time ($/hour), by binary search |
| What won't you compromise on? | Multi-select, only items that matter for this student | e.g. walking home safely at night, quiet, in-unit laundry, pets, AC, non-August start, private bath |

The order changes per student: each turn asks the screen with the highest expected information gain about which listing is best.

### 1.2 Optional: "Sharpen my matches" (your scorecard)

Built from the comment on the earlier draft. The recommended design, from least to most effort for the student:

1. **After the 5th screen** the results load immediately, with one card on top: "Sharpen my matches — 3 quick questions, about +6% confidence." The optional questions are also ordered by information gain, so the first one is the most useful.
2. **A "My scorecard" drawer**, reachable from results at any time, lists all \~20 attributes. Each one can be set to Must have / Nice to have / Don't care, or left on "We'll guess" with our predicted value shown.
3. **On each required screen**, one small text link under the answers: "Something else matters? Add it." It opens the scorecard without leaving the flow.

We recommend against a full button on every screen: it adds a decision to every screen and slows the 5 required answers. A small link plus the post-results card keeps the required path fast and the optional path easy to find.

**Class schedule (optional, not a priority).** One button at the bottom of the onboarding: "Import my class schedule (.ics) for exact commute times." Without it we use the campus answer; with it, every commute number becomes per-trip and per-day (see 2.6).

### 1.3 Preference vector (\~20 attributes)

| Group | Attributes |
| --- | --- |
| Core (always ranked) | cost per person, true total monthly cost, commute, lease start and length, bedrooms |
| Lease structure | individual vs joint, landlord roommate matching, guarantor required |
| Unit | in-unit laundry, AC, furnished, private bath, quiet, pets, parking |
| Neighbourhood (niche chips) | gym, grocery, late-night food, bus stop, study space, walk home at night |

Every attribute is in one of three states: **asked** (answered by the student), **predicted** (we guess, shown as an editable chip), or **unknown** (shown as "we don't know yet").

### 1.4 Algorithm

1. **Population model:** 2,500 sampled possible students from a small Bayesian network (campus → commute mode → parking need, budget → value of quality).
2. **Update:** each answer re-weights the particles (likelihood weighting).
3. **Score:** `−cost − value_of_time × commute_hours + quality and feature bonuses − over-budget penalty`, with hard filters for size, parking, laundry, pets and lease start.
4. **Choose the next screen:** `gain(q) = H(best) − Σ P(answer) × H(best | answer)`; skip anything under 0.03 bits.
5. **Predict the rest:** P(cares) per unasked attribute; ≥ 80% becomes an "assumed" chip; 20–80% becomes a candidate niche chip or optional question.
6. **Stop** after exactly 5 required screens. The confidence meter (P(true best is in the top 3)) is shown throughout, so a student can see when extra questions stop helping. Optional questions use the same math.

### 1.5 Data model and API

- `Answers` — `{ living, base, mode, budget, alphaLo, alphaHi, dealbreakers{}, scorecard{attr: must|nice|dont_care}, asked[] }`
- `POST /api/onboarding/step` → `{ next_question, gain_table, confidence, top_candidates[9], predicted_prefs[], optional_questions[] }`
- No account is needed for onboarding or results.

### 1.6 Your student housing ID card

The output of onboarding is a one-screen **housing ID card**: everything we know about what this student needs, built in about 5 clicks, and the thing that points them in the right direction.

| Field | Example | Source |
| --- | --- | --- |
| Living with | Match me with 3 roommates | asked |
| Week | North Campus, Tue/Thu 9 AM labs | asked / schedule import |
| Gets around | Bus | asked |
| Budget | Up to $1,150 per person | asked |
| Time is worth | About $12–$18 an hour | trade-off cards |
| Won't compromise on | Safe walk home at night, in-unit laundry | asked |
| We're assuming | No car, no pet, August start | predicted, tap to fix |

The card is the student's to keep and edit. With their permission it can be shared with roommates (to compare cards and find a group) and attached to an application so a landlord sees a pre-qualified, well-matched renter.

## Renter phase 2 — Compare

Three cards sit side by side, Apple-style, with rows aligned across them and every price normalised to "your cost per person per month". Behind them sits a bench of the next 6 best matches from the whole marketplace, from any landlord.

### 2.1 One card, top to bottom

1. **Header.** X button, listing name, area, landlord, "Verified" if confirmed in the last 7 days, "72% chance this is your #1", and a **How sure are we** badge: High / Medium / Low (see 2.6).
2. **Photo carousel.** Exterior, bedroom, floor plan, kitchen, bathroom.
3. **True monthly cost.** One big number, "$1,240 / person / month", with the lease badge (*individual · roommate matching* or *joint · $3,996 whole unit if you bring 3*). Tap to see the breakdown — rent, required fees, utilities, parking, transport, laundry — each labelled **Listed**, **Estimated** or **Unknown (ask the landlord)**.
4. **What you'll regret.** One amber line naming this place's biggest downside for *this* student: "Cheapest option, but your Tuesday and Thursday commute is 52 minutes each way."
5. **Real commute.** "4.8 hours a week commuting, 2 of them waiting at a bus stop in January", built from actual bus schedules and walk/bike routes for each trip in the student's week.
6. **Time vs money, in plain words.** On cards 2 and 3, compared with card 1: "B costs $110 more a month but gives you back 3 hours a week — about $9 an hour for your time. You value your time at about $15 an hour, so B is worth it."
7. **Your top 5 rows.** The 5 attributes that matter most to this student, including everything they refused to compromise on (e.g. "Walk home at night: 9 min, all on lit main streets"). Winner highlighted per row; rows where all 3 are equal collapse.
8. **Roommate-risk row.** "If a roommate leaves: you pay $0 extra" vs "you may owe up to $999 / month".
9. **Niche chips.** "+ Gym", "+ Grocery", "+ Late-night food", "+ Bus stop", "+ Study spots"; a tap adds that row to all 3 cards.
10. **Actions, top and bottom.** "Check if I qualify" (primary), "Message landlord" (pre-filled with every Unknown field as a question), "Save".

### 2.2 The X button

Tapping X opens a sheet with one optional row of reason chips — "Too expensive" / "Too far" / "Don't like the place" / "Skip" — and two choices:

| Choice | What happens |
| --- | --- |
| Show me the next best match | The top listing from the bench slides in, with its reason: "$40 cheaper, 4 min farther" |
| Compare a place I found elsewhere | Opens "Bring any listing" (see the decision section below); the result takes the empty slot |

The reason chip is a free extra question. "Too far" raises the value-of-time estimate and re-ranks the bench before the replacement is chosen.

### 2.3 Bench logic

- The next 6 listings by P(best), from any landlord, with at most 2 units per building so X never brings back a near-copy.
- Recompute after every X; when the bench runs dry, widen the search (budget +10%, one more area) and say so.
- **No landlord gets a ranking boost.** Sponsored listings, if we ever sell them, appear in a labelled row below the 3 cards.

### 2.4 Listing schema

```
Listing {
  id, landlord_id, source: direct | feed | bring_your_own, verified_at,
  address, lat, lng, beds, baths, sqft,
  price_basis: per_bed | per_unit, price_amount, unit_total,
  required_fees[], optional_fees[], utilities_included[],
  lease_type: individual | joint | both, roommate_matching: bool,
  lease_start, lease_months[], applications_open_on,
  amenities{laundry, ac, furnished, private_bath, pets, parking, gym_onsite},
  application_fee (≤ $50 in Ann Arbor), screening_criteria_url,
  photos[], landlord_contact
}
```

For listings landlords submit to us, `price_basis` and `lease_type` are **required fields**, so "unknown" disappears for our own inventory.

### 2.5 Niche-chip data and API

- OpenStreetMap places (Overpass API) and walking times (OSRM or OpenRouteService), pre-computed per listing.
- `GET /api/compare?ids=a,b,c` · `POST /api/bench/next {removed_id, reason}` · `GET /api/poi?ids=a,b,c&category=gym`

### 2.6 How each number on the card is computed

| Card element | Method | Data |
| --- | --- | --- |
| Real commute | For each trip in the student's week (from the schedule import, or 2 trips × 5 days to their campus), pick the fastest of walk, bike or bus. Bus time = walk to stop + wait + ride + walk; wait comes from the timetable at that hour. Winter view counts minutes spent outdoors waiting. | TheRide's [official GTFS feed](https://mobilitydatabase.org/feeds/gtfs/mdb-415) (permissive licence on [Transitland](https://rust-digger.code-maven.com/src/kactus-0.1.0/transitland-atlas/feeds/theride.org.dmfr.json)); U-M Transit ("Blue Bus") is [listed on Transitland](https://www.transit.land/places/United+States+of+America/Michigan/Ann+Arbor) — confirm its feed; OSRM walking and biking routes |
| True monthly cost | Rent + required fees + utilities + parking + transport + laundry. **Listed** = stated by the landlord (form, feed or evidence sentence); **Estimated** = our model (utilities by unit size and month, laundry by loads per week if no in-unit machine); **Unknown** = added to the landlord message. Bus transport is $0 for students: U-M community members with an MCard [ride TheRide free through MRide](https://ltp.umich.edu/transit/getting-around.php). | Listing fields; Ann Arbor's fee ordinance (phase 3) means required fees should already be inside rent |
| How sure are we | Share of this card's cost lines and top-5 rows that are Listed or verified. **High** ≥ 80% and verified within 7 days; **Medium** 50–79%; **Low** < 50%, or price basis unknown. Tapping the badge lists exactly what was estimated. This is our answer to the rubric's "decision quality and evidence". | Field labels above |
| What you'll regret | The attribute where this card is weakest among the 3, weighted by the student's priorities; shown only if the gap is meaningful (e.g. ≥ 15 extra minutes a trip or ≥ $75 a month), else "No big trade-off against your priorities." One line, plain words, using the schedule when we have it. | Engine scores per attribute |
| Time vs money | Extra monthly cost ÷ hours saved per month = price of an hour. Compared with the student's value of time from the trade-off cards (or hourly pay, if they add it to the scorecard). | Commute + cost above |
| Walk home at night | Route facts only: walking minutes from campus or the library at 11 PM, share of the route on lit main streets, and time to the last bus. No crime or demographic data. | City streetlight data ([Ann Arbor data catalog](https://geodev.btaa.org/catalog/372936ac-6b4f-49be-8244-d72685061917); the published layer is from 2014, so check for a newer one); GTFS last-trip times |

## Decision: keep the Cmd+A paste feature?

**Recommendation: keep it, but reshape it into "Bring any listing"** — paste text, drop a screenshot, or fill 4 fields — kept private to the student who added it and never used to grow our own inventory. Students will compare outside listings whether we help or not, and while our inventory is still thin this keeps them on our site.

### Why this needs a fresh decision now

As a Hackberry tool, pasting a Zillow listing was a student comparing options. As **a Zillow competitor**, the same feature carries more risk: Zillow's terms allow manual copying only for limited personal use and say you [cannot use Zillow data to develop competing products or services](https://www.olostep.com/blog/zillow-web-scraping). So the guardrails below are what make the feature acceptable, not optional extras.

### Options compared

| Option | Student value | Legal risk | Effort | Verdict |
| --- | --- | --- | --- | --- |
| A. Drop it | Low: students go back to tab-hopping | None | None | Too costly while our inventory is small |
| B. Cmd+A paste only | High on a laptop; awkward on a phone (no Cmd+A habit) | Medium | Medium | Too narrow |
| **C. "Bring any listing": paste, screenshot or 4-field form** | High on every device | Low to medium, with the guardrails | Medium | **Recommended** |
| D. Paste a URL and we fetch it | Highest convenience | High: our server would be scraping | Medium | No |

### How "Bring any listing" works

1. Student picks one: **paste the page** (Cmd/Ctrl+A, Cmd/Ctrl+V), **drop a screenshot**, or **type 4 fields** (address, price, per person or whole place, bedrooms).
2. A cheap LLM (or later [NuExtract](https://huggingface.co/numind/NuExtract-2.0-8B) from Hugging Face) fills the Listing schema and returns **the exact sentence behind every value**. Values without evidence are dropped.
3. Nothing is assumed: missing fields show "Not on the listing you added", exactly as the earlier comment asked.
4. Ask only when it matters: "Is $999 per person or for the whole place?"
5. Student confirms the card; the engine geocodes and scores it like any other listing: "This would rank #2 for you."

### Guardrails (not legal advice; get a lawyer's review before public launch)

- Visible **only to the student who added it**; kept in their account or deleted after the session.
- Never added to our search results, our ranking training data, or any landlord-outreach list.
- Facts only: no photos, no full descriptions, no competitor logos. Wording is "Bring any listing", never "Import from Zillow".
- Our servers never fetch a URL.
- **Supply-friendly twist:** an "Invite this landlord to list" button sends the landlord a message *from the student*. Inventory then grows by landlords choosing to join, not by copying listings.

### For the hackathon demo

Show the paste path with one pre-extracted example ready, so a slow AI call can't break the 5-minute demo.

## Supply side: landlords and listings

A marketplace is only as good as its listings, so supply is the hardest part of this plan. We fill the site three ways, and every listing must carry the honest fields students need (price per bed or unit, lease type, roommate matching, required fees).

### 6.1 Where listings come from

| Source | Who | How | When |
| --- | --- | --- | --- |
| Direct listing form | Small landlords, house owners | A 10-minute guided form with required honest fields and a fee-compliance check | Day one |
| Property-management feeds | Large operators (likely including Hackberry) | We become an Internet Listing Service that accepts the standard MITS XML feed | After the first operators sign up |
| Market data API | Us, for context | RentCast for rent estimates and comparables | Day one, for "is this a fair price" |

Notes on the feed route:

- Big operators already push listings out this way: Apartments.com's [property data feed is based on the MITS format](https://mymedia.apartments.com/advertise/resources/listings-feed-program) and accepts Entrata, Yardi, MRI and RealPage.
- Yardi has [moved its ILS feed to MITS 5.0 to carry more detailed fee data](https://propertyhelp.apartments.com/article/1266-how-do-i-access-new-fee-transparency-features-using-yardi-voyager), which helps our "true cost" number.
- Feeds refresh pricing and availability on their own; one operator's Entrata setup [updates listing sites 1–4 times a day](https://horizonra.freshdesk.com/support/solutions/articles/157000277700-internet-listing-services-ils-).
- RentCast says its data can be used [for any use case not specifically prohibited under its Terms of Use](https://developers.rentcast.io). We still need to read those terms before showing RentCast listings to students, rather than only using them for price context.

### 6.2 The landlord product

1. **List once.** Structured form or feed. Required: price basis, lease type, roommate matching, application fee, utilities, required fees, applications-open date, screening criteria.
2. **Compliance check.** Flags Ann Arbor issues before publishing: application fee over $50, pre-tenancy fees, required fees not built into the rent, missing utilities disclosure.
3. **Leads inbox.** Each lead arrives pre-qualified: budget per person, move-in date, group or "match me", guarantor status, and the reasons the student ranked this place.
4. **Roommate matching** for per-bed buildings: students who chose "Match me" can be grouped by schedule, quiet and budget (later).
5. **Applications.** Received through our universal application (phase 3) or passed to the landlord's own system.

### 6.3 Keeping listings honest and fresh

- `verified_at` on every listing; direct listings ask the landlord to confirm every 7 days and hide after 14 days without a reply.
- Feed listings stay live while the feed keeps sending them.
- A "Report this listing" button on every card; 2 reports from different students hide it pending review.

### 6.4 Cold start in Ann Arbor

1. Hackberry Lane's units first, as launch partner.
2. Recruit 10–20 student-focused property managers with free listings and free pre-qualified leads for the first leasing season.
3. "Invite this landlord to list" from the Bring-any-listing feature.
4. Approach UMich Beyond the Diag about a partnership instead of competing with its listing service.

## Renter phase 3 — Apply and sign

As a marketplace we own the application, like Zillow does: one **universal application** a student fills once and sends to any landlord on the site. A screening partner handles credit checks and Social Security numbers; we never store them.

### 7.1 The flow

1. **Pre-qualify (30 seconds, no SSN, no fee).** Who pays rent (me / family / scholarship or sponsor / mix), monthly amount, US credit history yes/no, guarantor type. Each card shows *Likely eligible*, *Likely needs a guarantor* or *Missing: proof of funds*, checked against the landlord's published criteria.
2. **Universal application (filled once).** Identity, household, rental history ("first-time renter" is fine), funding and documents, pets, move-in date. Most of it is pre-filled from onboarding.
3. **Screening.** Through a partner API such as TransUnion SmartMove / ShareAble, where [the landlord can choose whether they or the renter pays](https://mysmartmove.com/). One report is reused across applications for a set window; Zillow does the same, [reusing reports for 30 days](https://www.zillow.com/rentals-network/credit-reports-for-landlords).
4. **Landlord decision** in our leads inbox, or in their own system for feed-connected operators.
5. **Lease review.** A plain-language summary before signing: cost per person, lease type and liability, every fee, deposit, dates, renewal rules. Anything that breaks the rules in 7.3 is flagged.
6. **E-sign** through a DocuSign or Dropbox Sign integration, or the landlord's own system.

### 7.2 What landlords ask, and how we handle it for students

| Landlord asks | What we do |
| --- | --- |
| Identity | Verified by the screening partner |
| Income vs rent | Count family support, scholarships, loans and sponsor letters as income |
| Credit | Partner report; "no US credit" routes to guarantor options |
| Guarantor | US-based / abroad / none; offer guarantor services |
| Rental history | First-time renters allowed |
| Criminal history | **Turned off in Ann Arbor** (see 7.3), even though screening products offer it |

### 7.3 Ann Arbor and Michigan rules (not legal advice)

- **Application fee ≤ $50**, disclosed in the listing, with screening criteria given in writing first and a [full refund if the applicant isn't offered the unit](https://www.a2gov.org/media/s2xa1bqy/ord-26-04-approval-notice.pdf). Pre-tenancy fees are [banned](https://offcampus.umich.edu/node/2989). One common screening product costs the renter [$39.99, or $49.99 with income verification](https://rentredi.com/blog/transunion-smartmove-screening-explained/), so the bundle must stay under the cap.
- **Since August 1, 2026, required fees must be built into base rent**, and ads must disclose utilities and total rent plus optional fees ([ORD-26-04](https://www.a2gov.org/media/s2xa1bqy/ord-26-04-approval-notice.pdf)). Our listing form enforces this.
- **Criminal history** can't be used in tenant selection in Ann Arbor ([Fair Chance Access to Housing](https://www.a2gov.org/city-clerk/boards-and-commissions/renters-commission/rental-housing-laws-in-ann-arbor/)).
- **Source of income and student status are protected** in Ann Arbor ([NAA](https://naahq.org/node/68)).
- **Timing:** landlords [can't show or lease an occupied unit until 150 days before the current lease ends](https://www.a2gov.org/departments/build-rent-inspect/housing/Documents/Guide%20to%20Early%20Leasing%20and%20Right%20to%20Renew%20Ordinances%2011-13-2023.pdf), so every listing carries an "applications open on" date.
- **Security deposit** is capped at [1.5 months' rent (MCL 554.602)](https://www.verticalrent.com/blog/security-deposit-laws-in-michigan-what-landlords-can-and-cant-take).

### 7.4 International students

No SSN and no US credit file is the common blocker. Guarantor services (TheGuarantors, Insurent, Leap) act as paid co-signers; [Insurent runs about 60–90% of a month's rent with US credit and 95–110% without](https://www.uni2study.com/articles/cosigners-guarantor-services-for-student-leases). Pre-qualify shows which landlords accept them before any fee is paid.

### 7.5 Data we keep

We store the application, self-reported funding, encrypted documents and status. We never store SSNs, credit reports or criminal history.

## Critique and risks

The biggest new risk is the cold start: a marketplace with few listings is useless to students, and a marketplace with few students is useless to landlords. The second is scope — "a new Zillow" cannot be built by 5 PM, so the demo must be a sharp slice.

| # | Risk | Why it matters | Mitigation |
| --- | --- | --- | --- |
| 1 | Chicken-and-egg cold start | No listings → no students → no landlords | One city only; Hackberry units first; free listings and free leads for season one; "Bring any listing" keeps students around while supply grows |
| 2 | Scope for today | A full two-sided marketplace is months of work | Demo the renter flow end to end; show the landlord side as one dashboard screen and the listing form |
| 3 | Pitching neutrality to a landlord judge | Hackberry may ask why its units sit next to competitors | Frame it as better leads: students arrive pre-qualified and already sure the place fits |
| 4 | Invented student priors | Predictions and simulations rest on numbers we made up | Survey \~100 UMich students; learn from real choices (X reasons, chips, scorecard); test ±20% prior shifts |
| 5 | "Bring any listing" as a competitor | Zillow's terms bar using its data for competing products | Private to the student, never in our inventory or models, no URL fetching; lawyer review before launch |
| 6 | Fair housing in ranking | Ranking or chips could steer students by neighbourhood demographics | Rank only on stated preferences and listing facts; no crime or demographic data; route facts only for "walk home at night" |
| 7 | Stale or fake listings | Ghost listings destroy trust fast | 7-day confirmation, 14-day auto-hide, report button, feed freshness |
| 8 | Paid ranking temptation | Selling placement would break the core promise | Ranking never for sale; sponsored listings labelled and kept out of the top 3 |
| 9 | Landlord willingness to pay | Pay-per-lead is unproven with Ann Arbor landlords | Test with 5–10 property managers in season one before charging |
| 10 | Phone layout | 3 columns are cramped at 375 px | 2 cards + swipe, row labels pinned |

### Friction metric to report

**Clicks from landing page to submitted application.** Target ≤ 12: 5 onboarding + up to 3 compare + up to 4 apply. Compare with Apartment List's 17 onboarding screens plus a required sign-up before any results.

## Testing and statistical validation

We prove four claims with about 200 named test cases plus a 1,000-student simulation. The current prototype already passes 13 tests on 100 simulated students: 99% top-3 accuracy at 3.1 screens on average.

### Claims

| Claim | Test | Pass bar |
| --- | --- | --- |
| H1. Same answer as the long form | 1,000 simulated students: is their full-information best in our top 3 after the 5 required screens? | ≥ 95%, with a Wilson 95% confidence interval |
| H2. Optional questions help | Same students, + up to 3 optional questions | Top-1 match rises; no drop in top-3 |
| H3. The order matters | Adaptive vs fixed-order 5 screens, same students; paired McNemar test | Adaptive better, p < 0.05 |
| H4. The confidence meter is honest | Reliability chart and expected calibration error | Error ≤ 5 points |

### Test suites (about 200 cases)

| Suite | Cases | Examples |
| --- | --- | --- |
| Scenario rules | 60 | Walkers never see parking; drivers get parking; pet owners see pet-friendly only; "Match me" shows only per-bed or matching buildings |
| Compare and bench | 30 | "Too far" brings a closer replacement; ≤ 2 bench units per building; no landlord gets a boost |
| Bring any listing | 30 | 30 hand-labelled pastes and screenshots from 5 sites; ranges; missing fields; student's own email removed; no URL fetching |
| Landlord side | 20 | Required fields enforced; compliance check catches a $75 application fee, a waitlist fee, required fees outside rent |
| Robustness | 30 | Priors ±20%; students drawn from a different distribution; 10% wrong answers |
| Compliance and fairness | 15 | No criminal-history field; no protected-class inputs reach ranking; fee ≤ $50 shown |
| Load and speed | 15 | 200 concurrent sessions; server p95 < 200 ms; one engine step < 50 ms on a mid-range phone |

New card elements get their own checks inside these suites: the confidence badge is never High when price basis or rent is estimated; a regret line appears only when the gap clears its threshold; every cost line carries exactly one label; GTFS commute times are within ±3 minutes of TheRide's own trip planner on 20 sample trips; the time-vs-money sentence uses the correct direction ("worth it" only when the price of an hour is below the student's value of time).

### Human check

A 15-minute hallway test with 5–8 students (clicks and minutes to "Start application"; "Would you trust this top 3?") and a 10-minute call with 2–3 landlords about the leads inbox. These are the only tests that do not depend on our own model.

Simulations show the algorithm finds what our model says is best with fewer questions; they do not show the model matches real students. The survey and hallway test close that gap.

## Build plan and open decisions

For 5 PM today we demo the renter journey end to end plus one landlord screen; the rest is the roadmap we pitch. Each row is one Claude Code session, in order.

### Stack

- **Frontend:** Next.js + TypeScript + Tailwind on Vercel.
- **Engine:** the prototype's `engine.js` ported to TypeScript, shared by browser and server; its 13 tests carried over (Vitest).
- **Data:** Postgres (e.g. Supabase) for listings, landlords, applications; a Python script pre-computes OpenStreetMap distances.
- **AI:** one server route for "Bring any listing" (hosted LLM with JSON schema now; NuExtract later).
- **Partners later:** screening (e.g. TransUnion SmartMove / ShareAble), e-sign (DocuSign or Dropbox Sign), MITS feed ingestion.

### Build order

| Step | Session | Must (by 5 PM) | Later |
| --- | --- | --- | --- |
| 1 | Scaffold; port engine; carry over tests | Yes | — |
| 2 | Listing schema + \~120 synthetic Ann Arbor listings from several fictional landlords (+ Hackberry units if shared) | Yes | Real direct listings, MITS feeds |
| 3 | Onboarding: 5 required screens, "Sharpen my matches" card, scorecard drawer, housing ID card | Yes | .ics schedule import |
| 4 | Compare: 3 cards, true monthly cost with labels, regret line, time-vs-money sentence, confidence badge, top-5 rows, X sheet + bench | Yes | Phone polish |
| 5 | Niche chips | 2 chips + TheRide GTFS commute, pre-computed | All 6 |
| 6 | Bring any listing | Paste + cached example | Screenshots, NuExtract, invite-landlord |
| 7 | Pre-qualify + universal application | Pre-qualify + mock submit | Screening partner, e-sign |
| 8 | Landlord dashboard | One screen: leads inbox + listing form with compliance check | Full landlord product |
| 9 | Tests to \~200 + simulation report | 1,000-student run, H1–H4 | Robustness, load |
| 10 | Deploy and rehearse | Yes | — |

### Decisions to finalise together

- [ ] Product name and one-line pitch for the marketplace
- [ ] Demo data: synthetic only, or ask Hackberry for a few real units as launch partner?
- [ ] "Bring any listing" in the demo: live AI call or cached only?
- [ ] Optional questions: confirm the "Sharpen my matches" card + scorecard drawer + small per-screen link
- [ ] Revenue model to pitch first: free listings + pay per qualified lead?
- [ ] Which 2 niche chips ship today?
- [ ] Phone layout: 2 cards + swipe, or 3 columns?
- [ ] Student survey before or after the hackathon?

### Sources

- Zillow and the market: [Q3 2026 results](https://www.onlinemarketplaces.com/?p=105754), [Zillow Rentals interview](https://newsletter.rismedia.com/news/view/126525/), [how Zillow makes money](https://www.sharetribe.com/how-to-build/how-does-zillow-make-money/), [Zillow terms summary](https://www.olostep.com/blog/zillow-web-scraping), [Zillow credit reports](https://www.zillow.com/rentals-network/credit-reports-for-landlords)
- Feeds and data: [Apartments.com feed program](https://mymedia.apartments.com/advertise/resources/listings-feed-program), [Yardi MITS 5.0 fees](https://propertyhelp.apartments.com/article/1266-how-do-i-access-new-fee-transparency-features-using-yardi-voyager), [Entrata ILS refresh](https://horizonra.freshdesk.com/support/solutions/articles/157000277700-internet-listing-services-ils-), [RentCast API](https://developers.rentcast.io), [NuExtract 2.0](https://huggingface.co/numind/NuExtract-2.0-8B)
- Screening: [TransUnion SmartMove](https://mysmartmove.com/), [SmartMove pricing explained](https://rentredi.com/blog/transunion-smartmove-screening-explained/), [guarantor costs](https://www.uni2study.com/articles/cosigners-guarantor-services-for-student-leases)
- Ann Arbor and Michigan: [ORD-26-04 rental fees](https://www.a2gov.org/media/s2xa1bqy/ord-26-04-approval-notice.pdf), [Beyond the Diag 2025 update](https://offcampus.umich.edu/node/2989), [Early Leasing guide](https://www.a2gov.org/departments/build-rent-inspect/housing/Documents/Guide%20to%20Early%20Leasing%20and%20Right%20to%20Renew%20Ordinances%2011-13-2023.pdf), [rental housing laws](https://www.a2gov.org/city-clerk/boards-and-commissions/renters-commission/rental-housing-laws-in-ann-arbor/), [NAA protected classes](https://naahq.org/node/68), [MCL 554.602 deposit cap](https://www.verticalrent.com/blog/security-deposit-laws-in-michigan-what-landlords-can-and-cant-take)
