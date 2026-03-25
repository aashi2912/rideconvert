-- =============================================================================
-- RideConvert — Post-Conversion Retention & Cohort Analysis
-- =============================================================================
-- Purpose:   Measure what happens AFTER a rider converts to membership.
--            Conversion rate is the North Star, but member retention is the
--            business model. A rider who converts and cancels in month 2
--            is worse than a casual rider who never converts — they consume
--            support costs and poison word-of-mouth.
--
-- PM context:
--   These queries answer: "Are we converting the right riders?"
--   If retention is low for a specific persona or channel, we are
--   optimising conversion at the expense of LTV. That is a failure mode
--   that won't show up in conversion metrics for 6-12 months.
--
-- Dialect:   Standard SQL (BigQuery / Snowflake / PostgreSQL compatible)
-- Author:    Senior Product Manager
-- Updated:   Q1 2026
-- =============================================================================


-- =============================================================================
-- QUERY 1: Monthly cohort retention — the foundational retention view
-- =============================================================================
-- Tracks what % of each signup cohort is still active (has ridden) in
-- each subsequent month. Classic cohort retention table.
--
-- PM question: Is retention improving or degrading over time?
-- Target: ≥65% retention at month 3, ≥50% at month 6.
-- =============================================================================

WITH member_cohorts AS (

    SELECT
        user_id,
        DATE_TRUNC('month', MIN(event_at))                     AS cohort_month,
        MIN(event_at)                                          AS converted_at

    FROM membership_events
    WHERE event_type = 'signup_completed'
    GROUP BY user_id

),

monthly_activity AS (

    SELECT
        r.user_id,
        DATE_TRUNC('month', r.started_at)                      AS activity_month,
        COUNT(r.ride_id)                                       AS rides_in_month

    FROM rides r
    WHERE r.user_type = 'Annual Member'
    GROUP BY r.user_id, DATE_TRUNC('month', r.started_at)

),

cohort_activity AS (

    SELECT
        c.user_id,
        c.cohort_month,
        a.activity_month,
        DATEDIFF('month', c.cohort_month, a.activity_month)    AS months_since_conversion,
        a.rides_in_month

    FROM member_cohorts c
    LEFT JOIN monthly_activity a ON c.user_id = a.user_id
    WHERE a.activity_month >= c.cohort_month

)

SELECT
    cohort_month,
    months_since_conversion,
    COUNT(DISTINCT user_id)                                    AS active_members,

    -- Cohort size (month 0 = conversion month)
    MAX(COUNT(DISTINCT user_id))
        OVER (PARTITION BY cohort_month)                       AS cohort_size,

    -- Retention rate
    ROUND(COUNT(DISTINCT user_id) * 100.0
          / MAX(COUNT(DISTINCT user_id))
          OVER (PARTITION BY cohort_month), 1)                 AS retention_pct,

    ROUND(AVG(rides_in_month), 1)                              AS avg_rides_per_active_member

FROM cohort_activity
GROUP BY cohort_month, months_since_conversion
ORDER BY cohort_month, months_since_conversion;


-- =============================================================================
-- QUERY 2: Retention by persona segment — are we converting the right riders?
-- =============================================================================
-- PM question: Which persona retains best? If Weekend Explorers retain at
-- 80% but Reluctant Commuters retain at 40%, the Reluctant Commuter
-- conversion is producing churn. The product is wrong for them —
-- not the acquisition.
-- =============================================================================

WITH member_cohorts AS (

    SELECT
        e.user_id,
        u.persona_segment,
        e.source_channel,
        DATE_TRUNC('month', MIN(e.event_at))                   AS cohort_month,
        MIN(e.event_at)                                        AS converted_at

    FROM membership_events e
    JOIN users u ON e.user_id = u.user_id
    WHERE e.event_type = 'signup_completed'
      AND e.event_at   >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY e.user_id, u.persona_segment, e.source_channel

),

