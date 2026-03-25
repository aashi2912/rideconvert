import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from "recharts";

// ── Design tokens ─────────────────────────────────────────
const D = {
  bg: "#08090E",
  s1: "#0F1018",
  s2: "#161720",
  s3: "#1E1F2C",
  s4: "#252637",
  b1: "rgba(255,255,255,0.05)",
  b2: "rgba(255,255,255,0.09)",
  b3: "rgba(255,255,255,0.14)",
  t1: "#EEEEF5",
  t2: "#9090A8",
  t3: "#555568",
  t4: "#333345",
  teal: "#00C9B1",
  amber: "#F59E0B",
  coral: "#F87171",
  purple: "#A78BFA",
  blue: "#60A5FA",
  green: "#34D399",
  gray: "#555568",
};

// ── Operator profiles (real benchmarks) ───────────────────
const OPERATORS = {
  toronto: {
    id: "toronto",
    label: "Bike Share Toronto",
    flag: "🇨🇦",
    city: "Toronto, ON",
    currency: "CAD",
    symbol: "C$",
    annualPrice: 105, // Annual 30
    annualPrice2: 120, // Annual 45
    singleUnlock: 1.0,
    singlePerMin: 0.12, // classic
    dayPass: 15,
    avgCasualRideMin: 29, // Toronto data — rides to 30-min limit
    avgMemberRideMin: 11,
    avgCasualRideCost: 4.48, // $1 + 29*$0.12
    breakEvenRides: 24, // $105 / $4.48 ≈ 23.4 → 24 rides
    bikes: "9,000+",
    stations: "862+",
    annualRides: "6.9M",
    year: "2024",
    casualPct: 23, // ~21-27% per official reports
    ebikePct: 19, // 2025 data
    // Extreme Toronto seasonality: 16× Aug vs Jan
    seasonal: [8, 11, 28, 55, 78, 88, 95, 100, 82, 50, 22, 10],
    highlight: true,
    note: "Home market · 7.8M rides in 2025 · Operating at breakeven",
  },
  divvy: {
    id: "divvy",
    label: "Divvy",
    flag: "🇺🇸",
    city: "Chicago, IL",
    currency: "USD",
    symbol: "$",
    annualPrice: 105,
    singleUnlock: 0,
    singlePerMin: 0,
    dayPass: 15,
    avgCasualRideMin: 22,
    avgMemberRideMin: 12,
    avgCasualRideCost: 3.3,
    breakEvenRides: 32,
    bikes: "5,800+",
    stations: "692+",
    annualRides: "~8M",
    year: "2023",
    casualPct: 30,
    ebikePct: 12,
    seasonal: [15, 18, 35, 62, 80, 90, 95, 100, 85, 58, 30, 18],
    highlight: false,
    note: "Chicago · Motivate / Lyft operated",
  },
  citibike: {
    id: "citibike",
    label: "Citi Bike",
    flag: "🇺🇸",
    city: "New York, NY",
    currency: "USD",
    symbol: "$",
    annualPrice: 179,
    singleUnlock: 0,
    singlePerMin: 0,
    dayPass: 15,
    avgCasualRideMin: 20,
    avgMemberRideMin: 13,
    avgCasualRideCost: 4.5,
    breakEvenRides: 40,
    bikes: "30,000+",
    stations: "1,800+",
    annualRides: "~40M",
    year: "2023",
    casualPct: 25,
    ebikePct: 22,
    seasonal: [22, 25, 40, 65, 82, 90, 95, 100, 88, 65, 38, 25],
    highlight: false,
    note: "NYC · Largest system in North America",
  },
  santander: {
    id: "santander",
    label: "Santander Cycles",
    flag: "🇬🇧",
    city: "London, UK",
    currency: "GBP",
    symbol: "£",
    annualPrice: 120,
    singleUnlock: 0,
    singlePerMin: 0,
    dayPass: 18,
    avgCasualRideMin: 24,
    avgMemberRideMin: 14,
    avgCasualRideCost: 3.2,
    breakEvenRides: 38,
    bikes: "14,000+",
    stations: "800+",
    annualRides: "~12M",
    year: "2023",
    casualPct: 35,
    ebikePct: 8,
    seasonal: [28, 30, 45, 60, 72, 80, 88, 100, 85, 65, 42, 30],
    highlight: false,
    note: "London · TfL operated · Data from 2015",
  },
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Generate monthly data for any operator
function genMonthlyData(op) {
  const base = 50000;
  return MONTHS.map((m, i) => ({
    month: m,
    members: Math.round(
      ((base * op.seasonal[i]) / 100) * (1 - op.casualPct / 100) * 1.1,
    ),
    casual: Math.round(
      ((base * op.seasonal[i]) / 100) * (op.casualPct / 100) * 1.1,
    ),
    conversions: Math.round(((base * op.seasonal[i]) / 100) * 0.028 * 0.8),
  }));
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_MEMBER_BASE = [780, 855, 880, 862, 820, 520, 478];
const DAY_CASUAL_BASE = [380, 362, 405, 420, 545, 920, 905];

const HOUR_DATA = Array.from({ length: 24 }, (_, i) => ({
  h: `${i}h`,
  members:
    i >= 7 && i <= 9
      ? 160 + i * 9
      : i >= 16 && i <= 18
        ? 175 + i * 5
        : 18 + i * 1.1,
  casual: i >= 10 && i <= 16 ? 60 + i * 5 : 12 + i * 0.7,
}));

const FUNNEL_STEPS = [
  { label: "Casual rides / month", pct: 100, color: D.s4 },
  { label: "Exposed to membership CTA", pct: 70, color: D.teal },
  { label: "CTA clicked", pct: 21, color: D.blue },
  { label: "Sign-up flow started", pct: 7, color: D.purple },
  { label: "Converted to member", pct: 2.8, color: D.green },
];

const AB_CURVE = [
  { day: "Day 1", control: 1.2 },
  { day: "Day 4", control: 1.2 },
  { day: "Day 7", control: 1.3 },
  { day: "Day 14", control: 1.2 },
  { day: "Day 21", control: 1.3 },
  { day: "Day 28", control: 1.2 },
];

const RICE = [
  {
    init: "Post-ride savings nudge",
    r: "High",
    i: "High",
    c: "High",
    e: "Low",
    q: "Q1",
    score: 92,
    top: true,
  },
  {
    init: "Flexible membership tier",
    r: "High",
    i: "High",
    c: "Med",
    e: "Med",
    q: "Q1",
    score: 78,
    top: false,
  },
  {
    init: "Break-even calculator",
    r: "Med",
    i: "High",
    c: "High",
    e: "Low",
    q: "Q1",
    score: 74,
    top: false,
  },
  {
    init: "Geo-targeted offer",
    r: "High",
    i: "Med",
    c: "Med",
    e: "Low",
    q: "Q2",
    score: 61,
    top: false,
  },
  {
    init: "One-tap upgrade flow",
    r: "Med",
    i: "High",
    c: "Med",
    e: "Med",
    q: "Q2",
    score: 54,
    top: false,
  },
  {
    init: "Usage-triggered emails",
    r: "Med",
    i: "Med",
    c: "High",
    e: "Low",
    q: "Q3",
    score: 48,
    top: false,
  },
];

// ── UI atoms ──────────────────────────────────────────────
const card = {
  background: D.s1,
  border: `1px solid ${D.b1}`,
  borderRadius: 12,
  padding: "18px 20px",
};

const KPI = ({ label, value, sub, accent = D.teal }) => (
  <div
    style={{
      background: D.s1,
      border: `1px solid ${D.b1}`,
      borderRadius: 12,
      padding: "16px 18px",
      flex: 1,
      minWidth: 120,
      position: "relative",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        background: `linear-gradient(90deg,${accent}50,transparent)`,
      }}
    />
    <p
      style={{
        margin: "0 0 10px",
        fontSize: 10,
        color: D.t3,
        letterSpacing: "0.5px",
        textTransform: "uppercase",
        fontWeight: 500,
      }}
    >
      {label}
    </p>
    <p
      style={{
        margin: "0 0 3px",
        fontSize: 24,
        fontWeight: 600,
        color: accent,
        letterSpacing: "-0.5px",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </p>
    <p style={{ margin: 0, fontSize: 10, color: D.t4 }}>{sub}</p>
  </div>
);

const Tag = ({ children, color = D.teal }) => (
  <span
    style={{
      fontSize: 10,
      fontWeight: 500,
      padding: "2px 8px",
      borderRadius: 20,
      background: `${color}18`,
      color,
      border: `0.5px solid ${color}28`,
      letterSpacing: "0.2px",
    }}
  >
    {children}
  </span>
);

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: D.s3,
        border: `1px solid ${D.b2}`,
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 12,
      }}
    >
      <p style={{ margin: "0 0 6px", fontWeight: 500, color: D.t1 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ margin: "2px 0", color: p.color || p.stroke }}>
          {p.name}:{" "}
          {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

const Leg = ({ items }) => (
  <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
    {items.map(([l, c]) => (
      <span
        key={l}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontSize: 10,
          color: D.t3,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: c,
            flexShrink: 0,
          }}
        />
        {l}
      </span>
    ))}
  </div>
);

const chartOpts = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: {
      ticks: { color: D.t3, font: { size: 10 } },
      grid: { color: "rgba(255,255,255,0.04)", drawBorder: false },
    },
    y: {
      ticks: { color: D.t3, font: { size: 10 } },
      grid: { color: "rgba(255,255,255,0.04)", drawBorder: false },
    },
  },
};

