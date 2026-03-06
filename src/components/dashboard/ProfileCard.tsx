"use client"

import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { TIER_LABELS, ROLE_LABELS } from "@/lib/constants"
import type { Role, Tier } from "@prisma/client"

interface MeData {
  firstName: string
  lastName: string
  email: string
  role: Role
  tier: Tier
  jobTitle: string | null
  avatarUrl: string | null
  employeeId: string | null
  graduationYear: number | null
  functionProject: string | null
  department: { name: string } | null
}

export function ProfileCard({ periodName }: { periodName?: string }) {
  const { data: session } = useSession()

  const { data: me } = useQuery<MeData>({
    queryKey: ["users", "me"],
    queryFn: async () => {
      const res = await fetch("/api/users/me")
      if (!res.ok) throw new Error("Failed")
      const json = await res.json()
      return json.data
    },
  })

  const firstName = me?.firstName || session?.user?.firstName || "User"
  const lastName = me?.lastName || session?.user?.lastName || ""
  const role = me?.role || session?.user?.role || "USER"
  const tier = me?.tier || session?.user?.tier || "ENGINEER"
  const jobTitle = me?.jobTitle || TIER_LABELS[tier]
  const avatarUrl = me?.avatarUrl || session?.user?.avatarUrl
  const email = me?.email || session?.user?.email || ""
  const functionProject = me?.functionProject
  const employeeId = me?.employeeId
  const graduationYear = me?.graduationYear
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()

  return (
    <div className="glass-card animate-card-in w-full p-5">
      <div className="flex items-center gap-5">
        {/* Avatar */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={`${firstName} ${lastName}`}
            className="h-16 w-16 rounded-2xl object-cover ring-2 ring-border"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/80 to-purple-600/80 text-xl font-bold text-white ring-2 ring-border">
            {initials}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground tracking-tight truncate">
            {firstName} {lastName}
          </h1>
          <p className="text-sm text-foreground-muted mt-0.5 truncate">{jobTitle}</p>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            {employeeId && (
              <span className="profile-badge profile-badge-id">
                #{employeeId}
              </span>
            )}
            <span className="profile-badge profile-badge-role">
              {ROLE_LABELS[role]}
            </span>
            <span className="profile-badge profile-badge-tier">
              {tier.replace("_", " ")}
            </span>
            {email && (
              <span className="profile-badge profile-badge-dept">
                {email}
              </span>
            )}
            {graduationYear && (
              <span className="profile-badge profile-badge-period">
                Grad {graduationYear}
              </span>
            )}
            {functionProject && (
              <span className="profile-badge profile-badge-dept">
                {functionProject}
              </span>
            )}
            {periodName && (
              <span className="profile-badge profile-badge-period">
                {periodName}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