activity_by_persona AS (

    SELECT
        c.user_id,
        c.persona_segment,
        c.cohort_month,
        c.source_channel,
        ma.activity_month,
        DATEDIFF('month', c.cohort_month, ma.activity_month)   AS months_since_conversion,
        COALESCE(ma.rides_in_month, 0)                         AS rides_in_month

    FROM member_cohorts c
    LEFT JOIN (
        SELECT user_id,
               DATE_TRUNC('month', started_at)                 AS activity_month,
               COUNT(*)                                        AS rides_in_month
        FROM rides
        WHERE user_type = 'Annual Member'
        GROUP BY user_id, DATE_TRUNC('month', started_at)
    ) ma ON c.user_id = ma.user_id
        AND ma.activity_month BETWEEN c.cohort_month
                                  AND c.cohort_month + INTERVAL '6 months'

)

SELECT
    persona_segment,
    months_since_conversion,
    COUNT(DISTINCT user_id)                                    AS active_members,
    ROUND(AVG(rides_in_month), 1)                              AS avg_rides,

    -- Retention vs cohort baseline (month 0)
    ROUND(COUNT(DISTINCT user_id) * 100.0
          / NULLIF(MAX(COUNT(DISTINCT user_id))
              OVER (PARTITION BY persona_segment), 0), 1)      AS retention_pct

FROM activity_by_persona
WHERE months_since_conversion BETWEEN 0 AND 6
GROUP BY persona_segment, months_since_conversion
ORDER BY persona_segment, months_since_conversion;


-- =============================================================================
-- QUERY 3: Churn early-warning — members at risk before renewal
-- =============================================================================
-- PM question: Which members show declining engagement signals that
-- predict cancellation at renewal? Flag them for a re-engagement nudge
-- before they cancel — much cheaper than re-acquiring after churn.
--
-- Churn signals:
--   - Ride frequency declined >50% in last 30 days vs prior 30 days
--   - No rides in the last 21 days
--   - Membership renewal is within 60 days
-- =============================================================================

WITH member_ride_trend AS (

    SELECT
        r.user_id,
        -- Prior 30-day window
        SUM(CASE WHEN r.started_at BETWEEN CURRENT_DATE - INTERVAL '60 days'
                                       AND CURRENT_DATE - INTERVAL '31 days'
                 THEN 1 ELSE 0 END)                            AS rides_prior_30d,
        -- Recent 30-day window
        SUM(CASE WHEN r.started_at >= CURRENT_DATE - INTERVAL '30 days'
                 THEN 1 ELSE 0 END)                            AS rides_recent_30d,
        MAX(r.started_at)                                      AS last_ride_at,
        DATEDIFF(CURRENT_DATE, MAX(DATE(r.started_at)))        AS days_since_last_ride

    FROM rides r
    WHERE r.user_type   = 'Annual Member'
      AND r.started_at >= CURRENT_DATE - INTERVAL '60 days'
    GROUP BY r.user_id

),

membership_renewal AS (

    SELECT
        user_id,
        MAX(event_at)                                          AS membership_start,
        DATEADD('year', 1, MAX(event_at))                      AS renewal_date,
        DATEDIFF(DATEADD('year', 1, MAX(event_at)), CURRENT_DATE)
                                                               AS days_to_renewal

    FROM membership_events
    WHERE event_type = 'signup_completed'
    GROUP BY user_id

)

SELECT
    t.user_id,
    u.persona_segment,
    mr.renewal_date,
    mr.days_to_renewal,
    t.rides_prior_30d,
    t.rides_recent_30d,
    t.days_since_last_ride,

    -- Engagement trend
    ROUND((t.rides_recent_30d - t.rides_prior_30d) * 1.0
          / NULLIF(t.rides_prior_30d, 0) * 100, 0)            AS ride_frequency_change_pct,

    -- Churn risk classification
    CASE
        WHEN t.days_since_last_ride >= 21
         AND mr.days_to_renewal <= 60
            THEN 'High — dormant + renewal imminent'
        WHEN t.rides_recent_30d < t.rides_prior_30d * 0.5
         AND mr.days_to_renewal <= 90
            THEN 'Medium — declining engagement near renewal'
        WHEN t.days_since_last_ride >= 14
            THEN 'Medium — extended inactivity'
        WHEN mr.days_to_renewal <= 30
            THEN 'Low — renewal soon, monitor'
        ELSE 'Active — no risk signal'
    END                                                        AS churn_risk,

    -- Recommended intervention
    CASE
        WHEN t.days_since_last_ride >= 21
            THEN 'Win-back: personalised re-engagement email with nearest station'
        WHEN t.rides_recent_30d < t.rides_prior_30d * 0.5
            THEN 'Re-engage: highlight member perks + upcoming local events'
        WHEN mr.days_to_renewal <= 30
            THEN 'Renewal reminder: show YTD savings vs casual rate'
        ELSE NULL
    END                                                        AS recommended_action