const pill = (txt, c, bg) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      fontSize: 10,
      fontWeight: 500,
      padding: "2px 8px",
      borderRadius: 12,
      background: bg || `${c}18`,
      color: c,
      border: `0.5px solid ${c}25`,
    }}
  >
    {txt}
  </span>
);
const vcol = (v) =>
  v === "High" || v === "Low" ? D.green : v === "Med" ? D.amber : D.gray;

// ── Views ─────────────────────────────────────────────────
function Overview({ op }) {
  const monthly = useMemo(() => genMonthlyData(op), [op]);
  const totalCasual = monthly.reduce((a, b) => a + b.casual, 0);
  const oppARR = Math.round(totalCasual * 0.05 * op.annualPrice);
  const currentARR = Math.round(totalCasual * 0.028 * op.annualPrice);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {op.highlight && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            background: `${D.teal}0A`,
            border: `1px solid ${D.teal}20`,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: D.teal,
              letterSpacing: "0.4px",
              textTransform: "uppercase",
            }}
          >
            Home market
          </span>
          <span style={{ fontSize: 11, color: D.t2 }}>{op.note}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <Tag color={D.teal}>
              Annual 30: {op.symbol}
              {op.annualPrice}
            </Tag>
            {op.annualPrice2 && (
              <Tag color={D.purple}>
                Annual 45: {op.symbol}
                {op.annualPrice2}
              </Tag>
            )}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <KPI
          label="Conversion rate"
          value="2.8%"
          sub="Target: 5.0% by Q3"
          accent={D.teal}
        />
        <KPI
          label="Annual rides"
          value={op.annualRides}
          sub={`${op.year} · ${op.bikes} bikes`}
          accent={D.blue}
        />
        <KPI
          label="ARR opportunity (5%)"
          value={`${op.symbol}${(oppARR / 1000).toFixed(0)}K`}
          sub="vs current baseline"
          accent={D.green}
        />
        <KPI
          label="E-bike share"
          value={`${op.ebikePct}%`}
          sub="of all trips — growing"
          accent={D.amber}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ ...card }}>
          <p
            style={{
              margin: "0 0 2px",
              fontSize: 12,
              fontWeight: 500,
              color: D.t1,
            }}
          >
            Monthly ride volume
          </p>
          <p style={{ margin: "0 0 14px", fontSize: 11, color: D.t3 }}>
            {op.id === "toronto"
              ? "Extreme Toronto seasonality — 16× Aug vs Jan"
              : "Seasonal pattern — members stable, casuals volatile"}
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={monthly}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: D.t3 }}
                interval={1}
              />
              <YAxis tick={{ fontSize: 10, fill: D.t3 }} />
              <Tooltip content={<Tip />} />
              <Area
                type="monotone"
                dataKey="members"
                stroke={D.teal}
                fill={`${D.teal}18`}
                strokeWidth={2}
                pointRadius={0}
                name="Members"
              />
              <Area
                type="monotone"
                dataKey="casual"
                stroke={D.amber}
                fill={`${D.amber}12`}
                strokeWidth={2}
                pointRadius={0}
                name="Casual"
              />
            </AreaChart>
          </ResponsiveContainer>
          <Leg
            items={[
              ["Annual members", D.teal],
              ["Casual riders", D.amber],
            ]}
          />
        </div>

        <div style={{ ...card }}>
          <p
            style={{
              margin: "0 0 2px",
              fontSize: 12,
              fontWeight: 500,
              color: D.t1,
            }}
          >
            Rides by day of week
          </p>
          <p style={{ margin: "0 0 14px", fontSize: 11, color: D.t3 }}>
            Members peak Tue–Thu · Casuals dominate weekends
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={DAY_LABELS.map((d, i) => ({
                day: d,
                members: DAY_MEMBER_BASE[i],
                casual: DAY_CASUAL_BASE[i],
              }))}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: D.t3 }} />
              <YAxis tick={{ fontSize: 10, fill: D.t3 }} />
              <Tooltip content={<Tip />} />
              <Bar
                dataKey="members"
                fill={`${D.teal}CC`}
                radius={[3, 3, 0, 0]}
                name="Members"
              />
              <Bar
                dataKey="casual"
                fill={`${D.amber}CC`}
                radius={[3, 3, 0, 0]}
                name="Casual"
              />
            </BarChart>
          </ResponsiveContainer>
          <Leg
            items={[
              ["Members", D.teal],
              ["Casual riders", D.amber],
            ]}
          />
        </div>
      </div>

      <div style={{ ...card }}>
        <p
          style={{
            margin: "0 0 2px",
            fontSize: 12,
            fontWeight: 500,
            color: D.t1,
          }}
        >
          Hourly ride distribution
        </p>
        <p style={{ margin: "0 0 14px", fontSize: 11, color: D.t3 }}>
          Twin commuter spikes at 8am & 5pm (members) vs. gradual 2–4pm peak
          (casual) — strongest behavioral signal for conversion timing
        </p>
        <ResponsiveContainer width="100%" height={130}>
          <AreaChart data={HOUR_DATA}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
            />
            <XAxis
              dataKey="h"
              tick={{ fontSize: 9, fill: D.t3 }}
              interval={2}
            />
            <YAxis tick={{ fontSize: 10, fill: D.t3 }} />
            <Tooltip content={<Tip />} />
            <ReferenceLine
              x="8h"
              stroke={D.teal}
              strokeDasharray="4 3"
              strokeWidth={0.8}
              label={{ value: "8am", position: "top", fill: D.t3, fontSize: 9 }}
            />
            <ReferenceLine
              x="17h"
              stroke={D.teal}
              strokeDasharray="4 3"
              strokeWidth={0.8}
              label={{ value: "5pm", position: "top", fill: D.t3, fontSize: 9 }}
            />
            <Area
              type="monotone"
              dataKey="members"
              stroke={D.teal}
              fill={`${D.teal}18`}
              strokeWidth={2}
              name="Members"
            />
            <Area
              type="monotone"
              dataKey="casual"
              stroke={D.amber}
              fill={`${D.amber}12`}
              strokeWidth={2}
              name="Casual"
            />
          </AreaChart>
        </ResponsiveContainer>
        <Leg
          items={[
            ["Members", D.teal],
            ["Casual riders", D.amber],
          ]}
        />
      </div>
    </div>
  );
}

