"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useKpiDefinitions() {
  return useQuery({
    queryKey: queryKeys.kpis.definitions,
    queryFn: async () => {
      const res = await fetch("/api/kpis?pageSize=100")
      if (!res.ok) throw new Error("Failed to fetch KPI definitions")
      const json = await res.json()
      return json.data
    },
  })
}

export function useMyAssignments(periodId?: string) {
  return useQuery({
    queryKey: queryKeys.kpis.assignments("me", periodId || ""),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (periodId) params.set("evalPeriodId", periodId)
      const res = await fetch(`/api/kpis/assignments?${params}`)
      if (!res.ok) throw new Error("Failed to fetch assignments")
      const json = await res.json()
      return json.data
    },
    enabled: !!periodId,
  })
}

export function useMyActuals(periodId?: string) {
  return useQuery({
    queryKey: queryKeys.kpis.actuals("me", periodId || ""),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (periodId) params.set("evalPeriodId", periodId)
      const res = await fetch(`/api/kpis/actuals?${params}`)
      if (!res.ok) throw new Error("Failed to fetch actuals")
      const json = await res.json()
      return json.data
    },
    enabled: !!periodId,
  })
}

export function useSubmitActual() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      assignmentId: string
      evalPeriodId: string
      actualValue?: number
      binaryValue?: boolean
    }) => {
      const res = await fetch("/api/kpis/actuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || "Submission failed")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpis", "actuals"] })
      queryClient.invalidateQueries({ queryKey: ["scoring"] })
    },
  })
}

export function useReviewActual() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string
      status: "APPROVED" | "REJECTED"
      reviewComment?: string
    }) => {
      const res = await fetch(`/api/kpis/actuals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Review failed")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpis", "actuals"] })
    },
  })
}
