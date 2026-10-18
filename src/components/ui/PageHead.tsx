import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import type { ReactNode } from "react"

interface PageHeadProps {
  /** One h1 per page, sentence case. */
  title: ReactNode
  /** A short sentence, or facts joined with " · ". */
  sub?: ReactNode
  /** Buttons; the primary goes last. */
  actions?: ReactNode
  /** Leaf pages: a link back to the parent, named for where it goes. */
  back?: { href: string; label: string }
  /** Sits beside the title (a status chip). */
  titleAside?: ReactNode
}

export function PageHead({ title, sub, actions, back, titleAside }: PageHeadProps) {
  return (
    <>
      {back && (
        <div className="back-row">
          <Link href={back.href} className="back-link">
            <ChevronLeft size={17} aria-hidden="true" />
            {back.label}
          </Link>
        </div>
      )}
      <div className="page-head">
        <div>
          {titleAside ? (
            <div className="detail-title-row">
              <h1 className="page-title">{title}</h1>
              {titleAside}
            </div>
          ) : (
            <h1 className="page-title">{title}</h1>
          )}
          {sub && <p className="page-sub">{sub}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
    </>
  )
}
