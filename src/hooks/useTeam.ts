"use client"

import { useQuery } from "@tanstack/react-query"

export function useTeamMembers() {
  return useQuery({
    queryKey: ["team", "members"],
    queryFn: async () => {
      const res = await fetch("/api/users?pageSize=100")
      if (!res.ok) throw new Error("Failed to fetch team members")
      const json = await res.json()
      return json.data
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
