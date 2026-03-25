# RideConvert — Urban Mobility Membership Growth

**An end-to-end product strategy for converting casual bike-share riders into annual members.**

[![Live Dashboard](https://img.shields.io/badge/Live_Dashboard-rideconvert.vercel.app-00C9B1?style=flat-square)](https://rideconvert.vercel.app/)
[![PRD](https://img.shields.io/badge/PRD-Read_the_doc-A78BFA?style=flat-square)](./docs/PRD.md)
[![Strategy](https://img.shields.io/badge/Strategy_Brief-6--pager-60A5FA?style=flat-square)](./docs/STRATEGY.md)
[![Decisions](https://img.shields.io/badge/Decision_Log-7_decisions-F59E0B?style=flat-square)](./docs/DECISIONS.md)

---

## The Business Problem

Urban bike-share operators globally face the same structural revenue challenge:

**Casual pay-per-ride users make up the majority of rides. Annual members generate 3–5× more lifetime revenue. Yet conversion rates sit at 2–4% industry-wide.**

This is not a marketing problem. It is a product problem.

Casual riders don't convert because the product was not designed to make membership feel obviously worth it for their specific usage pattern. The value proposition assumes a commuter. Most casual riders are not commuters.

The opportunity: **a 1pp lift in conversion at a 100K-ride/month operator = ~$1M+ incremental ARR**. No new users acquired. No new infrastructure. Pure product leverage on an existing engaged base.

**Toronto context (home market):** Bike Share Toronto logged 6.9M rides in 2024, growing to 7.8M in 2025. At ~23% casual share, that is ~1.6M casual rides per year. At current 2.8% conversion = ~3,700 member conversions per month. A lift to 5% adds C$700K+ incremental ARR — no new stations, no new users required.

---

## Strategic Framing

Before any solution, success was defined at three horizons:

| Horizon | Goal | How we'd know |
|---|---|---|
| **6 months** | Prove the nudge works | A/B test shows ≥25% lift at 95% confidence |
| **12 months** | Launch flexible membership tier | New tier reaches ≥4% attach rate among eligible casuals |
| **24 months** | Membership majority | Members > casual riders by ride volume |

Explicit choice: focus on converting existing casual riders rather than acquiring new users. Conversion has lower CAC, faster feedback loops, and existing behavioral data to work with.

---

## What's in This Repo

```
rideconvert/
│
├── dashboard/
│   ├── src/App.jsx           → React app — 5 views, 4 operators
│   └── package.json
│
├── notebooks/
│   └── 01_eda.ipynb          → EDA, clustering, funnel, A/B power analysis
│
├── sql/
│   ├── funnel_analysis.sql   → Conversion funnel queries
│   ├── segmentation.sql      → Rider behavioral segments
│   └── retention.sql         → Post-conversion cohort analysis
│
├── docs/
│   ├── STRATEGY.md           → 6-page strategy brief
│   ├── PRD.md                → Full product requirements
│   ├── DECISIONS.md          → Architecture of decisions
│   └── METRICS.md            → North Star + metric tree
│
└── requirements.txt
```

---

## The Strategy (3-minute version)

### Problem decomposition

| Root cause | Evidence | Product lever |
|---|---|---|
| Price barrier | Casual avg spend exceeds annual membership cost within 3–4 months | Break-even calculator, personalised per operator |
| Value mismatch | Casual rides avg 20–29 min — leisure, not commute | New membership tier matching their usage pattern |
| No trigger moment | No UX moment that creates urgency to convert | Post-ride savings nudge |
| Conversion friction | Sign-up requires 6+ steps — intent lost mid-flow | One-tap upgrade flow |

### Four user personas (data-derived, not assumed)

Behavioral clustering on 150K rides across ride duration, timing, day-of-week, bike type, and seasonality revealed four distinct groups:

**Weekend Explorer (42%)** — Leisure rides, parks and waterfronts, 2–4× per month. Barrier: the annual membership was built for commuters. Solution: flexible membership tier priced for leisure use.

**Reluctant Commuter (31%)** — Rush-hour rides, short trips (~11–13 min), 2× per week. Barrier: doesn't know if they ride enough to justify annual cost. Solution: break-even calculator. Toronto: ~24 rides at C$4.48/ride to recoup C$105.

**Seasonal Visitor (18%)** — Tourist clusters, summer-only. Annual membership is genuinely the wrong product. Solution: short-term visitor tier, future phase. Excluded from conversion optimisation.

**E-bike Adopter (9%, growing)** — Pays C$0.20/min casual vs C$0.10/min as a member — 2× the rate. Strong conversion lever unique to electrified systems.

### RICE prioritization

| Rank | Initiative | Score | Quarter |
|---|---|---|---|
| #1 | Post-ride savings nudge | 92 | Q1 |
| #2 | Flexible membership tier | 78 | Q1 |
| #3 | Break-even calculator | 74 | Q1 |
| #4 | Geo-targeted station offer | 61 | Q2 |
| #5 | One-tap upgrade flow | 54 | Q2 |
| #6 | Usage-triggered emails | 48 | Q3 |

### What was explicitly not built

- **Price discounting** — Trains users to wait for deals. Permanently destroys LTV.
- **Referral program** — Acquisition tool. Conversion problem not yet solved.
- **Gamification** — High effort, low confidence for this user segment.
- **New station infrastructure** — Supply is not the constraint.

---

## Live Dashboard

**→ [rideconvert.vercel.app](https://rideconvert.vercel.app)**

Five interactive views across four real-world operators — switch between Bike Share Toronto, Divvy, Citi Bike, and Santander Cycles:

| Tab | Question it answers |
|---|---|
| **Overview** | Where are we today and what's the seasonal pattern? |
| **Rider Segments** | Who are we converting, and what does each persona need? |
| **Conversion Funnel** | Where are we losing people and what is the revenue gap? |
| **A/B Testing** | How do we design and power the nudge experiment? |
| **Roadmap** | What are we building, when, and why that sequence? |

- **Operator selector** — real pricing, break-even, and seasonality per market. Toronto defaults as home market.
- **A/B test simulator** — interactive sliders model lift, sample size, and duration with statistical power feedback.
- **E-bike dimension** — e-bike conversion lever for electrified operators (Toronto, Citi Bike).
- **Break-even per operator** — Toronto 24 rides · Divvy 32 · Citi Bike 40 · Santander 38.

---

## Key Metrics

**North Star**: Casual → Member conversion rate within 90 days of first ride

| Metric | Current | Q3 Target | Stretch |
|---|---|---|---|
| Conversion rate | 2.8% | 5.0% | 7.5% |
| Members added / month | 3,500 | 6,250 | 9,375 |
| Incremental ARR (CAD) | Baseline | +C$363K | +C$774K |
| Time-to-convert (median) | 34 days | 21 days | 14 days |

**Guardrail metrics:**
- App uninstall rate
- Casual rider NPS
- Casual ride volume
- Member year-1 churn

---

## Data Sources

| Operator | City | Data URL | Key facts |
|---|---|---|---|
| **Bike Share Toronto** 🇨🇦 | Toronto, Canada | [open.toronto.ca](https://open.toronto.ca/dataset/bike-share-toronto-ridership-data/) | 7.8M rides (2025) · Annual 30: C$105 · Annual 45: C$120 · E-bike: 19% of trips |
| **Divvy** 🇺🇸 | Chicago, USA | [divvybikes.com/system-data](https://divvybikes.com/system-data) | Monthly CSVs · Annual: $105 |
| **Citi Bike** 🇺🇸 | New York City, USA | [citibikenyc.com/system-data](https://citibikenyc.com/system-data) | Largest in North America · Annual: $179 |
| **Santander Cycles** 🇬🇧 | London, UK | [cycling.data.tfl.gov.uk](https://cycling.data.tfl.gov.uk) | TfL data from 2015 · Annual: £120 |

Dashboard uses simulated data calibrated to the above distributions. The Python notebook uses real public data for analysis.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Dashboard | React + Recharts | Chart flexibility, deployable anywhere |
| Styling | Pure CSS design tokens | Full control, zero class bloat |
| Analysis | Python — pandas, scipy, scikit-learn | Industry standard for EDA and clustering |
| Deployment | Vercel | Zero-config, Git-integrated, instant deploys |
| Docs | Markdown | Portable, version-controlled |

---

## How to Run

```bash
# Dashboard
cd dashboard
npm install
npm run dev
# → http://localhost:5173

# Python analysis
pip install -r requirements.txt
jupyter notebook notebooks/
```

---

## Documents

| Document | What it covers |
|---|---|
| [STRATEGY.md](./docs/STRATEGY.md) | Full strategic narrative — start here |
| [PRD.md](./docs/PRD.md) | Product requirements, user stories, launch criteria |
| [DECISIONS.md](./docs/DECISIONS.md) | Every major decision, options considered, and rationale |
| [METRICS.md](./docs/METRICS.md) | North Star definition, metric tree, experiment standards |

---

## What's next

1. **Post-conversion onboarding** — Members churn when they don't build the habit in the first 30 days. A persona-personalised onboarding sequence is likely higher ROI than continued conversion optimisation.
2. **E-bike as a dedicated conversion lever** — The 50% member e-bike discount is a powerful, underused argument for electrified operators like Toronto and Citi Bike.
3. **B2B / employer channel** — One employer deal = 200–500 members at near-zero marginal CAC. Toronto already offers 20–25% corporate discounts.
4. **Dynamic pricing signal** — Surfacing the casual vs. member cost comparison at the point of payment — not just post-ride.

---

*Benchmarks sourced from publicly available operator data. Simulated dataset preserves real distribution properties. No proprietary operator data used.*
