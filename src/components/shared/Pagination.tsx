"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

/** A band footer for a list card: "Page 2 of 8" and previous/next. */
export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="pager">
      <span className="tabular">
        Page {page} of {totalPages}
      </span>
      <div className="pager-actions">
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft size={15} aria-hidden="true" />
          Previous
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
