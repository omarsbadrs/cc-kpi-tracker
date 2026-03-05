import "dotenv/config"
import { PrismaClient, Tier } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

// ─────────────────────────────────────
// PILLAR DEFINITIONS (Section 3.1)
// ─────────────────────────────────────

const pillars = [
  { code: "A", name: "Delivery & Timeliness", description: "On-time approvals and report submissions", sortOrder: 1 },
  { code: "B", name: "Data Quality & Governance", description: "Data accuracy, first-pass acceptance, DMS compliance", sortOrder: 2 },
  { code: "C", name: "Forecasting & Cost Control Effectiveness", description: "Forecast uncertainty, action adoption, achievement rate", sortOrder: 3 },
  { code: "D", name: "Communication & Stakeholders", description: "Complaints, stakeholder satisfaction", sortOrder: 4 },
  { code: "E", name: "Attendance, Reliability & Professional Conduct", description: "Attendance, punctuality, meetings, professionalism", sortOrder: 5 },
  { code: "F", name: "Growth, Coaching & Department Contribution", description: "Training completion and pass rates", sortOrder: 6 },
]

// ─────────────────────────────────────
// PILLAR WEIGHTS BY TIER (Section 3.3)
// ─────────────────────────────────────

const pillarWeights: Record<string, Record<Tier, number>> = {
  A: { JUNIOR: 30, ENGINEER: 30, SENIOR: 26, TEAM_LEAD: 20, SECTION_HEAD: 13 },
  B: { JUNIOR: 25, ENGINEER: 25, SENIOR: 23, TEAM_LEAD: 20, SECTION_HEAD: 17 },
  C: { JUNIOR: 20, ENGINEER: 20, SENIOR: 19, TEAM_LEAD: 16, SECTION_HEAD: 13 },
  D: { JUNIOR: 10, ENGINEER: 10, SENIOR: 14, TEAM_LEAD: 17, SECTION_HEAD: 19 },
  E: { JUNIOR: 10, ENGINEER: 10, SENIOR: 9, TEAM_LEAD: 5, SECTION_HEAD: 3 },
  F: { JUNIOR: 5, ENGINEER: 5, SENIOR: 10, TEAM_LEAD: 22, SECTION_HEAD: 36 },
}

// ─────────────────────────────────────
// ALPHA CONFIGS FOR TL/SH (Section 3.7.3)
// ─────────────────────────────────────

const alphaConfigs: { pillar: string; tier: Tier; alphaTeam: number; alphaPersonal: number }[] = [
  { pillar: "A", tier: "TEAM_LEAD", alphaTeam: 0.45, alphaPersonal: 0.55 },
  { pillar: "A", tier: "SECTION_HEAD", alphaTeam: 0.49, alphaPersonal: 0.51 },
  { pillar: "B", tier: "TEAM_LEAD", alphaTeam: 0.40, alphaPersonal: 0.60 },
  { pillar: "B", tier: "SECTION_HEAD", alphaTeam: 0.45, alphaPersonal: 0.55 },
  { pillar: "C", tier: "TEAM_LEAD", alphaTeam: 0.45, alphaPersonal: 0.55 },
  { pillar: "C", tier: "SECTION_HEAD", alphaTeam: 0.49, alphaPersonal: 0.51 },
  { pillar: "D", tier: "TEAM_LEAD", alphaTeam: 0.35, alphaPersonal: 0.65 },
  { pillar: "D", tier: "SECTION_HEAD", alphaTeam: 0.40, alphaPersonal: 0.60 },
  { pillar: "E", tier: "TEAM_LEAD", alphaTeam: 0.10, alphaPersonal: 0.90 },
  { pillar: "E", tier: "SECTION_HEAD", alphaTeam: 0.05, alphaPersonal: 0.95 },
  { pillar: "F", tier: "TEAM_LEAD", alphaTeam: 0.40, alphaPersonal: 0.60 },
  { pillar: "F", tier: "SECTION_HEAD", alphaTeam: 0.45, alphaPersonal: 0.55 },
]

