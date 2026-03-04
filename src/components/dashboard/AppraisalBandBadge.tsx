import { APPRAISAL_BANDS } from "@/lib/constants"
import type { AppraisalBand } from "@prisma/client"

export function AppraisalBandBadge({ band }: { band: AppraisalBand }) {
  const info = APPRAISAL_BANDS[band]
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
      style={{ backgroundColor: info.color + "20", color: info.color }}
    >
      {info.label}
    </span>
  )
}
