import Link from "next/link"
import type { ReactNode } from "react"

/** One ruled strip of figures. Columns: 2, then 4 from 760px. */
export function StatGrid({
  variant,
  children,
}: {
  /** "five" (2 → 3 → 5 columns) or "three" (2 → 3). */
  variant?: "five" | "three"
  children: ReactNode
}) {
  const cls = variant === "five" ? " five" : variant === "three" ? " stat-grid-3" : ""
  return <div className={`stat-grid${cls}`}>{children}</div>
}

interface StatTileProps {
  label: string
  value: ReactNode
  sub?: ReactNode
  /** Tiles link to the list behind the number when there is one. */
  href?: string
  onClick?: () => void
  /** Red value. Only when the number is non-zero and bad. */
  bad?: boolean
}

export function StatTile({ label, value, sub, href, onClick, bad }: StatTileProps) {
  const cls = `stat-tile${bad ? " tone-bad" : ""}${!href && !onClick ? " static" : ""}`
  const body = (
    <>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub !== undefined && sub !== null && <span className="stat-sub">{sub}</span>}
    </>
  )
  if (href) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} style={{ textAlign: "start" }}>
        {body}
      </button>
    )
  }
  return <div className={cls}>{body}</div>
}
