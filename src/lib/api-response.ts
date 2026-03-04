import { NextResponse } from "next/server"

interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function success<T>(data: T, meta?: PaginationMeta) {
  return NextResponse.json({ data, meta })
}

export function error(
  status: number,
  code: string,
  message: string,
  details?: { field: string; message: string }[]
) {
  return NextResponse.json({ error: { code, message, details } }, { status })
}
