import { z } from "zod"

export const uploadSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.enum([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/png",
    "image/jpeg",
    "application/zip",
  ]),
  fileSize: z.number().max(50 * 1024 * 1024, "Max file size is 50 MB"),
})

export const MAX_FILES_PER_ACTUAL = 5
export const MAX_FILE_SIZE_MB = 50
