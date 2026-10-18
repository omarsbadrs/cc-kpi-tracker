"use client"

import "@/styles/views/dashboard.css"
import type { ReactNode } from "react"
import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { TIER_LABELS, ROLE_LABELS } from "@/lib/constants"
import { UserAvatar } from "@/components/layout/UserMenu"
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

export interface ProfileFact {
  label: string
  value: ReactNode
}

/** "TEAM_LEAD" → "Team lead". */
export function tierWord(tier: string): string {
  const words = tier.toLowerCase().replace(/_/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * Avatar + heading + one line, then label-over-value facts under a rule.
 * Shared by the personal dashboard and a manager's member drill-down.
 */
export function ProfileSummary({
  firstName,
  lastName,
  avatarUrl,
  heading,
  sub,
  facts,
}: {
  firstName?: string | null
  lastName?: string | null
  avatarUrl?: string | null
  heading: ReactNode
  sub?: ReactNode
  facts: ProfileFact[]
}) {
  return (
    <section className="card profile-card" aria-label="Profile">
      <div className="client-head">
        <UserAvatar firstName={firstName} lastName={lastName} avatarUrl={avatarUrl} big />
        <div>
          <h2 className="profile-name">{heading}</h2>
          {sub && <p className="profile-sub">{sub}</p>}
        </div>
      </div>
      {facts.length > 0 && (
        <dl className="kv-grid">
          {facts.map((f) => (
            <div key={f.label} className="kv">
              <dt className="kv-label">{f.label}</dt>
              <dd className="kv-value">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
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

  const facts: ProfileFact[] = []
  if (employeeId) facts.push({ label: "Employee ID", value: <span className="tabular">#{employeeId}</span> })
  facts.push({ label: "Role", value: ROLE_LABELS[role] })
  facts.push({ label: "Tier", value: tierWord(tier) })
  if (email) facts.push({ label: "Email", value: email })
  if (graduationYear) facts.push({ label: "Graduated", value: <span className="tabular">{graduationYear}</span> })
  if (functionProject) facts.push({ label: "Function or project", value: functionProject })
  if (periodName) facts.push({ label: "Period", value: periodName })

  return (
    <ProfileSummary
      firstName={firstName}
      lastName={lastName}
      avatarUrl={avatarUrl}
      heading={`${firstName} ${lastName}`.trim()}
      sub={jobTitle}
      facts={facts}
    />
  )
}
