interface StatCardProps {
  label: string
  value: string | number
  subtitle?: string
  color?: string
  icon?: React.ReactNode
}

export function StatCard({ label, value, subtitle, color, icon }: StatCardProps) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-5 transition-colors hover:bg-card-hover">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-foreground-muted">{label}</p>
          <p
            className="mt-1 text-2xl font-bold"
            style={color ? { color } : undefined}
          >
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-foreground-muted">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="text-2xl">{icon}</div>
        )}
      </div>
    </div>
  )
}
