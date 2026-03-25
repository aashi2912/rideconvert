# Product Requirements Document
## RideConvert — Casual Rider to Annual Member Conversion Suite

| Field | Detail |
|---|---|
| **Author** | [Your Name] |
| **Status** | Draft v1.0 |
| **Last updated** | Q1 2026 |
| **Stakeholders** | Engineering, Design, Data, Growth, Finance, Legal |
| **Target launch** | Q1 2026 (Phase 1) · Q3 2026 (Phase 2) |
| **Links** | [Strategy Brief](./STRATEGY.md) · [Metrics Framework](./METRICS.md) · [Decision Log](./DECISIONS.md) |

---

## How to read this document

This PRD covers two related initiatives that ship in sequence:

- **Phase 1 (Q1)** — Post-ride savings nudge + break-even calculator. Quick wins. Minimal engineering. These ship first to establish the conversion baseline and generate data needed to justify Phase 2.
- **Phase 2 (Q3)** — Flexible membership tier + one-tap upgrade flow. Larger structural bet. Requires new SKU, pricing approval, and more engineering. Ships after Phase 1 proves the demand signal.

Read the Strategy Brief first. This document assumes familiarity with the user research, persona definitions, and prioritisation rationale in that document.

---

## 1. Problem Statement

Urban bike-share operators convert only 2–4% of casual riders into annual members, despite annual members generating 3–5× more lifetime revenue. The root cause is a product value gap: the membership product was designed around a commuter use case, while the majority of casual riders use the service for leisure. The product does not make membership feel worth it for how they actually ride.

---

## 2. Goals and Non-Goals

### Goals

- Increase casual → annual member conversion rate from 2.8% to 5.0% within 12 months
- Reduce time-to-convert from median 34 days to 21 days
- Reduce sign-up funnel drop-off rate from 62% to 42%
- Launch a flexible membership tier that achieves ≥4% attach rate among eligible casual riders within 90 days of launch

### Non-Goals

- **New user acquisition** — optimising conversion of existing casual riders only. Not top-of-funnel growth.
- **Pricing discounts on existing annual membership** — discounting trains users to wait for deals and permanently degrades LTV.
- **Referral or social sharing features** — acquisition tools, not conversion tools.
- **New station infrastructure or geographic expansion** — supply is not the constraint.
- **Gamification** — insufficient evidence for conversion lift in this user segment.
- **Changes to the casual rider ride experience** — adding conversion touchpoints only, not changing the core ride flow.

---

## 3. User Stories

### Phase 1 — Post-ride savings nudge

**As a casual rider who has just completed a ride**, I want to understand how much I am spending on individual rides compared to the cost of a membership, so that I can make an informed decision about whether membership is worth it — without having to do the math myself.

**Acceptance criteria:**
- The nudge appears in-app within 30 seconds of a ride ending
- The nudge displays the rider's cumulative spend for the past 30 days
- The nudge displays the monthly equivalent cost of annual membership
- The nudge displays a break-even calculation personalised to the operator ("You're X rides away from breaking even" — e.g. for Bike Share Toronto: ~24 rides at avg C$4.48/ride to recoup C$105 annual membership)
- The nudge includes a single CTA: "Get membership" → deep links to sign-up flow
- The nudge includes a secondary action: "Remind me later" (dismisses for 7 days)
- The nudge does NOT appear for riders who have already seen it 3+ times without converting (frequency cap)
- The nudge does NOT appear for existing members

**Edge cases:**
- Rider has taken only 1 ride this month: show projected savings at their current frequency, not 30-day cumulative
- Rider's cumulative spend is already higher than annual membership cost: show "You've already spent more than a membership costs this year"
- Rider dismisses 3 times: suppress nudge permanently, surface alternative CTA in ride receipt email instead

---

### Phase 1 — Break-even calculator

**As a casual rider who is considering membership but unsure if it's worth it**, I want to quickly calculate how many rides I need to take for membership to pay off, so that I can make a confident decision.

**Operator-specific break-even examples (for personalisation):**
- Bike Share Toronto: C$105 ÷ C$4.48/ride (avg 29-min ride) = **~24 rides** to break even
- Divvy Chicago: $105 ÷ $3.30/ride = **~32 rides** to break even
- Citi Bike NYC: $179 ÷ $4.50/ride = **~40 rides** to break even
- Santander Cycles: £120 ÷ £3.20/ride = **~38 rides** to break even

**Acceptance criteria:**
- Calculator is accessible from: (a) the nudge CTA, (b) the membership landing page, (c) the profile tab
- Input: average number of rides per week (slider, 1–7)
- Output: payback period in weeks, monthly savings, annual savings
- Inputs pre-populated based on the rider's actual usage history where available
- Available on web and in-app
- No sign-in required to use the calculator on web (shareable link)

---

### Phase 1 — Funnel instrumentation

**As a product team**, we need complete visibility into where riders drop off in the conversion funnel, so that we can identify and prioritise the highest-impact friction points before launching Phase 2.

