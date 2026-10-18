// Theme: the user's choice ("light" | "dark" | "system") lives in
// localStorage; the resolved theme is stamped on <html data-theme>, which is
// what the design-system tokens and Tailwind's `dark:` variant read.

export type ThemeMode = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

export const THEME_STORAGE_KEY = "cc-kpi:theme"

export const PAGE_COLORS: Record<ResolvedTheme, string> = {
  light: "#f4f4f6",
  dark: "#0d0d10",
}

/** Desktop sidebar: "collapsed" (icon rail) or "expanded". */
export const SIDEBAR_STORAGE_KEY = "cc-kpi:sidebar"
/** JSON map of nav group id → true when that group is folded. */
export const NAV_GROUPS_STORAGE_KEY = "cc-kpi:nav-closed"

// Runs inline in <head>, before React, so it must stay dependency-free. It
// stamps both the theme and the sidebar state so neither flashes on load.
export const THEME_BOOT_SCRIPT = `(function(){var r=document.documentElement;try{var m=localStorage.getItem("${THEME_STORAGE_KEY}");if(m!=="light"&&m!=="dark")m="system";var d=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);r.setAttribute("data-theme",d?"dark":"light");}catch(e){}try{r.setAttribute("data-sidebar",localStorage.getItem("${SIDEBAR_STORAGE_KEY}")==="collapsed"?"collapsed":"expanded");}catch(e){}})();`

export function readThemeMode(): ThemeMode {
  try {
    const m = localStorage.getItem(THEME_STORAGE_KEY)
    return m === "light" || m === "dark" ? m : "system"
  } catch {
    return "system"
  }
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode !== "system") return mode
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function applyTheme(mode: ThemeMode): ResolvedTheme {
  const resolved = resolveTheme(mode)
  document.documentElement.setAttribute("data-theme", resolved)
  try {
    if (mode === "system") localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute("content", PAGE_COLORS[resolved])
  })
  return resolved
}
