"use client"

import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { TIER_LABELS, ROLE_LABELS } from "@/lib/constants"

export default function ProfilePage() {
  const { data: session } = useSession()
  const { data: profile, isLoading } = useQuery({
    queryKey: ["users", "me"],
    queryFn: async () => {
      const res = await fetch("/api/users/me")
      if (!res.ok) throw new Error("Failed to fetch profile")
      return (await res.json()).data
    },
  })

  if (isLoading) return <LoadingSpinner />

  const user = profile || session?.user

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profile" />

      <div className="rounded-xl border border-card-border bg-card-bg p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {user?.firstName} {user?.lastName}
            </h2>
            <p className="text-sm text-foreground-muted">{user?.email}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: "Role", value: ROLE_LABELS[user?.role as keyof typeof ROLE_LABELS] || user?.role },
            { label: "Tier", value: TIER_LABELS[user?.tier as keyof typeof TIER_LABELS] || user?.tier },
            { label: "Job Title", value: user?.jobTitle || "—" },
            { label: "Employee ID", value: user?.employeeId || "—" },
            { label: "Department", value: profile?.department?.name || "—" },
            { label: "Company", value: profile?.company?.name || "—" },
            { label: "Nationality", value: user?.nationality || "—" },
            { label: "Last Login", value: user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "—" },
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
