"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { UserCheck, UserX, Info } from "lucide-react"
import { PageHead } from "@/components/ui/PageHead"
import { SearchInput } from "@/components/ui/Field"
import { StatusChip, TagPill } from "@/components/ui/StatusChip"
import { ConfirmDialog } from "@/components/ui/Modal"
import { useToast } from "@/components/ui/Toast"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { EmptyState } from "@/components/shared/EmptyState"
import { UserAvatar } from "@/components/layout/UserMenu"
import { TIER_LABELS, TIER_SHORT, ROLE_LABELS } from "@/lib/constants"
import "@/styles/views/admin-users.css"

interface InactiveUser {
  id: string
  firstName: string
  lastName: string
  email: string
  employeeId: string | null
  avatarUrl?: string | null
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

export default function InactiveUsersPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [search, setSearch] = useState("")
  const [reactivating, setReactivating] = useState<string | null>(null)
  const [confirmUser, setConfirmUser] = useState<InactiveUser | null>(null)

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
    onSuccess: (_result, userId) => {
      const u = (data?.data as InactiveUser[] | undefined)?.find((x) => x.id === userId)
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
      setReactivating(null)
      setConfirmUser(null)
      toast(u ? `${u.firstName} ${u.lastName} reactivated` : "User reactivated")
    },
    onError: () => {
      setReactivating(null)
      setConfirmUser(null)
      toast("Could not reactivate. Check your connection and try again", { icon: "alert" })
    },
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

  const countLabel = `${users.length} deactivated ${users.length === 1 ? "account" : "accounts"}`

  return (
    <div>
      <PageHead
        title="Inactive users"
        sub={isLoading ? "Loading…" : `${countLabel} · hidden from all other pages`}
      />

      <div className="sample-banner offline-banner" role="note">
        <span className="sample-banner-ic">
          <Info size={14} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <span className="grow">
          Inactive users are left out of team views, assignments, scoring, analytics and reports. Their history is kept,
          and reactivating restores full access.
        </span>
      </div>

      {users.length > 0 && (
        <div className="toolbar">
          <SearchInput
            placeholder="Search name, email, title or ID"
            aria-label="Search inactive users"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {isLoading ? (
        <LoadingSpinner label="Loading inactive users…" />
      ) : users.length === 0 ? (
        <div className="card-list">
          <EmptyState
            icon={UserCheck}
            title="No inactive users"
            description="Deactivated accounts appear here so you can restore them."
          />
        </div>
      ) : (
        <section className="card list-card">
          <div className="card-head">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="card-title">Deactivated accounts</h2>
              <TagPill>{filtered.length}</TagPill>
            </div>
            {search && (
              <span className="side-note" style={{ overflowWrap: "anywhere" }}>
                Matching “{search}”
              </span>
            )}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={UserX}
              title="No inactive users match"
              description="Try a different name, email, title or employee ID."
              action={
                <button type="button" className="btn" onClick={() => setSearch("")}>
                  Clear search
                </button>
              }
            />
          ) : (
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Inactive users">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col" className="num">#</th>
                    <th scope="col">Person</th>
                    <th scope="col">Role · tier</th>
                    <th scope="col">Job title</th>
                    <th scope="col">Employee ID</th>
                    <th scope="col">Last sign-in</th>
                    <th scope="col">Status</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u, i) => {
                    const name = `${u.firstName} ${u.lastName}`
                    const lastLogin = u.lastLoginAt
                      ? new Date(u.lastLoginAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                      : "Never"
                    const busy = reactivating === u.id

                    return (
                      <tr key={u.id} className="hover">
                        <td className="num muted">{i + 1}</td>
                        <td>
                          <div className="person-cell">
                            <UserAvatar firstName={u.firstName} lastName={u.lastName} avatarUrl={u.avatarUrl} />
                            <div className="person-text">
                              <span className="person-name">{name}</span>
                              <span className="person-sub">{u.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <TagPill>{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}</TagPill>
                            <span className="ink-2 nowrap">{TIER_SHORT[u.tier] ?? u.tier}</span>
                          </div>
                        </td>
                        <td className="clip muted">
                          {u.jobTitle || TIER_LABELS[u.tier as keyof typeof TIER_LABELS] || "—"}
                        </td>
                        <td className="nowrap">
                          {u.employeeId ? <span className="kpi-code">#{u.employeeId}</span> : <span className="muted">—</span>}
                        </td>
                        <td className="nowrap muted tabular">{lastLogin}</td>
                        <td>
                          <StatusChip tone="neutral" small>Inactive</StatusChip>
                        </td>
                        <td className="num">
                          <button
                            type="button"
                            className="btn btn-sm"
                            aria-label={`Reactivate ${name}`}
                            aria-disabled={busy || undefined}
                            onClick={() => {
                              if (!busy) setConfirmUser(u)
                            }}
                          >
                            <UserCheck size={15} aria-hidden="true" />
                            {busy ? "Reactivating…" : "Reactivate"}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <ConfirmDialog
        open={confirmUser !== null}
        title={confirmUser ? `Reactivate ${confirmUser.firstName} ${confirmUser.lastName}?` : "Reactivate this user?"}
        message="They can sign in again and reappear in teams, assignments, scoring and reports."
        confirmLabel="Reactivate user"
        danger={false}
        busy={reactivate.isPending}
        onConfirm={() => {
          if (!confirmUser) return
          setReactivating(confirmUser.id)
          reactivate.mutate(confirmUser.id)
        }}
        onCancel={() => setConfirmUser(null)}
      />
    </div>
  )
}