**Acceptance criteria:**
- Every step in the sign-up flow fires a named analytics event
- Events captured: nudge_shown, nudge_cta_clicked, nudge_dismissed, calculator_opened, calculator_submitted, signup_step_1 through signup_step_4, signup_completed, signup_abandoned (with step number)
- Events include: user_id (hashed), persona_segment, ride_count_30d, cumulative_spend_30d, platform (iOS/Android/web)
- Dashboard shows real-time funnel drop-off by step
- Data available within 24 hours of event

---

### Phase 2 — Flexible membership tier

**As a Weekend Explorer casual rider**, I want a membership option that feels designed for how I actually ride — not one that assumes I commute every day — so that I can get the cost benefits of membership without paying for something I won't use.

**Acceptance criteria:**
- New membership SKU: "Weekend Membership" at $[TBD — pricing research required] per year
- Entitlements: unlimited rides on Saturdays and Sundays, 10 weekday ride credits per month
- Weekday credits roll over for a maximum of 1 month (no indefinite accumulation)
- Weekend membership is presented as a distinct product, not a discount on annual
- Positioning: "Built for how you actually ride" — not "cheaper option"
- Weekend tier is NOT shown to riders whose usage is primarily weekday (commuter profile)
- Pricing ladder on landing page: single ride → day pass → weekend membership → annual membership
- A/B test: weekend tier shown vs. not shown, to measure impact on overall conversion and annual membership cannibalization

**Legal / Finance requirements (to confirm before build):**
- Pricing to be approved by Finance
- Terms and conditions update required
- Proration rules for mid-year purchase

---

### Phase 2 — One-tap upgrade flow

**As a casual rider who has decided to purchase a membership**, I want to complete my purchase in as few steps as possible, so that I don't abandon the process while I'm still motivated.

**Acceptance criteria:**
- For riders with a saved payment method: sign-up flow reduced from 6 steps to 2 (plan confirmation → payment confirmation)
- For riders without a saved payment method: sign-up flow reduced to 3 steps (plan confirmation → payment entry → confirmation)
- Payment method from most recent ride auto-populated
- Membership start date: immediate
- Confirmation screen includes: membership start date, first renewal date, entitlements summary
- Confirmation triggers: welcome email, push notification, updated app state
- If payment fails: clear inline error, retry without restarting flow

---

## 4. Functional Requirements

### 4.1 Post-ride savings nudge

| Requirement | Priority |
|---|---|
| In-app trigger within 30s of ride end | P0 |
| Personalised spend calculation (30-day rolling) | P0 |
| Break-even ride count display | P0 |
| Deep link to sign-up flow | P0 |
| Frequency cap: max 3 impressions before suppress | P1 |
| "Remind me later" — 7 day snooze | P1 |
| Suppress for existing members | P0 |
| Suppress for riders with <2 rides in past 30 days | P1 |
| A/B test variant support | P0 |

### 4.2 Break-even calculator

| Requirement | Priority |
|---|---|
| Rides per week slider input (1–7) | P0 |
| Pre-populate from ride history (logged-in users) | P1 |
| Payback period output (weeks) | P0 |
| Monthly and annual savings output | P0 |
| Available without sign-in (web) | P1 |

### 4.3 Flexible membership tier

| Requirement | Priority |
|---|---|
| New SKU creation in billing system | P0 |
| Entitlement enforcement: weekends unlimited | P0 |
| Entitlement enforcement: 10 weekday credits/mo | P0 |
| Credit rollover cap (1 month) | P1 |
| Persona-based tier recommendation | P1 |
| Pricing ladder on membership page | P0 |
| A/B test: weekend tier present vs. absent | P0 |

### 4.4 One-tap upgrade flow

| Requirement | Priority |
|---|---|
| Saved payment method auto-population | P0 |
| 2-step flow for saved payment users | P0 |
| 3-step flow for new payment users | P0 |
| Immediate membership activation | P0 |
| Confirmation email + push | P0 |
| Payment failure handling with inline error | P0 |
| Analytics events at each step | P0 |

---

## 5. Non-Functional Requirements

| Requirement | Specification |
|---|---|
| Nudge load time | <500ms from ride end event |
| Calculator response time | <200ms (client-side) |
| Sign-up flow completion time | Target <3 minutes end-to-end |
| Uptime — sign-up flow | 99.9% |
| Payment processing | PCI DSS compliant |
| Accessibility | WCAG 2.1 AA for all new UI surfaces |
| Analytics event delivery | 99%+ delivery rate |
| GDPR / CCPA | Spend data used for nudge must be disclosed in privacy policy |

---

## 6. Design Requirements

### Nudge UI
- Bottom sheet overlay on post-ride summary screen (not a separate screen)
- Headline: "[Name], your rides this month: $[X]"
- Subline: "Annual membership: $8.75/month. You're [N] rides from breaking even."
- Primary CTA: "Get membership" — full-width, primary colour
- Secondary: "Remind me later" — text link, not a button
- Maximum height: 40% of screen

### Break-even calculator
- Embedded in the membership landing page
- Single slider: "How often do you ride?" — 1 to 7 rides per week
- Three output cards: "Payback in [X] weeks" · "Save $[X]/month" · "Save $[X]/year"
- Output cards animate on slider change
- Primary CTA below: "Start your membership"

