"use client";

import { useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBureauStore } from "@/lib/store";

/**
 * Staff MFA (TOTP) enrollment. Shown to admin accounts only. Production
 * sign-in for staff requires MFA to be enrolled, so this is where a staff
 * account is prepared before it is used against a production deployment
 * (or use `npm run admin:provision`).
 */
export function MfaCard({ enabled }: { enabled: boolean }) {
  const refresh = useBureauStore((s) => s.refresh);
  const [pending, setPending] = useState<{ secret: string; otpauth: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const call = async (method: "POST" | "PUT" | "DELETE", body?: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/mfa", {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "That didn't work. Try again.");
        return null;
      }
      return data as Record<string, unknown>;
    } finally {
      setBusy(false);
    }
  };

  const begin = async () => {
    const data = await call("POST");
    if (data) setPending({ secret: String(data.secret), otpauth: String(data.otpauth) });
  };

  const confirm = async () => {
    const data = await call("PUT", { code });
    if (data) {
      setPending(null);
      setCode("");
      await refresh();
    }
  };

  const disable = async () => {
    const data = await call("DELETE", { code });
    if (data) {
      setCode("");
      await refresh();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Staff two-factor authentication
          <Badge variant={enabled ? "success" : "warning"} className="text-[10px]">
            {enabled ? "Enabled" : "Not enabled"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Staff accounts must have an authenticator app enrolled to sign in to a production
          deployment.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!enabled && !pending && (
          <Button onClick={begin} disabled={busy}>
            <KeyRound className="h-4 w-4" />
            Set up authenticator app
          </Button>
        )}

        {pending && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Add this key to your authenticator app (manual entry, time-based, 6 digits), then
              enter the current code to finish.
            </p>
            <code className="block break-all rounded-md border border-border bg-background p-3 text-xs">
              {pending.secret}
            </code>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Show setup link (otpauth URI)</summary>
              <code className="mt-2 block break-all">{pending.otpauth}</code>
            </details>
          </div>
        )}

        {(pending || enabled) && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="mfa-code" className="text-xs text-muted-foreground">
                {enabled ? "Current code (to disable)" : "Current code"}
              </Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="w-36"
                autoComplete="one-time-code"
              />
            </div>
            {pending ? (
              <Button onClick={confirm} disabled={busy || code.trim().length < 6}>
                Confirm and enable
              </Button>
            ) : (
              <Button variant="outline" onClick={disable} disabled={busy || code.trim().length < 6}>
                Disable two-factor
              </Button>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
