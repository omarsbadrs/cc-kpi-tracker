"use client"

import "@/styles/views/dashboard.css"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { usePeriods } from "@/hooks/usePeriods"
import { useState, useEffect, type ReactNode } from "react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
  LineChart, Line, CartesianGrid, ComposedChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, PieChart, Pie,
} from "recharts"
import {
  AlertTriangle, CheckCircle2, ChevronRight, ClipboardList, Hourglass, SlidersHorizontal, UserX, XCircle,
  type LucideIcon,
} from "lucide-react"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { EmptyState } from "@/components/shared/EmptyState"
import { PageHead } from "@/components/ui/PageHead"
import { StatGrid, StatTile } from "@/components/ui/StatGrid"
import { Field, SelectWrap } from "@/components/ui/Field"
import { BandChip, StatusChip, TagPill } from "@/components/ui/StatusChip"
import { Meter, PillarTag } from "@/components/ui/KpiMarks"
import { ScoreGauge, bandFor } from "@/components/dashboard/ScoreGauge"
import {
  ACTUAL_STATUS, APPRAISAL_BANDS, PILLAR_CODES, PILLAR_SHORT, PILLARS, SCORE_COLORS, STRONG_THRESHOLD,
  TIER_SHORT, TONE_COLORS,
} from "@/lib/constants"
import type { AppraisalBand } from "@prisma/client"

// ─── data shapes from /api/admin/insights ────────────────────────────────────

interface TierCount { tier: string; count: number }
interface BandCount { band: string; count: number }
interface StatusCount { status: string; count: number }
interface PillarAverage { pillarCode: string; avgPercent: number }
interface PillarApproval { pillarCode: string; name: string; approvalRate: number; approved: number; total: number }
interface Performer { userId: string; name: string; tier: string; overallScore: number; appraisalBand: string | null }
interface ScoreCount { score: number; count: number }
interface TrendPoint { periodName: string; avgScore: number }
interface Period { id: string; name: string; isActive: boolean; isClosed: boolean }

// Lowest to highest, so the band bar reads left to right like the scale.
const BAND_ORDER: AppraisalBand[] = ["UNSATISFACTORY", "NEEDS_IMPROVEMENT", "MEETS", "STRONG", "EXCEEDS"]

const TIER_ORDER = ["SECTION_HEAD", "TEAM_LEAD", "SENIOR", "ENGINEER", "JUNIOR"]

const TICK = { fill: "var(--ink-3)", fontSize: 12 }
const VALUE_LABEL = { fill: "var(--ink-2)", fontSize: 12, fontWeight: 600 }

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0
}

// ─── small pieces ────────────────────────────────────────────────────────────

interface TipRow { name: string; value: string; color?: string }

/** A recharts `content` renderer that draws the system's .chart-tooltip. */
function tooltip<T>(describe: (d: T) => { title: string; rows: TipRow[] }) {
  return function ChartTip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }) {
    const datum = payload?.[0]?.payload as T | undefined
    if (!active || !datum) return null
    const { title, rows } = describe(datum)
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-label">{title}</div>
        {rows.map((r) => (
          <div key={r.name} className="chart-tooltip-row">
            {r.color && <span className="rep-swatch" style={{ background: r.color }} />}
            <span>{r.name}</span>
            <b>{r.value}</b>
          </div>
        ))}
      </div>
    )
  }
}

function CardHead({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="card-head">
      <h2 className="card-title">{title}</h2>
      {aside}
    </div>
  )
}

function AttentionRow({
  href, icon: Icon, tone, title, sub,
}: {
  href: string
  icon: LucideIcon
  tone: "bad" | "warn" | "info"
  title: string
  sub: string
}) {
  return (
    <Link href={href} className="attn-row">
      <span className={`attn-ic tone-${tone}`} aria-hidden="true">
        <Icon size={17} strokeWidth={1.6} />
      </span>
      <span className="attn-main">
        <span className="attn-title">{title}</span>
        <span className="attn-sub">{sub}</span>
      </span>
      <ChevronRight size={17} aria-hidden="true" className="muted" />
    </Link>
  )
}

