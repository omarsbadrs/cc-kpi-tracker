import type { Role } from "@prisma/client"
import {
  LayoutDashboard,
  ClipboardList,
  Bell,
  Users,
  UsersRound,
  FileText,
  ShieldCheck,
  Library,
  Target,
  CalendarDays,
  Calculator,
  Upload,
  Network,
  ClipboardCheck,
  UserX,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  roles: Role[]
  /** One line for the mobile More sheet. */
  sub: string
}

export interface NavGroup {
  id: string
  label: string
  items: NavItem[]
}

const ALL: Role[] = ["USER", "MANAGER", "ADMIN"]
const LEADS: Role[] = ["MANAGER", "ADMIN"]
const ADMIN: Role[] = ["ADMIN"]

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "work",
    label: "My work",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ALL, sub: "Your score and pillars at a glance" },
      { label: "My KPIs", href: "/kpis", icon: ClipboardList, roles: ALL, sub: "Targets, actuals and evidence" },
      { label: "KPI library", href: "/kpi-library", icon: Library, roles: ALL, sub: "Every KPI, its target and how it is scored" },
      { label: "Notifications", href: "/notifications", icon: Bell, roles: ALL, sub: "Approvals, reminders and published scores" },
    ],
  },
  {
    id: "team",
    label: "Team",
    items: [
      { label: "Team overview", href: "/manager/team", icon: Users, roles: LEADS, sub: "Everyone's pillars side by side" },
      { label: "Team members", href: "/manager/members", icon: UsersRound, roles: LEADS, sub: "Drill into one person's scorecard" },
      { label: "Review queue", href: "/manager/review", icon: ClipboardCheck, roles: LEADS, sub: "Approve or reject submitted actuals" },
      { label: "Reports", href: "/manager/reports", icon: FileText, roles: LEADS, sub: "Department exports" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    items: [
      { label: "Users", href: "/admin/users", icon: ShieldCheck, roles: ADMIN, sub: "Accounts, roles and tiers" },
      { label: "Org chart", href: "/admin/org-chart", icon: Network, roles: ADMIN, sub: "Who reports to whom" },
      { label: "Assignments", href: "/admin/assignments", icon: Target, roles: ADMIN, sub: "Which KPIs each person carries" },
      { label: "Periods", href: "/admin/periods", icon: CalendarDays, roles: ADMIN, sub: "Open, lock and close evaluation periods" },
      { label: "Scoring", href: "/admin/scoring", icon: Calculator, roles: ADMIN, sub: "Run, review and publish scores" },
      { label: "Import", href: "/admin/import", icon: Upload, roles: ADMIN, sub: "Load historical actuals from CSV" },
      { label: "Inactive users", href: "/admin/inactive-users", icon: UserX, roles: ADMIN, sub: "Deactivated accounts" },
    ],
  },
]

export function navForRole(role: Role | undefined): NavGroup[] {
  if (!role) return []
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter(
    (g) => g.items.length > 0
  )
}

/** Leaf routes borrow their parent's highlight. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/")
}

/** The four destinations on the mobile tab bar; everything else is in More. */
export function tabsForRole(role: Role | undefined): string[] {
  if (role === "ADMIN") return ["/dashboard", "/kpis", "/manager/review", "/admin/users"]
  if (role === "MANAGER") return ["/dashboard", "/kpis", "/manager/team", "/manager/review"]
  return ["/dashboard", "/kpis", "/kpi-library", "/notifications"]
}

/** Short labels for the tab bar (10.5px). */
export const TAB_LABELS: Record<string, string> = {
  "/dashboard": "Home",
  "/kpis": "My KPIs",
  "/kpi-library": "Library",
  "/notifications": "Alerts",
  "/manager/team": "Team",
  "/manager/review": "Review",
  "/admin/users": "Users",
}
