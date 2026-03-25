# Metrics & Measurement Framework

---

## Break-even Reference (operator-specific)

| Operator | Annual price | Avg casual ride cost | Break-even rides | At 2×/week |
|---|---|---|---|---|
| Bike Share Toronto (Annual 30) | C$105 | C$4.48 (29 min × $0.12 + $1 unlock) | ~24 rides | ~3 months |
| Divvy Chicago | $105 | $3.30 | ~32 rides | ~4 months |
| Citi Bike NYC | $179 | $4.50 | ~40 rides | ~5 months |
| Santander Cycles | £120 | £3.20 | ~38 rides | ~5 months |

The nudge message is personalised per operator: *"You're [X] rides from annual membership paying off."*

---

## North Star Metric

**Casual → Member conversion rate within 90 days of first ride**

### Why this metric, not another

**Why conversion rate, not absolute member count?**
Absolute count scales with operator size. Conversion rate measures product effectiveness independent of scale.

**Why 90 days, not 30 or 180?**
30 days is too short — it misses seasonal casual riders who take their first ride in May and convert in July. 180 days includes too much noise. 90 days captures the full decision cycle while remaining actionable.

**Why "from first ride," not "from first CTA exposure"?**
Because the business goal is converting people who've experienced the product. Measuring from CTA exposure would optimise for showing the CTA to the right people, not for delivering a product worth converting to.

---

## Metric Tree

```
NORTH STAR
Casual → Member conversion rate (90d)
│
├── ACQUISITION
│   ├── % casual riders exposed to at least one membership CTA per month
│   │   Target: 80%+ (currently ~70%)
│   │
│   ├── CTA click-through rate (all surfaces combined)
│   │   Target: 8%+ (currently ~3%)
│   │
│   └── CTA click-through rate by surface
│       ├── Post-ride nudge (new)       → Target: 12%
│       ├── App home screen banner      → Current: 2.1%
│       ├── Ride receipt email          → Current: 1.8%
│       └── Station QR code            → Current: 0.4%
│
├── ACTIVATION
│   ├── % of CTA clicks that start sign-up flow
│   │   Target: 60%+ (currently ~40%)
│   │
│   └── Sign-up flow completion rate (step-by-step)
│       Step 1 — Plan selection:       Current 85% → Target 90%
│       Step 2 — Account creation:     Current 72% → Target 85%
│       Step 3 — Payment entry:        Current 55% → Target 75%
│       Step 4 — Confirmation:         Current 90% → Target 95%
│       Overall funnel:                Current 38% → Target 58%
│
├── CONVERSION
│   ├── Overall conversion rate (North Star)
│   │   Current: 2.8% | Q1 target: 3.8% | Q3 target: 5.0%
│   │
│   ├── Conversion rate by persona segment
│   │   Weekend Explorer:      Target 5.5% (from ~3.2%)
│   │   Reluctant Commuter:    Target 6.2% (from ~4.1%)
│   │   E-bike Adopter:        Target 7.0% (from ~2.5%) — strong price lever
│   │   Seasonal Visitor:      Target 1.0% (intentionally low — wrong product)
│   │
│   ├── Conversion rate by acquisition channel
│   │   Post-ride nudge:       Target 4.8% (new channel)
│   │   Email campaign:        Target 3.5% (from ~1.9%)
│   │   Organic (no CTA):      Target 1.8% (from ~1.2%)
│   │
│   └── Time-to-convert (days from first ride)
│       Current median: 34 days | Target: 21 days
│
└── RETENTION
    ├── Year-1 member renewal rate
    │   Target: 72%+ (industry benchmark: 65%)
    │
    ├── Ride frequency — first 90 days post-conversion
    │   Target: ≥12 rides in first 90 days
    │
    └── Member NPS
        Target: 45+
```

---

## Guardrail Metrics

These are not success metrics — they are constraints. If any guardrail is breached, stop and investigate before continuing.

| Metric | Current baseline | Guardrail threshold | Response |
|---|---|---|---|
| App uninstall rate (casual riders) | 0.8%/month | +5% relative increase | Pause nudge, review copy and timing |
| Casual rider NPS | 42 | -5 points | Investigate coercion perception |
| Casual ride volume | 125K/month | -10% decrease | Check if conversion is cannibalising casual usage |
| Member year-1 churn | 28% | >35% | Investigate onboarding and habit formation |
| Payment failure rate | 3.2% | >6% | Review payment UX |

---

## Experiment Design Standards

### Power requirements
- Minimum 80% statistical power
- 95% confidence level (α = 0.05)
- Two-tailed test unless directional hypothesis is pre-registered

### Pre-registration
Before running any test:
1. Write the hypothesis
2. Define primary and secondary KPIs
3. Define rollback criteria
4. Calculate required sample size
5. Lock the analysis plan

### Sample size calculator

For the post-ride nudge test:
- Baseline: 2.8%
- MDE: 20% relative lift → 3.36%
- Required n: ~3,200 per arm (80% power, 95% confidence)
- At Toronto casual volume (~4,400 exposed/day): ~15 days to reach significance
- Recommended duration: 4 weeks (captures weekly pattern variation)

### Experiment log

| Test | Hypothesis | Status | Result |
|---|---|---|---|
| Post-ride savings nudge | 30% lift in 7-day conversion | Planned Q1 | — |
| Break-even calculator (web) | 15% lift for calculator-exposed users | Planned Q1 | — |
| CTA copy variant A vs B | "Save $X" vs "You're X rides away" | Planned Q2 | — |
| One-tap upgrade flow | 20% reduction in funnel drop-off | Planned Q2 | — |
| Flexible tier pricing (C$55 vs C$65) | Price sensitivity test | Planned Q3 | — |

---

## Reporting Cadence

| Report | Audience | Frequency |
|---|---|---|
| Conversion dashboard | Product, Growth | Daily (automated) |
| Weekly experiment update | Product, Engineering leads | Weekly |
| Funnel health review | Product, Design, Engineering | Bi-weekly |
| Strategy scorecard | Leadership | Monthly |
| Quarterly business review | Exec team | Quarterly |

---

## Metric anti-patterns to avoid

**Don't optimise for CTA impressions.** Showing the membership CTA more is not the same as converting more riders. Frequency without relevance is spam.

**Don't celebrate early conversion spikes.** If conversion jumps 3× in week 1, it's almost certainly survivor bias — the easy converters converting first. Watch the 90-day cohort.

**Don't count a member as retained until they ride.** Track "active members" (≥1 ride in past 30 days) separately from "total members."

**Don't ignore the Seasonal Visitor.** They're 18% of casual rides. Optimising hard for their conversion will skew every experiment. Segment them out of conversion analysis.
