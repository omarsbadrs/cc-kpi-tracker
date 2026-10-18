"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/providers"

/** Icon button that flips light/dark. Profile has the full Light/Dark/System choice. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const next = theme === "dark" ? "light" : "dark"

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="icon-btn"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {theme === "dark" ? <Sun size={17} strokeWidth={1.7} aria-hidden="true" /> : <Moon size={17} strokeWidth={1.7} aria-hidden="true" />}
    </button>
  )
}