FROM member_ride_trend t
JOIN users u ON t.user_id = u.user_id
JOIN membership_renewal mr ON t.user_id = mr.user_id
WHERE mr.days_to_renewal BETWEEN 0 AND 90   -- renewal window
  AND (
    t.days_since_last_ride >= 14
    OR t.rides_recent_30d < t.rides_prior_30d * 0.5
  )
ORDER BY
    CASE churn_risk
        WHEN 'High — dormant + renewal imminent'     THEN 1
        WHEN 'Medium — declining engagement near renewal' THEN 2
        WHEN 'Medium — extended inactivity'          THEN 3
        ELSE 4
    END,
    mr.days_to_renewal;


-- =============================================================================
-- QUERY 4: YTD savings report — member value realisation
-- =============================================================================
-- PM question: Are members actually saving money vs what they would have
-- paid as casual riders? If yes, by how much?
-- This powers the renewal reminder message:
-- "You've saved C$X this year as a member. Don't lose it."
-- =============================================================================

WITH member_ytd AS (

    SELECT
        r.user_id,
        u.persona_segment,
        COUNT(r.ride_id)                                       AS ytd_rides,
        SUM(r.duration_min)                                    AS ytd_minutes,

        -- What they paid (member rate)
        SUM(CASE WHEN r.bike_type = 'EFIT'
                 THEN r.duration_min * 0.10    -- member e-bike rate
                 ELSE 0 END)                                   AS actual_ebike_charges,
        105                                                    AS annual_membership_fee,

        -- What they would have paid as casual (classic: $1 + $0.12/min, e-bike: $1 + $0.20/min)
        SUM(CASE
            WHEN r.bike_type = 'ICONIC'
                THEN 1.00 + (r.duration_min * 0.12)
            WHEN r.bike_type = 'EFIT'
                THEN 1.00 + (r.duration_min * 0.20)
            ELSE 0
        END)                                                   AS equivalent_casual_cost

    FROM rides r
    JOIN users u ON r.user_id = u.user_id
    JOIN membership_events me
        ON  r.user_id   = me.user_id
        AND me.event_type = 'signup_completed'
    WHERE r.user_type   = 'Annual Member'
      AND r.started_at >= DATE_TRUNC('year', CURRENT_DATE)   -- YTD
    GROUP BY r.user_id, u.persona_segment

)

SELECT
    user_id,
    persona_segment,
    ytd_rides,
    ROUND(ytd_minutes / 60.0, 1)                              AS ytd_hours_ridden,
    ROUND(actual_ebike_charges, 2)                            AS actual_ebike_charges_cad,
    annual_membership_fee,
    ROUND(actual_ebike_charges + annual_membership_fee, 2)    AS total_member_cost_cad,
    ROUND(equivalent_casual_cost, 2)                          AS equivalent_casual_cost_cad,

    -- Net savings
    ROUND(equivalent_casual_cost
          - (actual_ebike_charges + annual_membership_fee), 2) AS net_savings_cad,

    -- Savings as multiple of membership fee (>1 = membership paid for itself)
    ROUND(equivalent_casual_cost
          / NULLIF(actual_ebike_charges + annual_membership_fee, 0), 2)
                                                              AS savings_multiple,

    -- Renewal message personalisation
    CASE
        WHEN (equivalent_casual_cost - actual_ebike_charges - annual_membership_fee) >= 50
            THEN CONCAT('High value: saved C$',
                        ROUND(equivalent_casual_cost - actual_ebike_charges - 105, 0),
                        ' — strong renewal message')
        WHEN (equivalent_casual_cost - actual_ebike_charges - annual_membership_fee) >= 0
            THEN CONCAT('Positive ROI: membership has paid off — remind at renewal')
        ELSE 'Low usage — at-risk rider, send re-engagement first'
    END                                                       AS renewal_message_tier

