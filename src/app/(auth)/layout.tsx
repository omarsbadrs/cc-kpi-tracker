import { ThemeSwitch } from "@/components/layout/ThemeSwitch"
import "@/styles/views/account.css"

/* Sign-in, forgot and reset password: one ruled card centred on the page
   ground, outside the app shell. The card and its wordmark live here so every
   auth screen reads the same; each page brings its own title and form. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="auth-shell">
      <main className="auth-card">
        {/* Light/dark switch in the card's top-end corner. */}
        <div className="auth-corner">
          <ThemeSwitch />
        </div>
        <div className="auth-brand justify-center">
          {/* One wordmark per theme; the hidden one is display:none, so only
              the visible image is announced. */}
          <img src="/logo-light.svg" alt="Elsewedy Electric PSP" className="brand-logo brand-logo-light" />
          <img src="/logo.svg" alt="Elsewedy Electric PSP" className="brand-logo brand-logo-dark" />
        </div>
        {children}
      </main>
    </div>
  )
}
