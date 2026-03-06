interface StatCardProps {
  label: string
  value: string | number
  subtitle?: string
  color?: string
  icon?: React.ReactNode
}

export function StatCard({ label, value, subtitle, color, icon }: StatCardProps) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="label-xs">{label}</p>
          <p
            className="mt-2 metric-lg"
            style={color ? { color } : undefined}
          >
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-foreground-muted">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="text-2xl text-foreground-muted">{icon}</div>
        )}
      </div>
    </div>
  )
}
