"use client";

import Link from "next/link";
import { Landmark, LogIn, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useBureauStore, useCurrentUser, useHydrated } from "@/lib/store";

/** Demo sign-in surfaces are compiled out of production builds entirely. */
const DEMO_UI = process.env.NODE_ENV !== "production";

/**
 * Client-side auth gate for the app area — a UX boundary on top of the real
 * enforcement (middleware session checks + per-route authorization).
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const user = useCurrentUser();
  const logInDemo = useBureauStore((s) => s.logInDemo);

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded-md bg-secondary" />
        <div className="h-64 animate-pulse rounded-lg bg-secondary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center pt-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Landmark className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Sign in to continue</h1>
        <p className="mt-2 text-muted-foreground">
          Your cases, documents, and support tickets live in your account.
        </p>
        <Card className="mt-6 w-full">
          <CardContent className="flex flex-col gap-3 p-5">
            <Link href="/login" className="w-full">
              <Button className="w-full">
                <LogIn className="h-4 w-4" />
                Log in
              </Button>
            </Link>
            <Link href="/signup" className="w-full">
              <Button variant="outline" className="w-full">
                Create an account
              </Button>
            </Link>
            {DEMO_UI && (
              <>
                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center"><span className="bg-card px-2 text-xs text-muted-foreground">or explore instantly</span></div>
                </div>
                <Button variant="secondary" onClick={() => logInDemo("customer")}>
                  <UserRound className="h-4 w-4" />
                  Continue as demo customer
                </Button>
                <Button variant="ghost" onClick={() => logInDemo("admin")}>
                  <ShieldCheck className="h-4 w-4" />
                  Explore the admin console
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        {DEMO_UI && (
          <p className="mt-4 text-xs text-muted-foreground">
            Demo accounts come pre-loaded with realistic cases. All data stays in the local
            development database.
          </p>
        )}
      </div>
    );
  }

  return <>{children}</>;
}

/** Admin-only gate used inside the app area. */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const user = useCurrentUser();

  if (!hydrated) {
    return <div className="h-64 animate-pulse rounded-lg bg-secondary" />;
  }
  if (user?.role !== "admin") {
    return (
      <div className="mx-auto max-w-md pt-10 text-center">
        <h1 className="text-xl font-bold">Staff area</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The admin console is only available to BureauOS staff accounts.
        </p>
        <Link href="/login" className="mt-5 inline-block">
          <Button variant="outline">Go to login</Button>
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
