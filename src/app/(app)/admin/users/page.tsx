"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { Badge } from "@/components/shared/Badge"
import { Pagination } from "@/components/shared/Pagination"
import { TIER_LABELS, ROLE_LABELS } from "@/lib/constants"
import { useRouter } from "next/navigation"

export default function AdminUsersPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [showCreateForm, setShowCreateForm] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" })
      if (search) params.set("search", search)
      const res = await fetch(`/api/users?${params}`)
      if (!res.ok) throw new Error("Failed to fetch users")
      return res.json()
    },
  })

  const createUser = useMutation({
    mutationFn: async (userData: Record<string, string>) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || "Failed to create user")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
      setShowCreateForm(false)
    },
  })

  if (isLoading) return <LoadingSpinner />

  const users = data?.data || []
  const meta = data?.meta

  return (
    <div>
      <PageHeader
        title="User Management"
        description={`${meta?.total || 0} users total`}
        action={
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showCreateForm ? "Cancel" : "Add User"}
          </button>
        }
      />

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, email, or employee ID..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="w-full max-w-md rounded-lg border border-border bg-input px-4 py-2 text-sm text-foreground placeholder-foreground-muted outline-none focus:border-blue-500"
        />
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <CreateUserForm
          onSubmit={(data) => createUser.mutate(data)}
          isLoading={createUser.isPending}
          error={createUser.error?.message}
        />
      )}

      {/* Users Table */}
      <div className="overflow-x-auto rounded-xl border border-card-border bg-card-bg">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-background-secondary">
              <th className="px-4 py-3 font-medium text-foreground-secondary">Name</th>
              <th className="px-4 py-3 font-medium text-foreground-secondary">Email</th>
              <th className="px-4 py-3 font-medium text-foreground-secondary">Role</th>
              <th className="px-4 py-3 font-medium text-foreground-secondary">Tier</th>
              <th className="px-4 py-3 font-medium text-foreground-secondary">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user: { id: string; firstName: string; lastName: string; email: string; role: string; tier: string; isActive: boolean }) => (
              <tr
                key={user.id}
                onClick={() => router.push(`/admin/users/${user.id}`)}
                className="cursor-pointer border-b border-border transition-colors hover:bg-card-hover"
              >
                <td className="px-4 py-3 font-medium text-foreground">{user.firstName} {user.lastName}</td>
                <td className="px-4 py-3 text-foreground-secondary">{user.email}</td>
                <td className="px-4 py-3"><Badge>{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}</Badge></td>
                <td className="px-4 py-3 text-xs text-foreground-muted">{TIER_LABELS[user.tier as keyof typeof TIER_LABELS]}</td>
                <td className="px-4 py-3">
                  <Badge variant={user.isActive ? "success" : "danger"}>
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />}
      </div>
    </div>
  )
}

function CreateUserForm({ onSubmit, isLoading, error }: { onSubmit: (data: Record<string, string>) => void; isLoading: boolean; error?: string }) {
  const [formData, setFormData] = useState({
    email: "", password: "", firstName: "", lastName: "",
    role: "USER", tier: "ENGINEER", jobTitle: "", employeeId: "",
  })

  const update = (key: string, value: string) => setFormData({ ...formData, [key]: value })

  return (
    <div className="mb-6 rounded-xl border border-card-border bg-card-bg p-6">
      <h3 className="mb-4 text-sm font-medium text-foreground-muted">New User</h3>
      {error && <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <input placeholder="First Name" value={formData.firstName} onChange={(e) => update("firstName", e.target.value)} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500" />
        <input placeholder="Last Name" value={formData.lastName} onChange={(e) => update("lastName", e.target.value)} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500" />
        <input placeholder="Email" type="email" value={formData.email} onChange={(e) => update("email", e.target.value)} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500" />
        <input placeholder="Password" type="password" value={formData.password} onChange={(e) => update("password", e.target.value)} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500" />
        <select value={formData.role} onChange={(e) => update("role", e.target.value)} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500">
          <option value="USER">User</option>
          <option value="MANAGER">Manager</option>
          <option value="ADMIN">Admin</option>
        </select>
        <select value={formData.tier} onChange={(e) => update("tier", e.target.value)} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500">
          <option value="JUNIOR">Junior</option>
          <option value="ENGINEER">Engineer</option>
          <option value="SENIOR">Senior</option>
          <option value="TEAM_LEAD">Team Lead</option>
          <option value="SECTION_HEAD">Section Head</option>
        </select>
        <input placeholder="Job Title" value={formData.jobTitle} onChange={(e) => update("jobTitle", e.target.value)} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500" />
        <input placeholder="Employee ID" value={formData.employeeId} onChange={(e) => update("employeeId", e.target.value)} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500" />
      </div>
      <button onClick={() => onSubmit(formData)} disabled={isLoading} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        {isLoading ? "Creating..." : "Create User"}
      </button>
    </div>
  )
}
