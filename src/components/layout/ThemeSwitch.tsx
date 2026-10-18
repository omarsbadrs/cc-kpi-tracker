"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/providers"

/**
 * Light/dark as a sliding switch: sun at the start, moon at the end, the
 * knob sits on the theme in use. role="switch" with aria-checked = dark.
 */
export function ThemeSwitch() {
  const { theme, setMode } = useTheme()
  const dark = theme === "dark"

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark theme"
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="theme-switch"
      onClick={() => setMode(dark ? "light" : "dark")}
    >
      <Sun size={14} strokeWidth={1.8} aria-hidden="true" className="theme-switch-sun" />
      <Moon size={14} strokeWidth={1.8} aria-hidden="true" className="theme-switch-moon" />
      <span className="theme-switch-knob" aria-hidden="true">
        {dark ? <Moon size={13} strokeWidth={2} /> : <Sun size={13} strokeWidth={2} />}
      </span>
    </button>
  )
}
