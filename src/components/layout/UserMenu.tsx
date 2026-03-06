"use client"

import { signOut, useSession } from "next-auth/react"
import { useState, useRef, useEffect } from "react"
import Link from "next/link"

export function UserMenu() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (!session?.user) return null

  const initials = `${session.user.firstName[0]}${session.user.lastName[0]}`

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
        style={{
          background: "linear-gradient(135deg, #f59e0b, #ef4444)",
          color: "#fff",
        }}
        aria-label="User menu"
        aria-expanded={isOpen}
      >
        {initials}
      </button>

      {isOpen && (
        <div className="dropdown-menu absolute right-0 mt-2 w-56">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              {session.user.firstName} {session.user.lastName}
            </p>
            <p className="text-xs text-foreground-muted">{session.user.email}</p>
          </div>
          <div className="p-1.5">
            <Link
              href="/profile"
              onClick={() => setIsOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm text-foreground-secondary hover:bg-card-hover transition-colors"
            >
              Profile
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full rounded-xl px-3 py-2 text-left text-sm text-red-400 hover:bg-card-hover transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