function PerformerRows({ people, startRank, descending }: { people: Performer[]; startRank: number; descending: boolean }) {
  return (
    <div className="doc-list">
      {people.map((p, i) => (
        <Link key={p.userId} href={`/manager/members/${p.userId}`} className="doc-row">
          <span className="doc-row-ic rank-ic tabular" aria-label={`Rank ${descending ? startRank + i : startRank - i}`}>
            {descending ? startRank + i : startRank - i}
          </span>
          <span className="doc-row-main">
            <span className="doc-row-title">{p.name}</span>
            <span className="doc-row-sub">{TIER_SHORT[p.tier] ?? p.tier}</span>
          </span>
          <span className="doc-row-end">
            <span className="doc-row-amount">{p.overallScore.toFixed(1)}</span>
            {p.appraisalBand ? <BandChip band={p.appraisalBand as AppraisalBand} small /> : null}
          </span>
        </Link>
      ))}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function AdminInsightsDashboard() {
  const { data: periods } = usePeriods()
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("")
  const [tierFilter, setTierFilter] = useState<string>("")
  const [pillarFilter, setPillarFilter] = useState<string>("")
  const [bandFilter, setBandFilter] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    if (periods?.length && !selectedPeriodId) {
      const active = periods.find((p: { isActive: boolean; isClosed: boolean }) => p.isActive && !p.isClosed)
      setSelectedPeriodId(active?.id ?? periods[0]?.id ?? "")
    }
  }, [periods, selectedPeriodId])

  const activeFilterCount = [tierFilter, pillarFilter, bandFilter, statusFilter].filter(Boolean).length

  const clearFilters = () => {
    setTierFilter(""); setPillarFilter(""); setBandFilter(""); setStatusFilter("")
  }

  const { data, isLoading } = useQuery({
    queryKey: ["admin-insights-v3", selectedPeriodId, tierFilter, pillarFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedPeriodId) params.set("evalPeriodId", selectedPeriodId)
      if (tierFilter) params.set("tier", tierFilter)
      if (pillarFilter) params.set("pillarCode", pillarFilter)
      const res = await fetch(`/api/admin/insights?${params}`)
      if (!res.ok) throw new Error("Failed to fetch insights")
      return (await res.json()).data
    },
    enabled: true,
  })

  const selectedPeriod = (periods ?? []).find((p: Period) => p.id === selectedPeriodId) as Period | undefined

  // ── Figures ────────────────────────────────────────────────
  const summary = data?.summary
  const totalStaff: number = summary?.totalStaff ?? 0
  const scoredUsers: number = summary?.scoredUsers ?? 0
  const totalActuals: number = summary?.totalActuals ?? 0
  const totalApproved: number = summary?.totalApproved ?? 0
  const totalPending: number = summary?.totalPending ?? 0
  const totalAssigned: number = summary?.totalAssignedKpis ?? 0
  const avgScore: number | null = scoredUsers > 0 ? summary?.avgOverallScore ?? null : null

  const headcountByTier: TierCount[] = data?.headcountByTier ?? []
  const rawBandDist: BandCount[] = data?.bandDistribution ?? []
  const rawStatusDist: StatusCount[] = data?.submissionStatus ?? []
  const pillarAverages: PillarAverage[] = data?.pillarAverages ?? []
  const approvalByPillar: PillarApproval[] = data?.approvalByPillar ?? []
  const rawTop: Performer[] = data?.topPerformers ?? []
  const rawLowest: Performer[] = data?.lowestPerformers ?? []
  const scoreDistribution: ScoreCount[] = data?.scoreDistribution ?? []
  const scoreTrend: TrendPoint[] = data?.scoreTrend ?? []

  // Band and status filters narrow what is listed, client-side.
  const keepBand = (p: Performer) => !bandFilter || p.appraisalBand === bandFilter
  const topPerformers = rawTop.filter(keepBand).slice(0, 5)
  const lowestPerformers = rawLowest.filter(keepBand)

  const approvalRate = pct(totalApproved, totalActuals)
  const rejected = rawStatusDist.find((d) => d.status === "REJECTED")?.count ?? 0
  const notSubmitted = Math.max(0, totalAssigned - totalActuals)
  const notScored = Math.max(0, totalStaff - scoredUsers)

  const bandCount = (b: AppraisalBand) => rawBandDist.find((d) => d.band === b)?.count ?? 0
  const belowMeets = bandCount("NEEDS_IMPROVEMENT") + bandCount("UNSATISFACTORY")
  const bands = BAND_ORDER.map((b) => ({ band: b, count: bandCount(b) }))
    .filter((d) => !bandFilter || d.band === bandFilter)
  const bandTotal = bands.reduce((s, d) => s + d.count, 0)

  // Change against the period before the selected one, when the trend has it.
  const trendIndex = selectedPeriod ? scoreTrend.findIndex((t) => t.periodName === selectedPeriod.name) : -1
  const previous = trendIndex > 0 ? scoreTrend[trendIndex - 1] : undefined
  const change = previous && avgScore !== null ? avgScore - previous.avgScore : undefined

  const pillarRows = PILLAR_CODES
    .filter((code) => !pillarFilter || code === pillarFilter)
    .map((code) => {
      const avg = pillarAverages.find((p) => p.pillarCode === code)
      const appr = approvalByPillar.find((p) => p.pillarCode === code)
      return { code, avg: avg?.avgPercent ?? null, appr }
    })

  const tiers = TIER_ORDER.map((t) => ({ tier: t, count: headcountByTier.find((h) => h.tier === t)?.count ?? 0 }))
    .filter((t) => t.count > 0)
  const maxTier = Math.max(1, ...tiers.map((t) => t.count))

  const statusShown = (s: string) => !statusFilter || statusFilter === s

  // Radar: every pillar, unscored ones at 0 so the shape keeps six corners.
  const radarData = PILLAR_CODES.map((code) => ({
    code,
    value: pillarAverages.find((p) => p.pillarCode === code)?.avgPercent ?? 0,
  }))

  // Donut: submission status, drawn in the status tones, largest share first.
  const STATUS_ORDER = ["APPROVED", "SUBMITTED", "DRAFT", "REJECTED"]
  const statusData = STATUS_ORDER
    .map((s) => ({ status: s, count: rawStatusDist.find((d) => d.status === s)?.count ?? 0 }))
    .filter((d) => statusShown(d.status))
  const statusTotal = statusData.reduce((s, d) => s + d.count, 0)
  const statusColor = (s: string) => TONE_COLORS[ACTUAL_STATUS[s]?.tone ?? "neutral"]
  const statusLabel = (s: string) => (s === "SUBMITTED" ? "Waiting review" : ACTUAL_STATUS[s]?.label ?? s)

  // ── Header and filters ─────────────────────────────────────
  const head = (
    <PageHead
      title="Department overview"
      sub={[
        selectedPeriod?.name,
        totalStaff > 0 ? `${scoredUsers} of ${plural(totalStaff, "person", "people")} scored` : null,
      ].filter(Boolean).join(" · ") || "KPI performance across the Cost Control department"}
      actions={
        <>
          <label htmlFor="insights-period" className="sr-only">Evaluation period</label>
          <SelectWrap>
            <select id="insights-period" className="select" value={selectedPeriodId} onChange={(e) => setSelectedPeriodId(e.target.value)}>
              {(periods ?? []).map((p: Period) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.isClosed ? " (closed)" : p.isActive ? " (active)" : ""}
                </option>
              ))}
            </select>
          </SelectWrap>
          <button
            type="button"
            className="btn"
            aria-expanded={filtersOpen}
            aria-controls="insights-filters"
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <SlidersHorizontal size={15} aria-hidden="true" />
            Filters
            {activeFilterCount > 0 && <span className="filter-count tabular">{activeFilterCount}</span>}
          </button>
        </>
      }
    />
  )

  const filters = filtersOpen ? (
    <section id="insights-filters" className="card filters-card" aria-label="Filters">
      <div className="field-grid">
        <Field label="Tier" htmlFor="insights-tier">
          <SelectWrap>
            <select id="insights-tier" className="select" value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
              <option value="">All tiers</option>
              <option value="SECTION_HEAD">Section head</option>
              <option value="TEAM_LEAD">Team lead</option>
              <option value="SENIOR">Senior engineer</option>
              <option value="ENGINEER">Engineer</option>
              <option value="JUNIOR">Junior engineer</option>
            </select>
          </SelectWrap>
        </Field>
        <Field label="Pillar" htmlFor="insights-pillar">
          <SelectWrap>
            <select id="insights-pillar" className="select" value={pillarFilter} onChange={(e) => setPillarFilter(e.target.value)}>
              <option value="">All pillars</option>
              {PILLAR_CODES.map((c) => (
                <option key={c} value={c}>{c} · {PILLAR_SHORT[c]}</option>
              ))}
            </select>
          </SelectWrap>
        </Field>
        <Field label="Appraisal band" htmlFor="insights-band">
          <SelectWrap>
            <select id="insights-band" className="select" value={bandFilter} onChange={(e) => setBandFilter(e.target.value)}>
              <option value="">All bands</option>
              {[...BAND_ORDER].reverse().map((b) => (
                <option key={b} value={b}>{APPRAISAL_BANDS[b].label}</option>
              ))}
            </select>
          </SelectWrap>
        </Field>
        <Field label="Submission status" htmlFor="insights-status">
          <SelectWrap>
            <select id="insights-status" className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="SUBMITTED">Waiting review</option>
              <option value="DRAFT">Draft</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </SelectWrap>
        </Field>
      </div>
      {activeFilterCount > 0 && (
        <div className="filters-foot">
          <span className="muted">{plural(activeFilterCount, "filter")} on</span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={clearFilters}>Clear filters</button>
        </div>
      )}
    </section>
  ) : null

  if (isLoading) {
    return (
      <>
        {head}
        {filters}
        <LoadingSpinner />
      </>
    )
  }

  const avgBand = avgScore !== null ? bandFor(avgScore) : null

  return (
    <>
      {head}
      {filters}

      {/* ── 1. The answer: department score + four figures that need a decision ── */}
      <div className="exec-hero">
        <section className="exec-score" aria-label="Department score">
          <span className="hero-score-label">Department score</span>
          <ScoreGauge
            score={avgScore}
            band={avgBand}
            size={136}
            label={avgScore === null ? "Department score: not scored yet" : `Department score: ${avgScore} out of 100, ${APPRAISAL_BANDS[avgBand!].label}`}
          />
          {avgBand ? <BandChip band={avgBand} /> : null}
          <span className="hero-score-note">
            {avgScore === null
              ? "Run scoring for this period to see it"
              : change !== undefined
                ? `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(1)} on ${previous?.periodName} · average of ${scoredUsers} people`
                : `Average of ${plural(scoredUsers, "scored person", "scored people")}`}
          </span>
        </section>

        <div className="exec-tiles">
          <StatGrid>
            <StatTile
              label="Approval rate"
              value={`${approvalRate}%`}
              sub={`${totalApproved} of ${plural(totalActuals, "actual")} approved`}
            />
            <StatTile
              label="Waiting review"
              value={totalPending}
              sub={totalPending > 0 ? "Open the review queue" : "Nothing waiting"}
              href="/manager/review"
            />
            <StatTile
              label="Below meets expectations"
              value={belowMeets}
              sub={belowMeets > 0 ? `${plural(belowMeets, "person", "people")} under 70` : "Nobody under 70"}
              href="/manager/team"
              bad={belowMeets > 0}
            />
            <StatTile
              label="Not submitted"
              value={notSubmitted}
              sub={`of ${plural(totalAssigned, "assigned KPI")}`}
            />
          </StatGrid>
        </div>
      </div>

      {/* ── 2. Where the department stands, pillar by pillar ── */}
      <section className="card list-card">
        <CardHead
          title="Pillar scorecard"
          aside={<span className="side-note">Department average · mark at {STRONG_THRESHOLD}% is the strong line</span>}
        />
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Pillar scorecard">
          <table className="data-table pillar-table">
            <thead>
              <tr>
                <th scope="col">Pillar</th>
                <th scope="col" className="bar-col">Average</th>
                <th scope="col" className="num">Average</th>
                <th scope="col" className="num">Of 5</th>
                <th scope="col" className="num">Approved</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {pillarRows.map(({ code, avg, appr }) => (
                <tr key={code}>
                  <th scope="row">
                    <span className="pillar-cell">
                      <PillarTag code={code} />
                      <span className="pillar-cell-name">{PILLAR_SHORT[code]}</span>
                    </span>
                  </th>
                  <td className="bar-col">
                    <Meter
                      value={avg ?? 0}
                      pillar={code}
                      thick
                      target={STRONG_THRESHOLD}
                      label={`${PILLAR_SHORT[code]} average ${avg === null ? "not scored" : `${avg}%`}`}
                    />
                  </td>
                  <td className="num cell-figure">{avg === null ? "–" : `${avg.toFixed(1)}%`}</td>
                  <td className="num muted">{avg === null ? "–" : (avg / 20).toFixed(2)}</td>
                  <td className="num">
                    {appr ? (
                      <>
                        {appr.approvalRate}%<span className="cell-sub">{appr.approved} of {appr.total}</span>
                      </>
                    ) : "–"}
                  </td>
                  <td>
                    {avg === null ? (
                      <StatusChip tone="neutral" small>Not scored</StatusChip>
                    ) : avg >= STRONG_THRESHOLD ? (
                      <StatusChip tone="ok" small>On target</StatusChip>
                    ) : (
                      <StatusChip tone="warn" small>Below target</StatusChip>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 2b. The same pillars as a shape, and where submissions stand ── */}
      <div className="split even exec-row">
        <section className="card">
          <CardHead title="Pillar profile" aside={<span className="side-note">Department average by pillar</span>} />
          <div
            className="chart"
            role="img"
            aria-label={`Pillar profile: ${radarData.map((d) => `${d.code} ${Math.round(d.value)}%`).join(", ")}`}
          >
            <ResponsiveContainer width="100%" height={290}>
              <RadarChart data={radarData} outerRadius="62%" margin={{ top: 18, right: 40, bottom: 18, left: 40 }}>
                <PolarGrid stroke="var(--hairline)" />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <PolarAngleAxis
                  dataKey="code"
                  tick={(props: {
                    x?: number | string; y?: number | string; cx?: number | string; cy?: number | string
                    payload?: { value?: string }
                  }) => {
                    const code = props.payload?.value ?? ""
                    const d = radarData.find((r) => r.code === code)
                    // Push each label outward from the centre so it clears the shape.
                    const cx = Number(props.cx), cy = Number(props.cy)
                    const dx = Number(props.x) - cx, dy = Number(props.y) - cy
                    const len = Math.hypot(dx, dy) || 1
                    const x = Number(props.x) + (dx / len) * 14
                    // Labels above the centre stack upward, so both lines clear it.
                    const y = Number(props.y) + (dy / len) * 12 - (dy < -4 ? 12 : 0)
                    const anchor = Math.abs(dx) < 4 ? "middle" : dx > 0 ? "start" : "end"
                    return (
                      <g>
                        <text x={x} y={y - 3} textAnchor={anchor} style={{ fill: "var(--ink-3)", fontSize: 11.5 }}>
                          {code} · {PILLAR_SHORT[code]?.split(" ")[0]}
                        </text>
                        <text x={x} y={y + 12} textAnchor={anchor} style={{ fill: "var(--ink)", fontSize: 13, fontWeight: 650 }}>
                          {d ? `${Math.round(d.value)}%` : ""}
                        </text>
                      </g>
                    )
                  }}
                />
                <Radar dataKey="value" stroke="var(--series-1)" strokeWidth={2} fill="var(--series-1)" fillOpacity={0.14}
                  dot={{ r: 3.5, fill: "var(--series-1)", strokeWidth: 0 }} isAnimationActive={false} />
                <Tooltip
                  content={tooltip<{ code: string; value: number }>((d) => ({
                    title: `${d.code} · ${PILLAR_SHORT[d.code]}`,
                    rows: [{ name: "Average", value: `${d.value.toFixed(1)}%`, color: PILLARS[d.code as keyof typeof PILLARS]?.color }],
                  }))}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card">
          <CardHead title="Submission status" aside={<TagPill>{plural(statusTotal, "actual")}</TagPill>} />
          <div className="donut-wrap">
            <div
              className="chart donut"
              role="img"
              aria-label={`Submission status: ${statusData.map((d) => `${statusLabel(d.status)} ${d.count}`).join(", ")}`}
            >
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusData.filter((d) => d.count > 0)} dataKey="count" nameKey="status"
                    innerRadius="68%" outerRadius="92%" paddingAngle={statusData.filter((d) => d.count > 0).length > 1 ? 2 : 0}
                    stroke="var(--surface)" strokeWidth={2} isAnimationActive={false}>
                    {statusData.filter((d) => d.count > 0).map((d) => (
                      <Cell key={d.status} fill={statusColor(d.status)} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={tooltip<{ status: string; count: number }>((d) => ({
                      title: statusLabel(d.status),
                      rows: [{ name: "Actuals", value: `${d.count} (${pct(d.count, statusTotal)}%)`, color: statusColor(d.status) }],
                    }))}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center" aria-hidden="true">
                <span className="donut-value tabular">{pct(totalApproved, statusTotal)}%</span>
                <span className="donut-label">approved</span>
              </div>
            </div>
            <ul className="band-legend donut-legend">
              {statusData.map((d) => (
                <li key={d.status} className="band-legend-row">
                  <span className="rep-swatch" style={{ background: statusColor(d.status) }} aria-hidden="true" />
                  <span className="band-legend-name">{statusLabel(d.status)}</span>
                  <span />
                  <span className="band-legend-count tabular">{d.count}</span>
                  <span className="band-legend-pct tabular">{pct(d.count, statusTotal)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      {/* ── 3. Spread of results, and what needs action ── */}
      <div className="split even exec-row">
        <section className="card">
          <CardHead title="Appraisal bands" aside={<TagPill>{plural(bandTotal, "person", "people")}</TagPill>} />
          {bandTotal === 0 ? (
            <p className="side-note">No one is scored in this period yet.</p>
          ) : (
            <>
              {/* Bell curve: a bar per band, lowest to highest, with the
                  distribution's shape drawn faintly over them. */}
              <div
                className="chart"
                role="img"
                aria-label={`Appraisal bands, lowest to highest: ${bands.map((d) => `${APPRAISAL_BANDS[d.band].label} ${d.count}`).join(", ")}`}
              >
                <ResponsiveContainer width="100%" height={190}>
                  <ComposedChart
                    data={bands.map((d) => ({ ...d, short: `${APPRAISAL_BANDS[d.band].min}–${APPRAISAL_BANDS[d.band].max}` }))}
                    margin={{ top: 22, right: 8, left: 8, bottom: 0 }}
                  >
                    <XAxis dataKey="short" tick={TICK} axisLine={false} tickLine={false} interval={0} />
                    <Tooltip
                      cursor={{ fill: "var(--band)" }}
                      content={tooltip<{ band: AppraisalBand; count: number }>((d) => ({
                        title: APPRAISAL_BANDS[d.band].label,
                        rows: [{ name: "People", value: `${d.count} (${pct(d.count, bandTotal)}%)`, color: APPRAISAL_BANDS[d.band].color }],
                      }))}
                    />
                    <Area type="natural" dataKey="count" stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="4 4"
                      fill="var(--ink-3)" fillOpacity={0.06} dot={false} isAnimationActive={false} />
                    <Bar dataKey="count" barSize={34} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                      {bands.map((d) => (
                        <Cell key={d.band} fill={APPRAISAL_BANDS[d.band].color} />
                      ))}
                      <LabelList dataKey="count" position="top" style={VALUE_LABEL} />
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <ul className="band-legend">
                {[...bands].reverse().map((d) => (
                  <li key={d.band} className="band-legend-row">
                    <span className="rep-swatch" style={{ background: APPRAISAL_BANDS[d.band].color }} aria-hidden="true" />
                    <span className="band-legend-name">{APPRAISAL_BANDS[d.band].label}</span>
                    <span className="band-legend-range tabular">{APPRAISAL_BANDS[d.band].min}–{APPRAISAL_BANDS[d.band].max}</span>
                    <span className="band-legend-count tabular">{d.count}</span>
                    <span className="band-legend-pct tabular">{pct(d.count, bandTotal)}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card list-card exec-attention">
          <CardHead title="Needs attention" />
          {(() => {
            const rows: ReactNode[] = []
            if (totalPending > 0 && statusShown("SUBMITTED")) rows.push(
              <AttentionRow key="pending" href="/manager/review" icon={Hourglass} tone="warn"
                title={`${plural(totalPending, "actual")} waiting for review`}
                sub="Approve or reject them so they count toward this period's scores" />)
            if (belowMeets > 0) rows.push(
              <AttentionRow key="below" href="/manager/team" icon={AlertTriangle} tone="bad"
                title={`${plural(belowMeets, "person", "people")} below meets expectations`}
                sub="Overall score under 70 · see the team overview" />)
            if (rejected > 0 && statusShown("REJECTED")) rows.push(
              <AttentionRow key="rejected" href="/manager/review" icon={XCircle} tone="bad"
                title={`${plural(rejected, "actual")} rejected`}
                sub="Waiting for a corrected submission" />)
            if (notSubmitted > 0) rows.push(
              <AttentionRow key="missing" href="/manager/review" icon={ClipboardList} tone="warn"
                title={`${plural(notSubmitted, "KPI")} without an actual`}
                sub={`${pct(notSubmitted, totalAssigned)}% of assigned KPIs have nothing submitted yet`} />)
            if (notScored > 0) rows.push(
              <AttentionRow key="unscored" href="/admin/scoring" icon={UserX} tone="info"
                title={`${plural(notScored, "person", "people")} not scored yet`}
                sub="Run scoring for this period to include them" />)
            return rows.length > 0 ? (
              <div className="doc-list">{rows}</div>
            ) : (
              <EmptyState icon={CheckCircle2} title="Nothing needs attention"
                description="Every actual is reviewed and everyone is scored." />
            )
          })()}
        </section>
      </div>

      {/* ── 4. The people at both ends ── */}
      <div className="split even exec-row">
        <section className="card list-card">
          <CardHead title="Top performers" aside={<Link href="/manager/team" className="card-link">Team overview</Link>} />
          {topPerformers.length === 0 ? (
            <EmptyState title="No one scored yet" description="Run scoring for this period to rank the department." />
          ) : (
            <PerformerRows people={topPerformers} startRank={1} descending />
          )}
        </section>
        <section className="card list-card">
          <CardHead title="Lowest scores" aside={<Link href="/manager/team" className="card-link">Team overview</Link>} />
          {lowestPerformers.length === 0 ? (
            <EmptyState
              title={scoredUsers > 10 ? "No one in this band" : "Too few people scored"}
              description={scoredUsers > 10 ? "Change the band filter to see the lowest scores." : "The lowest five appear once more than ten people are scored."}
            />
          ) : (
            <PerformerRows people={lowestPerformers} startRank={scoredUsers} descending={false} />
          )}
        </section>
      </div>

      {/* ── 5. Context: who, how KPIs scored, and the trend ── */}
      <div className="exec-trio">
        <section className="card">
          <CardHead title="Workforce" aside={<TagPill>{plural(totalStaff, "person", "people")}</TagPill>} />
          <p className="card-sub">
            {summary?.avgExperienceYears ? `${summary.avgExperienceYears} years average experience` : "Headcount by tier"}
          </p>
          <ul className="hbar-list">
            {tiers.map((t) => (
              <li key={t.tier} className="hbar-row">
                <span className="hbar-label">{TIER_SHORT[t.tier] ?? t.tier}</span>
                <span className="hbar-track" aria-hidden="true">
                  <span className="hbar-fill" style={{ width: `${(t.count / maxTier) * 100}%` }} />
                </span>
                <span className="hbar-value tabular">{t.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <CardHead title="KPI score spread" />
          <p className="card-sub">How many KPIs scored 0 to 5</p>
          <div className="chart" role="img" aria-label={`KPI scores: ${scoreDistribution.map((d) => `score ${d.score}: ${d.count}`).join(", ")}`}>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={scoreDistribution} barCategoryGap="22%" margin={{ top: 18, right: 4, left: -22, bottom: 0 }}>
                <XAxis dataKey="score" tick={TICK} axisLine={false} tickLine={false} />
                <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "var(--band)" }}
                  content={tooltip<ScoreCount>((d) => ({
                    title: `Score ${d.score} of 5`,
                    rows: [{ name: "KPIs", value: String(d.count), color: SCORE_COLORS[d.score as keyof typeof SCORE_COLORS] }],
                  }))}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {scoreDistribution.map((d) => (
                    <Cell key={d.score} fill={SCORE_COLORS[d.score as keyof typeof SCORE_COLORS] ?? "var(--ink-3)"} />
                  ))}
                  <LabelList dataKey="count" position="top" style={VALUE_LABEL} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card">
          <CardHead title="Score trend" />
          <p className="card-sub">Department average by period</p>
          {scoreTrend.length > 1 ? (
            <div className="chart" role="img" aria-label={`Department average by period: ${scoreTrend.map((d) => `${d.periodName} ${d.avgScore}`).join(", ")}`}>
              <ResponsiveContainer width="100%" height={170}>
                <LineChart data={scoreTrend} margin={{ top: 18, right: 12, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--hairline)" />
                  <XAxis dataKey="periodName" tick={TICK} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={TICK} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ stroke: "var(--hairline-strong)" }}
                    content={tooltip<TrendPoint>((d) => ({
                      title: d.periodName,
                      rows: [{ name: "Average score", value: String(d.avgScore), color: "var(--series-1)" }],
                    }))}
                  />
                  <Line type="monotone" dataKey="avgScore" stroke="var(--series-1)" strokeWidth={2}
                    dot={{ fill: "var(--series-1)", r: 3.5 }} activeDot={{ r: 5 }} name="Average score">
                    <LabelList dataKey="avgScore" position="top" style={VALUE_LABEL} />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="trend-empty">
              <span className="trend-empty-value tabular">{avgScore ?? "–"}</span>
              <span className="side-note">
                {scoreTrend.length === 1 ? `Only ${scoreTrend[0]?.periodName} is scored so far.` : "No period is scored yet."}{" "}
                The trend line appears once a second period has scores.
              </span>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
