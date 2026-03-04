import { createServiceClient } from "./supabase/server"

export async function uploadEvidence(
  file: Buffer,
  fileName: string,
  userId: string,
  periodId: string,
  companyId: string
): Promise<string> {
  const supabase = createServiceClient()
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
  const path = `${companyId}/${userId}/${periodId}/${Date.now()}_${safeName}`

  const { data, error } = await supabase.storage
    .from("kpi-evidence")
    .upload(path, file, { upsert: false })

  if (error) throw new Error(`Upload failed: ${error.message}`)
  return data.path
}

export async function getSignedUrl(storagePath: string): Promise<string> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.storage
    .from("kpi-evidence")
    .createSignedUrl(storagePath, 3600)

  if (error) throw new Error(`Signed URL failed: ${error.message}`)
  return data.signedUrl
}

export async function deleteFile(storagePath: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.storage
    .from("kpi-evidence")
    .remove([storagePath])

  if (error) throw new Error(`Delete failed: ${error.message}`)
}
