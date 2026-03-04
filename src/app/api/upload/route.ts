import { withAuth } from "@/lib/api-handler"
import { success, error } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { uploadEvidence, deleteFile } from "@/lib/file-storage"
import { MAX_FILES_PER_ACTUAL } from "@/lib/validations/upload"
import { logger } from "@/lib/logger"

export const POST = withAuth(async (req, { session }) => {
  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const actualId = formData.get("actualId") as string | null

  if (!file || !actualId) {
    return error(400, "VALIDATION_ERROR", "File and actualId are required")
  }

  if (file.size > 50 * 1024 * 1024) {
    return error(400, "VALIDATION_ERROR", "File size exceeds 50 MB limit")
  }

  // Validate file type
  const allowedTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/png",
    "image/jpeg",
    "application/zip",
  ]
  if (!allowedTypes.includes(file.type)) {
    return error(
      400,
      "VALIDATION_ERROR",
      `File type "${file.type}" is not allowed. Supported types: PDF, DOCX, XLSX, CSV, PPTX, PNG, JPG, ZIP`
    )
  }

  // Check existing file count for this actual
  const existingCount = await prisma.evidenceFile.count({
    where: { actualId },
  })
  if (existingCount >= MAX_FILES_PER_ACTUAL) {
    return error(
      400,
      "VALIDATION_ERROR",
      `Maximum ${MAX_FILES_PER_ACTUAL} files per actual submission`
    )
  }

  // Verify the actual exists and the user owns it (or is admin)
  const actual = await prisma.kpiActual.findUnique({
    where: { id: actualId },
    include: { assignment: { include: { user: true } } },
  })

  if (!actual) return error(404, "NOT_FOUND", "Actual not found")

  if (
    actual.userId !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    return error(
      403,
      "FORBIDDEN",
      "You can only upload evidence for your own actuals"
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  const storagePath = await uploadEvidence(
    buffer,
    file.name,
    session.user.id,
    actual.evalPeriodId,
    actual.assignment.user.companyId
  )

  const evidence = await prisma.evidenceFile.create({
    data: {
      actualId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      storagePath,
    },
  })

  logger.info(
    {
      userId: session.user.id,
      fileName: file.name,
      fileSize: file.size,
      actualId,
    },
    "Evidence uploaded"
  )
  return success(evidence)
})

export const DELETE = withAuth(async (req, { session }) => {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return error(400, "VALIDATION_ERROR", "Missing evidence file ID")

  const evidence = await prisma.evidenceFile.findUnique({
    where: { id },
    include: { actual: true },
  })

  if (!evidence) return error(404, "NOT_FOUND", "Evidence file not found")

  // Only the owner or admin can delete evidence
  if (
    evidence.actual.userId !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    return error(
      403,
      "FORBIDDEN",
      "You can only delete your own evidence files"
    )
  }

  // Delete from Supabase Storage
  await deleteFile(evidence.storagePath)

  // Delete from database
  await prisma.evidenceFile.delete({ where: { id } })

  logger.info(
    {
      userId: session.user.id,
      evidenceId: id,
      fileName: evidence.fileName,
    },
    "Evidence deleted"
  )
  return success({ message: "Evidence file deleted" })
})
