# Prototype engine (reference for the backend)

This is the working adaptive-onboarding engine from the prototype. It is plain JavaScript (CommonJS) with no dependencies. Port it to TypeScript in `lib/engine/` and keep its behaviour — see `KICKOFF.md` and `docs/PRD.md` section 1.4.

| File | What it is |
| --- | --- |
| `engine.js` | Synthetic listings (120, hedonic pricing, 12 Ann Arbor neighbourhoods), particle population model, likelihood-weighting updates, expected-information-gain question picker, stop rule, trade-off bisection, explanations |
| `tests.js` | 13 tests (T1–T13): top-3 accuracy vs full information, clicks, adaptive vs fixed order, calibration, walkers never asked about parking, budget and campus sensitivity, determinism |
| `bench.js` | Quick benchmark: average clicks and top-1/top-3 hit rates |

## Run

```bash
cd prototype
node tests.js 150     # 13 tests on 150 simulated students
node bench.js 100     # benchmark
```

Expected: 13/13 pass. At τ = 0.95, about 3.1 clicks, 98–99% top-3, about 73–76% top-1 (fixed-order baseline ≈ 72%).

`package.json` in this folder sets `"type": "commonjs"`, because the repo root is an ES module package.

All listings and students are synthetic (Example data).
