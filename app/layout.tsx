import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { BRAND_NAME } from "@/lib/brand";
import { appOrigin } from "@/lib/server/commerce";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const DESCRIPTION =
  "Building202 turns overwhelming bureaucratic problems — DMV issues, job separation, insurance denials, veteran benefits, tenant rights, business compliance — into organized cases with clear next steps.";

export const metadata: Metadata = {
  // Absolute URLs (canonical links, Open Graph) resolve against the deployment's
  // configured public URL (BUREAUOS_APP_URL; production value in .env.example).
  metadataBase: new URL(appOrigin()),
  applicationName: BRAND_NAME,
  title: {
    default: `${BRAND_NAME} — Navigate bureaucracy with a plan`,
    template: `%s · ${BRAND_NAME}`,
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    title: `${BRAND_NAME} — Navigate bureaucracy with a plan`,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
