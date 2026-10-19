import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandWordmark } from "@/components/brand-wordmark";

/** Header/footer wrapper for public marketing & legal pages. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          {/* Below 360px the name, Log in and Create account don't fit beside the
              icon tile, so the tile drops and the name stays. */}
          <BrandWordmark iconClassName="max-[359px]:hidden" />
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link href="/pricing" className="hidden px-3 text-sm text-muted-foreground transition-colors hover:text-foreground sm:block">
              Pricing
            </Link>
            <Link href="/login" className="whitespace-nowrap px-2 text-sm sm:px-3 text-muted-foreground transition-colors hover:text-foreground">
              Log in
            </Link>
            <Link href="/signup">
              <Button size="sm">
                Create account
                <ArrowRight className="hidden h-4 w-4 sm:block" />
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-border">
        <div className="container flex flex-col items-center justify-between gap-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Building202</p>
          <nav className="flex flex-wrap items-center justify-center gap-4 text-xs">
            <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link href="/legal/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/legal/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/legal/disclaimer" className="hover:text-foreground">Disclaimer</Link>
          </nav>
          <p className="max-w-sm text-center text-xs sm:text-right">
            Building202 is self-service software, not a law firm. It does not provide legal, tax, or
            financial advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
