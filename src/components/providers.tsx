"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SessionProvider } from "next-auth/react"
import { useState, useEffect, createContext, useContext, type ReactNode } from "react"

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

type Theme = "dark" | "light"

const ThemeContext = createContext<{
  theme: Theme
  toggleTheme: () => void
}>({
  theme: "dark",
  toggleTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ theme: Theme; mounted: boolean }>({
    theme: "dark",
    mounted: false,
  })

  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null
    const initial = stored || "dark"
    document.documentElement.classList.toggle("dark", initial === "dark")
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration: read localStorage once on mount
    setState({ theme: initial, mounted: true })
  }, [])

  const toggleTheme = () => {
    const next = state.theme === "dark" ? "light" : "dark"
    setState((prev) => ({ ...prev, theme: next }))
    localStorage.setItem("theme", next)
    document.documentElement.classList.toggle("dark", next === "dark")
  }

  if (!state.mounted) {
    return <div className="dark">{children}</div>
  }

  return (
    <ThemeContext.Provider value={{ theme: state.theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// ─────────────────────────────────────
// Combined Providers
// ─────────────────────────────────────

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>{children}</ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}