// ─────────────────────────────────────
// KPI DEFINITIONS (Section 3.4)
// ─────────────────────────────────────

interface KpiDef {
  code: string
  name: string
  pillar: string
  unit: "PERCENTAGE" | "COUNT" | "SCORE" | "BINARY"
  direction: "HIGHER" | "LOWER" | "BINARY"
  frequency: "MONTHLY" | "QUARTERLY"
  sla?: string
  dataSource?: string
  formula?: string
  targets: Record<Tier, number>  // target value per tier
  weights: Record<Tier, number>  // sub-KPI weight within pillar per tier
}

const kpiDefinitions: KpiDef[] = [
  // ── Pillar A: Delivery & Timeliness ──
  { code: "A1.1", name: "IPC/Payment Request Approval on-time %", pillar: "A", unit: "PERCENTAGE", direction: "HIGHER", frequency: "MONTHLY", sla: "1 day", dataSource: "Oracle R12", formula: "(On Time Count / Total Count) × 100", targets: { JUNIOR: 95, ENGINEER: 96, SENIOR: 97, TEAM_LEAD: 98, SECTION_HEAD: 98 }, weights: { JUNIOR: 10, ENGINEER: 8, SENIOR: 7, TEAM_LEAD: 6, SECTION_HEAD: 5 } },
  { code: "A1.2", name: "RDM Approval on-time %", pillar: "A", unit: "PERCENTAGE", direction: "HIGHER", frequency: "MONTHLY", sla: "1 day", dataSource: "Oracle R12", targets: { JUNIOR: 95, ENGINEER: 96, SENIOR: 97, TEAM_LEAD: 98, SECTION_HEAD: 98 }, weights: { JUNIOR: 6, ENGINEER: 6, SENIOR: 5, TEAM_LEAD: 4, SECTION_HEAD: 2 } },
  { code: "A1.3", name: "RPIM Approval on-time %", pillar: "A", unit: "PERCENTAGE", direction: "HIGHER", frequency: "MONTHLY", sla: "1 day", dataSource: "Oracle R12", targets: { JUNIOR: 95, ENGINEER: 96, SENIOR: 97, TEAM_LEAD: 98, SECTION_HEAD: 98 }, weights: { JUNIOR: 6, ENGINEER: 6, SENIOR: 5, TEAM_LEAD: 3, SECTION_HEAD: 1 } },
  { code: "A1.4", name: "Equipment Request Approval on-time %", pillar: "A", unit: "PERCENTAGE", direction: "HIGHER", frequency: "MONTHLY", sla: "1 day", dataSource: "Oracle R12", targets: { JUNIOR: 95, ENGINEER: 96, SENIOR: 97, TEAM_LEAD: 98, SECTION_HEAD: 98 }, weights: { JUNIOR: 3, ENGINEER: 3, SENIOR: 2, TEAM_LEAD: 1, SECTION_HEAD: 0 } },
  { code: "A1.5", name: "Employee Transfer Approval on-time %", pillar: "A", unit: "PERCENTAGE", direction: "HIGHER", frequency: "MONTHLY", sla: "1 day", dataSource: "Oracle R12", targets: { JUNIOR: 95, ENGINEER: 96, SENIOR: 97, TEAM_LEAD: 98, SECTION_HEAD: 98 }, weights: { JUNIOR: 3, ENGINEER: 3, SENIOR: 1, TEAM_LEAD: 0, SECTION_HEAD: 0 } },
  { code: "A1.6", name: "Assign Budget on-time %", pillar: "A", unit: "PERCENTAGE", direction: "HIGHER", frequency: "MONTHLY", sla: "2 days", dataSource: "Oracle R12", targets: { JUNIOR: 95, ENGINEER: 96, SENIOR: 97, TEAM_LEAD: 98, SECTION_HEAD: 98 }, weights: { JUNIOR: 7, ENGINEER: 7, SENIOR: 6, TEAM_LEAD: 5, SECTION_HEAD: 4 } },
  { code: "A1.7", name: "Commercial Offer CC Review on-time %", pillar: "A", unit: "PERCENTAGE", direction: "HIGHER", frequency: "MONTHLY", sla: "1 day", dataSource: "SharePoint/Email", targets: { JUNIOR: 95, ENGINEER: 96, SENIOR: 97, TEAM_LEAD: 98, SECTION_HEAD: 98 }, weights: { JUNIOR: 6, ENGINEER: 7, SENIOR: 6, TEAM_LEAD: 5, SECTION_HEAD: 4 } },
  { code: "A1.8", name: "PO CC Approval on-time %", pillar: "A", unit: "PERCENTAGE", direction: "HIGHER", frequency: "MONTHLY", sla: "1 day", dataSource: "Oracle R12", targets: { JUNIOR: 95, ENGINEER: 96, SENIOR: 97, TEAM_LEAD: 98, SECTION_HEAD: 98 }, weights: { JUNIOR: 12, ENGINEER: 10, SENIOR: 9, TEAM_LEAD: 8, SECTION_HEAD: 7 } },
  { code: "A1.9", name: "PR CC Approval on-time %", pillar: "A", unit: "PERCENTAGE", direction: "HIGHER", frequency: "MONTHLY", sla: "2 days", dataSource: "Oracle R12", targets: { JUNIOR: 95, ENGINEER: 96, SENIOR: 97, TEAM_LEAD: 98, SECTION_HEAD: 98 }, weights: { JUNIOR: 12, ENGINEER: 10, SENIOR: 9, TEAM_LEAD: 8, SECTION_HEAD: 7 } },
  { code: "A2.1", name: "PFR submitted on time %", pillar: "A", unit: "PERCENTAGE", direction: "HIGHER", frequency: "MONTHLY", sla: "15th monthly", dataSource: "SharePoint/Email", targets: { JUNIOR: 100, ENGINEER: 100, SENIOR: 100, TEAM_LEAD: 100, SECTION_HEAD: 100 }, weights: { JUNIOR: 8, ENGINEER: 8, SENIOR: 10, TEAM_LEAD: 12, SECTION_HEAD: 14 } },
  { code: "A2.2", name: "POC submitted on time %", pillar: "A", unit: "PERCENTAGE", direction: "HIGHER", frequency: "MONTHLY", sla: "20th monthly", dataSource: "SharePoint/Email", targets: { JUNIOR: 95, ENGINEER: 97, SENIOR: 98, TEAM_LEAD: 100, SECTION_HEAD: 100 }, weights: { JUNIOR: 6, ENGINEER: 7, SENIOR: 9, TEAM_LEAD: 10, SECTION_HEAD: 12 } },
  { code: "A2.3", name: "Invoicing report on time %", pillar: "A", unit: "PERCENTAGE", direction: "HIGHER", frequency: "MONTHLY", sla: "20th monthly", dataSource: "SharePoint/Email", targets: { JUNIOR: 95, ENGINEER: 97, SENIOR: 98, TEAM_LEAD: 100, SECTION_HEAD: 100 }, weights: { JUNIOR: 6, ENGINEER: 7, SENIOR: 9, TEAM_LEAD: 10, SECTION_HEAD: 12 } },
  { code: "A2.4", name: "Cash report on time %", pillar: "A", unit: "PERCENTAGE", direction: "HIGHER", frequency: "MONTHLY", sla: "20th monthly", dataSource: "SharePoint/Email", targets: { JUNIOR: 95, ENGINEER: 97, SENIOR: 98, TEAM_LEAD: 100, SECTION_HEAD: 100 }, weights: { JUNIOR: 5, ENGINEER: 5, SENIOR: 6, TEAM_LEAD: 7, SECTION_HEAD: 8 } },
  { code: "A2.5", name: "PAG totals to PM on time %", pillar: "A", unit: "PERCENTAGE", direction: "HIGHER", frequency: "QUARTERLY", sla: "15th quarterly", dataSource: "SharePoint/Email", targets: { JUNIOR: 100, ENGINEER: 100, SENIOR: 100, TEAM_LEAD: 100, SECTION_HEAD: 100 }, weights: { JUNIOR: 3, ENGINEER: 4, SENIOR: 5, TEAM_LEAD: 7, SECTION_HEAD: 8 } },
  { code: "A2.6", name: "PAG to Excellence/Governance on time %", pillar: "A", unit: "PERCENTAGE", direction: "HIGHER", frequency: "MONTHLY", sla: "15th monthly", dataSource: "SharePoint/Email", targets: { JUNIOR: 95, ENGINEER: 97, SENIOR: 98, TEAM_LEAD: 100, SECTION_HEAD: 100 }, weights: { JUNIOR: 4, ENGINEER: 5, SENIOR: 6, TEAM_LEAD: 8, SECTION_HEAD: 10 } },
  { code: "A2.7", name: "Executive presentation on time %", pillar: "A", unit: "PERCENTAGE", direction: "HIGHER", frequency: "MONTHLY", sla: "22nd monthly", dataSource: "SharePoint/Email", targets: { JUNIOR: 95, ENGINEER: 97, SENIOR: 98, TEAM_LEAD: 100, SECTION_HEAD: 100 }, weights: { JUNIOR: 3, ENGINEER: 4, SENIOR: 5, TEAM_LEAD: 6, SECTION_HEAD: 6 } },

  // ── Pillar B: Data Quality & Governance ──
  { code: "B1", name: "Data defects rate per report", pillar: "B", unit: "PERCENTAGE", direction: "LOWER", frequency: "MONTHLY", formula: "(Total defects logged) / (Total audited items)", targets: { JUNIOR: 5, ENGINEER: 4, SENIOR: 3, TEAM_LEAD: 2, SECTION_HEAD: 2 }, weights: { JUNIOR: 25, ENGINEER: 20, SENIOR: 20, TEAM_LEAD: 20, SECTION_HEAD: 15 } },
  { code: "B2", name: "First Pass Accept Rate (FPA)", pillar: "B", unit: "PERCENTAGE", direction: "HIGHER", frequency: "MONTHLY", formula: "(# reports accepted with no rework) / (Total audited)", targets: { JUNIOR: 90, ENGINEER: 92, SENIOR: 94, TEAM_LEAD: 95, SECTION_HEAD: 95 }, weights: { JUNIOR: 25, ENGINEER: 30, SENIOR: 35, TEAM_LEAD: 35, SECTION_HEAD: 35 } },
  { code: "B3", name: "DMS Compliance", pillar: "B", unit: "PERCENTAGE", direction: "HIGHER", frequency: "MONTHLY", formula: "(# files compliant) / (Total files checked)", targets: { JUNIOR: 95, ENGINEER: 96, SENIOR: 97, TEAM_LEAD: 98, SECTION_HEAD: 99 }, weights: { JUNIOR: 25, ENGINEER: 30, SENIOR: 30, TEAM_LEAD: 35, SECTION_HEAD: 40 } },
  { code: "B4", name: "Follow CC Standards & Procedures", pillar: "B", unit: "BINARY", direction: "BINARY", frequency: "MONTHLY", targets: { JUNIOR: 1, ENGINEER: 1, SENIOR: 1, TEAM_LEAD: 1, SECTION_HEAD: 1 }, weights: { JUNIOR: 25, ENGINEER: 20, SENIOR: 15, TEAM_LEAD: 10, SECTION_HEAD: 10 } },

  // ── Pillar C: Forecasting & Cost Control Effectiveness ──
  { code: "C1", name: "Forecast Uncertainty % (FU%)", pillar: "C", unit: "PERCENTAGE", direction: "LOWER", frequency: "MONTHLY", formula: "|EAC(t) − EAC(t−1)| / EAC(t−1) × 100", targets: { JUNIOR: 12, ENGINEER: 12, SENIOR: 12, TEAM_LEAD: 12, SECTION_HEAD: 12 }, weights: { JUNIOR: 30, ENGINEER: 35, SENIOR: 40, TEAM_LEAD: 45, SECTION_HEAD: 50 } },
  { code: "C2", name: "Action Adoption", pillar: "C", unit: "BINARY", direction: "BINARY", frequency: "MONTHLY", formula: "Pass if recommended actions exist in month", targets: { JUNIOR: 1, ENGINEER: 1, SENIOR: 1, TEAM_LEAD: 1, SECTION_HEAD: 1 }, weights: { JUNIOR: 20, ENGINEER: 20, SENIOR: 20, TEAM_LEAD: 15, SECTION_HEAD: 15 } },
  { code: "C3", name: "Achievement Rate %", pillar: "C", unit: "PERCENTAGE", direction: "HIGHER", frequency: "MONTHLY", formula: "(# actions achieved & verified) / (# total actions) × 100", targets: { JUNIOR: 70, ENGINEER: 75, SENIOR: 80, TEAM_LEAD: 85, SECTION_HEAD: 90 }, weights: { JUNIOR: 50, ENGINEER: 45, SENIOR: 40, TEAM_LEAD: 40, SECTION_HEAD: 35 } },

  // ── Pillar D: Communication & Stakeholders ──
  { code: "D1", name: "No. of complaints and reminder emails", pillar: "D", unit: "COUNT", direction: "LOWER", frequency: "MONTHLY", formula: "Count of complaints/reminders received", targets: { JUNIOR: 5, ENGINEER: 4, SENIOR: 3, TEAM_LEAD: 2, SECTION_HEAD: 1 }, weights: { JUNIOR: 60, ENGINEER: 55, SENIOR: 45, TEAM_LEAD: 35, SECTION_HEAD: 30 } },
  { code: "D2", name: "Stakeholder Score", pillar: "D", unit: "SCORE", direction: "HIGHER", frequency: "QUARTERLY", formula: "AVG survey score (accuracy, timeliness, proactivity, value)", targets: { JUNIOR: 2.5, ENGINEER: 2.5, SENIOR: 2.5, TEAM_LEAD: 2.5, SECTION_HEAD: 2.5 }, weights: { JUNIOR: 40, ENGINEER: 45, SENIOR: 55, TEAM_LEAD: 65, SECTION_HEAD: 70 } },

  // ── Pillar E: Attendance, Reliability & Professional Conduct ──
  { code: "E1", name: "Attendance days %", pillar: "E", unit: "PERCENTAGE", direction: "HIGHER", frequency: "MONTHLY", formula: "(Days attended) / (Planned working days)", targets: { JUNIOR: 98, ENGINEER: 98, SENIOR: 98, TEAM_LEAD: 98, SECTION_HEAD: 98 }, weights: { JUNIOR: 45, ENGINEER: 40, SENIOR: 30, TEAM_LEAD: 20, SECTION_HEAD: 15 } },
  { code: "E2", name: "On-time arrival %", pillar: "E", unit: "PERCENTAGE", direction: "HIGHER", frequency: "MONTHLY", formula: "(Days on-time) / (Attendance days)", targets: { JUNIOR: 95, ENGINEER: 95, SENIOR: 95, TEAM_LEAD: 95, SECTION_HEAD: 95 }, weights: { JUNIOR: 35, ENGINEER: 35, SENIOR: 25, TEAM_LEAD: 20, SECTION_HEAD: 15 } },
  { code: "E3", name: "Internal meetings attendance %", pillar: "E", unit: "PERCENTAGE", direction: "HIGHER", frequency: "MONTHLY", formula: "(# meetings attended) / (Total required)", targets: { JUNIOR: 97, ENGINEER: 97, SENIOR: 97, TEAM_LEAD: 95, SECTION_HEAD: 95 }, weights: { JUNIOR: 10, ENGINEER: 15, SENIOR: 30, TEAM_LEAD: 45, SECTION_HEAD: 55 } },
  { code: "E4", name: "Professional appearance", pillar: "E", unit: "BINARY", direction: "BINARY", frequency: "MONTHLY", targets: { JUNIOR: 1, ENGINEER: 1, SENIOR: 1, TEAM_LEAD: 1, SECTION_HEAD: 1 }, weights: { JUNIOR: 10, ENGINEER: 10, SENIOR: 15, TEAM_LEAD: 15, SECTION_HEAD: 15 } },

  // ── Pillar F: Growth, Coaching & Department Contribution ──
  { code: "F1", name: "Training completion vs plan %", pillar: "F", unit: "PERCENTAGE", direction: "HIGHER", frequency: "QUARTERLY", formula: "(# completed & accepted) / (Total planned)", targets: { JUNIOR: 90, ENGINEER: 90, SENIOR: 95, TEAM_LEAD: 100, SECTION_HEAD: 100 }, weights: { JUNIOR: 60, ENGINEER: 55, SENIOR: 45, TEAM_LEAD: 40, SECTION_HEAD: 35 } },
  { code: "F2", name: "Training Pass %", pillar: "F", unit: "PERCENTAGE", direction: "HIGHER", frequency: "MONTHLY", formula: "(# passed) / (Total registered)", targets: { JUNIOR: 90, ENGINEER: 90, SENIOR: 95, TEAM_LEAD: 95, SECTION_HEAD: 95 }, weights: { JUNIOR: 40, ENGINEER: 45, SENIOR: 55, TEAM_LEAD: 60, SECTION_HEAD: 65 } },
]

