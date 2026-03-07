import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api-handler"
import { success, error } from "@/lib/api-response"
import { logger } from "@/lib/logger"

interface CsvRow {
  employee_email: string
  kpi_code: string
  new_actual_value: string
  new_binary_value: string
}

interface ImportError {
  row: number
  field: string
  message: string
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  const headerLine = lines[0]!
  const headers = headerLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""))

  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!
    const values: string[] = []
    let current = ""
    let inQuotes = false

    for (let j = 0; j < line.length; j++) {
      const ch = line[j]!
      if (inQuotes) {
        if (ch === '"' && line[j + 1] === '"') {
          current += '"'
          j++
        } else if (ch === '"') {
          inQuotes = false
        } else {
          current += ch
        }
      } else {
        if (ch === '"') {
          inQuotes = true
        } else if (ch === ",") {
          values.push(current.trim())
          current = ""
        } else {
          current += ch
        }
      }
    }
    values.push(current.trim())

    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] || ""
    })
    rows.push(row)
  }

  return rows
}

export const POST = withAuth(async (req, { session }) => {
  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const evalPeriodId = formData.get("evalPeriodId") as string | null
  const dryRun = formData.get("dryRun") === "true"

  if (!file) return error(400, "VALIDATION_ERROR", "CSV file is required")
  if (!evalPeriodId) return error(400, "VALIDATION_ERROR", "evalPeriodId is required")

  const period = await prisma.evalPeriod.findUnique({ where: { id: evalPeriodId } })
  if (!period) return error(404, "NOT_FOUND", "Evaluation period not found")
  if (period.isClosed) return error(422, "UNPROCESSABLE", "This evaluation period is closed")
  if (period.isLocked) return error(422, "UNPROCESSABLE", "This period is currently being scored")

  const csvText = await file.text()
  const rows = parseCsv(csvText) as unknown as CsvRow[]

  if (rows.length === 0) {
    return error(400, "VALIDATION_ERROR", "CSV file is empty or has no data rows")
  }

  // Validate required columns
  const firstRow = rows[0]!
  if (!("employee_email" in firstRow) || !("kpi_code" in firstRow)) {
    return error(400, "VALIDATION_ERROR", "CSV must have employee_email and kpi_code columns")
  }

  // Pre-fetch lookup maps
  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  })
  const userMap = new Map(users.map((u) => [u.email.toLowerCase(), u.id]))

  const kpis = await prisma.kpiDefinition.findMany({
    select: { id: true, code: true, direction: true },
  })
  const kpiMap = new Map(kpis.map((k) => [k.code, k]))

  const assignments = await prisma.kpiAssignment.findMany({
    where: { evalPeriodId, isActive: true },
    select: { id: true, userId: true, kpiDefinitionId: true },
  })
  const assignmentMap = new Map(
    assignments.map((a) => [`${a.userId}:${a.kpiDefinitionId}`, a.id])
  )

  const errors: ImportError[] = []
  const validRows: {
    assignmentId: string
    userId: string
    actualValue: number | null
    binaryValue: boolean | null
  }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const rowNum = i + 2 // 1-indexed + header

    const email = row.employee_email?.trim().toLowerCase()
    const kpiCode = row.kpi_code?.trim()
    const newActual = row.new_actual_value?.trim()
    const newBinary = row.new_binary_value?.trim()

    // Skip rows where both new values are empty
    if (!newActual && !newBinary) continue

    if (!email) {
      errors.push({ row: rowNum, field: "employee_email", message: "Email is required" })
      continue
    }
    if (!kpiCode) {
      errors.push({ row: rowNum, field: "kpi_code", message: "KPI code is required" })
      continue
    }

    const userId = userMap.get(email)
    if (!userId) {
      errors.push({ row: rowNum, field: "employee_email", message: `User ${email} not found` })
      continue
    }

    const kpi = kpiMap.get(kpiCode)
    if (!kpi) {
      errors.push({ row: rowNum, field: "kpi_code", message: `KPI ${kpiCode} not found` })
      continue
    }

    const assignmentId = assignmentMap.get(`${userId}:${kpi.id}`)
    if (!assignmentId) {
      errors.push({ row: rowNum, field: "kpi_code", message: `${kpiCode} not assigned to ${email} for this period` })
      continue
    }

    // Parse values based on KPI direction
    if (kpi.direction === "BINARY") {
      const val = (newBinary || newActual || "").toLowerCase()
      if (!["pass", "fail", "true", "false", "1", "0", "yes", "no"].includes(val)) {
        errors.push({ row: rowNum, field: "new_binary_value", message: `Invalid binary value: "${val}". Use Pass/Fail` })
        continue
      }
      const binaryValue = ["pass", "true", "1", "yes"].includes(val)
      validRows.push({ assignmentId, userId, actualValue: null, binaryValue })
    } else {
      const numVal = parseFloat(newActual)
      if (isNaN(numVal)) {
        errors.push({ row: rowNum, field: "new_actual_value", message: `Invalid number: "${newActual}"` })
        continue
      }
      validRows.push({ assignmentId, userId, actualValue: numVal, binaryValue: null })
    }
  }

  if (!dryRun && validRows.length > 0) {
    // Upsert all valid actuals in a transaction
    await prisma.$transaction(
      validRows.map((r) =>
        prisma.kpiActual.upsert({
          where: {
            assignmentId_evalPeriodId: {
              assignmentId: r.assignmentId,
              evalPeriodId,
            },
          },
          create: {
            assignmentId: r.assignmentId,
            userId: r.userId,
            evalPeriodId,
            actualValue: r.actualValue,
            binaryValue: r.binaryValue,
            status: "SUBMITTED",
            submittedAt: new Date(),
          },
          update: {
            actualValue: r.actualValue,
            binaryValue: r.binaryValue,
            status: "SUBMITTED",
            submittedAt: new Date(),
          },
        })
      )
    )

    logger.info(
      { adminId: session.user.id, periodId: evalPeriodId, imported: validRows.length, errors: errors.length },
      "Bulk actuals imported"
    )
  }

  return success({
    total: rows.length,
    valid: validRows.length,
    skipped: rows.length - validRows.length - errors.length,
    errors,
    imported: dryRun ? 0 : validRows.length,
    dryRun,
  })
}, "ADMIN")
