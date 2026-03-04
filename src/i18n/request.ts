import { getRequestConfig } from "next-intl/server"

export default getRequestConfig(async () => {
  const locale = "en" // MVP: English only, future: detect from user preference

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
