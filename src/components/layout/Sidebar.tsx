"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import type { Role } from "@prisma/client"

interface NavItem {
  label: string
  href: string
  icon: string
  roles: Role[]
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "📊", roles: ["USER", "MANAGER", "ADMIN"] },
  { label: "My KPIs", href: "/kpis", icon: "📋", roles: ["USER", "MANAGER", "ADMIN"] },
  { label: "Notifications", href: "/notifications", icon: "🔔", roles: ["USER", "MANAGER", "ADMIN"] },
  { label: "Profile", href: "/profile", icon: "👤", roles: ["USER", "MANAGER", "ADMIN"] },
  // Manager
  { label: "Team Overview", href: "/manager/team", icon: "👥", roles: ["MANAGER", "ADMIN"] },
  { label: "Team Members", href: "/manager/members", icon: "📈", roles: ["MANAGER", "ADMIN"] },
  { label: "Reports", href: "/manager/reports", icon: "📑", roles: ["MANAGER", "ADMIN"] },
  // Admin
  { label: "Users", href: "/admin/users", icon: "🛡️", roles: ["ADMIN"] },
  { label: "KPI Library", href: "/admin/kpi-library", icon: "📚", roles: ["ADMIN"] },
  { label: "Assignments", href: "/admin/assignments", icon: "🎯", roles: ["ADMIN"] },
  { label: "Periods", href: "/admin/periods", icon: "📅", roles: ["ADMIN"] },
  { label: "Scoring", href: "/admin/scoring", icon: "⚙️", roles: ["ADMIN"] },
  { label: "Import", href: "/admin/import", icon: "📥", roles: ["ADMIN"] },
]

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = session?.user?.role

  const filteredItems = navItems.filter(
    (item) => role && item.roles.includes(role)
  )

  // Group nav items
  const mainItems = filteredItems.filter(
    (i) => !i.href.startsWith("/manager") && !i.href.startsWith("/admin")
  )
  const managerItems = filteredItems.filter((i) => i.href.startsWith("/manager"))
  const adminItems = filteredItems.filter((i) => i.href.startsWith("/admin"))

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 flex h-full w-64 flex-col border-r border-border bg-sidebar-bg transition-transform lg:relative lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-border px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            CC
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">CC KPI Tracker</p>
            <p className="text-xs text-foreground-muted">Elsewedy Electric</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <NavGroup items={mainItems} pathname={pathname} onClose={onClose} />

          {managerItems.length > 0 && (
            <>
              <div className="mt-6 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                Team
              </div>
              <NavGroup items={managerItems} pathname={pathname} onClose={onClose} />
            </>
          )}

          {adminItems.length > 0 && (
            <>
              <div className="mt-6 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                Administration
              </div>
              <NavGroup items={adminItems} pathname={pathname} onClose={onClose} />
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-4">
          <p className="text-xs text-foreground-muted">Cost Control Dept.</p>
        </div>
      </aside>
    </>
  )
}

function NavGroup({
  items,
  pathname,
  onClose,
}: {
  items: NavItem[]
  pathname: string
  onClose: () => void
}) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-blue-600/10 font-medium text-blue-500"
                  : "text-sidebar-text hover:bg-card-hover hover:text-foreground"
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
