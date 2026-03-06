import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api-handler"
import { success, error } from "@/lib/api-response"
import { parsePagination, paginateQuery, buildMeta } from "@/lib/pagination"
import { createUserSchema } from "@/lib/validations/users"
import bcrypt from "bcryptjs"
import { logger } from "@/lib/logger"

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url)
  const { page, pageSize, sortBy, sortOrder } = parsePagination(searchParams)

  const role = searchParams.get("role") || undefined
  const tier = searchParams.get("tier") || undefined
  const search = searchParams.get("search") || undefined

  const where: Record<string, unknown> = {}
  if (role) where.role = role
  if (tier) where.tier = tier
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { employeeId: { contains: search, mode: "insensitive" } },
    ]
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        role: true,
        tier: true,
        jobTitle: true,
        isActive: true,
        avatarUrl: true,
        departmentId: true,
        managerId: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { [sortBy || "createdAt"]: sortOrder },
      ...paginateQuery(page, pageSize),
    }),
    prisma.user.count({ where }),
  ])

  return success(users, buildMeta(page, pageSize, total))
}, "ADMIN")

export const POST = withAuth(async (req, { session }) => {
  const body = await req.json()
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return error(
      400,
      "VALIDATION_ERROR",
      "Invalid input",
      parsed.error.issues.map((i) => ({
        field: String(i.path[0]),
        message: i.message,
      }))
    )
  }

  const data = parsed.data
  const existing = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  })
  if (existing) {
    return error(409, "CONFLICT", "A user with this email already exists")
  }

  const passwordHash = await bcrypt.hash(data.password, 12)

  const company = await prisma.company.findFirst()
  if (!company) {
    return error(500, "INTERNAL_ERROR", "No company found in the system")
  }

  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      employeeId: data.employeeId,
      role: data.role,
      tier: data.tier,
      jobTitle: data.jobTitle,
      departmentId: data.departmentId,
      managerId: data.managerId,
      nationality: data.nationality,
      companyId: company.id,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      tier: true,
      createdAt: true,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE_USER",
      entity: "user",
      entityId: user.id,
      newValue: { email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, tier: user.tier },
    },
  })

  logger.info({ userId: user.id }, "User created")
  return success(user)
}, "ADMIN")
