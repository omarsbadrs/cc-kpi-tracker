"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SessionProvider } from "next-auth/react"
import { useState, useEffect, useCallback, useMemo, createContext, useContext, type ReactNode } from "react"
import { applyTheme, readThemeMode, resolveTheme, type ResolvedTheme, type ThemeMode } from "@/lib/theme"
import { ToastProvider } from "@/components/ui/Toast"

// ─────────────────────────────────────
// Query Provider
// ─────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        retry: 2,
        refetchOnWindowFocus: true,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

// ─────────────────────────────────────
// Theme Provider
// ─────────────────────────────────────

interface ThemeContextValue {
  /** The user's choice. */
  mode: ThemeMode
  /** What is on screen now ("system" resolved). */
  theme: ResolvedTheme
  setMode: (mode: ThemeMode) => void
  /** Flips between light and dark, leaving "system". */
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "system",
  theme: "light",
  setMode: () => {},
  toggleTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

function ThemeProvider({ children }: { children: ReactNode }) {
  // The boot script in <head> already stamped data-theme; this only mirrors it.
  const [mode, setModeState] = useState<ThemeMode>("system")
  const [theme, setTheme] = useState<ResolvedTheme>("light")

  useEffect(() => {
    const initial = readThemeMode()
    setModeState(initial)
    setTheme(resolveTheme(initial))
  }, [])

  // While following the system, follow it live.
  useEffect(() => {
    if (mode !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => setTheme(applyTheme("system"))
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [mode])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    setTheme(applyTheme(next))
  }, [])

  const toggleTheme = useCallback(() => {
    setMode(theme === "dark" ? "light" : "dark")
  }, [theme, setMode])

  const value = useMemo(() => ({ mode, theme, setMode, toggleTheme }), [mode, theme, setMode, toggleTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// ─────────────────────────────────────
// Combined Providers
// ─────────────────────────────────────

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}
