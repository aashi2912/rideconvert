-- =============================================================================
-- RideConvert — Conversion Funnel Analysis
-- =============================================================================
-- Purpose:   Measure and diagnose the casual rider → annual member funnel
-- Dialect:   Standard SQL (compatible with BigQuery, Snowflake, PostgreSQL)
-- Author:    Senior Product Manager
-- Updated:   Q1 2026
--
-- Schema assumptions:
--   rides(ride_id, user_id, started_at, ended_at, duration_min,
--         user_type, bike_type, station_id, ride_cost_cad)
--
--   membership_events(event_id, user_id, event_type, event_at, membership_tier,
--                     price_cad, source_channel, nudge_variant)
--   event_type IN ('cta_shown','cta_clicked','signup_started',
--                  'signup_step_completed','signup_abandoned','signup_completed')
--
--   users(user_id, first_ride_at, user_type, persona_segment,
--         city, registration_channel)
-- =============================================================================


-- =============================================================================
-- QUERY 1: Top-level funnel — daily snapshot
-- =============================================================================
-- PM question: Where exactly are we losing riders in the conversion flow?
-- This is the primary monitoring query — should run daily and feed the
-- internal analytics dashboard. Drop-off at each step drives sprint priorities.
-- =============================================================================

WITH daily_funnel AS (

    SELECT
        DATE(e.event_at)                                        AS event_date,

        -- Step 1: Casual riders who completed a ride (nudge eligible)
        COUNT(DISTINCT CASE
            WHEN r.user_type = 'Casual Member'
            THEN r.user_id END)                                 AS casual_riders,

        -- Step 2: Riders who saw the CTA
        COUNT(DISTINCT CASE
            WHEN e.event_type = 'cta_shown'
            THEN e.user_id END)                                 AS cta_shown,

        -- Step 3: Riders who clicked the CTA
        COUNT(DISTINCT CASE
            WHEN e.event_type = 'cta_clicked'
            THEN e.user_id END)                                 AS cta_clicked,

        -- Step 4: Riders who started sign-up
        COUNT(DISTINCT CASE
            WHEN e.event_type = 'signup_started'
            THEN e.user_id END)                                 AS signup_started,

        -- Step 5: Riders who completed sign-up (converted)
        COUNT(DISTINCT CASE
            WHEN e.event_type = 'signup_completed'
            THEN e.user_id END)                                 AS signup_completed

    FROM rides r
    LEFT JOIN membership_events e
        ON  r.user_id   = e.user_id
        AND DATE(r.started_at) = DATE(e.event_at)
    WHERE r.started_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY DATE(e.event_at)

),

