"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Landmark, LogIn, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StoreSeeder } from "@/components/store-seeder";
import { useBureauStore, DEMO_CUSTOMER_EMAIL, DEMO_PASSWORD } from "@/lib/store";
import { safeNextPath } from "@/lib/safe-next";

/** Demo sign-in surfaces are compiled out of production builds entirely;
 *  the server additionally refuses demo-account credentials in production. */
const DEMO_UI = process.env.NODE_ENV !== "production";

/** Post-login destination from ?next= (same-site relative paths only). */
function nextDestination(fallback = "/dashboard"): string {
  if (typeof window === "undefined") return fallback;
  return safeNextPath(new URLSearchParams(window.location.search).get("next"), fallback);
}

export default function LoginPage() {
  const router = useRouter();
  const logIn = useBureauStore((s) => s.logIn);
  const logInDemo = useBureauStore((s) => s.logInDemo);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Carried to the signup link after mount (reading it during render would
  // mismatch the server-rendered markup).
  const [query, setQuery] = useState("");
  useEffect(() => setQuery(window.location.search), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await logIn(email, password, totp.trim() || undefined);
    if (result.ok) {
      router.push(nextDestination());
    } else {
      setError(result.error ?? "Login failed.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <StoreSeeder />
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Landmark className="h-5 w-5" />
        </div>
        <span className="text-xl font-bold tracking-tight">
          Bureau<span className="text-primary">OS</span>
        </span>
      </Link>

      <Card className="w-full max-w-md">
        <CardContent className="p-6 sm:p-8">
          <h1 className="text-xl font-bold tracking-tight">Log in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick up your cases where you left off.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="totp">
                Authenticator code{" "}
                <span className="font-normal text-muted-foreground">(if MFA is enabled)</span>
              </Label>
              <Input
                id="totp"
                inputMode="numeric"
                value={totp}
                onChange={(e) => setTotp(e.target.value)}
                placeholder="123456"
                autoComplete="one-time-code"
              />
            </div>
            {error && (
              <p className="text-sm text-red-400" role="alert">{error}</p>
            )}
            <Button type="submit" className="w-full">
              <LogIn className="h-4 w-4" />
              Log in
            </Button>
          </form>

          {DEMO_UI && (
            <>
              <div className="relative py-5">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center"><span className="bg-card px-2 text-xs text-muted-foreground">or explore instantly</span></div>
              </div>

              <div className="grid gap-2">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await logInDemo("customer");
                    router.push("/dashboard");
                  }}
                >
                  <UserRound className="h-4 w-4" />
                  Continue as demo customer
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    await logInDemo("admin");
                    router.push("/admin");
                  }}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Explore the admin console
                </Button>
              </div>
            </>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link href={`/signup${query}`} className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>

      {DEMO_UI && (
        <p className="mt-6 max-w-md text-center text-xs text-muted-foreground">
          Auth.js sign-in against the local development database. Demo customer:{" "}
          <code className="text-foreground/80">{DEMO_CUSTOMER_EMAIL}</code> /{" "}
          <code className="text-foreground/80">{DEMO_PASSWORD}</code> — demo accounts exist in
          development only and are refused by production sign-in.
        </p>
      )}
    </div>
  );
}
