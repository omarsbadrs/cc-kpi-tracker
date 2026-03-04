"use client"

import { useNotifications, useMarkAllRead } from "@/hooks/useNotifications"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { EmptyState } from "@/components/shared/EmptyState"

export default function NotificationsPage() {
  const { data: notifications, isLoading } = useNotifications()
  const markAllRead = useMarkAllRead()

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Notifications"
        action={
          notifications?.length > 0 ? (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground-secondary hover:bg-card-hover"
            >
              Mark all read
            </button>
          ) : undefined
        }
      />

      {!notifications?.length ? (
        <EmptyState title="No notifications" description="You're all caught up!" />
      ) : (
        <div className="space-y-2">
          {notifications.map((n: { id: string; title: string; message: string; isRead: boolean; createdAt: string; type: string }) => (
            <div
              key={n.id}
              className={`rounded-xl border p-4 transition-colors ${
                n.isRead
                  ? "border-border bg-card-bg"
                  : "border-blue-500/20 bg-blue-500/5"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="mt-1 text-sm text-foreground-secondary">{n.message}</p>
                </div>
                {!n.isRead && <div className="mt-1 h-2 w-2 rounded-full bg-blue-500" />}
              </div>
              <p className="mt-2 text-xs text-foreground-muted">
                {new Date(n.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