FROM member_ytd
ORDER BY net_savings_cad DESC;


-- =============================================================================
-- QUERY 5: Guardrail monitoring — ensure conversion does not damage casual UX
-- =============================================================================
-- PM question: Is the nudge causing casual riders to reduce their ride frequency
-- or uninstall the app? These are the guardrail metrics we track weekly.
--
-- If casual ride volume drops >10% or uninstalls rise >5% in the nudge
-- cohort vs control, we pause the nudge immediately.
-- =============================================================================

WITH nudge_cohort AS (

    SELECT
        e.user_id,
        e.nudge_variant,
        DATE(e.event_at)                                       AS nudge_date

    FROM membership_events e
    WHERE e.event_type   = 'cta_shown'
      AND e.event_at    >= CURRENT_DATE - INTERVAL '28 days'

),

post_nudge_behavior AS (

    SELECT
        nc.nudge_variant,
        nc.user_id,

        -- Ride frequency: 14 days before nudge vs 14 days after
        SUM(CASE WHEN r.started_at BETWEEN nc.nudge_date - INTERVAL '14 days'
                                       AND nc.nudge_date - INTERVAL '1 day'
                 THEN 1 ELSE 0 END)                            AS rides_pre_nudge,
        SUM(CASE WHEN r.started_at BETWEEN nc.nudge_date
                                       AND nc.nudge_date + INTERVAL '13 days'
                 THEN 1 ELSE 0 END)                            AS rides_post_nudge,

        -- App uninstall event (from app events table)
        MAX(CASE WHEN ae.event_type = 'app_uninstall'
                      AND ae.event_at >= nc.nudge_date
                 THEN 1 ELSE 0 END)                            AS uninstalled_post_nudge

    FROM nudge_cohort nc
    LEFT JOIN rides r ON r.user_id = nc.user_id
    LEFT JOIN app_events ae ON ae.user_id = nc.user_id
    GROUP BY nc.nudge_variant, nc.user_id, nc.nudge_date

)

SELECT
    nudge_variant,
    COUNT(DISTINCT user_id)                                    AS users,
    ROUND(AVG(rides_pre_nudge), 2)                             AS avg_rides_pre_nudge,
    ROUND(AVG(rides_post_nudge), 2)                            AS avg_rides_post_nudge,

    -- Ride frequency change (guardrail: must be > -10%)
    ROUND((AVG(rides_post_nudge) - AVG(rides_pre_nudge))
          / NULLIF(AVG(rides_pre_nudge), 0) * 100, 1)         AS ride_freq_change_pct,

    -- Uninstall rate (guardrail: must be < 5% relative increase vs control)
    ROUND(SUM(uninstalled_post_nudge) * 100.0
          / NULLIF(COUNT(DISTINCT user_id), 0), 2)             AS uninstall_rate_pct,

    -- Guardrail status
    CASE
        WHEN (AVG(rides_post_nudge) - AVG(rides_pre_nudge))
             / NULLIF(AVG(rides_pre_nudge), 0) < -0.10
            THEN 'BREACH — ride frequency down >10% — pause nudge'
        WHEN SUM(uninstalled_post_nudge) * 100.0
             / NULLIF(COUNT(DISTINCT user_id), 0) > 5.0
            THEN 'BREACH — uninstall rate >5% — pause nudge'
        ELSE 'OK — within guardrail thresholds'
    END                                                        AS guardrail_status

FROM post_nudge_behavior
GROUP BY nudge_variant
ORDER BY nudge_variant;
