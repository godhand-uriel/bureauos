import type { MetadataRoute } from "next";
import { appOrigin } from "@/lib/server/commerce";

// Read per request, so the configured public URL (BUREAUOS_APP_URL) is used
// even if it was not set when the app was built.
export const dynamic = "force-dynamic";

/** Public marketing and legal pages may be indexed; signed-in areas and the API may not. */
export default function robots(): MetadataRoute.Robots {
  const origin = appOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/pricing", "/legal/"],
      disallow: [
        "/api/",
        "/admin",
        "/dashboard",
        "/cases",
        "/checkout",
        "/billing",
        "/settings",
        "/support",
        "/assistant",
        "/navigators",
        "/reset-password",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
