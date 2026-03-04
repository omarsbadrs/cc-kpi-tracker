"use client"

import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"

export default function ImportPage() {
  return (
    <div>
      <PageHeader
        title="Data Import"
        description="Import historical KPI actuals from CSV files"
      />
      <EmptyState
        title="CSV Import"
        description="Bulk import functionality for historical actuals will be available in a future update. Use the standard submission flow for current period data."
      />
    </div>
  )
}
