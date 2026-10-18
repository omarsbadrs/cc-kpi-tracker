import type { Tone } from "@/lib/constants"

const TONES = {
  default: "info",
  success: "ok",
  warning: "warn",
  danger: "bad",
  neutral: "neutral",
} as const satisfies Record<string, Tone>

interface BadgeProps {
  children: React.ReactNode
  variant?: keyof typeof TONES
  className?: string
}

/** A small status chip (dot + word). Prefer StatusChip in new code. */
export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span className={`status-chip small tone-${TONES[variant]}${className ? ` ${className}` : ""}`}>{children}</span>
  )
}
