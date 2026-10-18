"use client"

import { ListChecks } from "lucide-react"
import { PILLARS } from "@/lib/constants"
import { TagPill } from "@/components/ui/StatusChip"
import { PillarTag } from "@/components/ui/KpiMarks"
import { EmptyState } from "@/components/shared/EmptyState"
import { KpiTableHead, KpiTableRow, kpiCountLabel, type KpiRow } from "@/components/dashboard/KpiStatusGrid"
import type { PillarCode } from "@/types"

interface PillarKpiDetailProps {
  pillarCode: PillarCode
  kpis: KpiRow[]
  onKpiClick?: (code: string) => void
  /** Target of the pillar tile's aria-controls. */
  id?: string
}

/** The KPIs of the pillar tile that is pressed, as a list card. */
export function PillarKpiDetail({ pillarCode, kpis, onKpiClick, id }: PillarKpiDetailProps) {
  const pillar = PILLARS[pillarCode]
  if (!pillar) return null

  const titleId = `pillar-${pillarCode}-detail-title`

  return (
    <section id={id} className="card list-card" aria-labelledby={titleId}>
      <div className="card-head">
        <div className="row min-w-0">
          <PillarTag code={pillarCode} big />
          <h2 className="card-title min-w-0" id={titleId}>
            {pillar.name}
          </h2>
        </div>
        <TagPill>{kpis.length === 0 ? "None assigned" : `${kpiCountLabel(kpis.length)} assigned`}</TagPill>
      </div>

      {kpis.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No KPIs assigned for this pillar"
          description="KPIs in this pillar appear here once they are assigned to you for the period."
        />
      ) : (
        <div className="table-scroll" tabIndex={0} role="region" aria-label={`${pillar.name} KPIs`}>
          <table className="data-table">
            <KpiTableHead />
            <tbody>
              {kpis.map((kpi) => (
                <KpiTableRow key={kpi.code} kpi={kpi} onClick={onKpiClick} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