funnel_with_rates AS (

    SELECT
        event_date,
        casual_riders,
        cta_shown,
        cta_clicked,
        signup_started,
        signup_completed,

        -- Drop-off rates at each step
        ROUND(cta_shown      * 1.0 / NULLIF(casual_riders, 0), 4)  AS exposure_rate,
        ROUND(cta_clicked    * 1.0 / NULLIF(cta_shown,     0), 4)  AS cta_ctr,
        ROUND(signup_started * 1.0 / NULLIF(cta_clicked,   0), 4)  AS click_to_start,
        ROUND(signup_completed * 1.0 / NULLIF(signup_started,0),4) AS start_to_complete,

        -- North Star: end-to-end conversion rate
        ROUND(signup_completed * 1.0 / NULLIF(casual_riders, 0), 4) AS conversion_rate,

        -- 7-day rolling average (smooths day-of-week noise)
        ROUND(AVG(signup_completed * 1.0 / NULLIF(casual_riders, 0))
            OVER (ORDER BY event_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 4)
                                                                    AS conversion_rate_7d_avg

    FROM daily_funnel

)

SELECT * FROM funnel_with_rates
ORDER BY event_date DESC;


-- =============================================================================
-- QUERY 2: Funnel by persona segment
-- =============================================================================
-- PM question: Which persona converts best? Which is being failed by the funnel?
-- This drives persona-specific CTA copy and nudge targeting decisions.
-- If Weekend Explorer converts at 2% but Reluctant Commuter converts at 5%,
-- the calculator copy is working and we should invest more there first.
-- =============================================================================

WITH persona_funnel AS (

    SELECT
        u.persona_segment,
        COUNT(DISTINCT r.user_id)                               AS casual_riders,

        COUNT(DISTINCT CASE
            WHEN e.event_type = 'cta_shown'
            THEN e.user_id END)                                 AS cta_shown,

        COUNT(DISTINCT CASE
            WHEN e.event_type = 'cta_clicked'
            THEN e.user_id END)                                 AS cta_clicked,

        COUNT(DISTINCT CASE
            WHEN e.event_type = 'signup_completed'
            THEN e.user_id END)                                 AS converted,

        ROUND(AVG(r.duration_min), 1)                           AS avg_ride_duration,
        ROUND(AVG(r.ride_cost_cad), 2)                          AS avg_ride_cost

    FROM rides r
    JOIN users u ON r.user_id = u.user_id
    LEFT JOIN membership_events e ON r.user_id = e.user_id
    WHERE r.user_type  = 'Casual Member'
      AND r.started_at >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY u.persona_segment

)

SELECT
    persona_segment,
    casual_riders,
    cta_shown,
    cta_clicked,
    converted,
    avg_ride_duration,
    avg_ride_cost,
    ROUND(105.0 / NULLIF(avg_ride_cost, 0), 0)                  AS breakeven_rides,
    ROUND(cta_clicked  * 1.0 / NULLIF(cta_shown,      0), 3)   AS cta_ctr,
    ROUND(converted    * 1.0 / NULLIF(casual_riders,   0), 4)   AS conversion_rate,

    -- Rank by conversion rate to focus optimisation effort
    RANK() OVER (ORDER BY converted * 1.0 / NULLIF(casual_riders, 0) DESC)
                                                                AS conversion_rank

FROM persona_funnel
ORDER BY conversion_rate DESC;


-- =============================================================================
-- QUERY 3: Funnel by acquisition channel (A/B test results)
-- =============================================================================
-- PM question: Which nudge variant is winning? Is the post-ride nudge
-- outperforming the email campaign and geo-targeted offer?
-- This is the primary read-out query after each experiment completes.
-- =============================================================================

WITH channel_funnel AS (

    SELECT
        e.source_channel,
        e.nudge_variant,
        COUNT(DISTINCT e.user_id)                               AS users_exposed,
        COUNT(DISTINCT CASE
            WHEN e.event_type = 'cta_clicked'
            THEN e.user_id END)                                 AS cta_clicks,
        COUNT(DISTINCT CASE
            WHEN e.event_type = 'signup_completed'
            THEN e.user_id END)                                 AS conversions,
        AVG(CASE
            WHEN e.event_type = 'signup_completed'
            THEN EXTRACT(EPOCH FROM (e.event_at - first_touch.first_at)) / 86400.0
            END)                                                AS avg_days_to_convert

    FROM membership_events e
    JOIN (
        SELECT user_id, MIN(event_at) AS first_at
        FROM membership_events
        WHERE event_type = 'cta_shown'
        GROUP BY user_id
    ) first_touch ON e.user_id = first_touch.user_id
    WHERE e.event_at >= CURRENT_DATE - INTERVAL '28 days'  -- standard test window
    GROUP BY e.source_channel, e.nudge_variant

)

SELECT
    source_channel,
    nudge_variant,
    users_exposed,
    cta_clicks,
    conversions,
    ROUND(cta_clicks    * 1.0 / NULLIF(users_exposed, 0), 4)   AS ctr,
    ROUND(conversions   * 1.0 / NULLIF(users_exposed, 0), 4)   AS conversion_rate,
    ROUND(avg_days_to_convert, 1)                               AS avg_days_to_convert,

    -- Incremental ARR if this channel rate held at scale (C$105/yr, 133K rides/mo)
    ROUND(conversions * 1.0 / NULLIF(users_exposed, 0)
          * 133000 * 105 * 12 / 1000, 0)                       AS projected_annual_arr_k

FROM channel_funnel
ORDER BY conversion_rate DESC;


-- =============================================================================
-- QUERY 4: Sign-up flow step analysis (where in the flow do we lose people?)
-- =============================================================================
-- PM question: Of riders who start sign-up, at which exact step do they abandon?
-- This directly informs the one-tap upgrade flow UX work in Q2.
-- A drop at Step 3 (payment) means friction. A drop at Step 1 means
-- the plan page is not convincing enough.
-- =============================================================================

WITH step_events AS (

    SELECT
        user_id,
        nudge_variant,
        MAX(CASE WHEN event_type = 'signup_started'
                 THEN 1 ELSE 0 END)                             AS reached_step_1,
        MAX(CASE WHEN event_type = 'signup_step_completed'
                      AND JSON_EXTRACT_SCALAR(event_metadata, '$.step') = '2'
                 THEN 1 ELSE 0 END)                             AS reached_step_2,
        MAX(CASE WHEN event_type = 'signup_step_completed'
                      AND JSON_EXTRACT_SCALAR(event_metadata, '$.step') = '3'
                 THEN 1 ELSE 0 END)                             AS reached_step_3,
        MAX(CASE WHEN event_type = 'signup_completed'
                 THEN 1 ELSE 0 END)                             AS completed,
        MAX(CASE WHEN event_type = 'signup_abandoned'
                 THEN JSON_EXTRACT_SCALAR(event_metadata, '$.step')
                 END)                                           AS abandoned_at_step,
        MIN(CASE WHEN event_type = 'signup_started'
                 THEN event_at END)                             AS started_at,
        MIN(CASE WHEN event_type = 'signup_completed'
                 THEN event_at END)                             AS completed_at

    FROM membership_events
    WHERE event_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY user_id, nudge_variant

)

SELECT
    nudge_variant,
    SUM(reached_step_1)                                         AS entered_flow,
    SUM(reached_step_2)                                         AS reached_step_2,
    SUM(reached_step_3)                                         AS reached_step_3,
    SUM(completed)                                              AS completed,

    -- Drop-off at each step
    ROUND((SUM(reached_step_1) - SUM(reached_step_2)) * 1.0
          / NULLIF(SUM(reached_step_1), 0), 3)                  AS drop_step_1,
    ROUND((SUM(reached_step_2) - SUM(reached_step_3)) * 1.0
          / NULLIF(SUM(reached_step_2), 0), 3)                  AS drop_step_2,
    ROUND((SUM(reached_step_3) - SUM(completed))      * 1.0
          / NULLIF(SUM(reached_step_3), 0), 3)                  AS drop_step_3,

    -- Overall completion rate
    ROUND(SUM(completed) * 1.0 / NULLIF(SUM(reached_step_1), 0), 3)
                                                                AS flow_completion_rate,

    -- Median time to complete (minutes)
    ROUND(AVG(CASE WHEN completed = 1
              THEN EXTRACT(EPOCH FROM (completed_at - started_at)) / 60.0
              END), 1)                                          AS median_completion_min,

    -- Most common abandonment step
    MODE() WITHIN GROUP (ORDER BY abandoned_at_step)            AS most_common_abandon_step

FROM step_events
GROUP BY nudge_variant
ORDER BY flow_completion_rate DESC;


-- =============================================================================
-- QUERY 5: Time-to-convert distribution
-- =============================================================================
-- PM question: How long does it take from first ride to membership purchase?
-- Target: reduce median from 34 days to 21 days.
-- Understanding this distribution tells us the optimal nudge timing window.
-- =============================================================================

WITH user_journey AS (

    SELECT
        u.user_id,
        u.persona_segment,
        u.first_ride_at,
        MIN(e.event_at)                                         AS converted_at,
        EXTRACT(DAY FROM MIN(e.event_at) - u.first_ride_at)    AS days_to_convert,
        COUNT(DISTINCT DATE(r.started_at))                      AS active_ride_days_before_convert,
        SUM(r.ride_cost_cad)                                    AS total_spend_before_convert

    FROM users u
    JOIN membership_events e
        ON  u.user_id    = e.user_id
        AND e.event_type = 'signup_completed'
    JOIN rides r
        ON  r.user_id    = u.user_id
        AND r.started_at < MIN(e.event_at) OVER (PARTITION BY u.user_id)
        AND r.user_type  = 'Casual Member'
    WHERE u.first_ride_at >= CURRENT_DATE - INTERVAL '180 days'
    GROUP BY u.user_id, u.persona_segment, u.first_ride_at

)

SELECT
    persona_segment,
    COUNT(*)                                                    AS conversions,
    ROUND(AVG(days_to_convert), 1)                             AS avg_days_to_convert,
    PERCENTILE_CONT(0.25) WITHIN GROUP
        (ORDER BY days_to_convert)                             AS p25_days,
    PERCENTILE_CONT(0.50) WITHIN GROUP
        (ORDER BY days_to_convert)                             AS median_days,
    PERCENTILE_CONT(0.75) WITHIN GROUP
        (ORDER BY days_to_convert)                             AS p75_days,
    PERCENTILE_CONT(0.90) WITHIN GROUP
        (ORDER BY days_to_convert)                             AS p90_days,
    ROUND(AVG(active_ride_days_before_convert), 1)             AS avg_ride_days_before_convert,
    ROUND(AVG(total_spend_before_convert), 2)                  AS avg_spend_before_convert_cad,

    -- At avg spend, how many rides = break-even?
    ROUND(105.0 / NULLIF(AVG(total_spend_before_convert)
          / NULLIF(AVG(active_ride_days_before_convert), 0), 0), 0)
                                                               AS est_breakeven_rides

FROM user_journey
GROUP BY persona_segment
ORDER BY median_days;
