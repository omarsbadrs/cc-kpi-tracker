import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api-handler"
import { error } from "@/lib/api-response"
import type { Tier } from "@prisma/client"

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url)
  const evalPeriodId = searchParams.get("evalPeriodId")

  if (!evalPeriodId) {
    return error(400, "VALIDATION_ERROR", "evalPeriodId is required")
  }

  const period = await prisma.evalPeriod.findUnique({
    where: { id: evalPeriodId },
    select: { name: true },
  })
  if (!period) {
    return error(404, "NOT_FOUND", "Evaluation period not found")
  }

  // Fetch all active assignments for this period with user + KPI + targets
  const assignments = await prisma.kpiAssignment.findMany({
    where: { evalPeriodId, isActive: true, user: { role: { not: "ADMIN" } } },
    include: {
      user: { select: { email: true, firstName: true, lastName: true, employeeId: true, tier: true } },
      kpiDefinition: {
        include: {
          pillar: { select: { code: true, name: true } },
          targets: true,
        },
      },
      actuals: {
        where: { evalPeriodId },
        take: 1,
        orderBy: { createdAt: "desc" as const },
        select: { actualValue: true, binaryValue: true, status: true },
      },
    },
    orderBy: [
      { user: { lastName: "asc" } },
      { kpiDefinition: { sortOrder: "asc" } },
    ],
  })

  // Build CSV
  const headers = [
    "period",
    "employee_email",
    "employee_name",
    "employee_id",
    "tier",
    "pillar_code",
    "pillar_name",
    "kpi_code",
    "kpi_name",
    "unit",
    "direction",
    "target",
    "current_actual (read-only)",
    "current_status (read-only)",
    "new_actual_value",
    "new_binary_value",
  ]

  const rows = assignments.map((a) => {
    const tierTarget = a.kpiDefinition.targets.find((t) => t.tier === (a.user.tier as Tier))
    const target = a.targetOverride ?? tierTarget?.targetValue ?? ""
    const isBinary = a.kpiDefinition.direction === "BINARY"
    const targetDisplay = target !== ""
      ? (isBinary ? "Pass" : String(target))
      : ""

    const actual = a.actuals[0]
    const currentActual = actual?.actualValue != null
      ? String(actual.actualValue)
      : actual?.binaryValue != null
        ? (actual.binaryValue ? "Pass" : "Fail")
        : ""

    return [
      period.name,
      a.user.email,
      `${a.user.firstName} ${a.user.lastName}`,
      a.user.employeeId || "",
      a.user.tier,
      a.kpiDefinition.pillar.code,
      a.kpiDefinition.pillar.name,
      a.kpiDefinition.code,
      a.kpiDefinition.name,
      a.kpiDefinition.unit,
      a.kpiDefinition.direction,
      targetDisplay,
      currentActual,
      actual?.status || "",
      "", // new_actual_value — to be filled by admin
      "", // new_binary_value — to be filled by admin
    ]
  })

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => {
        const str = String(cell)
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }).join(",")
    ),
  ].join("\n")

  const safeName = period.name.replace(/[^a-zA-Z0-9_-]/g, "_")

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kpi_actuals_template_${safeName}.csv"`,
    },
  })
}, "ADMIN")
