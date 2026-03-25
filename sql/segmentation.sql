-- =============================================================================
-- RideConvert — Rider Behavioral Segmentation
-- =============================================================================
-- Purpose:   Identify and classify casual rider personas from trip behavior.
--            These queries power the persona-based targeting logic for the
--            post-ride nudge, break-even calculator, and flexible tier CTA.
-- Dialect:   Standard SQL (BigQuery / Snowflake / PostgreSQL compatible)
-- Author:    Senior Product Manager
-- Updated:   Q1 2026
--
-- Schema assumptions: same as funnel_analysis.sql
--
-- PM context:
--   Personas are NOT defined upfront and then mapped to data.
--   They are derived from behavioral clustering (see 02_segmentation.ipynb)
--   and these queries operationalise those cluster definitions for
--   production targeting. The persona_segment field in the users table
--   is populated by a nightly job that runs this classification logic.
-- =============================================================================


-- =============================================================================
-- QUERY 1: Classify riders into personas based on trailing 60-day behavior
-- =============================================================================
-- This is the production classification query — runs nightly as a batch job.
-- Output populates users.persona_segment for use in nudge targeting.
--
-- Classification rules (derived from k-means cluster analysis):
--   Weekend Explorer:   >60% of rides on weekends, avg duration > 20 min
--   Reluctant Commuter: >40% of rides 7-9am or 4-7pm on weekdays
--   E-bike Adopter:     >50% of rides on e-bikes
--   Seasonal Visitor:   <6 total rides in trailing 60 days, no weekday pattern
--   Unclassified:       insufficient data (<3 rides)
-- =============================================================================

WITH user_ride_profile AS (

    SELECT
        r.user_id,
        COUNT(*)                                                AS total_rides,
        ROUND(AVG(r.duration_min), 1)                          AS avg_duration_min,
        ROUND(AVG(r.ride_cost_cad), 2)                         AS avg_ride_cost,
        SUM(r.ride_cost_cad)                                   AS total_spend_60d,

        -- Weekend vs weekday split
        ROUND(SUM(CASE WHEN DAYOFWEEK(r.started_at) IN (1, 7)  -- Sun=1, Sat=7
                       THEN 1.0 ELSE 0 END)
              / NULLIF(COUNT(*), 0), 3)                        AS pct_weekend,

        -- Rush-hour commuter signal
        ROUND(SUM(CASE
            WHEN DAYOFWEEK(r.started_at) BETWEEN 2 AND 6   -- Mon-Fri
            AND (HOUR(r.started_at) BETWEEN 7 AND 9
              OR HOUR(r.started_at) BETWEEN 16 AND 18)
            THEN 1.0 ELSE 0 END)
            / NULLIF(COUNT(*), 0), 3)                          AS pct_commute_hours,

        -- E-bike preference
        ROUND(SUM(CASE WHEN r.bike_type = 'EFIT'
                       THEN 1.0 ELSE 0 END)
              / NULLIF(COUNT(*), 0), 3)                        AS pct_ebike,

        -- Seasonality signal: are they summer-only?
        COUNT(DISTINCT MONTH(r.started_at))                    AS distinct_months_active,

        -- Ride recency (days since last ride)
        DATEDIFF(CURRENT_DATE, MAX(DATE(r.started_at)))        AS days_since_last_ride,

        -- Spend-to-membership ratio (how close are they to break-even?)
        ROUND(SUM(r.ride_cost_cad) / 105.0, 3)                AS spend_to_membership_ratio

    FROM rides r
    WHERE r.user_type   = 'Casual Member'
      AND r.started_at >= CURRENT_DATE - INTERVAL '60 days'
    GROUP BY r.user_id

),

persona_classified AS (

    SELECT
        user_id,
        total_rides,
        avg_duration_min,
        avg_ride_cost,
        total_spend_60d,
        pct_weekend,
        pct_commute_hours,
        pct_ebike,
        distinct_months_active,
        days_since_last_ride,
        spend_to_membership_ratio,

        -- Persona classification (ordered by priority — e-bike first as it
        -- cuts across other segments and has the strongest price lever)
        CASE
            WHEN total_rides < 3
                THEN 'Insufficient data'

            WHEN pct_ebike >= 0.50
                THEN 'E-bike Adopter'

            WHEN pct_weekend >= 0.60
             AND avg_duration_min >= 20
                THEN 'Weekend Explorer'

            WHEN pct_commute_hours >= 0.40
             AND avg_duration_min <= 15
                THEN 'Reluctant Commuter'

            WHEN total_rides <= 6
             AND distinct_months_active <= 2
                THEN 'Seasonal Visitor'

            ELSE 'Unclassified'
        END                                                    AS persona_segment,

        -- Conversion priority score (higher = more likely to convert)
        -- Used to rank riders within a segment for nudge throttling
        ROUND(
            (pct_commute_hours * 0.30)
          + (spend_to_membership_ratio * 0.40)
          + (CASE WHEN total_rides >= 8 THEN 0.20 ELSE total_rides * 0.025 END)
          + (CASE WHEN days_since_last_ride <= 7 THEN 0.10 ELSE 0 END)
        , 3)                                                   AS conversion_priority_score

    FROM user_ride_profile

)

