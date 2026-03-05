// i18n request config — MVP: English only
// When next-intl is added back, restore: import { getRequestConfig } from "next-intl/server"

export const locale = "en"

export async function getMessages() {
  return (await import("../messages/en.json")).default
}
