import type { ReactNode } from "react"
import { ACTUAL_STATUS, APPRAISAL_BANDS, type Tone } from "@/lib/constants"
import type { AppraisalBand } from "@prisma/client"

/** Dot + word in a 9% tint of its tone. Status is never colour alone. */
export function StatusChip({
  tone = "neutral",
  small = false,
  children,
}: {
  tone?: Tone
  small?: boolean
  children: ReactNode
}) {
  return <span className={`status-chip tone-${tone}${small ? " small" : ""}`}>{children}</span>
}

/** DRAFT / SUBMITTED / APPROVED / REJECTED. */
export function ActualStatusChip({ status, small = true }: { status: string; small?: boolean }) {
  const meta = ACTUAL_STATUS[status] ?? { label: status.charAt(0) + status.slice(1).toLowerCase(), tone: "neutral" as Tone }
  return (
    <StatusChip tone={meta.tone} small={small}>
      {meta.label}
    </StatusChip>
  )
}

export function BandChip({ band, small = false }: { band: AppraisalBand; small?: boolean }) {
  const info = APPRAISAL_BANDS[band]
  return (
    <StatusChip tone={info.tone} small={small}>
      {info.label}
    </StatusChip>
  )
}

/** A count or qualifier beside a heading. No dot. */
export function TagPill({ children }: { children: ReactNode }) {
  return <span className="tag-pill">{children}</span>
}