// ─────────────────────────────────────
// DEMO USERS (Section 21)
// ─────────────────────────────────────

const demoUsers = [
  { email: "admin@elsewedy.com", password: "Admin@2025", firstName: "Admin", lastName: "User", role: "ADMIN" as const, tier: "SECTION_HEAD" as const, jobTitle: "System Administrator" },
  { email: "manager@elsewedy.com", password: "Manager@2025", firstName: "Manager", lastName: "User", role: "MANAGER" as const, tier: "TEAM_LEAD" as const, jobTitle: "Cost Control Team Lead" },
  { email: "engineer@elsewedy.com", password: "User@2025", firstName: "Engineer", lastName: "User", role: "USER" as const, tier: "ENGINEER" as const, jobTitle: "Cost Control Engineer" },
]

// ─────────────────────────────────────
// MAIN SEED FUNCTION
// ─────────────────────────────────────

async function main() {
  console.log("🌱 Seeding database...")

  // 1. Create company
  const company = await prisma.company.upsert({
    where: { id: "elsewedy-electric" },
    update: {},
    create: {
      id: "elsewedy-electric",
      name: "Elsewedy Electric",
      sector: "EPC / Engineering",
    },
  })
  console.log("  ✓ Company created")

  // 2. Create department
  const department = await prisma.department.upsert({
    where: { id: "cost-control" },
    update: {},
    create: {
      id: "cost-control",
      name: "Cost Control",
      companyId: company.id,
    },
  })
  console.log("  ✓ Department created")

  // 3. Create pillars
  const pillarMap: Record<string, string> = {}
  for (const p of pillars) {
    const pillar = await prisma.pillar.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    })
    pillarMap[p.code] = pillar.id
  }
  console.log("  ✓ 6 Pillars created")

  // 4. Create pillar weights (30 records: 6 pillars × 5 tiers)
  const tiers: Tier[] = ["JUNIOR", "ENGINEER", "SENIOR", "TEAM_LEAD", "SECTION_HEAD"]
  for (const [pillarCode, tierWeights] of Object.entries(pillarWeights)) {
    const pillarId = pillarMap[pillarCode]!
    for (const tier of tiers) {
      await prisma.pillarWeight.upsert({
        where: { pillarId_tier: { pillarId, tier } },
        update: { weight: tierWeights[tier] },
        create: { pillarId, tier, weight: tierWeights[tier] },
      })
    }
  }
  console.log("  ✓ 30 Pillar Weights created")

  // 5. Create alpha configs (12 records: 6 pillars × 2 manager tiers)
  for (const ac of alphaConfigs) {
    const pillarId = pillarMap[ac.pillar]!
    await prisma.alphaConfig.upsert({
      where: { pillarId_tier: { pillarId, tier: ac.tier } },
      update: { alphaTeam: ac.alphaTeam, alphaPersonal: ac.alphaPersonal },
      create: { pillarId, tier: ac.tier, alphaTeam: ac.alphaTeam, alphaPersonal: ac.alphaPersonal },
    })
  }
  console.log("  ✓ 12 Alpha Configs created")

  // 6. Create KPI definitions, targets, and sub-weights
  let kpiCount = 0
  let targetCount = 0
  let weightCount = 0

  for (const kpi of kpiDefinitions) {
    const pillarId = pillarMap[kpi.pillar]!
    const kpiDef = await prisma.kpiDefinition.upsert({
      where: { code: kpi.code },
      update: {},
      create: {
        code: kpi.code,
        name: kpi.name,
        pillarId,
        unit: kpi.unit,
        direction: kpi.direction,
        frequency: kpi.frequency,
        sla: kpi.sla,
        dataSource: kpi.dataSource,
        formula: kpi.formula,
        sortOrder: kpiCount,
      },
    })
    kpiCount++

    // Create targets for each tier
    for (const tier of tiers) {
      const targetValue = kpi.targets[tier]
      const targetOperator = kpi.direction === "LOWER" ? "<=" : kpi.direction === "BINARY" ? "==" : ">="

      await prisma.kpiTarget.upsert({
        where: { kpiDefinitionId_tier: { kpiDefinitionId: kpiDef.id, tier } },
        update: { targetValue, targetOperator },
        create: { kpiDefinitionId: kpiDef.id, tier, targetValue, targetOperator },
      })
      targetCount++
    }

    // Create sub-KPI weights for each tier
    for (const tier of tiers) {
      await prisma.subKpiWeight.upsert({
        where: { kpiDefinitionId_tier: { kpiDefinitionId: kpiDef.id, tier } },
        update: { weight: kpi.weights[tier] },
        create: { kpiDefinitionId: kpiDef.id, tier, weight: kpi.weights[tier] },
      })
      weightCount++
    }
  }
  console.log(`  ✓ ${kpiCount} KPI Definitions created`)
  console.log(`  ✓ ${targetCount} KPI Targets created`)
  console.log(`  ✓ ${weightCount} Sub-KPI Weights created`)

  // 7. Create demo users
  for (const user of demoUsers) {
    const hashedPassword = await bcrypt.hash(user.password, 12)
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        passwordHash: hashedPassword,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tier: user.tier,
        jobTitle: user.jobTitle,
        companyId: company.id,
        departmentId: department.id,
      },
    })
  }
  console.log("  ✓ 3 Demo Users created")

  // 8. Create demo evaluation period (current month)
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const monthName = now.toLocaleString("en", { month: "long", year: "numeric" })

  await prisma.evalPeriod.upsert({
    where: { id: "current-period" },
    update: {},
    create: {
      id: "current-period",
      name: monthName,
      periodType: "MONTHLY",
      startDate: startOfMonth,
      endDate: endOfMonth,
      isActive: true,
    },
  })
  console.log("  ✓ Demo Eval Period created")

  console.log("\n✅ Seed complete!")
  console.log(`   Total: 1 company, 1 department, 6 pillars, ${kpiCount} KPIs, ${targetCount} targets, ${weightCount} weights, 30 pillar weights, 12 alpha configs, 3 users, 1 eval period`)
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
