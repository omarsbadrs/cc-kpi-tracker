"use client"

import { useCallback, useState } from "react"

// ─────────────────────────────────────
// Types
// ─────────────────────────────────────

export interface ReportMember {
  id: string
  firstName: string
  lastName: string
  email: string
  employeeId: string | null
  role: string
  tier: string
  jobTitle: string | null
  isActive: boolean
  managerId: string | null
}

interface TreeNode {
  member: ReportMember
  children: TreeNode[]
}

// ─────────────────────────────────────
// Constants
// ─────────────────────────────────────

const TIER_ORDER = ["SECTION_HEAD", "TEAM_LEAD", "SENIOR", "ENGINEER", "JUNIOR"] as const

const TIER_COLORS: Record<string, [number, number, number]> = {
  SECTION_HEAD: [139, 92, 246],
  TEAM_LEAD:    [59,  130, 246],
  SENIOR:       [16,  185, 129],
  ENGINEER:     [14,  165, 233],
  JUNIOR:       [245, 158, 11],
}

const TIER_LABELS: Record<string, string> = {
  SECTION_HEAD: "Section Head",
  TEAM_LEAD:    "Team Lead",
  SENIOR:       "Senior Engineer",
  ENGINEER:     "Cost Control Engineer",
  JUNIOR:       "Junior Engineer",
}

const TIER_SHORT: Record<string, string> = {
  SECTION_HEAD: "Head",
  TEAM_LEAD:    "Lead",
  SENIOR:       "Senior",
  ENGINEER:     "Engineer",
  JUNIOR:       "Junior",
}

const DEF_COLOR: [number, number, number] = [14, 165, 233]

// ─────────────────────────────────────
// Tree helpers
// ─────────────────────────────────────

function buildTree(members: ReportMember[]): TreeNode[] {
  const map = new Map(members.map(m => [m.id, m]))
  const roots: ReportMember[] = []
  for (const m of members) {
    if (!m.managerId || !map.has(m.managerId)) roots.push(m)
  }
  function buildNode(m: ReportMember): TreeNode {
    return { member: m, children: members.filter(r => r.managerId === m.id).map(buildNode) }
  }
  return roots.map(buildNode)
}

function getDepth(node: TreeNode): number {
  if (node.children.length === 0) return 1
  return 1 + Math.max(...node.children.map(getDepth))
}

// ─────────────────────────────────────
// Hook
// ─────────────────────────────────────

