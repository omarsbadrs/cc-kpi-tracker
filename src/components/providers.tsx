"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SessionProvider } from "next-auth/react"
import { useState, useEffect, useCallback, useMemo, createContext, useContext, type ReactNode } from "react"

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
    setState({ theme: initial, mounted: true })
  }, [])

  const toggleTheme = useCallback(() => {
    setState((prev) => {
      const next = prev.theme === "dark" ? "light" : "dark"
      localStorage.setItem("theme", next)
      document.documentElement.classList.toggle("dark", next === "dark")
      return { ...prev, theme: next }
    })
  }, [])

  const contextValue = useMemo(() => ({ theme: state.theme, toggleTheme }), [state.theme, toggleTheme])

  if (!state.mounted) {
    return <div className="dark">{children}</div>
  }

  return (
    <ThemeContext.Provider value={contextValue}>
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
