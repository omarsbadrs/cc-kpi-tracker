import { Search } from "lucide-react"
import type { InputHTMLAttributes, ReactNode } from "react"

/**
 * `.field` > `.field-label` + control. Pass `htmlFor` matching the control's
 * id so the label lands on the real control, never on a wrapper.
 */
export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode
  hint?: ReactNode
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`field${className ? ` ${className}` : ""}`}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {hint && <span className="field-hint"> {hint}</span>}
      </label>
      {children}
    </div>
  )
}

/** Wraps a `<select className="select">` so the CSS chevron is drawn. */
export function SelectWrap({ children }: { children: ReactNode }) {
  return <div className="select-wrap">{children}</div>
}

/** Toolbar search: icon at inline-start, `.input.search-input`. */
export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="search-wrap">
      <Search size={16} aria-hidden="true" />
      <input type="search" {...props} className={`input search-input${props.className ? ` ${props.className}` : ""}`} />
    </div>
  )
}
