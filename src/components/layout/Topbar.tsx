"use client"

import { useSession } from "next-auth/react"
import { ThemeToggle } from "./ThemeToggle"
import { UserMenu } from "./UserMenu"
import { TIER_LABELS } from "@/lib/constants"

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { data: session } = useSession()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-sm lg:px-6">
      {/* Left: menu button + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-foreground-muted hover:bg-card-hover hover:text-foreground lg:hidden"
          aria-label="Toggle sidebar"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Right: theme toggle + user */}
      <div className="flex items-center gap-3">
        <ThemeToggle />
        {session?.user && (
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-foreground">
                {session.user.firstName} {session.user.lastName}
              </p>
              <p className="text-xs text-foreground-muted">
                {TIER_LABELS[session.user.tier] ?? session.user.tier}
              </p>
            </div>
            <UserMenu />
          </div>
        )}
      </div>
    </header>
  )
}
