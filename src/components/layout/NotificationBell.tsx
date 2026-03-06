"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"
import { useNotifications, useUnreadCount, useMarkAllRead } from "@/hooks/useNotifications"
import { cn } from "@/lib/utils"

interface Notification {
  id: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  type: string
  link?: string
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { data: notifications } = useNotifications()
  const { data: unreadCount } = useUnreadCount()
  const markAllRead = useMarkAllRead()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    if (open) {
      document.addEventListener("keydown", handleEsc)
      return () => document.removeEventListener("keydown", handleEsc)
    }
  }, [open])

  const recent = (notifications as Notification[] | undefined)?.slice(0, 5)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="ca-topbar-btn relative"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.7} />
        {(unreadCount as number) > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {(unreadCount as number) > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="dropdown-menu absolute right-0 top-full mt-2 w-80 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            {(unreadCount as number) > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="text-xs text-foreground-muted hover:text-foreground disabled:opacity-50 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {!recent?.length ? (
              <div className="px-4 py-8 text-center text-sm text-foreground-muted">
                No notifications yet
              </div>
            ) : (
              recent.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-card-hover",
                    !n.isRead && "bg-card-bg"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && (
                      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    )}
                    <div className={cn("min-w-0 flex-1", n.isRead && "pl-4")}>
                      <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-foreground-secondary">{n.message}</p>
                      <p className="mt-1 text-[11px] text-foreground-muted">
                        {formatTimeAgo(n.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-center text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = now - date
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}
