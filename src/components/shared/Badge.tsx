import { cn } from "@/lib/utils"

const variants = {
  default: "bg-blue-500/10 text-blue-400 border-blue-500/15",
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/15",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/15",
  danger: "bg-red-500/10 text-red-400 border-red-500/15",
  neutral: "bg-foreground-muted/10 text-foreground-muted border-foreground-muted/10",
}

interface BadgeProps {
  children: React.ReactNode
  variant?: keyof typeof variants
  className?: string
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-semibold",
      variants[variant],
      className
    )}>
      {children}
    </span>
  )
}
