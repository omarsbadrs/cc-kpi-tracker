"use client"

import Link from "next/link"
import {
  AlertCircle,
  Award,
  Bell,
  CircleCheck,
  CircleX,
  ClipboardList,
  Clock,
  type LucideIcon,
} from "lucide-react"
import { useNotifications, useMarkAllRead } from "@/hooks/useNotifications"
import { PageHead } from "@/components/ui/PageHead"
import { StatusChip } from "@/components/ui/StatusChip"
import { useToast } from "@/components/ui/Toast"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { EmptyState } from "@/components/shared/EmptyState"
import "@/styles/views/account.css"

interface NotificationItem {
  id: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  type: string
  link?: string | null
}

/** Row icon by notification type; anything new falls back to the bell. */
const TYPE_ICONS: Record<string, LucideIcon> = {
  KPI_ASSIGNED: ClipboardList,
  DEADLINE_REMINDER: Clock,
  SCORE_PUBLISHED: Award,
  ACTUAL_APPROVED: CircleCheck,
  ACTUAL_REJECTED: CircleX,
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })

/** "Just now", "5 minutes ago", "yesterday"; a date after a week. */
function timeAgo(iso: string): string {
  const then = new Date(iso)
  const seconds = (then.getTime() - Date.now()) / 1000
  const abs = Math.abs(seconds)
  if (abs < 60) return "Just now"
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute")
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), "hour")
  if (abs < 7 * 86400) return relative.format(Math.round(seconds / 86400), "day")
  return then.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

function NotificationRow({ n }: { n: NotificationItem }) {
  const Icon = TYPE_ICONS[n.type] ?? Bell
  const className = `doc-row notif-row${n.isRead ? "" : " unread"}`

  const body = (
    <>
      <span className="doc-row-ic">
        <Icon size={17} strokeWidth={1.6} aria-hidden="true" />
      </span>
      <span className="doc-row-main">
        <span className="doc-row-title">{n.title}</span>
        <span className="doc-row-sub">{n.message}</span>
      </span>
      <span className="doc-row-end">
        <time className="notif-time" dateTime={n.createdAt} title={new Date(n.createdAt).toLocaleString()}>
          {timeAgo(n.createdAt)}
        </time>
        {!n.isRead && (
          <StatusChip tone="info" small>
            New
          </StatusChip>
        )}
      </span>
    </>
  )

  if (n.link) {
    return (
      <Link href={n.link} className={className}>
        {body}
      </Link>
    )
  }
  return <div className={`${className} is-static`}>{body}</div>
}

export default function NotificationsPage() {
  const { data, isLoading, isError } = useNotifications()
  const markAllRead = useMarkAllRead()
  const toast = useToast()

  const notifications: NotificationItem[] = data ?? []
  const unread = notifications.filter((n) => !n.isRead).length
  const count = notifications.length

  function handleMarkAllRead() {
    // Busy, not unavailable: the button keeps focus, so guard a second run.
    if (markAllRead.isPending) return
    markAllRead.mutate(undefined, {
      onSuccess: () => toast("All marked as read"),
      onError: () => toast("Could not mark as read. Check your connection", { icon: "alert" }),
    })
  }

  const sub = isLoading
    ? undefined
    : count === 0
      ? "Nothing new"
      : unread > 0
        ? `${unread} unread`
        : "Nothing unread"

  return (
    <>
      <PageHead
        title="Notifications"
        sub={sub}
        actions={
          count > 0 ? (
            <button
              type="button"
              className="btn"
              onClick={handleMarkAllRead}
              disabled={unread === 0}
              title={unread === 0 ? "Everything is already read" : undefined}
              aria-disabled={markAllRead.isPending || undefined}
            >
              {markAllRead.isPending ? "Marking…" : "Mark all as read"}
            </button>
          ) : undefined
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : isError ? (
        <div className="card-list">
          <EmptyState
            icon={AlertCircle}
            title="Could not load notifications"
            description="Check your connection, then reload the page."
          />
        </div>
      ) : count === 0 ? (
        <div className="card-list">
          <EmptyState
            icon={Bell}
            title="You're all caught up"
            description="KPI assignments, deadline reminders and published scores will show up here."
          />
        </div>
      ) : (
        <section className="card list-card" aria-label="Notifications">
          <div className="card-head">
            <h2 className="card-title">Latest</h2>
          </div>
          <div className="doc-list">
            {notifications.map((n) => (
              <NotificationRow key={n.id} n={n} />
            ))}
          </div>
          <div className="list-foot">
            <span>
              {count === 1 ? "1 notification" : `${count} notifications`}
            </span>
            <span>{unread === 1 ? "1 unread" : `${unread} unread`}</span>
          </div>
        </section>
      )}
    </>
  )
}
