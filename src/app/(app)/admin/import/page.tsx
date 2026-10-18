"use client"

import { Upload } from "lucide-react"
import { PageHead } from "@/components/ui/PageHead"
import { EmptyState } from "@/components/shared/EmptyState"

export default function ImportPage() {
  return (
    <>
      <PageHead title="Data import" sub="Import historical KPI actuals from CSV files" />
      <section className="card">
        <EmptyState
          icon={Upload}
          title="CSV import is coming soon"
          description="Bulk import of historical actuals arrives in a future update. For the current period, use the standard submission flow."
        />
      </section>
    </>
  )
}
