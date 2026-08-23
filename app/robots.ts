import type { MetadataRoute } from "next"

// A dashboard nem kereshető. A noindex három helyen szerepel: itt, a layout
// metadata-jában, és X-Robots-Tag fejlécként a next.config.ts-ben.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  }
}
