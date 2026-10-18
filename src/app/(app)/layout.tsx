"use client"

import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { TabBar } from "@/components/layout/TabBar"

/**
 * The shell: on desktop two panels (navigation, content) floating on the
 * page ground; on a phone the content is the whole screen with a tab bar.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="app" id="app">
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById("main")?.focus()
        }}
      >
        Skip to content
      </a>
      <div className="shell">
        <Sidebar />
        <main id="main" className="main" tabIndex={-1}>
          <div className="main-inner">
            {/* Keyed so each route plays the view-in animation. */}
            <div className="view" key={pathname}>
              {children}
            </div>
          </div>
        </main>
      </div>
      <TabBar />
    </div>
  )
}
