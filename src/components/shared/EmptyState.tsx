import { Inbox, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

interface EmptyStateProps {
  title: string
  description?: ReactNode
  action?: ReactNode
  icon?: LucideIcon
}

/** A bare 22px icon, a title and one helpful sentence. */
export function EmptyState({ title, description, action, icon: Icon = Inbox }: EmptyStateProps) {
  return (
    <div className="empty">
      <Icon size={22} strokeWidth={1.6} aria-hidden="true" className="empty-icon" />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div className="empty-actions">{action}</div>}
    </div>
  )
}
