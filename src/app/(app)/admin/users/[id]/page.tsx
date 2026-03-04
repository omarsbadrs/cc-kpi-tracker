"use client"

import { useParams } from "next/navigation"
import { useUserDetail } from "@/hooks/useTeam"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { TIER_LABELS, ROLE_LABELS } from "@/lib/constants"

export default function AdminUserDetailPage() {
  const { id } = useParams() as { id: string }
  const { data: user, isLoading } = useUserDetail(id)

  if (isLoading) return <LoadingSpinner />
  if (!user) return <div className="py-12 text-center text-foreground-muted">User not found</div>

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={`${user.firstName} ${user.lastName}`}
        description={user.email}
      />

      <div className="rounded-xl border border-card-border bg-card-bg p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: "Role", value: ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] },
            { label: "Tier", value: TIER_LABELS[user.tier as keyof typeof TIER_LABELS] },
            { label: "Job Title", value: user.jobTitle || "—" },
            { label: "Employee ID", value: user.employeeId || "—" },
            { label: "Status", value: user.isActive ? "Active" : "Inactive" },
            { label: "Last Login", value: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never" },
          ].map((field) => (
            <div key={field.label}>
              <p className="text-xs font-medium text-foreground-muted">{field.label}</p>
              <p className="mt-1 text-sm text-foreground">{field.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
