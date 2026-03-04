// Locale routing configuration for next-intl
// MVP: English only. Future: Arabic RTL support.

export const locales = ["en"] as const
export const defaultLocale = "en" as const

export type Locale = (typeof locales)[number]
