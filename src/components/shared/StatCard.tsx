interface StatCardProps {
  label: string
  value: string | number
  subtitle?: string
  /** Kept for old call sites; the value is always ink. */
  color?: string
  icon?: React.ReactNode
}

/** A single figure on its own card. Inside a row of figures, use StatGrid. */
export function StatCard({ label, value, subtitle }: StatCardProps) {
  return (
    <div className="card">
      <div className="kv">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
        {subtitle && <span className="stat-sub">{subtitle}</span>}
      </div>
    </div>
  )
}
