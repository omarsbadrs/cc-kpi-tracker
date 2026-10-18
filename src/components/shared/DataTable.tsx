"use client"

import { EmptyState } from "./EmptyState"

interface Column<T> {
  key: string
  header: string
  render?: (item: T) => React.ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyField: string
  emptyMessage?: string
  onRowClick?: (item: T) => void
  /** Accessible name for the scrolling region. */
  label?: string
}

/** A ruled table in a card that scrolls inside its own rail, never the page. */
export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  emptyMessage = "Nothing to show yet",
  onRowClick,
  label = "Table",
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="card-list">
        <EmptyState title={emptyMessage} />
      </div>
    )
  }

  return (
    <div className="card-list">
      <div className="table-scroll" tabIndex={0} role="region" aria-label={label}>
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} scope="col" className={col.className}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={String(item[keyField])}
                className={onRowClick ? "clickable" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={() => onRowClick?.(item)}
                onKeyDown={(e) => {
                  if (onRowClick && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault()
                    onRowClick(item)
                  }
                }}
              >
                {columns.map((col) => (
                  <td key={col.key} className={col.className}>
                    {col.render ? col.render(item) : String(item[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
