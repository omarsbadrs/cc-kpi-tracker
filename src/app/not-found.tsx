import Link from "next/link"
import { FileQuestion } from "lucide-react"
import "@/styles/views/account.css"

export default function NotFound() {
  return (
    <div className="auth-shell">
      <main className="card status-card">
        <div className="empty">
          <FileQuestion size={22} strokeWidth={1.6} aria-hidden="true" className="empty-icon" />
          <h1>Page not found</h1>
          <p>The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
          <div className="empty-actions">
            <Link href="/dashboard" className="btn btn-primary">
              Go to dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
