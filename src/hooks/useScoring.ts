"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useMyScores(periodId?: string) {
  return useQuery({
    queryKey: queryKeys.scoring.results("me", periodId || ""),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (periodId) params.set("evalPeriodId", periodId)
      const res = await fetch(`/api/kpis/scoring?${params}`)
      if (!res.ok) throw new Error("Failed to fetch scores")
      const json = await res.json()
      return json.data
    },
    enabled: !!periodId,
  })
}

export function useUserScores(userId: string, periodId?: string) {
  return useQuery({
    queryKey: queryKeys.scoring.results(userId, periodId || ""),
    queryFn: async () => {
      const params = new URLSearchParams({ userId })
      if (periodId) params.set("evalPeriodId", periodId)
      const res = await fetch(`/api/kpis/scoring?${params}`)
      if (!res.ok) throw new Error("Failed to fetch scores")
      const json = await res.json()
      return json.data
    },
    enabled: !!userId && !!periodId,
  })
}

export function useRunScoring() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { evalPeriodId: string; dryRun?: boolean }) => {
      const res = await fetch("/api/kpis/scoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || "Scoring failed")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scoring"] })
    },
  })
}
