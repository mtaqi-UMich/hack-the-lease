# Validation data (real listings)

Purpose: real public listing data to check our product's numbers against.
This folder is NOT part of the shared prompt (only `context/` is), so pushing here changes nothing else.

## Files
- `haven-on-geddes.json` - Haven on Geddes (1700 Geddes Ave), retrieved 2026-11-20.

## Sources (3)
1. Hackberry's official site: havenongeddes.com (floor plans, sqft, rent, lease term)
2. Amber: amberstudent.com (floor plans, per-room rent, fees, pet rules)
3. Uhomes: en.uhomes.com (from-price, amenities)

## How to read it
- Rent is per private bedroom per month (inferred from the official "Private" option and Amber's per-room label). Per-unit = per-bed x 3.
- `null` / "not listed" = unknown, not zero.
- Official site and Amber agree on the Ranch ($1,335); official and Uhomes agree on the Bi-Level ($1,100).
- Not collected: Apartments.com and HotPads block automated access; Apartment List's Haven page is gone; UMich Off Campus Housing does not list Haven.
- Prices change. Re-check before the demo if it matters.
