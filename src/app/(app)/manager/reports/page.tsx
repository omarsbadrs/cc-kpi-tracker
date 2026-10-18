"use client"

import { FileText } from "lucide-react"
import { PageHead } from "@/components/ui/PageHead"
import { EmptyState } from "@/components/shared/EmptyState"

export default function ReportsPage() {
  return (
    <>
      <PageHead title="Reports" sub="Export department performance reports" />
      <div className="card-list">
        <EmptyState
          icon={FileText}
          title="Exports are on the way"
          description="PDF scorecards and Excel department reports will be available in a future update."
        />
      </div>
    </>
  )
}
