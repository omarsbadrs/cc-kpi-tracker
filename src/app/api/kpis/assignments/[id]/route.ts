import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api-handler"
import { success, error } from "@/lib/api-response"

export const GET = withAuth(async (req, { session, params }) => {
  const id = params?.id
  if (!id) return error(400, "VALIDATION_ERROR", "Missing assignment ID")

  const assignment = await prisma.kpiAssignment.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          tier: true,
          role: true,
        },
      },
      kpiDefinition: {
        include: {
          pillar: { select: { code: true, name: true } },
          targets: true,
        },
      },
      evalPeriod: {
        select: { name: true, startDate: true, endDate: true },
      },
      actuals: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  })

  if (!assignment) return error(404, "NOT_FOUND", "Assignment not found")

  // Non-admin/manager can only view their own assignments
  if (
    session.user.role === "USER" &&
    assignment.userId !== session.user.id
  ) {
    return error(403, "FORBIDDEN", "You can only view your own assignments")
  }

  return success(assignment)
})
