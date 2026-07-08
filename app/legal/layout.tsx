import { PublicShell } from "@/components/public-shell";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicShell>
      <div className="container max-w-3xl py-12 lg:py-16">{children}</div>
    </PublicShell>
  );
}
