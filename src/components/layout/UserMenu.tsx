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
        className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white hover:bg-blue-700"
        aria-label="User menu"
        aria-expanded={isOpen}
      >
        {initials}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border border-border bg-background-card shadow-lg">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              {session.user.firstName} {session.user.lastName}
            </p>
            <p className="text-xs text-foreground-muted">{session.user.email}</p>
          </div>
          <div className="p-1">
            <Link
              href="/profile"
              onClick={() => setIsOpen(false)}
              className="block rounded-md px-3 py-2 text-sm text-foreground-secondary hover:bg-card-hover"
            >
              Profile
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full rounded-md px-3 py-2 text-left text-sm text-red-400 hover:bg-card-hover"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