### One-tap flow
- Full-screen, single-column layout
- Progress indicator: step 1 of 2 (or 1 of 3)
- Payment method shown as: "[Card brand] ending [last 4]"
- Large confirm button: "Start my membership — $[price]/year"
- Small text below CTA: "Renews [date]. Cancel anytime."

---

## 7. Analytics and Instrumentation Plan

### Events required (Phase 1)

```
nudge_shown
  → user_id, ride_id, spend_30d, ride_count_30d, persona_segment, platform, ab_variant

nudge_cta_clicked
  → user_id, ride_id, persona_segment, platform, ab_variant

nudge_dismissed
  → user_id, ride_id, dismiss_count, platform, ab_variant

calculator_opened
  → user_id, source (nudge | landing_page | profile), platform

calculator_submitted
  → user_id, rides_per_week_input, payback_weeks_shown, savings_annual_shown

signup_started
  → user_id, source, tier_selected, platform

signup_step_completed
  → user_id, step_number (1–4), time_on_step_seconds

signup_abandoned
  → user_id, last_step_completed, time_in_flow_seconds

signup_completed
  → user_id, tier, price, payment_method_type, source, ab_variant, time_to_convert_days
```

---

## 8. Launch Plan

### Phase 1 launch sequence

| Week | Milestone |
|---|---|
| W1–2 | Engineering build: nudge + instrumentation |
| W3 | QA and internal testing |
| W4 | Soft launch: 5% of casual riders (canary) |
| W5 | Canary review: check guardrails, inspect events |
| W6 | Full rollout: 50/50 A/B split |
| W10 | A/B test read-out (4-week test window) |
| W11 | Decision: scale, iterate, or pause |
| W12 | Break-even calculator launch |

### Phase 1 launch criteria

- [ ] Nudge appears within 500ms of ride end in 99%+ of test cases
- [ ] Analytics events firing at >99% delivery rate
- [ ] Frequency cap verified: no user sees nudge more than 3 times
- [ ] Existing members confirmed suppressed
- [ ] Legal has reviewed spend data usage in privacy policy
- [ ] Rollback plan tested: feature flag disables nudge in <5 minutes

### Phase 2 launch criteria

- [ ] Finance has approved flexible membership pricing
- [ ] Legal has reviewed updated terms and conditions
- [ ] Entitlement enforcement tested
- [ ] Cannibalization A/B test designed and approved
- [ ] Payment failure handling tested for all card types and error codes

---

## 9. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Nudge feels coercive — increases uninstalls | Medium | High | Frequency cap (3 impressions max). Monitor uninstall rate. Kill switch via feature flag. |
| Weekend tier cannibalises annual membership | Medium | High | A/B test weekend tier presence before full launch. |
| Spend data calculation is inaccurate | Low | High | QA on 5 test accounts before launch. |
| One-tap flow has payment failures not caught | Low | High | Test all card types, all error codes, expired card, insufficient funds. |
| Phase 1 shows no lift — pressure to discount | Medium | High | Pre-align on no-discounting constraint before launch. |

---

## 10. Open Questions

| Question | Owner | Status |
|---|---|---|
| What is the flexible membership price? (willingness-to-pay research needed) | PM | Open |
| How do we handle users on legacy pricing plans? | Engineering + Finance | Open |
| Does the nudge require explicit opt-in under GDPR for EU operators? | Legal | Open |
| What is the definition of "weekend" for non-standard time zones? | Engineering | Open |
| Can we use saved payment methods without re-consent? | Legal + Engineering | Open |

---

## Appendix A — Persona reference

| Persona | % of casual rides | Conversion barrier | Primary product lever |
|---|---|---|---|
| Weekend Explorer | 42% | Price/value mismatch for leisure use | Flexible membership tier |
| Reluctant Commuter | 31% | Uncertainty about ride frequency vs. cost | Break-even calculator + nudge |
| Seasonal Visitor | 18% | Annual membership wrong product | Short-term visitor tier (future phase) |
| E-bike Adopter | 9% (growing) | Unaware of 50% member e-bike rate discount | E-bike savings nudge (electrified operators) |

---

## Appendix B — Sign-up flow current state vs. target state

**Current state (6 steps):**
1. Membership landing page
2. Plan selection
3. Account creation
4. Address entry
5. Payment entry
6. Confirmation

**Target state — returning user with saved payment (2 steps):**
1. Plan confirmation
2. Payment confirmation

**Target state — new user (3 steps):**
1. Plan confirmation
2. Payment entry
3. Confirmation

---

## Appendix C — Competitive reference

| Operator | Pricing | Notes |
|---|---|---|
| Citi Bike (NYC) | $179/year | No flexible tier |
| Divvy (Chicago) | $105/year | No flexible tier |
| Santander Cycles (London) | £120/year | No flexible tier |
| Bike Share Toronto | CAD $105 (Annual 30) · CAD $120 (Annual 45) | No monthly or weekend tier |
| Vélib' (Paris) | €39/year (classic) | Closest to flexible tier model |

No major operator has a weekend-specific membership tier as of Q1 2026.
