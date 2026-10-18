import type { ReactNode } from "react"
import { PageHead } from "@/components/ui/PageHead"

interface PageHeaderProps {
  title: string
  description?: ReactNode
  action?: ReactNode
  back?: { href: string; label: string }
}

/** Kept for existing screens; renders the design system's page head. */
export function PageHeader({ title, description, action, back }: PageHeaderProps) {
  return <PageHead title={title} sub={description} actions={action} back={back} />
}
