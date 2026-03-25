# Architecture of Decisions

> This document logs every significant product and technical decision — including the options considered and why we chose what we did. The goal is to make the reasoning reproducible, not just the conclusions.

---

## Decision 001 — Problem framing: conversion vs. acquisition

**Status**: Decided

### Context
Annual members are significantly more profitable than casual riders. There are two obvious ways to grow membership: (1) acquire new users who sign up as members from day one, or (2) convert existing casual riders.

### Options considered

**Option A: Acquisition-first** — Target non-users with messaging about annual membership value.
*Pros*: Larger addressable pool.
*Cons*: High CAC. No trust established. Conversion before product experience is very hard.

**Option B: Conversion-first** — Focus entirely on converting existing casual riders who already know and use the product.
*Pros*: Existing engagement and trust. Lower CAC. Faster feedback loop. Behavioral data exists to personalise.
*Cons*: Smaller addressable pool per operator.

**Option C: Parallel tracks** — Run acquisition and conversion simultaneously.
*Pros*: Covers both surfaces.
*Cons*: Splits focus. Learnings don't compound.

### Decision
**Option B — Conversion-first.**

Conversion has higher expected value in the near term: CAC is dramatically lower, behavioral data exists to personalise, and the product problem must be solved before acquisition spend makes sense — otherwise we're filling a leaky bucket.

**Revisit trigger**: If conversion rate hits 5%+ and casual ride volume is growing, re-open acquisition discussion.

---

## Decision 002 — Persona approach: data-derived vs. assumption-based

**Status**: Decided

### Context
We needed to understand who casual riders actually are before designing solutions for them.

### Options considered

**Option A: Assumption-based personas** — Use common sense to define 3–4 types (commuter, tourist, recreational, etc.).
*Pros*: Fast.
*Cons*: Bakes in bias. Solutions will fit the assumption, not the user.

**Option B: Data-derived segmentation** — Cluster riders by behavioral signals to let the data reveal natural segments.
*Pros*: Grounded in actual behavior. Reveals non-obvious patterns.
*Cons*: Requires data. Segments may need qualitative validation.

**Option C: Qual-first** — Do 20 user interviews first, then build personas from what you hear.
*Pros*: Rich qualitative texture.
*Cons*: Slower. N=20 is not representative.

### Decision
**Option B, validated with Option C thinking.**

Behavioral signals (ride duration, timing, geography, bike type) were used to identify four natural clusters. Labels came after the data — not before. In a production setting, Option C (user interviews, n=20 per segment) would validate the job-to-be-done behind each cluster before committing to solutions.

---

## Decision 003 — Monetisation: flexible tier vs. discount on annual

**Status**: Decided

### Context
One obvious way to convert price-sensitive casual riders is to offer a discount. Another is to create a new, lower-priced tier.

### Options considered

**Option A: Discount campaign** — Offer 20–30% off annual membership.
*Pros*: Fast to ship. Directly attacks price barrier.
*Cons*: Trains users to wait for discounts. Permanently anchors price expectation lower. Damages LTV for every converted member. Cannot be undone.

**Option B: Flexible membership tier (new SKU)** — Create a new option at ~60% of annual price covering unlimited weekend rides plus weekday credits.
*Pros*: Serves Weekend Explorer precisely. Doesn't cannibalize full annual. Can price-ladder users up over time. Preserves full-price integrity.
*Cons*: New SKU requires pricing approval, legal review, engineering work.

**Option C: Trial membership** — Offer a free 30-day trial.
*Pros*: Removes risk for the user.
*Cons*: Revenue impact during trial. Users who don't build habit in 30 days will churn immediately.

### Decision
**Option B — Flexible membership tier.**

Discounting (Option A) is the worst long-term decision even if it produces short-term conversion numbers. It permanently degrades the pricing architecture.

**Sequencing**: Ship the nudge and calculator in Q1. Use conversion data to build the business case for the new SKU. Launch the flexible tier in Q3 with data behind it.

---

## Decision 004 — Build vs. buy: dashboard technology

**Status**: Decided

### Context
A live, shareable analytics dashboard was needed. Options ranged from no-code tools to full custom builds.

### Options considered

**Option A: Tableau Public / Looker Studio**
*Pros*: Fast. Polished out of the box.
*Cons*: Limited interactivity — no A/B simulator. BI tool aesthetic, not product aesthetic.

**Option B: React + Recharts (custom)**
*Pros*: Full control over design and interaction. Can build the A/B simulator. Demonstrates technical fluency.
*Cons*: More time to build.

