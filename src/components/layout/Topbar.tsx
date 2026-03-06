"use client"

import { useSession } from "next-auth/react"
import { ThemeToggle } from "./ThemeToggle"
import { NotificationBell } from "./NotificationBell"
import { UserMenu } from "./UserMenu"

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { data: session } = useSession()

  return (
    <header className="ca-topbar sticky top-0 z-30 flex h-16 items-center justify-between px-5 lg:px-6">
      {/* Left: hamburger + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="ca-topbar-btn lg:hidden"
          aria-label="Toggle sidebar"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Cost Control Department KPI Tracker
        </h1>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        <NotificationBell />
        <ThemeToggle />
        {session?.user && <UserMenu />}
      </div>
    </header>
  )
}
