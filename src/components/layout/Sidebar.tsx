"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import type { Role } from "@prisma/client"
import {
  LayoutDashboard,
  ClipboardList,
  Bell,
  User,
  Users,
  UsersRound,
  FileText,
  ShieldCheck,
  Library,
  Target,
  CalendarDays,
  Settings,
  Download,
  Network,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react"

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  roles: Role[]
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["USER", "MANAGER", "ADMIN"] },
  { label: "My KPIs", href: "/kpis", icon: ClipboardList, roles: ["USER", "MANAGER", "ADMIN"] },
  { label: "Notifications", href: "/notifications", icon: Bell, roles: ["USER", "MANAGER", "ADMIN"] },
  { label: "Profile", href: "/profile", icon: User, roles: ["USER", "MANAGER", "ADMIN"] },
  { label: "Team Overview", href: "/manager/team", icon: Users, roles: ["MANAGER", "ADMIN"] },
  { label: "Team Members", href: "/manager/members", icon: UsersRound, roles: ["MANAGER", "ADMIN"] },
  { label: "Review Queue", href: "/manager/review", icon: ClipboardCheck, roles: ["MANAGER", "ADMIN"] },
  { label: "Reports", href: "/manager/reports", icon: FileText, roles: ["MANAGER", "ADMIN"] },
  { label: "Org Chart", href: "/admin/org-chart", icon: Network, roles: ["ADMIN"] },
  { label: "Users", href: "/admin/users", icon: ShieldCheck, roles: ["ADMIN"] },
  { label: "KPI Library", href: "/admin/kpi-library", icon: Library, roles: ["ADMIN"] },
  { label: "Assignments", href: "/admin/assignments", icon: Target, roles: ["ADMIN"] },
  { label: "Periods", href: "/admin/periods", icon: CalendarDays, roles: ["ADMIN"] },
  { label: "Scoring", href: "/admin/scoring", icon: Settings, roles: ["ADMIN"] },
  { label: "Import", href: "/admin/import", icon: Download, roles: ["ADMIN"] },
]

export function Sidebar({
  isOpen,
  onClose,
  collapsed,
  onToggleCollapse,
}: {
  isOpen: boolean
  onClose: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = session?.user?.role

  const filteredItems = navItems.filter(
    (item) => role && item.roles.includes(role)
  )

  const mainItems = filteredItems.filter(
    (i) => !i.href.startsWith("/manager") && !i.href.startsWith("/admin")
  )
  const managerItems = filteredItems.filter((i) => i.href.startsWith("/manager"))
  const adminItems = filteredItems.filter((i) => i.href.startsWith("/admin"))

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "ca-sidebar fixed top-0 left-0 z-50 flex h-full flex-col transition-all lg:relative lg:translate-x-0",
          collapsed ? "w-[68px]" : "w-56",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Collapse toggle */}
        <div className="absolute -right-3.5 top-[7.25rem] hidden lg:block" style={{ zIndex: 9999 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleCollapse() }}
            className="sidebar-collapse-btn h-7 w-7"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              {collapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              )}
            </svg>
          </button>
        </div>

        {/* Logo */}
        <div className={cn(
          "flex h-16 items-center justify-center border-b border-border",
          collapsed ? "px-2" : "px-4"
        )}>
          <img
            src="/logo.svg"
            alt="Elsewedy Electric PSP"
            className={cn("hidden dark:block", collapsed ? "h-5 w-auto" : "h-7 w-auto")}
          />
          <img
            src="/logo-light.svg"
            alt="Elsewedy Electric PSP"
            className={cn("block dark:hidden", collapsed ? "h-5 w-auto" : "h-7 w-auto")}
          />
        </div>

        {/* Navigation */}
        <nav className={cn("flex-1 overflow-y-auto py-3", collapsed ? "px-2" : "px-2.5")}>
          <NavGroup items={mainItems} pathname={pathname} onClose={onClose} collapsed={collapsed} />

          {managerItems.length > 0 && (
            <>
              {!collapsed && <div className="section-label mt-5 mb-1.5">Team</div>}
              {collapsed && <div className="my-2.5 mx-1 border-t border-border" />}
              <NavGroup items={managerItems} pathname={pathname} onClose={onClose} collapsed={collapsed} />
            </>
          )}

          {adminItems.length > 0 && (
            <>
              {!collapsed && <div className="section-label mt-5 mb-1.5">Admin</div>}
              {collapsed && <div className="my-2.5 mx-1 border-t border-border" />}
              <NavGroup items={adminItems} pathname={pathname} onClose={onClose} collapsed={collapsed} />
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-3 text-center">
          {collapsed ? (
            <p className="text-[9px] font-semibold text-foreground-muted/50" title="Cost Control Dept. — by Omar Badr">OB</p>
          ) : (
            <>
              <p className="text-[11px] text-foreground-muted">Cost Control Dept.</p>
              <p className="mt-1 text-[11px] font-semibold text-foreground-secondary">Omar Badr</p>
            </>
          )}
        </div>
      </aside>
    </>
  )
}

function NavGroup({
  items,
  pathname,
  onClose,
  collapsed,
}: {
  items: NavItem[]
  pathname: string
  onClose: () => void
  collapsed: boolean
}) {
  return (
    <ul className={cn("space-y-1", collapsed && "flex flex-col items-center")}>
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
        const Icon = item.icon

        if (collapsed) {
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onClose}
                title={item.label}
                className={cn(
                  "ca-sidebar-icon",
                  isActive && "ca-sidebar-icon-active"
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
              </Link>
            </li>
          )
        }

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onClose}
              className={cn(
                "ca-sidebar-link",
                isActive && "ca-sidebar-link-active"
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.7} />
              {item.label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
