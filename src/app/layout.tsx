import type { Metadata, Viewport } from "next"
import { Providers } from "@/components/providers"
import { THEME_BOOT_SCRIPT } from "@/lib/theme"
import "./globals.css"

export const metadata: Metadata = {
  title: "Cost Control KPI Tracker — Elsewedy Electric PSP",
  description: "Cost Control Department KPI Performance Management System",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Matches --page in each theme; kept in sync by the theme provider.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d10" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Stamps data-theme before first paint so a dark choice never
            flashes light (and the reverse). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