SELECT *
FROM persona_classified
WHERE persona_segment != 'Insufficient data'
ORDER BY conversion_priority_score DESC;


-- =============================================================================
-- QUERY 2: Persona segment summary — size, behavior, conversion potential
-- =============================================================================
-- PM question: How big is each segment and what is each worth?
-- This drives resource allocation decisions — which persona to invest in first.
-- =============================================================================

WITH classified_riders AS (
    -- Reference the classification above (or the users table if already populated)
    SELECT
        u.user_id,
        u.persona_segment,
        COUNT(r.ride_id)                                       AS rides_90d,
        SUM(r.ride_cost_cad)                                   AS spend_90d,
        ROUND(AVG(r.duration_min), 1)                          AS avg_duration,
        ROUND(AVG(r.ride_cost_cad), 2)                         AS avg_ride_cost
    FROM users u
    JOIN rides r ON u.user_id = r.user_id
    WHERE r.user_type  = 'Casual Member'
      AND r.started_at >= CURRENT_DATE - INTERVAL '90 days'
      AND u.persona_segment IS NOT NULL
    GROUP BY u.user_id, u.persona_segment
)

SELECT
    persona_segment,
    COUNT(DISTINCT user_id)                                    AS rider_count,
    ROUND(COUNT(DISTINCT user_id) * 100.0
          / SUM(COUNT(DISTINCT user_id)) OVER (), 1)          AS pct_of_casual_base,

    ROUND(AVG(rides_90d), 1)                                   AS avg_rides_per_rider_90d,
    ROUND(AVG(avg_duration), 1)                                AS avg_trip_duration_min,
    ROUND(AVG(avg_ride_cost), 2)                               AS avg_ride_cost_cad,
    ROUND(AVG(spend_90d), 2)                                   AS avg_spend_90d_cad,

    -- Break-even rides at C$105 annual membership
    ROUND(105.0 / NULLIF(AVG(avg_ride_cost), 0), 0)           AS breakeven_rides,

    -- Months to break even at current ride frequency
    ROUND(105.0 / NULLIF(AVG(avg_ride_cost) * AVG(rides_90d) / 3, 0), 1)
                                                               AS months_to_breakeven,

    -- Revenue opportunity at 5% conversion (C$105 × 12 months ARR)
    ROUND(COUNT(DISTINCT user_id) * 0.05 * 105 * 12 / 1000, 0)
                                                               AS arr_opportunity_at_5pct_k

FROM classified_riders
GROUP BY persona_segment
ORDER BY arr_opportunity_at_5pct_k DESC;


-- =============================================================================
-- QUERY 3: E-bike adopter deep-dive — the electrification conversion lever
-- =============================================================================
-- PM question: How much more expensive is a casual e-bike trip vs a member rate?
-- This is the core evidence for the e-bike-specific nudge message.
-- "This e-bike ride cost you C$X. As a member it would have cost C$X/2."
-- =============================================================================

WITH ebike_spend AS (

    SELECT
        r.user_id,
        r.user_type,
        r.duration_min,

        -- Casual e-bike cost: $1 unlock + $0.20/min
        CASE WHEN r.user_type = 'Casual Member'
             THEN 1.00 + (r.duration_min * 0.20)
             ELSE 0 END                                        AS casual_ebike_cost,

        -- Member e-bike cost: $0.10/min (no unlock fee)
        r.duration_min * 0.10                                  AS member_ebike_cost,

        -- Savings per ride
        CASE WHEN r.user_type = 'Casual Member'
             THEN (1.00 + r.duration_min * 0.20) - (r.duration_min * 0.10)
             ELSE 0 END                                        AS savings_per_ride_if_member

    FROM rides r
    WHERE r.bike_type = 'EFIT'
      AND r.started_at >= CURRENT_DATE - INTERVAL '90 days'

)

