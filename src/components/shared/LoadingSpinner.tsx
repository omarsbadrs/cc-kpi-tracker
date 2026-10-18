/** Quiet loading line. Sizes are kept for old call sites; all render alike. */
export function LoadingSpinner({ label = "Loading…" }: { size?: "sm" | "md" | "lg"; label?: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  )
}
