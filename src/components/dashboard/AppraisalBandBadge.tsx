import type { AppraisalBand } from "@prisma/client"
import { BandChip } from "@/components/ui/StatusChip"

export function AppraisalBandBadge({ band, small = false }: { band: AppraisalBand; small?: boolean }) {
  return <BandChip band={band} small={small} />
}
