import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "BureauOS — Navigate bureaucracy with a plan",
    template: "%s · BureauOS",
  },
  description:
    "BureauOS turns overwhelming bureaucratic problems — DMV issues, job separation, insurance denials, veteran benefits, tenant rights, business compliance — into organized cases with clear next steps.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
