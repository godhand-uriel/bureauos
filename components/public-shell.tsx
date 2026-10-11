import Link from "next/link";
import { ArrowRight, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Header/footer wrapper for public marketing & legal pages. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Landmark className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Bureau<span className="text-primary">OS</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link href="/pricing" className="hidden px-3 text-sm text-muted-foreground transition-colors hover:text-foreground sm:block">
              Pricing
            </Link>
            <Link href="/login" className="px-3 text-sm text-muted-foreground transition-colors hover:text-foreground">
              Log in
            </Link>
            <Link href="/signup">
              <Button size="sm">
                Create account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-border">
        <div className="container flex flex-col items-center justify-between gap-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} BureauOS</p>
          <nav className="flex flex-wrap items-center justify-center gap-4 text-xs">
            <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link href="/legal/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/legal/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/legal/disclaimer" className="hover:text-foreground">Disclaimer</Link>
          </nav>
          <p className="max-w-sm text-center text-xs sm:text-right">
            BureauOS is self-service software, not a law firm. It does not provide legal, tax, or
            financial advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