SELECT
    user_type,
    COUNT(*)                                                   AS ebike_rides,
    ROUND(AVG(duration_min), 1)                                AS avg_duration_min,
    ROUND(AVG(casual_ebike_cost), 2)                           AS avg_casual_cost_cad,
    ROUND(AVG(member_ebike_cost), 2)                           AS avg_member_cost_cad,
    ROUND(AVG(savings_per_ride_if_member), 2)                  AS avg_savings_per_ride,

    -- Annual savings if rider converts (at current e-bike frequency)
    ROUND(AVG(savings_per_ride_if_member)
          * COUNT(*) / 90 * 365, 2)                           AS projected_annual_savings_cad,

    -- Break-even e-bike rides (C$105 / avg savings per ride)
    ROUND(105.0 / NULLIF(AVG(savings_per_ride_if_member), 0), 0)
                                                               AS ebike_breakeven_rides

FROM ebike_spend
GROUP BY user_type;


-- =============================================================================
-- QUERY 4: High-value casual riders — priority nudge targets
-- =============================================================================
-- PM question: Of all casual riders, which individuals are the highest
-- priority for a personalised membership push this week?
--
-- Ranking criteria:
--   1. Spend is already close to or exceeding membership break-even
--   2. Rides frequently (not a one-time user)
--   3. Has ridden recently (high recency = high engagement)
--   4. Uses e-bikes (strongest price lever)
-- =============================================================================

WITH rider_signals AS (

    SELECT
        r.user_id,
        u.persona_segment,
        COUNT(r.ride_id)                                       AS total_rides_30d,
        SUM(r.ride_cost_cad)                                   AS total_spend_30d,
        MAX(r.started_at)                                      AS last_ride_at,
        DATEDIFF(CURRENT_DATE, MAX(DATE(r.started_at)))        AS days_since_last_ride,
        ROUND(AVG(r.duration_min), 1)                          AS avg_duration,
        ROUND(SUM(CASE WHEN r.bike_type = 'EFIT'
                       THEN 1.0 ELSE 0 END) / COUNT(*), 2)    AS pct_ebike,

        -- Has this user already been nudged this month?
        MAX(CASE WHEN e.event_type = 'cta_shown'
                      AND e.event_at >= DATE_TRUNC('month', CURRENT_DATE)
                 THEN 1 ELSE 0 END)                            AS nudged_this_month,

        -- Already a member?
        MAX(CASE WHEN e.event_type = 'signup_completed'
                 THEN 1 ELSE 0 END)                            AS is_member

    FROM rides r
    JOIN users u ON r.user_id = u.user_id
    LEFT JOIN membership_events e ON r.user_id = e.user_id
    WHERE r.user_type   = 'Casual Member'
      AND r.started_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY r.user_id, u.persona_segment

)

SELECT
    user_id,
    persona_segment,
    total_rides_30d,
    ROUND(total_spend_30d, 2)                                  AS total_spend_30d_cad,
    days_since_last_ride,
    avg_duration,
    pct_ebike,

    -- Spend as % of annual membership — how close to self-justifying?
    ROUND(total_spend_30d / 105.0 * 100, 0)                   AS pct_of_membership_spent,

    -- Nudge message personalisation hint
    CASE
        WHEN pct_ebike >= 0.50
            THEN CONCAT('E-bike nudge: Member rate saves ~C$',
                        ROUND((1.00 + avg_duration * 0.10) * total_rides_30d, 0),
                        '/mo')
        WHEN total_spend_30d >= 30
            THEN CONCAT('Spend nudge: C$', ROUND(total_spend_30d, 0),
                        ' spent — membership = C$8.75/mo')
        WHEN persona_segment = 'Reluctant Commuter'
            THEN CONCAT('Commuter nudge: ', total_rides_30d,
                        ' rides → break-even in ', ROUND(105.0/NULLIF(total_spend_30d/total_rides_30d,0),0),
                        ' more rides')
        ELSE 'Standard membership CTA'
    END                                                        AS recommended_nudge_message,

    -- Priority score (higher = nudge first)
    ROUND(
        (LEAST(total_spend_30d / 105.0, 1.0) * 40)     -- spend proximity: max 40pts
      + (LEAST(total_rides_30d / 10.0, 1.0) * 25)      -- frequency: max 25pts
      + (CASE WHEN days_since_last_ride <= 3 THEN 20
              WHEN days_since_last_ride <= 7 THEN 15
              WHEN days_since_last_ride <= 14 THEN 5
              ELSE 0 END)                               -- recency: max 20pts
      + (pct_ebike * 15)                                -- e-bike lever: max 15pts
    , 0)                                                       AS priority_score

FROM rider_signals
WHERE is_member     = 0   -- not already a member
  AND nudged_this_month = 0  -- not already nudged this month
  AND total_rides_30d >= 3   -- enough signal to personalise
ORDER BY priority_score DESC
LIMIT 10000;  -- top 10K riders for this week's nudge batch
