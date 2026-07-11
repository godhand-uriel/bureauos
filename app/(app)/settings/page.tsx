"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BellRing, Database, LogOut, RefreshCw, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Callout } from "@/components/callout";
import { TierBadge } from "@/components/platform-badges";
import { useBureauStore, useCurrentUser, useHydrated, useMySubscription } from "@/lib/store";

export default function SettingsPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const user = useCurrentUser();
  const subscription = useMySubscription();
  const updateProfile = useBureauStore((s) => s.updateProfile);
  const resetAllData = useBureauStore((s) => s.resetAllData);
  const logOut = useBureauStore((s) => s.logOut);
  const caseCount = useBureauStore((s) => s.cases.length);
  const [savedFlash, setSavedFlash] = useState(false);

  if (!hydrated || !user) {
    return <div className="h-64 animate-pulse rounded-lg bg-secondary" />;
  }

  const flash = () => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Profile details prefill letters and route notifications. Everything stays on this device.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="h-4 w-4 text-primary" />
            Profile
          </CardTitle>
          <CardDescription>
            Signed in as {user.email}
            {subscription && (
              <span className="ml-2 inline-flex align-middle"><TierBadge tier={subscription.tier} /></span>
            )}{" "}
            {savedFlash && <span className="text-emerald-400">Saved.</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="display-name">Full name</Label>
            <Input
              id="display-name"
              value={user.name}
              onChange={(e) => {
                updateProfile({ name: e.target.value });
                flash();
              }}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user.email}
                onChange={(e) => {
                  updateProfile({ email: e.target.value });
                  flash();
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone (for SMS)</Label>
              <Input
                id="phone"
                value={user.phone}
                placeholder="(555) 555-0100"
                onChange={(e) => {
                  updateProfile({ phone: e.target.value });
                  flash();
                }}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="us-state">Your state</Label>
            <Input
              id="us-state"
              value={user.usState}
              placeholder="e.g. California"
              onChange={(e) => {
                updateProfile({ usState: e.target.value });
                flash();
              }}
            />
            <p className="text-xs text-muted-foreground">
              Used to surface jurisdiction-specific process notes on your plans.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="h-4 w-4 text-primary" />
            Notifications
          </CardTitle>
          <CardDescription>Deadline alerts, case updates, ticket replies — email and SMS.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/settings/notifications">
            <Button variant="outline">
              Manage notification preferences
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-primary" />
            Data & account
          </CardTitle>
          <CardDescription>
            {caseCount} case{caseCount === 1 ? "" : "s"} visible to this account, stored in the
            local development database (SQLite). Nothing is sent to external services in this MVP.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              variant="outline"
              onClick={async () => {
                await logOut();
                router.push("/");
              }}
            >
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                if (window.confirm("Reset ALL local demo data (all accounts and cases) and reload the demo?")) {
                  await resetAllData(true);
                }
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Reset & reload demo data
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (window.confirm("Delete ALL local demo data (all accounts and cases)? This cannot be undone.")) {
                  await resetAllData(false);
                  router.push("/");
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete all data
            </Button>
          </div>
          <Separator />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Data is served by validated API routes backed by Prisma (SQLite locally — see{" "}
            <code>prisma/schema.prisma</code>), with server-side ownership checks on every write
            and Auth.js sessions enforced in middleware. Production swaps SQLite for
            Postgres/Supabase without changing app components.
          </p>
        </CardContent>
      </Card>

      <Callout variant="info" title="About BureauOS">
        BureauOS helps you organize information, understand options, and prepare next steps for
        bureaucratic processes. It does not provide legal, tax, or financial advice, and it is not
        affiliated with any government agency.
      </Callout>
    </div>
  );
}