function Segments({ op }) {
  const personas = [
    {
      name: "Weekend Explorer",
      color: D.teal,
      pct: 42,
      rides: "~26 min avg",
      behavior: "Leisure · 2–4× /month · weekends · waterfronts & parks",
      pain: "Single passes expensive for spontaneous rides",
      trigger: `Weekend membership tier · ${op.symbol}${Math.round(op.annualPrice * 0.6)}/yr`,
    },
    {
      name: "Reluctant Commuter",
      color: D.purple,
      pct: 31,
      rides: "~12 min avg",
      behavior: "Rush-hour weekdays · ~2× /week · near transit hubs",
      pain: `Unsure they ride enough to justify ${op.symbol}${op.annualPrice}/yr`,
      trigger: `Break-even: ${op.breakEvenRides} rides · ${op.symbol}${op.avgCasualRideCost}/ride avg`,
    },
    {
      name: "Seasonal Visitor",
      color: D.amber,
      pct: 18,
      rides: "~31 min avg",
      behavior: `Tourist clusters · summer only${op.id === "toronto" ? " · CNE, lakefront" : ""}`,
      pain: "Annual pass is wrong product for short visits",
      trigger: "Short-term visitor tier (future phase)",
    },
    {
      name: "E-bike Adopter",
      color: D.blue,
      pct: 9,
      rides: "~18 min avg",
      behavior: `${op.ebikePct}% of all trips · growing · faster & further`,
      pain: `E-bike trips cost more (${op.symbol}0.20/min casual)`,
      trigger: "Member e-bike rate 50% off — high conversion lever",
    },
  ];
  const pie = personas.map((p) => ({
    name: p.name,
    value: p.pct,
    color: p.color,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {op.highlight && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            background: `${D.blue}0A`,
            border: `1px solid ${D.blue}20`,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: D.blue,
              letterSpacing: "0.4px",
              textTransform: "uppercase",
              marginRight: 8,
            }}
          >
            Toronto insight
          </span>
          <span style={{ fontSize: 11, color: D.t2 }}>
            Casual riders average {op.avgCasualRideMin} min — riding right to
            the 30-min free limit. Break-even: {op.breakEvenRides} rides at{" "}
            {op.symbol}
            {op.avgCasualRideCost}/ride avg. Monthly membership gap vs BIXI
            Montréal ($20/mo) — unmet need confirmed.
          </span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ ...card }}>
          <p
            style={{
              margin: "0 0 2px",
              fontSize: 12,
              fontWeight: 500,
              color: D.t1,
            }}
          >
            Rider segment breakdown
          </p>
          <p style={{ margin: "0 0 14px", fontSize: 11, color: D.t3 }}>
            Four conversion archetypes — each needs a different product response
          </p>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie
                data={pie}
                dataKey="value"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={50}
              >
                {pie.map((s, i) => (
                  <Cell key={i} fill={s.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `${v}%`} />
            </PieChart>
          </ResponsiveContainer>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginTop: 10,
            }}
          >
            {personas.map((p) => (
              <div
                key={p.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11,
                  padding: "4px 0",
                  borderBottom: `1px solid ${D.b1}`,
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color: D.t2,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: p.color,
                    }}
                  />
                  {p.name}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: D.t3 }}>{p.rides}</span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: p.color,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {p.pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {personas.map((p) => (
            <div
              key={p.name}
              style={{
                ...card,
                borderLeft: `2px solid ${p.color}`,
                paddingLeft: 14,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 5,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: p.color }}>
                  {p.name}
                </span>
                <Tag color={p.color}>{p.rides}</Tag>
              </div>
              <p
                style={{
                  margin: "0 0 3px",
                  fontSize: 11,
                  color: D.t3,
                  lineHeight: 1.5,
                }}
              >
                {p.behavior}
              </p>
              <p style={{ margin: "0 0 2px", fontSize: 10, color: D.coral }}>
                Pain: {p.pain}
              </p>
              <p style={{ margin: 0, fontSize: 10, color: D.green }}>
                Lever: {p.trigger}
              </p>
            </div>
          ))}
        </div>
      </div>

      {op.highlight && (
        <div style={{ ...card }}>
          <p
            style={{
              margin: "0 0 2px",
              fontSize: 12,
              fontWeight: 500,
              color: D.t1,
            }}
          >
            E-bike vs Classic bike — conversion opportunity
          </p>
          <p style={{ margin: "0 0 14px", fontSize: 11, color: D.t3 }}>
            Toronto has 1,600 e-bikes ({op.ebikePct}% of trips). Casual e-bike
            cost = $0.20/min. Member rate = $0.10/min (50% off). Strong price
            lever.
          </p>
          {[
            ["Casual e-bike (30 min ride)", 0.2 * 30, D.coral],
            ["Member e-bike (30 min ride)", 0.1 * 30, D.green],
            ["Annual 30 break-even (e-bike)", 105 / (0.2 * 18), D.teal],
          ].map(([l, v, c]) => (
            <div
              key={l}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <span
                style={{ fontSize: 11, color: D.t3, width: 250, flexShrink: 0 }}
              >
                {l}
              </span>
              <div
                style={{
                  flex: 1,
                  background: D.s3,
                  borderRadius: 4,
                  height: 22,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min((v / 8) * 100, 100)}%`,
                    height: "100%",
                    background: c,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    padding: "0 8px",
                    transition: "width .5s",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#08090E",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    C${v.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Funnel({ op }) {
  const monthlyRides = 125000;
  const opps = [
    {
      label: `Current (2.8%)`,
      members: Math.round(monthlyRides * 0.028),
      color: D.gray,
    },
    {
      label: `Post-nudge (4.2%)`,
      members: Math.round(monthlyRides * 0.042),
      color: D.teal,
    },
    {
      label: `Q3 target (5.0%)`,
      members: Math.round(monthlyRides * 0.05),
      color: D.green,
    },
    {
      label: `Stretch (7.5%)`,
      members: Math.round(monthlyRides * 0.075),
      color: D.purple,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <KPI
          label="Current conversion"
          value="2.8%"
          sub="Casual → member"
          accent={D.coral}
        />
        <KPI
          label="Break-even rides"
          value={`${op.breakEvenRides}`}
          sub={`At avg ${op.symbol}${op.avgCasualRideCost}/ride`}
          accent={D.teal}
        />
        <KPI
          label="ARR at 5% target"
          value={`${op.symbol}${Math.round((monthlyRides * 0.05 * op.annualPrice * 12) / 1000)}K`}
          sub={`+${op.symbol}${Math.round((monthlyRides * (0.05 - 0.028) * op.annualPrice * 12) / 1000)}K incremental`}
          accent={D.green}
        />
        <KPI
          label="Biggest drop-off"
          value="CTA → Click"
          sub="70% exposed → 21% click"
          accent={D.amber}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ ...card }}>
          <p
            style={{
              margin: "0 0 2px",
              fontSize: 12,
              fontWeight: 500,
              color: D.t1,
            }}
          >
            Conversion funnel
          </p>
          <p style={{ margin: "0 0 16px", fontSize: 11, color: D.t3 }}>
            Largest opportunity: closing the CTA awareness-to-click gap
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              alignItems: "center",
            }}
          >
            {FUNNEL_STEPS.map((s, i) => (
              <div
                key={s.label}
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <div
                  style={{
                    width: `${Math.max(s.pct + 5, 14)}%`,
                    minWidth: 60,
                    height: 34,
                    background: s.color,
                    border: i === 0 ? `1px solid ${D.b2}` : "none",
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all .3s",
                  }}
                >
                  <span
                    style={{
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {s.pct}%
                  </span>
                </div>
                <span style={{ fontSize: 10, color: D.t3 }}>{s.label}</span>
                {i < FUNNEL_STEPS.length - 1 && (
                  <span style={{ fontSize: 10, color: D.coral }}>
                    −{Math.round(100 - (FUNNEL_STEPS[i + 1].pct / s.pct) * 100)}
                    % drop-off
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...card }}>
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 12,
                fontWeight: 500,
                color: D.t1,
              }}
            >
              Opportunity sizing
            </p>
            {opps.map((o) => (
              <div
                key={o.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 10px",
                  background: D.s2,
                  border: `1px solid ${D.b1}`,
                  borderRadius: 8,
                  marginBottom: 6,
                  fontSize: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 500, color: D.t1 }}>{o.label}</div>
                  <div
                    style={{
                      fontSize: 10,
                      color: D.t3,
                      marginTop: 1,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {o.members.toLocaleString()} members/mo
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: o.color,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {op.symbol}
                  {Math.round((o.members * op.annualPrice * 12) / 1000)}K ARR
                </span>
              </div>
            ))}
          </div>

          <div style={{ ...card }}>
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 12,
                fontWeight: 500,
                color: D.t1,
              }}
            >
              Root cause map
            </p>
            {[
              [
                "Price barrier",
                `${op.symbol}${op.annualPrice}/yr feels high vs. ride frequency`,
                D.coral,
              ],
              [
                "Value mismatch",
                "Product built for commuters, not leisure riders",
                D.amber,
              ],
              [
                "No trigger moment",
                "No post-ride moment that creates membership urgency",
                D.purple,
              ],
              [
                "UX friction",
                "Sign-up requires 6+ steps — intent lost in the flow",
                D.blue,
              ],
            ].map(([c, f, col]) => (
              <div
                key={c}
                style={{
                  display: "flex",
                  gap: 10,
                  marginBottom: 8,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 3,
                    height: 28,
                    background: col,
                    borderRadius: 2,
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: D.t1 }}>
                    {c}
                  </div>
                  <div style={{ fontSize: 10, color: D.t3, marginTop: 1 }}>
                    {f}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ABTest({ op }) {
  const [lift, setLift] = useState(30);
  const [sample, setSample] = useState(5000);
  const [dur, setDur] = useState(28);

  const base = 2.8;
  const treated = +(base * (1 + lift / 100)).toFixed(2);
  const delta = Math.round(((treated - base) / 100) * sample);
  const arr = Math.round(delta * 12 * op.annualPrice);
  const sig = sample >= 3000 && dur >= 14;
  const abData = AB_CURVE.map((d, i) => ({
    ...d,
    treatment: +(d.control * (1 + (lift / 100) * (0.55 + i * 0.09))).toFixed(2),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...card }}>
        <p
          style={{
            margin: "0 0 2px",
            fontSize: 12,
            fontWeight: 500,
            color: D.t1,
          }}
        >
          A/B test simulator — post-ride savings nudge
        </p>
        <p style={{ margin: "0 0 18px", fontSize: 11, color: D.t3 }}>
          {op.highlight
            ? `Toronto pricing context: avg casual ride = ${op.symbol}${op.avgCasualRideCost} · break-even = ${op.breakEvenRides} rides · nudge message: "You're ${op.breakEvenRides} rides from annual membership paying off"`
            : "Model your experiment before shipping. Drag sliders to see projected impact."}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 18,
            marginBottom: 18,
          }}
        >
          {[
            {
              label: "Expected lift",
              id: "lift",
              min: 5,
              max: 80,
              step: 5,
              val: lift,
              set: setLift,
              fmt: (v) => `${v}%`,
            },
            {
              label: "Sample / arm",
              id: "sample",
              min: 500,
              max: 20000,
              step: 500,
              val: sample,
              set: setSample,
              fmt: (v) => (+v).toLocaleString(),
            },
            {
              label: "Test duration",
              id: "dur",
              min: 7,
              max: 56,
              step: 7,
              val: dur,
              set: setDur,
              fmt: (v) => `${v} days`,
            },
          ].map((s) => (
            <div key={s.id}>
              <div
                style={{
                  fontSize: 10,
                  color: D.t3,
                  marginBottom: 8,
                  letterSpacing: "0.4px",
                  textTransform: "uppercase",
                }}
              >
                {s.label} ·{" "}
                <span style={{ color: D.teal, fontWeight: 600 }}>
                  {s.fmt(s.val)}
                </span>
              </div>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={s.val}
                onChange={(e) => s.set(+e.target.value)}
                style={{ width: "100%", accentColor: D.teal }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 9,
                  color: D.t4,
                  marginTop: 4,
                }}
              >
                <span>{s.fmt(s.min)}</span>
                <span>{s.fmt(s.max)}</span>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <KPI
            label="Control rate"
            value={`${base}%`}
            sub="Baseline — no nudge"
            accent={D.gray}
          />
          <KPI
            label="Treatment rate"
            value={`${treated}%`}
            sub={`+${lift}% projected lift`}
            accent={D.teal}
          />
          <KPI
            label="Additional members"
            value={`+${delta.toLocaleString()}`}
            sub="Per test period"
            accent={D.green}
          />
          <KPI
            label="Projected ARR"
            value={`${op.symbol}${Math.round(arr / 1000)}K`}
            sub={`${op.currency} · if lift holds at scale`}
            accent={D.purple}
          />
        </div>

        <div
          style={{
            padding: "12px 14px",
            borderRadius: 8,
            border: `1px solid ${sig ? D.green + "40" : D.coral + "40"}`,
            background: sig ? `${D.green}08` : `${D.coral}08`,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: sig ? D.green : D.coral,
              marginBottom: 3,
            }}
          >
            {sig
              ? "Statistical significance achievable"
              : "Underpowered — increase sample or duration"}
          </div>
          <div style={{ fontSize: 11, color: D.t3 }}>
            {sig
              ? `At ${sample.toLocaleString()} per arm over ${dur} days, you can detect a ${lift}% lift at 95% confidence.`
              : "Need at least 3,000 per arm and 14 days to detect this effect size reliably."}
          </div>
        </div>

        <p
          style={{
            margin: "0 0 8px",
            fontSize: 12,
            fontWeight: 500,
            color: D.t1,
          }}
        >
          Conversion rate over test window
        </p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={abData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
            />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: D.t3 }} />
            <YAxis
              unit="%"
              domain={[0, "auto"]}
              tick={{ fontSize: 10, fill: D.t3 }}
            />
            <Tooltip content={<Tip />} formatter={(v) => `${v}%`} />
            <Line
              type="monotone"
              dataKey="control"
              stroke={D.gray}
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
              name="Control"
            />
            <Line
              type="monotone"
              dataKey="treatment"
              stroke={D.teal}
              strokeWidth={2.5}
              dot={{ r: 3, fill: D.teal, strokeWidth: 2, stroke: "#08090E" }}
              name="Treatment"
            />
          </LineChart>
        </ResponsiveContainer>
        <Leg
          items={[
            ["Control (no nudge)", D.gray],
            ["Treatment (nudge active)", D.teal],
          ]}
        />
      </div>

      <div style={{ ...card }}>
        <p
          style={{
            margin: "0 0 14px",
            fontSize: 12,
            fontWeight: 500,
            color: D.t1,
          }}
        >
          RICE prioritization — all 6 initiatives
        </p>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}
          >
            <thead>
              <tr style={{ borderBottom: `1px solid ${D.b2}` }}>
                {[
                  "Initiative",
                  "Reach",
                  "Impact",
                  "Conf.",
                  "Effort",
                  "Quarter",
                  "Score",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "6px 10px",
                      textAlign: "left",
                      fontWeight: 500,
                      fontSize: 10,
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                      color: D.t3,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RICE.map((r, i) => {
                const qc =
                  r.q === "Q1" ? D.green : r.q === "Q2" ? D.amber : D.gray;
                return (
                  <tr
                    key={i}
                    style={{
                      borderBottom: `1px solid ${D.b1}`,
                      background: i % 2 === 0 ? "transparent" : D.s2 + "80",
                    }}
                  >
                    <td
                      style={{
                        padding: "8px 10px",
                        fontWeight: r.top ? 600 : 400,
                        color: r.top ? D.t1 : D.t2,
                      }}
                    >
                      {r.init}
                    </td>
                    {[r.r, r.i, r.c, r.e].map((v, j) => (
                      <td key={j} style={{ padding: "8px 10px" }}>
                        {pill(v, vcol(v))}
                      </td>
                    ))}
                    <td style={{ padding: "8px 10px" }}>{pill(r.q, qc)}</td>
                    <td
                      style={{
                        padding: "8px 10px",
                        fontWeight: r.top ? 600 : 400,
                        color: r.top ? D.teal : D.t2,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {r.score}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Roadmap({ op }) {
  const quarters = [
    {
      q: "Q1",
      theme: "Quick wins",
      color: D.teal,
      items: [
        "Post-ride savings nudge",
        "Break-even calculator",
        "User interviews (n=20)",
        "Funnel instrumentation",
      ],
    },
    {
      q: "Q2",
      theme: "Personalize",
      color: D.purple,
      items: [
        "Usage-triggered emails",
        "Geo-targeted offers",
        "CTA A/B test",
        "Q1 impact review",
      ],
    },
    {
      q: "Q3",
      theme: "New tier",
      color: D.amber,
      items: [
        `${op.id === "toronto" ? "Annual 45 upsell flow" : "Weekend membership SKU"}`,
        `One-tap upgrade flow`,
        "Corporate/employer deals",
        "Full funnel analysis",
      ],
    },
  ];
  const growth = [
    { phase: "Baseline", rate: 2.8 },
    { phase: "Post nudge", rate: 3.6 },
    { phase: "+ Calculator", rate: 4.0 },
    { phase: "+ Emails", rate: 4.3 },
    { phase: "+ Geo", rate: 4.6 },
    { phase: "+ New tier", rate: 5.2 },
    { phase: "+ 1-tap", rate: 5.8 },
  ];
  const ns = [
    {
      label: "Acquisition",
      color: D.blue,
      metrics: ["% casuals exposed to CTA", "CTA click-through rate"],
    },
    {
      label: "Activation",
      color: D.purple,
      metrics: ["Sign-up flow started", "Drop-off per step"],
    },
    {
      label: "Conversion",
      color: D.teal,
      metrics: ["Casual → member rate", "Rate by persona"],
    },
    {
      label: "Retention",
      color: D.green,
      metrics: ["Year-2 renewal rate", "Ride freq post-convert"],
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <KPI
          label="Total initiatives"
          value="12"
          sub="Across 3 quarters"
          accent={D.teal}
        />
        <KPI
          label="Q1 effort"
          value="Low"
          sub="All quick wins"
          accent={D.green}
        />
        <KPI
          label="North Star target"
          value="5.0%"
          sub="Conversion rate by Q3"
          accent={D.purple}
        />
        <KPI
          label={op.id === "toronto" ? "Annual 30 price" : "Annual price"}
          value={`${op.symbol}${op.annualPrice}`}
          sub={`${op.currency} · break-even: ${op.breakEvenRides} rides`}
          accent={D.amber}
        />
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}
      >
        {quarters.map((q) => (
          <div
            key={q.q}
            style={{
              ...card,
              borderTop: `3px solid ${q.color}`,
              paddingTop: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: q.color,
                  letterSpacing: "-1px",
                }}
              >
                {q.q}
              </span>
              <Tag color={q.color}>{q.theme}</Tag>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {q.items.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: D.s2,
                    border: `1px solid ${D.b1}`,
                    fontSize: 11,
                    color: D.t2,
                  }}
                >
                  <div
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: q.color,
                      flexShrink: 0,
                      marginTop: 4,
                    }}
                  />
                  {item}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...card }}>
        <p
          style={{
            margin: "0 0 2px",
            fontSize: 12,
            fontWeight: 500,
            color: D.t1,
          }}
        >
          Projected conversion growth
        </p>
        <p style={{ margin: "0 0 14px", fontSize: 11, color: D.t3 }}>
          Each phase compounds — quick wins build the evidence base for
          structural bets
        </p>
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={growth}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
            />
            <XAxis dataKey="phase" tick={{ fontSize: 9, fill: D.t3 }} />
            <YAxis
              unit="%"
              domain={[0, 7]}
              tick={{ fontSize: 10, fill: D.t3 }}
            />
            <Tooltip formatter={(v) => `${v}%`} />
            <ReferenceLine
              y={5.0}
              stroke={D.teal}
              strokeDasharray="4 3"
              strokeWidth={0.8}
              label={{
                value: "5% target",
                fill: D.teal,
                fontSize: 9,
                position: "right",
              }}
            />
            <Area
              type="monotone"
              dataKey="rate"
              stroke={D.teal}
              fill={`${D.teal}20`}
              strokeWidth={2.5}
              dot={{ r: 4, fill: D.teal, strokeWidth: 2, stroke: "#08090E" }}
              name="Conversion rate"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ ...card }}>
        <p
          style={{
            margin: "0 0 14px",
            fontSize: 12,
            fontWeight: 500,
            color: D.t1,
          }}
        >
          North Star metric tree
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,minmax(0,1fr))",
            gap: 10,
            marginBottom: 12,
          }}
        >
          {ns.map((b) => (
            <div
              key={b.label}
              style={{
                borderRadius: 10,
                overflow: "hidden",
                border: `1px solid ${b.color}30`,
              }}
            >
              <div
                style={{
                  padding: "8px 10px",
                  background: `${b.color}18`,
                  borderBottom: `1px solid ${b.color}25`,
                  fontSize: 11,
                  fontWeight: 600,
                  color: b.color,
                }}
              >
                {b.label}
              </div>
              <div
                style={{
                  padding: "10px 12px",
                  background: D.s2,
                  fontSize: 10,
                  color: D.t3,
                  lineHeight: 1.8,
                }}
              >
                {b.metrics.map((m) => (
                  <p key={m} style={{ margin: "0 0 2px" }}>
                    • {m}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 8,
            background: `${D.teal}0A`,
            border: `1px solid ${D.teal}20`,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: D.teal }}>
            North Star →{" "}
          </span>
          <span style={{ fontSize: 12, color: D.t2 }}>
            Casual-to-member conversion rate within 90 days of first ride
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Operator selector ─────────────────────────────────────
function OpSelector({ current, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {Object.values(OPERATORS).map((op) => (
        <button
          key={op.id}
          onClick={() => onChange(op.id)}
          style={{
            padding: "5px 12px",
            fontSize: 11,
            fontWeight: 500,
            borderRadius: 8,
            cursor: "pointer",
            transition: "all .15s",
            background: current === op.id ? D.s3 : "transparent",
            border: `1px solid ${current === op.id ? D.b3 : D.b1}`,
            color: current === op.id ? D.t1 : D.t3,
            outline: "none",
          }}
        >
          {op.flag} {op.label}
          {op.highlight && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 9,
                color: D.teal,
                fontWeight: 600,
              }}
            >
              HOME
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "segments", label: "Rider segments" },
  { id: "funnel", label: "Conversion funnel" },
  { id: "abtest", label: "A/B testing" },
  { id: "roadmap", label: "Roadmap" },
];

export default function RideConvert() {
  if (typeof document !== "undefined") {
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.background = D.bg;
    document.body.style.minHeight = "100vh";
  }
  const [tab, setTab] = useState("overview");
  const [opId, setOpId] = useState("toronto");
  const op = OPERATORS[opId];

  const views = {
    overview: <Overview op={op} />,
    segments: <Segments op={op} />,
    funnel: <Funnel op={op} />,
    abtest: <ABTest op={op} />,
    roadmap: <Roadmap op={op} />,
  };

  return (
    <div
      style={{
        fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
        width: "100%",
        padding: "20px 28px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          paddingBottom: 18,
          borderBottom: `1px solid ${D.b1}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: D.teal,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#08090E"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="5.5" cy="17" r="2.5" />
              <circle cx="18.5" cy="17" r="2.5" />
              <path d="M5.5 17H3v-4l5-5 5 5M14 17V8l2.5 2.5L19 8" />
            </svg>
          </div>
          <div>
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: D.t1,
                letterSpacing: "-0.3px",
              }}
            >
              RideConvert
            </span>
            <span style={{ fontSize: 12, color: D.t3, marginLeft: 6 }}>
              / Urban Mobility Analytics
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Tag color={D.teal}>4 operators</Tag>
          <Tag color={D.green}>Real benchmarks</Tag>
        </div>
      </div>

      {/* Operator selector */}
      <div style={{ marginBottom: 16 }}>
        <p
          style={{
            margin: "0 0 8px",
            fontSize: 10,
            color: D.t3,
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          Operator context
        </p>
        <OpSelector current={opId} onChange={setOpId} />
      </div>

      {/* Nav */}
      <div
        style={{
          display: "flex",
          gap: 1,
          marginBottom: 22,
          background: D.s1,
          border: `1px solid ${D.b1}`,
          borderRadius: 10,
          padding: 3,
          width: "fit-content",
          overflowX: "auto",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 500,
              border: "none",
              borderRadius: 7,
              cursor: "pointer",
              transition: "all .15s",
              whiteSpace: "nowrap",
              outline: "none",
              background: tab === t.id ? D.s3 : "transparent",
              color: tab === t.id ? D.t1 : D.t3,
              boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,0.4)" : "none",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* View */}
      {views[tab]}

      {/* Footer */}
      <div
        style={{
          marginTop: 24,
          padding: "12px 0",
          borderTop: `1px solid ${D.b1}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 10, color: D.t4 }}>
          Operator-agnostic · Benchmarks from Divvy, Citi Bike, Santander Cycles
          & Bike Share Toronto · Simulated data preserving real distributions
        </span>
      </div>
    </div>
  );
}
