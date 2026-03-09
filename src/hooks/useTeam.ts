"use client"

import { useQuery } from "@tanstack/react-query"

/** Returns the hierarchy-aware list of team members.
 *  - ADMIN:   all active users (allUsers from /api/team)
 *  - MANAGER: self + all recursive descendants (active only)
 */
export function useTeamMembers() {
  return useQuery({
    queryKey: ["team", "members"],
    queryFn: async () => {
      const res = await fetch("/api/team")
      if (!res.ok) throw new Error("Failed to fetch team members")
      const json = await res.json()
      // Both ADMIN and MANAGER responses include `allUsers`
      return (json.data?.allUsers ?? []) as {
        id: string
        firstName: string
        lastName: string
        email: string
        role: string
        tier: string
        jobTitle: string | null
        isActive: boolean
        managerId: string | null
        avatarUrl: string | null
        employeeId: string | null
        nationality: string | null
        graduationYear: number | null
        lastLoginAt: string | null
      }[]
    },
  })
}

export function useUserDetail(userId: string) {
  return useQuery({
    queryKey: ["users", userId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}`)
      if (!res.ok) throw new Error("Failed to fetch user")
      const json = await res.json()
      return json.data
    },
    enabled: !!userId,
  })
}
