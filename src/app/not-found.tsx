import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
      <div className="text-center">
        <div className="mb-4 text-8xl font-bold text-foreground-muted">404</div>
        <h1 className="mb-2 text-xl font-semibold text-foreground">Page not found</h1>
        <p className="mb-6 text-sm text-foreground-muted">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
