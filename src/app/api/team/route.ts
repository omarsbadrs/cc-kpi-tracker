import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api-handler"
import { success, error } from "@/lib/api-response"
import { z } from "zod"

const selectFields = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  employeeId: true,
  role: true as const,
  tier: true as const,
  jobTitle: true,
  isActive: true,
  avatarUrl: true,
  managerId: true,
  nationality: true,
  graduationYear: true,
  lastLoginAt: true,
}

/** Recursively collect all descendant user IDs under a given manager */
function collectDescendantIds(
  rootId: string,
  index: Map<string, string[]>  // managerId → [childIds]
): string[] {
  const children = index.get(rootId) ?? []
  const result: string[] = [...children]
  for (const childId of children) {
    result.push(...collectDescendantIds(childId, index))
  }
  return result
}

// Returns team hierarchy:
// - ADMIN: full allUsers list for the org chart tree
// - MANAGER: self + all descendants (recursive) as allUsers
export const GET = withAuth(async (req, { session }) => {
  const userRole = session.user.role
  const userId = session.user.id

  if (userRole === "ADMIN") {
    const managers = await prisma.user.findMany({
      where: {
        OR: [
          { role: "MANAGER" },
          { role: "ADMIN" },
        ],
      },
      select: {
        ...selectFields,
        reports: {
          select: selectFields,
          orderBy: { firstName: "asc" },
        },
      },
      orderBy: [{ tier: "desc" }, { firstName: "asc" }],
    })

    const unassigned = await prisma.user.findMany({
      where: {
        managerId: null,
        role: "USER",
      },
      select: selectFields,
      orderBy: { firstName: "asc" },
    })

    const allUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: selectFields,
      orderBy: [{ firstName: "asc" }],
    })

    return success({ managers, unassigned, allUsers })
  }

  // MANAGER: fetch all active users, find the manager + all their descendants
  const everyone = await prisma.user.findMany({
    where: { isActive: true },
    select: selectFields,
    orderBy: [{ firstName: "asc" }],
  })

  // Build managerId → childIds index
  const childIndex = new Map<string, string[]>()
  for (const u of everyone) {
    if (u.managerId) {
      const arr = childIndex.get(u.managerId) ?? []
      arr.push(u.id)
      childIndex.set(u.managerId, arr)
    }
  }

  const descendantIds = new Set([userId, ...collectDescendantIds(userId, childIndex)])
  const allUsers = everyone.filter((u) => descendantIds.has(u.id))

  return success({ allUsers })
}, "MANAGER")

// Reassign members to a manager (ADMIN only)
// Supports single: { userId, managerId }
// Supports bulk:   { userIds, managerId }
const reassignSchema = z.union([
  z.object({
    userId: z.string().cuid(),
    managerId: z.string().cuid().nullable(),
  }),
  z.object({
    userIds: z.array(z.string().cuid()).min(1).max(100),
    managerId: z.string().cuid().nullable(),
  }),
])

export const PATCH = withAuth(async (req) => {
  const body = await req.json()
  const parsed = reassignSchema.safeParse(body)

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
  const managerId = data.managerId
  const userIds = "userIds" in data ? data.userIds : [data.userId]

  // Verify manager exists if provided
  if (managerId) {
    const manager = await prisma.user.findUnique({ where: { id: managerId }, select: { id: true } })
    if (!manager) {
      return error(404, "NOT_FOUND", "Manager not found")
    }
    // Filter out self-assignment
    const filtered = userIds.filter((id) => id !== managerId)
    if (filtered.length === 0) {
      return error(400, "VALIDATION_ERROR", "Cannot assign a user as their own manager")
    }

    await prisma.user.updateMany({
      where: { id: { in: filtered } },
      data: { managerId },
    })

    return success({ updated: filtered.length })
  }

  // Unassign (set managerId to null)
  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { managerId: null },
  })

  return success({ updated: userIds.length })
}, "ADMIN")
