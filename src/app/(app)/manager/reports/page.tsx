"use client"

import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Export department performance reports"
      />
      <EmptyState
        title="Coming Soon"
        description="PDF and Excel export functionality will be available in a future update."
      />
    </div>
  )
}