**Option C: Notion / Webflow write-up with embedded charts**
*Pros*: Fastest. Easy to share.
*Cons*: Not interactive. No A/B simulation capability.

### Decision
**Option B — React + Recharts.**

A live, interactive, deployable dashboard demonstrates a deeper understanding of what engineering teams are building. Option A would be fine for a data analyst project — it's not the right choice here.

---

## Decision 005 — Data: real vs. simulated

**Status**: Decided

### Context
Real operator data is either proprietary or requires significant processing time (Divvy public data is ~500MB/year of CSVs).

### Options considered

**Option A: Real Divvy data** — Download and process 12 months.
*Pros*: 100% credible. Can cite exact statistics.
*Cons*: Takes 1–2 days to clean properly. Specific to one operator/city.

**Option B: Simulated data** — Generate synthetic data matching statistical distributions of real public datasets.
*Pros*: Fast. Operator-agnostic. You have to understand the distributions to simulate them correctly.
*Cons*: Not "real" — must be disclosed clearly.

**Option C: Both** — Real data for the Python analysis notebook, simulated for the live dashboard.
*Pros*: Best of both worlds.
*Cons*: More work. Potential for inconsistency.

### Decision
**Option C in spirit, Option B for MVP.**

The dashboard uses simulated data — fully disclosed in the README and dashboard footer. The Python notebook uses real public data to demonstrate analytical rigor. The separation is intentional: the dashboard communicates strategy, the notebook demonstrates methodology.

---

## Decision 006 — Home market: Toronto as default operator

**Status**: Decided

### Context
The project benchmarks four public operators. The dashboard needed a default. The documentation needed a primary reference market.

### Options considered

**Option A: Generic / no default** — Aggregated or blended data.
*Cons*: No personalisation signal. Misses the opportunity to show market-specific product thinking.

**Option B: Divvy (Chicago) as default** — Most widely used in data courses. Most recognisable.
*Cons*: Over-represented in similar projects. Doesn't differentiate.

**Option C: Bike Share Toronto as default** — The home market. Two-tier membership structure (Annual 30 / Annual 45), fast-growing e-bike fleet (19% of trips), real CAD pricing, and a documented gap — no monthly or weekend tier despite BIXI Montréal offering one nearby.
*Pros*: Genuine local market knowledge. Two-tier structure adds product complexity. E-bike dimension unique to this market. Confirmed gap versus adjacent competitor.

### Decision
**Option C — Bike Share Toronto as home market default.**

Toronto is the most analytically interesting of the four operators for this specific problem: two existing tiers, growing e-bike fleet, extreme seasonality (16× August vs January), and a confirmed product gap relative to BIXI Montréal.

**Revisit trigger**: If targeting operators in a specific US market, switch default to Divvy and adjust financial model to USD throughout.

---

## Decision 007 — Persona count: three vs. four (adding E-bike Adopter)

**Status**: Decided

### Context
The original persona framework had three segments. When adding Bike Share Toronto as a data source, a fourth behavioral cluster became significant: casual riders who specifically choose e-bikes.

### Options considered

**Option A: Keep three personas**
*Cons*: E-bike riders have a fundamentally different conversion lever — the 50% member discount on per-minute e-bike pricing. Folding them into other personas obscures a high-value product opportunity.

**Option B: Add E-bike Adopter as a fourth persona**
*Pros*: Honest to the data. 19% of Toronto trips. Reveals a conversion lever not visible in the three-persona model. Demonstrates that persona frameworks should evolve as new data dimensions become available.
*Cons*: Less relevant for non-electrified operators (Divvy, Santander).

### Decision
**Option B — Four personas, with E-bike Adopter scoped to electrified operators.**

The e-bike conversion lever is too strong to ignore for operators with significant e-bike fleets. The four-persona model is also more honest: persona frameworks should evolve as the product and data evolve.

---

## Open decisions

| Decision | Options | Blocker |
|---|---|---|
| Post-conversion onboarding | Email sequence vs. in-app vs. none | Need conversion baseline first |
| B2B / employer channel | Build vs. partner vs. ignore | Requires sales motion |
| Pricing for flexible membership tier | C$55 / C$65 / C$75 (Toronto) | Need willingness-to-pay research |
| Monthly membership tier | Add vs. skip (BIXI Montréal has $20/mo) | Pricing cannibalisation risk |
| E-bike onboarding nudge | Standalone vs. part of main nudge | Depends on e-bike fleet size per operator |
