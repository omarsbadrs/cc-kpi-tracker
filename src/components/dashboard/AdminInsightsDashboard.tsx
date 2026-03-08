"use client"

import { useQuery } from "@tanstack/react-query"
import { usePeriods } from "@/hooks/usePeriods"
import { useState, useEffect } from "react"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts"
import { Users, CheckCircle2, Clock, TrendingUp, Award, BarChart2, X, ClipboardList, FileCheck } from "lucide-react"
import { AppraisalBandBadge } from "@/components/dashboard/AppraisalBandBadge"
import type { AppraisalBand } from "@prisma/client"

// ─── colour maps ──────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  SECTION_HEAD: "#8b5cf6",
  TEAM_LEAD:    "#3b82f6",
  SENIOR:       "#10b981",
  ENGINEER:     "#0ea5e9",
  JUNIOR:       "#f59e0b",
}

const BAND_COLORS: Record<string, string> = {
  EXCEEDS:           "#22c55e",
  STRONG:            "#3b82f6",
  MEETS:             "#f59e0b",
  NEEDS_IMPROVEMENT: "#f97316",
  UNSATISFACTORY:    "#ef4444",
}

const BAND_LABELS: Record<string, string> = {
  EXCEEDS: "Exceeds", STRONG: "Strong", MEETS: "Meets",
  NEEDS_IMPROVEMENT: "Needs Impr.", UNSATISFACTORY: "Unsat.",
}

const PILLAR_COLORS: Record<string, string> = {
  A: "#22c55e", B: "#3b82f6", C: "#f59e0b", D: "#8b5cf6", E: "#ef4444", F: "#06b6d4",
}

const PILLAR_NAMES: Record<string, string> = {
  A: "Delivery", B: "Data Gov.", C: "Forecasting",
  D: "Comm.", E: "Attendance", F: "Growth",
}

const STATUS_COLORS: Record<string, string> = {
  APPROVED: "#22c55e", SUBMITTED: "#f59e0b", DRAFT: "#64748b", REJECTED: "#ef4444",
}

const SCORE_COLORS = ["#991b1b", "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e"]

const TIER_SHORT: Record<string, string> = {
  SECTION_HEAD: "Head", TEAM_LEAD: "Lead", SENIOR: "Senior", ENGINEER: "Engineer", JUNIOR: "Junior",
}

// ─── tooltip styles ───────────────────────────────────────────────────────────

const tooltipStyle = {
  backgroundColor: "#1e1e2e",
  border: "1px solid #2e2e45",
  borderRadius: 8,
  color: "#e2e8f0",
  fontSize: 12,
}
const tooltipItemStyle = { color: "#e2e8f0" }
const tooltipLabelStyle = { color: "#94a3b8", marginBottom: 2 }

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, color,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color: string
}) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">{label}</p>
          <p className="mt-1.5 text-3xl font-bold tabular-nums text-foreground">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-foreground-muted">{sub}</p>}
        </div>
        <div className="rounded-xl p-2.5" style={{ backgroundColor: `${color}18` }}>
          <Icon className="h-5 w-5" style={{ color }} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  )
}

// ─── Chart card wrapper ───────────────────────────────────────────────────────

function ChartCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass-card p-5 ${className}`}>
      <p className="mb-4 text-sm font-semibold text-foreground">{title}</p>
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

// ─── Filter select ────────────────────────────────────────────────────────────

function FilterSelect({
  value, onChange, label, children,
}: {
  value: string; onChange: (v: string) => void; label: string; children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-input px-3 py-1.5 text-sm text-foreground outline-none focus:border-blue-500 min-w-[140px]"
      >
        {children}
      </select>
    </div>
  )
}

export function AdminInsightsDashboard() {
  const { data: periods } = usePeriods()
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("")
  const [tierFilter,    setTierFilter]    = useState<string>("")
  const [pillarFilter,  setPillarFilter]  = useState<string>("")
  const [bandFilter,    setBandFilter]    = useState<string>("")
  const [statusFilter,  setStatusFilter]  = useState<string>("")

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
    queryKey: ["admin-insights-v2", selectedPeriodId, tierFilter, pillarFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedPeriodId) params.set("evalPeriodId", selectedPeriodId)
      if (tierFilter)        params.set("tier",        tierFilter)
      if (pillarFilter)      params.set("pillarCode",  pillarFilter)
      const res = await fetch(`/api/admin/insights?${params}`)
      if (!res.ok) throw new Error("Failed to fetch insights")
      return (await res.json()).data
    },
    enabled: true,
  })

  if (isLoading) return <LoadingSpinner />

  const {
    summary,
    headcountByTier = [],
    bandDistribution: rawBandDist = [],
    submissionStatus: rawStatusDist = [],
    pillarAverages = [],
    approvalByPillar = [],
    topPerformers: rawTopPerformers = [],
    scoreDistribution = [],
    scoreTrend = [],
  } = data ?? {}

  // ── Client-side filters (band, status) ────────────────────
  const bandDistribution = bandFilter
    ? rawBandDist.filter((d: { band: string }) => d.band === bandFilter)
    : rawBandDist

  const submissionStatus = statusFilter
    ? rawStatusDist.filter((d: { status: string }) => d.status === statusFilter)
    : rawStatusDist

  const topPerformers = bandFilter
    ? rawTopPerformers.filter((p: { appraisalBand: string | null }) => p.appraisalBand === bandFilter)
    : rawTopPerformers

  const approvalRate = summary?.totalActuals > 0
    ? Math.round((summary.totalApproved / summary.totalActuals) * 100)
    : 0

  interface Period { id: string; name: string; isActive: boolean; isClosed: boolean }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Department Overview</h1>
          <p className="mt-0.5 text-sm text-foreground-muted">KPI performance insights across the Cost Control Department</p>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Period */}
          <FilterSelect label="Period" value={selectedPeriodId} onChange={setSelectedPeriodId}>
            {(periods ?? []).map((p: Period) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.isClosed ? " (Closed)" : p.isActive ? " (Active)" : ""}
              </option>
            ))}
          </FilterSelect>

          {/* Tier */}
          <FilterSelect label="Tier" value={tierFilter} onChange={setTierFilter}>
            <option value="">All Tiers</option>
            <option value="SECTION_HEAD">Section Head</option>
            <option value="TEAM_LEAD">Team Lead</option>
            <option value="SENIOR">Senior Engineer</option>
            <option value="ENGINEER">Engineer</option>
            <option value="JUNIOR">Junior Engineer</option>
          </FilterSelect>

          {/* Pillar */}
          <FilterSelect label="Pillar" value={pillarFilter} onChange={setPillarFilter}>
            <option value="">All Pillars</option>
            <option value="A">A — Delivery &amp; Timeliness</option>
            <option value="B">B — Data Quality &amp; Governance</option>
            <option value="C">C — Forecasting &amp; Cost Control</option>
            <option value="D">D — Communication &amp; Stakeholders</option>
            <option value="E">E — Attendance &amp; Conduct</option>
            <option value="F">F — Growth &amp; Coaching</option>
          </FilterSelect>

          {/* Appraisal band */}
          <FilterSelect label="Appraisal Band" value={bandFilter} onChange={setBandFilter}>
            <option value="">All Bands</option>
            <option value="EXCEEDS">Exceeds Expectations</option>
            <option value="STRONG">Strong</option>
            <option value="MEETS">Meets Expectations</option>
            <option value="NEEDS_IMPROVEMENT">Needs Improvement</option>
            <option value="UNSATISFACTORY">Unsatisfactory</option>
          </FilterSelect>

          {/* Submission status */}
          <FilterSelect label="Submission Status" value={statusFilter} onChange={setStatusFilter}>
            <option value="">All Statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="SUBMITTED">Pending Review</option>
            <option value="DRAFT">Draft</option>
            <option value="REJECTED">Rejected</option>
          </FilterSelect>

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-transparent select-none">Clear</span>
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard icon={Users}         label="Total Staff"       value={summary?.totalStaff ?? 0}          color="#3b82f6" />
        <StatCard icon={ClipboardList} label="Assigned KPIs"   value={summary?.totalAssignedKpis ?? 0}   color="#8b5cf6" sub="total assignments" />
        <StatCard icon={BarChart2}     label="KPI Actuals"      value={summary?.totalActuals ?? 0}         color="#0ea5e9" sub="submitted records" />
        <StatCard icon={FileCheck}     label="Actuals Approved" value={summary?.totalApproved ?? 0}        color="#22c55e" sub={`${approvalRate}% of actuals`} />
        <StatCard icon={Clock}         label="Pending Review"   value={summary?.totalPending ?? 0}         color="#f59e0b" />
        <StatCard icon={TrendingUp}    label="Avg. Score"       value={summary?.avgOverallScore ?? "—"}    color="#06b6d4" sub="out of 100" />
        <StatCard icon={Award}         label="Scored Users"     value={summary?.scoredUsers ?? 0}          color="#f97316" sub={`of ${summary?.totalStaff ?? 0}`} />
      </div>

      {/* ── Row 1: Headcount + Band distribution + Submission status ── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Headcount by tier — vertical bar */}
        <ChartCard title="Headcount by Tier">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={headcountByTier} barCategoryGap="30%">
              <XAxis dataKey="tier" tick={{ fill: "#94a3b8", fontSize: 10 }}
                tickFormatter={(v) => TIER_SHORT[v] ?? v} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} cursor={{ fill: "#ffffff08" }}
                formatter={(v, _n, p) => [v, TIER_SHORT[p.payload.tier] ?? p.payload.tier]} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {headcountByTier.map((entry: { tier: string }) => (
                  <Cell key={entry.tier} fill={TIER_COLORS[entry.tier] ?? "#64748b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Appraisal band — donut */}
        <ChartCard title="Appraisal Band Distribution">
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={200}>
              <PieChart>
                <Pie data={bandDistribution} dataKey="count" innerRadius={48} outerRadius={78} paddingAngle={3}>
                  {bandDistribution.map((entry: { band: string }) => (
                    <Cell key={entry.band} fill={BAND_COLORS[entry.band] ?? "#64748b"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle}
                  formatter={(v, _n, p) => [v, BAND_LABELS[p.payload.band] ?? p.payload.band]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-1.5 text-xs">
              {bandDistribution.filter((d: { count: number }) => d.count > 0).map((d: { band: string; count: number }) => (
                <div key={d.band} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: BAND_COLORS[d.band] }} />
                  <span className="text-foreground-muted">{BAND_LABELS[d.band]}</span>
                  <span className="ml-auto font-semibold text-foreground">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        {/* Submission status — donut */}
        <ChartCard title="Submission Status">
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={200}>
              <PieChart>
                <Pie data={submissionStatus} dataKey="count" innerRadius={48} outerRadius={78} paddingAngle={3}>
                  {submissionStatus.map((entry: { status: string }) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#64748b"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-1.5 text-xs">
              {submissionStatus.filter((d: { count: number }) => d.count > 0).map((d: { status: string; count: number }) => (
                <div key={d.status} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLORS[d.status] }} />
                  <span className="text-foreground-muted capitalize">{d.status.toLowerCase()}</span>
                  <span className="ml-auto font-semibold text-foreground">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* ── Row 2: Pillar radar + Approval by pillar + Score distribution ── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Pillar avg scores — radar */}
        <ChartCard title="Average Score by Pillar">
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={pillarAverages.map((p: { pillarCode: string; avgPercent: number }) => ({
              ...p, name: PILLAR_NAMES[p.pillarCode] ?? p.pillarCode,
            }))}>
              <PolarGrid stroke="#2e2e45" />
              <PolarAngleAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <Radar dataKey="avgPercent" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} dot={{ fill: "#3b82f6", r: 3 }} />
              <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Approval rate by pillar — horizontal bar */}
        <ChartCard title="Approval Rate by Pillar">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={approvalByPillar.map((p: { pillarCode: string; name: string; approvalRate: number; approved: number; total: number }) => ({
              ...p, label: PILLAR_NAMES[p.pillarCode] ?? p.pillarCode,
            }))} layout="vertical" barCategoryGap="25%">
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }}
                tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
              <YAxis dataKey="label" type="category" tick={{ fill: "#94a3b8", fontSize: 10 }} width={62} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle}
                formatter={(v, _n, p) => [`${v}% (${p.payload.approved}/${p.payload.total})`, "Approval"]} />
              <Bar dataKey="approvalRate" radius={[0, 4, 4, 0]}>
                {approvalByPillar.map((entry: { pillarCode: string }) => (
                  <Cell key={entry.pillarCode} fill={PILLAR_COLORS[entry.pillarCode] ?? "#3b82f6"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* KPI score distribution — bar */}
        <ChartCard title="KPI Score Distribution (0–5)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scoreDistribution} barCategoryGap="20%">
              <XAxis dataKey="score" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} formatter={(v) => [v, "KPIs"]} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {scoreDistribution.map((entry: { score: number }) => (
                  <Cell key={entry.score} fill={SCORE_COLORS[entry.score] ?? "#64748b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Row 3: Score trend + Top performers ── */}
      <div className="grid gap-4 lg:grid-cols-5">

        {/* Score trend — line chart */}
        <ChartCard title="Average Department Score Trend" className="lg:col-span-3">
          {scoreTrend.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={scoreTrend}>
                <CartesianGrid stroke="#1e1e2e" strokeDasharray="4 4" />
                <XAxis dataKey="periodName" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                <Line type="monotone" dataKey="avgScore" stroke="#3b82f6" strokeWidth={2.5}
                  dot={{ fill: "#3b82f6", r: 4 }} activeDot={{ r: 6 }} name="Avg Score" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[220px] items-center justify-center text-sm text-foreground-muted">
              Not enough period data to show trend yet.
            </div>
          )}
        </ChartCard>

        {/* Top performers table */}
        <ChartCard title="Top 10 Performers" className="lg:col-span-2">
          <div className="space-y-1.5 overflow-y-auto" style={{ maxHeight: 220 }}>
            {topPerformers.length === 0 ? (
              <p className="text-center text-sm text-foreground-muted py-8">No scored users yet.</p>
            ) : topPerformers.map((p: { userId: string; name: string; tier: string; overallScore: number; appraisalBand: string | null }, i: number) => (
              <div key={p.userId} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-card-hover transition-colors">
                <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-foreground-muted">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground">{p.name}</p>
                  <p className="text-[10px] text-foreground-muted"
                    style={{ color: TIER_COLORS[p.tier] }}>
                    {TIER_SHORT[p.tier] ?? p.tier}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-sm font-bold tabular-nums text-foreground">{p.overallScore}</span>
                  {p.appraisalBand && (
                    <AppraisalBandBadge band={p.appraisalBand as AppraisalBand} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  )
}
