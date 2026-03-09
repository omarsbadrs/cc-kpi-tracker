"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { TIER_LABELS, TIER_SHORT, ROLE_LABELS } from "@/lib/constants"
import { UserX, UserCheck, Search, Mail, Clock, AlertTriangle } from "lucide-react"

interface InactiveUser {
  id: string
  firstName: string
  lastName: string
  email: string
  employeeId: string | null
  role: string
  tier: string
  jobTitle: string | null
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  _count?: {
    kpiAssignments: number
    kpiActuals: number
  }
}

const TIER_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  SECTION_HEAD: { bg: "bg-violet-500/10", text: "text-violet-400", dot: "bg-violet-500" },
  TEAM_LEAD:    { bg: "bg-blue-500/10",   text: "text-blue-400",   dot: "bg-blue-500"   },
  SENIOR:       { bg: "bg-emerald-500/10",text: "text-emerald-400",dot: "bg-emerald-500" },
  ENGINEER:     { bg: "bg-sky-500/10",    text: "text-sky-400",    dot: "bg-sky-500"     },
  JUNIOR:       { bg: "bg-amber-500/10",  text: "text-amber-400",  dot: "bg-amber-500"  },
}
const DEFAULT_COLOR = { bg: "bg-sky-500/10", text: "text-sky-400", dot: "bg-sky-500" }

export default function InactiveUsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [reactivating, setReactivating] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", "inactive"],
    queryFn: async () => {
      const res = await fetch("/api/users?isActive=false&pageSize=200&sortBy=lastName&sortOrder=asc")
      if (!res.ok) throw new Error("Failed to fetch inactive users")
      return res.json()
    },
  })

  const reactivate = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      })
      if (!res.ok) throw new Error("Failed to reactivate")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
      setReactivating(null)
    },
    onError: () => setReactivating(null),
  })

  const users: InactiveUser[] = data?.data ?? []
  const filtered = users.filter((u) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.employeeId?.toLowerCase().includes(q) ?? false) ||
      (u.jobTitle?.toLowerCase().includes(q) ?? false)
    )
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inactive Users"
        description={`${users.length} deactivated account${users.length !== 1 ? "s" : ""} — hidden from all other pages`}
      />

      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" strokeWidth={1.5} />
        <p className="text-sm text-amber-300/80">
          Inactive users are excluded from team views, assignments, scoring, analytics, and all reports.
          Their historical data is preserved in the database. Reactivating restores full access.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" strokeWidth={1.5} />
        <input
          type="text"
          placeholder="Search by name, email, title, or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border bg-card-bg py-2.5 pl-10 pr-4 text-sm text-foreground placeholder-foreground-muted outline-none transition-colors focus:border-blue-500"
        />
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-card-border bg-card-bg py-16 text-center">
          <UserX className="h-10 w-10 text-foreground-muted/30" strokeWidth={1.5} />
          <p className="text-sm text-foreground-muted">
            {search ? "No inactive users match your search." : "No inactive users — everyone is active."}
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="border-b border-border px-5 py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground-secondary">
              {filtered.length} user{filtered.length !== 1 ? "s" : ""}
              {search && <span className="text-foreground-muted"> matching &quot;{search}&quot;</span>}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-background-secondary/50">
                  <th className="w-8 px-4 py-2.5 text-xs font-medium text-foreground-muted">#</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-foreground-secondary">Name</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-foreground-secondary">Email</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-foreground-secondary">Role / Tier</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-foreground-secondary">Job Title</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-foreground-secondary">Employee ID</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-foreground-secondary">Last Login</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-foreground-secondary text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => {
                  const c = TIER_COLORS[u.tier] ?? DEFAULT_COLOR
                  const lastLogin = u.lastLoginAt
                    ? new Date(u.lastLoginAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                    : "Never"

                  return (
                    <tr key={u.id} className="border-b border-border/50 opacity-75 hover:opacity-100 transition-opacity">
                      <td className="px-4 py-3 text-xs text-foreground-muted/50 tabular-nums">{i + 1}</td>

                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background-secondary text-[11px] font-bold text-foreground-muted">
                            {u.firstName[0]}{u.lastName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground-secondary line-through decoration-foreground-muted/40">
                              {u.firstName} {u.lastName}
                            </p>
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                              <UserX className="h-2.5 w-2.5" />
                              Inactive
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-foreground-muted">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-foreground-muted/40" strokeWidth={1.5} />
                          <span className="font-mono text-xs">{u.email}</span>
                        </div>
                      </td>

                      {/* Role / Tier */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-foreground-muted">{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}</span>
                          <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.bg} ${c.text}`}>
                            <span className={`h-1 w-1 rounded-full ${c.dot}`} />
                            {TIER_SHORT[u.tier] ?? u.tier}
                          </span>
                        </div>
                      </td>

                      {/* Job Title */}
                      <td className="px-4 py-3 text-sm text-foreground-muted">
                        {u.jobTitle || TIER_LABELS[u.tier as keyof typeof TIER_LABELS] || "—"}
                      </td>

                      {/* Employee ID */}
                      <td className="px-4 py-3 font-mono text-xs text-foreground-muted">
                        {u.employeeId ? `#${u.employeeId}` : "—"}
                      </td>

                      {/* Last Login */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
                          <Clock className="h-3 w-3 text-foreground-muted/40" strokeWidth={1.5} />
                          {lastLogin}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setReactivating(u.id)
                            reactivate.mutate(u.id)
                          }}
                          disabled={reactivating === u.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          <UserCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
                          {reactivating === u.id ? "Reactivating…" : "Reactivate"}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
