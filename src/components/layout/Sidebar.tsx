"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { signOut, useSession } from "next-auth/react"
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen, UserRound } from "lucide-react"
import { navForRole, isActive } from "./nav"
import { ThemeToggle } from "./ThemeToggle"
import { useUnreadCount } from "@/hooks/useNotifications"
import { UserAvatar } from "./UserMenu"
import { NAV_GROUPS_STORAGE_KEY, SIDEBAR_STORAGE_KEY } from "@/lib/theme"

function readClosedGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(NAV_GROUPS_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

/**
 * Desktop navigation panel (≥ 900px). Phones use the TabBar instead.
 * It folds to a 64px icon rail (state stamped on <html data-sidebar> before
 * paint), and each section folds on its own heading.
 */
export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const user = session?.user
  const groups = navForRole(user?.role)
  const { data: unread } = useUnreadCount()
  const unreadCount = typeof unread === "number" ? unread : 0

  const [collapsed, setCollapsed] = useState(false)
  const [closed, setClosed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setCollapsed(document.documentElement.getAttribute("data-sidebar") === "collapsed")
    setClosed(readClosedGroups())
  }, [])

  const toggleSidebar = useCallback(() => {
    setCollapsed((was) => {
      const next = !was
      document.documentElement.setAttribute("data-sidebar", next ? "collapsed" : "expanded")
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "collapsed" : "expanded")
      } catch {
        // Storage blocked: the choice lasts for this page only.
      }
      return next
    })
  }, [])

  const toggleGroup = useCallback((id: string) => {
    setClosed((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      try {
        localStorage.setItem(NAV_GROUPS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Storage blocked: fine, it just won't be remembered.
      }
      return next
    })
  }, [])

  // Arriving on a page inside a folded section opens that section, so the
  // "you are here" mark is never hidden.
  useEffect(() => {
    const holder = groups.find((g) => g.items.some((i) => isActive(pathname, i.href)))
    if (holder && closed[holder.id]) toggleGroup(holder.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const collapseLabel = collapsed ? "Expand sidebar" : "Collapse sidebar"

  return (
    <aside className="sidebar" aria-label="Main">
      <div className="brand">
        <img src="/logo-light.svg" alt="Elsewedy Electric PSP" className="brand-logo brand-logo-light" />
        <img src="/logo.svg" alt="" aria-hidden="true" className="brand-logo brand-logo-dark" />
        <span className="brand-spacer" />
        <ThemeToggle />
        <button
          type="button"
          className="icon-btn sidebar-toggle"
          onClick={toggleSidebar}
          aria-label={collapseLabel}
          title={collapseLabel}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <PanelLeftOpen size={17} strokeWidth={1.7} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={17} strokeWidth={1.7} aria-hidden="true" />
          )}
        </button>
      </div>

      {user && (
        <div className="side-account" title={collapsed ? `${user.firstName} ${user.lastName}` : undefined}>
          <UserAvatar firstName={user.firstName} lastName={user.lastName} avatarUrl={user.avatarUrl} />
          <div className="side-account-main">
            <span className="name">
              {user.firstName} {user.lastName}
            </span>
            <span className="sub">{user.email}</span>
          </div>
        </div>
      )}

      <nav className="side-nav" aria-label="Sections">
        {groups.map((group) => {
          const isClosed = !collapsed && !!closed[group.id]
          const holdsActive = group.items.some((i) => isActive(pathname, i.href))
          const listId = `nav-list-${group.id}`
          return (
            <div key={group.id} className="nav-group" role="group" aria-labelledby={`nav-${group.id}`}>
              <button
                type="button"
                id={`nav-${group.id}`}
                className="nav-group-label nav-group-toggle"
                aria-expanded={!isClosed}
                aria-controls={listId}
                onClick={() => toggleGroup(group.id)}
              >
                <span>{group.label}</span>
                {isClosed && holdsActive && <span className="nav-group-dot" aria-label="Contains the current page" />}
                <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" className="nav-group-chev" />
              </button>
              <div id={listId} className="nav-group-items" hidden={isClosed}>
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href)
                  const Icon = item.icon
                  const badge = item.href === "/notifications" && unreadCount > 0 ? unreadCount : 0
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav-item${active ? " active" : ""}`}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
                      <span>{item.label}</span>
                      {badge > 0 && (
                        <span className="nav-badge" role="img" aria-label={`${badge} unread`} title={`${badge} unread`}>
                          {badge > 9 ? "9+" : badge}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="side-foot">
        <Link
          href="/profile"
          className={`nav-item${isActive(pathname, "/profile") ? " active" : ""}`}
          aria-current={isActive(pathname, "/profile") ? "page" : undefined}
          title={collapsed ? "Profile" : undefined}
        >
          <UserRound size={17} strokeWidth={1.7} aria-hidden="true" />
          <span>Profile</span>
        </Link>
        <button
          type="button"
          className="nav-item"
          onClick={() => signOut({ callbackUrl: "/login" })}
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut size={17} strokeWidth={1.7} aria-hidden="true" />
          <span>Sign out</span>
        </button>
        <p className="side-credit">Cost Control Dept. · Omar Badr</p>
      </div>
    </aside>
  )
}
