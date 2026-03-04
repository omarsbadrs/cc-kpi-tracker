"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function usePeriods() {
  return useQuery({
    queryKey: queryKeys.periods.all,
    queryFn: async () => {
      const res = await fetch("/api/periods")
      if (!res.ok) throw new Error("Failed to fetch periods")
      const json = await res.json()
      return json.data
    },
  })
}

export function useActivePeriod() {
  return useQuery({
    queryKey: queryKeys.periods.active,
    queryFn: async () => {
      const res = await fetch("/api/periods")
      if (!res.ok) throw new Error("Failed to fetch periods")
      const json = await res.json()
      const periods = json.data as Array<{ id: string; name: string; isActive: boolean; isClosed: boolean }>
      return periods.find((p) => p.isActive && !p.isClosed) || periods[0] || null
    },
  })
}
