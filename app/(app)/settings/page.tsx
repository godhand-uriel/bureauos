"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BellRing, Database, Download, FlaskConical, KeyRound, LogOut, RefreshCw, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Callout } from "@/components/callout";
import { MfaCard } from "@/components/mfa-card";
import { US_STATES } from "@/lib/us-states";
import { useBureauStore, useCapabilities, useCurrentUser, useHydrated } from "@/lib/store";
import type { User } from "@/lib/types";

function ProfileCard({ user }: { user: User }) {
  const saveProfile = useBureauStore((s) => s.saveProfile);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [usState, setUsState] = useState(user.usState);
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Pick up server-confirmed values (e.g. a normalized email) after a save.
  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
    setUsState(user.usState);
  }, [user.name, user.email, user.usState]);

  const emailChanged = email.trim().toLowerCase() !== user.email;
  const dirty = name.trim() !== user.name || usState !== user.usState || emailChanged;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await saveProfile(
      { name: name.trim(), usState, ...(emailChanged ? { email: email.trim() } : {}) },
      emailChanged ? currentPassword : undefined,
    );
    setBusy(false);
    if (result.ok) {
      setCurrentPassword("");
      setMessage({ ok: true, text: "Saved." });
    } else {
      setMessage({ ok: false, text: result.error });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRound className="h-4 w-4 text-primary" />
          Profile
        </CardTitle>
        <CardDescription>Your name appears on letters you generate.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="display-name">Full name</Label>
            <Input id="display-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email (used to sign in)</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="us-state">Your state</Label>
              <Select id="us-state" value={usState} onChange={(e) => setUsState(e.target.value)}>
                <option value="">Not set</option>
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.name}>{s.name}</option>
                ))}
              </Select>
            </div>
          </div>
          {emailChanged && (
            <div className="space-y-1.5">
              <Label htmlFor="profile-password">Current password</Label>
              <Input
                id="profile-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Changing your sign-in email requires your current password.
              </p>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={busy || !dirty || !name.trim()}>Save changes</Button>
            {message && (
              <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm text-emerald-400" : "text-sm text-red-400"}>
                {message.text}
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const router = useRouter();
  const changePassword = useBureauStore((s) => s.changePassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      setError("The new passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await changePassword(current, next);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/login?changed=1");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-primary" />
          Password
        </CardTitle>
        <CardDescription>
          Changing your password signs you out everywhere, including here. You&apos;ll sign in again
          with the new one.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="pw-current">Current password</Label>
            <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pw-new">New password</Label>
              <Input id="pw-new" type="password" autoComplete="new-password" minLength={10} value={next} onChange={(e) => setNext(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-confirm">Confirm new password</Label>
              <Input id="pw-confirm" type="password" autoComplete="new-password" minLength={10} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">At least 10 characters.</p>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="outline" disabled={busy || !current || next.length < 10 || !confirm}>
              Change password
            </Button>
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function DataCard({ isAdmin, caseCount }: { isAdmin: boolean; caseCount: number }) {
  const router = useRouter();
  const deleteAccount = useBureauStore((s) => s.deleteAccount);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await deleteAccount(password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-4 w-4 text-primary" />
          Your data
        </CardTitle>
        <CardDescription>
          {caseCount} case{caseCount === 1 ? "" : "s"} in this account. Building202 stores what you type
          into it — it does not store uploaded documents.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <a href="/api/me/export" download>
            <Button variant="outline">
              <Download className="h-4 w-4" />
              Download my data (JSON)
            </Button>
          </a>
          <p className="text-xs text-muted-foreground">
            Your profile, cases, intake answers, plans, deadlines, letters, tickets, and purchase
            history in one file.
          </p>
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <p className="text-sm font-medium">Delete account</p>
          {isAdmin ? (
            <p className="text-sm text-muted-foreground">
              Staff accounts can&apos;t be deleted from the app. Ask another administrator to remove it.
            </p>
          ) : !open ? (
            <>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Permanently deletes your account, every case, and everything in them — including
                any Case Pass, which is not refunded by deleting. This can&apos;t be undone. Records of
                payments are kept without your name or email, as financial records must be.
              </p>
              <Button variant="destructive" onClick={() => setOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Delete my account…
              </Button>
            </>
          ) : (
            <form className="space-y-3" onSubmit={submit}>
              <div className="space-y-1.5">
                <Label htmlFor="delete-password">Current password</Label>
                <Input id="delete-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
                <Input id="delete-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" required />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" variant="destructive" disabled={busy || !password || typed !== "DELETE"}>
                  Permanently delete my account
                </Button>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              </div>
              {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const user = useCurrentUser();
  const caps = useCapabilities();
  const resetAllData = useBureauStore((s) => s.resetAllData);
  const logOut = useBureauStore((s) => s.logOut);
  const sessionUserId = useBureauStore((s) => s.sessionUserId);
  const caseCount = useBureauStore((s) => s.cases.filter((c) => c.userId === sessionUserId).length);

  if (!hydrated || !user) {
    return <div className="h-64 animate-pulse rounded-lg bg-secondary" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-muted-foreground">Signed in as {user.email}</p>
        </div>
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
      </div>

      <ProfileCard user={user} />
      <PasswordCard />
      {user.role === "admin" && <MfaCard enabled={user.mfaEnabled} />}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="h-4 w-4 text-primary" />
            Notifications
          </CardTitle>
          <CardDescription>Choose which emails Building202 sends you.</CardDescription>
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

      <DataCard isAdmin={user.role === "admin"} caseCount={caseCount} />

      {caps?.devTools && (
        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-amber-300">
              <FlaskConical className="h-4 w-4" />
              Development tools — not available in production
            </CardTitle>
            <CardDescription>
              These act on the whole local development database (every account), not just yours.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              variant="outline"
              onClick={async () => {
                if (window.confirm("Reset the entire local development database and reload the demo data?")) {
                  await resetAllData(true);
                }
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Reset & reload demo data
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                if (window.confirm("Erase the entire local development database (all accounts and cases)?")) {
                  await resetAllData(false);
                  router.push("/");
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              Erase development database
            </Button>
          </CardContent>
        </Card>
      )}

      <Callout variant="info" title="About Building202">
        Building202 helps you organize information and prepare next steps for bureaucratic processes.
        It is self-service software, not a law firm: it does not provide legal, tax, or financial
        advice, and it is not affiliated with any government agency.
      </Callout>
    </div>
  );
}
