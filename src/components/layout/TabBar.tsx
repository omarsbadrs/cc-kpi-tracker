"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { signOut, useSession } from "next-auth/react"
import { ChevronRight, LogOut, MoreHorizontal, UserRound } from "lucide-react"
import { NAV_GROUPS, navForRole, isActive, tabsForRole, TAB_LABELS } from "./nav"
import { Modal } from "@/components/ui/Modal"
import { useTheme } from "@/components/providers"
import { Segmented } from "@/components/ui/Segmented"
import { useUnreadCount } from "@/hooks/useNotifications"
import type { ThemeMode } from "@/lib/theme"

/** Phone navigation (< 900px): four destinations plus More. */
export function TabBar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = session?.user?.role
  const [moreOpen, setMoreOpen] = useState(false)
  const { mode, setMode } = useTheme()
  const { data: unread } = useUnreadCount()
  const unreadCount = typeof unread === "number" ? unread : 0

  // Navigating closes the sheet.
  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  const allItems = NAV_GROUPS.flatMap((g) => g.items)
  const tabs = tabsForRole(role)
    .map((href) => allItems.find((i) => i.href === href))
    .filter((i): i is NonNullable<typeof i> => !!i)
  const tabHrefs = new Set(tabs.map((t) => t.href))
  const moreGroups = navForRole(role)
    .map((g) => ({ ...g, items: g.items.filter((i) => !tabHrefs.has(i.href)) }))
    .filter((g) => g.items.length > 0)
  const moreActive = !tabs.some((t) => isActive(pathname, t.href))

  return (
    <>
      <nav className="tabbar" aria-label="Main">
        {tabs.map((t) => {
          const Icon = t.icon
          const active = isActive(pathname, t.href)
          const badge = t.href === "/notifications" && unreadCount > 0 ? unreadCount : 0
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`tab-item${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
              {TAB_LABELS[t.href] ?? t.label}
              {badge > 0 && (
                <span className="nav-badge" role="img" aria-label={`${badge} unread`}>
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </Link>
          )
        })}
        <button
          type="button"
          className={`tab-item${moreActive ? " active" : ""}`}
          aria-haspopup="dialog"
          onClick={() => setMoreOpen(true)}
        >
          <MoreHorizontal size={17} strokeWidth={1.7} aria-hidden="true" />
          More
        </button>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        {moreGroups.map((g) => (
          <div key={g.id} className="more-group">
            <h3 className="more-group-label">{g.label}</h3>
            <div className="settings-list">
              {g.items.map((item) => {
                const Icon = item.icon
                const badge = item.href === "/notifications" && unreadCount > 0 ? unreadCount : 0
                return (
                  <Link key={item.href} href={item.href} className="settings-row">
                    <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                    <span className="grow">
                      <span className="title">{item.label}</span>
                      <span className="sub">{item.sub}</span>
                    </span>
                    {badge > 0 && <span className="nav-badge">{badge > 9 ? "9+" : badge}</span>}
                    <ChevronRight size={17} aria-hidden="true" />
                  </Link>
                )
              })}
            </div>
          </div>
        ))}

        <div className="more-group">
          <h3 className="more-group-label">Appearance</h3>
          <Segmented<ThemeMode>
            label="Theme"
            value={mode}
            onChange={setMode}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "System" },
            ]}
          />
        </div>

        <div className="settings-list more-group">
          <Link href="/profile" className="settings-row">
            <UserRound size={18} strokeWidth={1.5} aria-hidden="true" />
            <span className="grow">
              <span className="title">Profile</span>
              <span className="sub">{session?.user?.email}</span>
            </span>
            <ChevronRight size={17} aria-hidden="true" />
          </Link>
          <button type="button" className="settings-row danger" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut size={18} strokeWidth={1.5} aria-hidden="true" />
            <span className="grow">
              <span className="title">Sign out</span>
            </span>
          </button>
        </div>
      </Modal>
    </>
  )
}
