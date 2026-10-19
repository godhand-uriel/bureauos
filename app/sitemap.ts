import type { MetadataRoute } from "next";
import { appOrigin } from "@/lib/server/commerce";

// Read per request, so the configured public URL (BUREAUOS_APP_URL) is used.
export const dynamic = "force-dynamic";

/** The public pages only — everything else needs an account. */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = appOrigin();
  return ["/", "/pricing", "/legal/terms", "/legal/privacy", "/legal/disclaimer"].map((path) => ({
    url: `${origin}${path}`,
  }));
}