export function useTeamReportPdf() {
  const [isExporting, setIsExporting] = useState(false)

  const exportReport = useCallback(async ({
    analyticsMembers,
    orgChartMembers,
    managerName,
    isAdmin,
  }: {
    analyticsMembers: ReportMember[]
    orgChartMembers:  ReportMember[]
    managerName: string
    isAdmin: boolean
  }) => {
    setIsExporting(true)
    try {
      const { default: jsPDF } = await import("jspdf")

      const today = new Date().toLocaleDateString("en-GB", {
        day: "2-digit", month: "long", year: "numeric",
      })

      // A4 portrait
      const PW = 210
      const PH = 297
      const M  = 14
      const CW = PW - M * 2

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

      // ─── tiny helpers ───────────────────────────────────────────
      const tc   = (r: number, g: number, b: number) => doc.setTextColor(r, g, b)
      const fc   = (r: number, g: number, b: number) => doc.setFillColor(r, g, b)
      const dc   = (r: number, g: number, b: number) => doc.setDrawColor(r, g, b)
      const bold = (sz: number) => { doc.setFont("helvetica", "bold");   doc.setFontSize(sz) }
      const reg  = (sz: number) => { doc.setFont("helvetica", "normal"); doc.setFontSize(sz) }
      const lw   = (w: number)  => doc.setLineWidth(w)

      // only non-admin staff for analytics
      const staff = analyticsMembers.filter(m => m.role !== "ADMIN")

      const tierStats = TIER_ORDER
        .map(t => ({
          tier: t,
          count: staff.filter(m => m.tier === t).length,
          members: staff.filter(m => m.tier === t),
        }))
        .filter(t => t.count > 0)

      // ════════════════════════════════════════════════════════════
      // PAGE 1  —  PORTRAIT  —  Cover + Stats + Classification
      // ════════════════════════════════════════════════════════════

      // ── Top banner ──────────────────────────────────────────────
      fc(10, 10, 18); doc.rect(0, 0, PW, 30, "F")
      bold(12); tc(255, 255, 255); doc.text("ELSEWEDY ELECTRIC", M, 12)
      reg(7);  tc(180, 180, 210); doc.text("Cost Control Department  ·  KPI Performance Tracker", M, 20)
      reg(7);  tc(110, 110, 150); doc.text(today, PW - M, 20, { align: "right" })
      fc(220, 38, 38); doc.rect(0, 27, PW, 3, "F")      // red accent

      // ── Title block ─────────────────────────────────────────────
      fc(18, 18, 28); doc.rect(0, 30, PW, 36, "F")
      bold(20); tc(240, 240, 255)
      doc.text(isAdmin ? "TEAM DIRECTORY" : "TEAM REPORT", PW / 2, 50, { align: "center" })
      reg(8);  tc(150, 150, 200)
      doc.text(
        isAdmin ? "Full Organizational Directory" : `Personnel under the authority of ${managerName}`,
        PW / 2, 60, { align: "center" }
      )

      // ── Headcount + tier stat boxes ─────────────────────────────
      let y = 76
      bold(6); tc(110, 110, 155)
      doc.text("HEADCOUNT SUMMARY", M, y)
      y += 4

      const BOX_H = 28

      // Total box
      fc(24, 24, 38); doc.roundedRect(M, y, 36, BOX_H, 3, 3, "F")
      fc(99, 102, 241); doc.roundedRect(M, y, 36, 4, 3, 3, "F")
      doc.rect(M, y + 2, 36, 2, "F")
      reg(6);  tc(150, 150, 200); doc.text("TOTAL", M + 18, y + 10, { align: "center" })
      bold(20); tc(255, 255, 255); doc.text(String(staff.length), M + 18, y + 23, { align: "center" })

      // Tier boxes
      const tBoxW = tierStats.length > 0 ? (CW - 40) / tierStats.length : 20
      let bx = M + 40
      for (const { tier, count } of tierStats) {
        const [r, g, b] = TIER_COLORS[tier] ?? DEF_COLOR
        fc(24, 24, 38); doc.roundedRect(bx, y, tBoxW - 2, BOX_H, 3, 3, "F")
        fc(r, g, b);    doc.roundedRect(bx, y, tBoxW - 2, 4, 3, 3, "F")
        doc.rect(bx, y + 2, tBoxW - 2, 2, "F")
        reg(5.5); tc(Math.min(r + 90, 255), Math.min(g + 90, 255), Math.min(b + 90, 255))
        doc.text((TIER_SHORT[tier] ?? tier).toUpperCase(), bx + (tBoxW - 2) / 2, y + 10, { align: "center" })
        bold(18); tc(255, 255, 255)
        doc.text(String(count), bx + (tBoxW - 2) / 2, y + 23, { align: "center" })
        bx += tBoxW
      }
      y += BOX_H + 7

      // ── Classification breakdown ─────────────────────────────────
      dc(50, 50, 70); lw(0.2); doc.line(M, y, PW - M, y)
      y += 5
      bold(6); tc(110, 110, 155); doc.text("CLASSIFICATION BREAKDOWN", M, y)
      y += 4

      for (const { tier, count, members: tm } of tierStats) {
        const [r, g, b] = TIER_COLORS[tier] ?? DEF_COLOR

        // Tier header row
        fc(28, 28, 44); doc.roundedRect(M, y, CW, 8, 2, 2, "F")
        fc(r, g, b);    doc.rect(M, y, 4, 8, "F")
        doc.roundedRect(M, y, 4, 8, 2, 2, "F")
        bold(7);   tc(Math.min(r + 90, 255), Math.min(g + 90, 255), Math.min(b + 90, 255))
        doc.text(`${TIER_LABELS[tier] ?? tier}`, M + 8, y + 5.5)
        bold(7);   tc(220, 220, 255)
        doc.text(`${count} ${count === 1 ? "person" : "people"}`, PW - M - 2, y + 5.5, { align: "right" })
        y += 8

        // 2-column name/email rows
        const half = Math.ceil(tm.length / 2)
        for (let i = 0; i < half; i++) {
          const left  = tm[i]
          const right = tm[i + half]
          const bg = i % 2 === 0 ? [20, 20, 32] : [22, 22, 36]
          fc(bg[0]!, bg[1]!, bg[2]!); doc.rect(M, y, CW, 6.2, "F")
          const col2 = M + CW / 2

          if (left) {
            bold(6.5); tc(220, 220, 245)
            doc.text(`${left.firstName} ${left.lastName}`, M + 4, y + 4.4)
            reg(5.5); tc(110, 110, 155)
            doc.text(left.email, M + 4 + CW * 0.22, y + 4.4)
          }
          if (right) {
            bold(6.5); tc(220, 220, 245)
            doc.text(`${right.firstName} ${right.lastName}`, col2 + 4, y + 4.4)
            reg(5.5); tc(110, 110, 155)
            doc.text(right.email, col2 + 4 + CW * 0.22, y + 4.4)
          }
          y += 6.2

          if (y > PH - 18) {
            pageFooter(doc, doc.getCurrentPageInfo().pageNumber, PW, PH, M)
            doc.addPage(); y = M
          }
        }
        y += 3
      }

      // ════════════════════════════════════════════════════════════
      // PAGE 2+  —  PORTRAIT  —  Full Member Directory Table
      // ════════════════════════════════════════════════════════════
      doc.addPage()
      y = M

      fc(10, 10, 18); doc.rect(0, 0, PW, 14, "F")
      bold(9);  tc(255, 255, 255); doc.text("MEMBER DIRECTORY", M, 10)
      reg(6.5); tc(130, 130, 175); doc.text(`${staff.length} members`, PW - M, 10, { align: "right" })
      y = 18

      const C = { num: M, name: M + 7, email: M + 57, tier: M + 108, title: M + 130, empId: M + 175 }

      const drawTblHeader = (yy: number) => {
        fc(26, 26, 42); doc.rect(M, yy, CW, 7, "F")
        bold(5.5); tc(100, 100, 155)
        doc.text("#",          C.num + 2, yy + 5)
        doc.text("FULL NAME",  C.name,    yy + 5)
        doc.text("EMAIL",      C.email,   yy + 5)
        doc.text("TIER",       C.tier,    yy + 5)
        doc.text("JOB TITLE",  C.title,   yy + 5)
        doc.text("EMP ID",     C.empId,   yy + 5)
        return yy + 7
      }
      y = drawTblHeader(y)

      const sortedStaff = [...staff].sort((a, b) => {
        const td = TIER_ORDER.indexOf(a.tier as typeof TIER_ORDER[number])
                 - TIER_ORDER.indexOf(b.tier as typeof TIER_ORDER[number])
        if (td !== 0) return td
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
      })

      for (let i = 0; i < sortedStaff.length; i++) {
        const m = sortedStaff[i]!
        const [r, g, b] = TIER_COLORS[m.tier] ?? DEF_COLOR
        const bg = i % 2 === 0 ? [18, 18, 28] : [22, 22, 36]
        fc(bg[0]!, bg[1]!, bg[2]!); doc.rect(M, y, CW, 7, "F")
        fc(r, g, b); doc.rect(M, y, 1.5, 7, "F")

        reg(5);  tc(80,  80,  115); doc.text(String(i + 1),               C.num + 2, y + 5)
        bold(6.5);tc(220, 220, 248)
        const nm = `${m.firstName} ${m.lastName}`
        doc.text(nm.length > 23 ? nm.slice(0, 21) + "…" : nm, C.name, y + 5)
        reg(5.5); tc(110, 110, 158)
        doc.text(m.email.length > 29 ? m.email.slice(0, 27) + "…" : m.email, C.email, y + 5)

        // tier pill
        fc(Math.round(r * 0.12 + 18), Math.round(g * 0.12 + 18), Math.round(b * 0.12 + 18))
        doc.roundedRect(C.tier, y + 1, 19, 5, 1.5, 1.5, "F")
        bold(5); tc(Math.min(r + 85, 255), Math.min(g + 85, 255), Math.min(b + 85, 255))
        doc.text(TIER_SHORT[m.tier] ?? m.tier, C.tier + 9.5, y + 4.7, { align: "center" })

        reg(5.5); tc(120, 120, 160)
        doc.text((m.jobTitle || TIER_LABELS[m.tier] || "").slice(0, 26), C.title, y + 5)
        reg(5.5); tc(90, 90, 135)
        doc.text(m.employeeId ? `#${m.employeeId}` : "—", C.empId, y + 5)

        y += 7
        if (y > PH - 18 && i < sortedStaff.length - 1) {
          pageFooter(doc, doc.getCurrentPageInfo().pageNumber, PW, PH, M)
          doc.addPage()
          fc(10, 10, 18); doc.rect(0, 0, PW, 10, "F")
          reg(5.5); tc(120, 120, 165); doc.text("MEMBER DIRECTORY (continued)", M, 7)
          y = 14; y = drawTblHeader(y)
        }
      }

      // ════════════════════════════════════════════════════════════
      // FINAL PAGE  —  LANDSCAPE  —  Org Chart (auto-scaled to fit)
      // ════════════════════════════════════════════════════════════

      // Fixed A3 landscape canvas
      const OW = 420   // mm  (A3 landscape width)
      const OH = 297   // mm
      const OM = 14    // margin
      const HEADER_H  = 20
      const FOOTER_H  = 12
      const LEGEND_H  = 16
      const AVAIL_W   = OW - OM * 2
      const AVAIL_H   = OH - HEADER_H - FOOTER_H - LEGEND_H - OM

      doc.addPage([OW, OH])

      // Header
      fc(10, 10, 18); doc.rect(0, 0, OW, HEADER_H, "F")
      fc(220, 38, 38); doc.rect(0, HEADER_H - 3, OW, 3, "F")
      bold(10); tc(255, 255, 255); doc.text("ORGANIZATIONAL CHART", OM, 12)
      reg(6.5); tc(120, 120, 160); doc.text(
        isAdmin ? "Full Organization" : `Team under ${managerName}`,
        OW / 2, 12, { align: "center" }
      )
      reg(6.5); tc(110, 110, 150); doc.text(today, OW - OM, 12, { align: "right" })

      // Build tree (from orgChartMembers which includes the manager)
      const roots = buildTree(orgChartMembers)

      if (roots.length > 0) {
        // Natural size constants
        const BASE_NW = 46
        const BASE_NH = 20
        const BASE_HG = 10
        const BASE_VG = 18

        // Compute natural width/height of whole tree
        function subW(node: TreeNode, nw: number, hg: number): number {
          if (node.children.length === 0) return nw
          const cw = node.children.reduce((s, c) => s + subW(c, nw, hg), 0)
          return Math.max(nw, cw + (node.children.length - 1) * hg)
        }

        const naturalW = roots.reduce(
          (s, r, i) => s + subW(r, BASE_NW, BASE_HG) + (i < roots.length - 1 ? BASE_HG * 2 : 0),
          0
        )
        const maxDepth = Math.max(...roots.map(getDepth))
        const naturalH = maxDepth * BASE_NH + (maxDepth - 1) * BASE_VG

        // Scale to fit available area — only scale DOWN
        const scaleW = naturalW > AVAIL_W ? AVAIL_W / naturalW : 1
        const scaleH = naturalH > AVAIL_H ? AVAIL_H / naturalH : 1
        const S = Math.min(scaleW, scaleH)   // uniform scale

        const NW = BASE_NW * S
        const NH = BASE_NH * S
        const HG = BASE_HG * S
        const VG = BASE_VG * S

        // Font sizes scale but never below readable minimums
        const fName  = Math.max(3.8, 5.5  * S)
        const fTier  = Math.max(3.2, 4.5  * S)
        const fEmail = Math.max(2.8, 4.0  * S)

        // Recompute tree widths with scaled gap
        function scaledSubW(node: TreeNode): number {
          if (node.children.length === 0) return NW
          const cw = node.children.reduce((s, c) => s + scaledSubW(c), 0)
          return Math.max(NW, cw + (node.children.length - 1) * HG)
        }

        const scaledTotalW = roots.reduce(
          (s, r, i) => s + scaledSubW(r) + (i < roots.length - 1 ? HG * 2 : 0),
          0
        )

        // Center the tree horizontally
        const startX = OM + (AVAIL_W - scaledTotalW) / 2
        const startY = HEADER_H + OM

        // ── Draw a single node card ──
        function drawCard(node: TreeNode, cx: number, ny: number) {
          const [r, g, b] = TIER_COLORS[node.member.tier] ?? DEF_COLOR
          const nx = cx - NW / 2

          // Shadow
          fc(8, 8, 14); doc.roundedRect(nx + 0.4, ny + 0.4, NW, NH, 2, 2, "F")
          // Card body
          fc(22, 22, 35); doc.roundedRect(nx, ny, NW, NH, 2, 2, "F")
          // Colour accent bar
          fc(r, g, b); doc.roundedRect(nx, ny, NW, NH * 0.18, 2, 2, "F")
          doc.rect(nx, ny + NH * 0.09, NW, NH * 0.09, "F")
          // Border
          dc(Math.round(r / 3), Math.round(g / 3), Math.round(b / 3)); lw(0.2)
          doc.roundedRect(nx, ny, NW, NH, 2, 2, "S")

          // Name
          bold(fName); tc(232, 232, 255)
          const name = `${node.member.firstName} ${node.member.lastName}`
          doc.text(name.length > 20 ? name.slice(0, 18) + "…" : name, cx, ny + NH * 0.5, { align: "center" })
          // Tier
          reg(fTier); tc(Math.min(r + 100, 255), Math.min(g + 100, 255), Math.min(b + 100, 255))
          doc.text(TIER_SHORT[node.member.tier] ?? node.member.tier, cx, ny + NH * 0.68, { align: "center" })
          // Email
          reg(fEmail); tc(90, 90, 120)
          const em = node.member.email.length > 26 ? node.member.email.slice(0, 24) + "…" : node.member.email
          doc.text(em, cx, ny + NH * 0.88, { align: "center" })
        }

        // ── Recursively draw tree ──
        function drawTree(node: TreeNode, x: number, ny: number, availW: number) {
          const cx = x + availW / 2
          drawCard(node, cx, ny)
          if (node.children.length === 0) return

          const totalCW = node.children.reduce((s, c) => s + scaledSubW(c), 0)
                        + (node.children.length - 1) * HG
          let childX = x + (availW - totalCW) / 2
          const childY = ny + NH + VG
          const midY   = ny + NH + VG / 2

          dc(55, 55, 85); lw(0.35)
          doc.line(cx, ny + NH, cx, midY)

          if (node.children.length > 1) {
            const firstCX = childX + scaledSubW(node.children[0]!) / 2
            const lastCX  = childX + totalCW - scaledSubW(node.children[node.children.length - 1]!) / 2
            doc.line(firstCX, midY, lastCX, midY)
          }

          for (const child of node.children) {
            const sw = scaledSubW(child)
            const ccx = childX + sw / 2
            doc.line(ccx, midY, ccx, childY)
            drawTree(child, childX, childY, sw)
            childX += sw + HG
          }
        }

        // Draw all roots
        let rx = startX
        for (let i = 0; i < roots.length; i++) {
          const sw = scaledSubW(roots[i]!)
          drawTree(roots[i]!, rx, startY, sw)
          rx += sw + (i < roots.length - 1 ? HG * 2 : 0)
        }
      }

      // ── Legend ──────────────────────────────────────────────────
      const legendY = OH - FOOTER_H - LEGEND_H + 2
      dc(45, 45, 65); lw(0.2); doc.line(OM, legendY, OW - OM, legendY)
      bold(5.5); tc(110, 110, 155); doc.text("TIER LEGEND", OM, legendY + 6)
      let lx = OM + 28
      for (const t of TIER_ORDER) {
        if (!tierStats.find(s => s.tier === t)) continue
        const [r, g, b] = TIER_COLORS[t] ?? DEF_COLOR
        fc(r, g, b); doc.circle(lx, legendY + 5.5, 1.8, "F")
        reg(5.5); tc(200, 200, 225); doc.text(TIER_SHORT[t] ?? t, lx + 4, legendY + 6.5)
        lx += 24
      }

      // ── Footer on every page ────────────────────────────────────
      const totalPages = doc.getNumberOfPages()
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p)
        const pw = p === totalPages ? OW : PW
        pageFooter(doc, p, pw, OH, OM, totalPages)
      }

      const fname = isAdmin
        ? "team-directory-report.pdf"
        : `team-report-${managerName.replace(/\s+/g, "-").toLowerCase()}.pdf`
      doc.save(fname)
    } finally {
      setIsExporting(false)
    }
  }, [])

  return { exportReport, isExporting }
}

// ─────────────────────────────────────
// Footer helper
// ─────────────────────────────────────
function pageFooter(
  doc: import("jspdf").jsPDF,
  pageNum: number,
  pw: number,
  ph: number,
  M: number,
  total?: number,
) {
  doc.setFillColor(10, 10, 18)
  doc.rect(0, ph - 10, pw, 10, "F")
  doc.setFont("helvetica", "normal")
  doc.setFontSize(5.5)
  doc.setTextColor(75, 75, 110)
  doc.text(
    "Elsewedy Electric  ·  Cost Control Department KPI Tracker  ·  CONFIDENTIAL",
    M, ph - 3.5
  )
  if (total) {
    doc.text(`Page ${pageNum} of ${total}`, pw - M, ph - 3.5, { align: "right" })
  }
}
