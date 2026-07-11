"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Landmark, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StoreSeeder } from "@/components/store-seeder";
import { useBureauStore } from "@/lib/store";

export default function SignupPage() {
  const router = useRouter();
  const signUp = useBureauStore((s) => s.signUp);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usState, setUsState] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await signUp(name, email, password, usState);
    if (result.ok) {
      router.push("/dashboard");
    } else {
      setError(result.error ?? "Sign up failed.");
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
          <h1 className="text-xl font-bold tracking-tight">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Start on the free Self-Service plan — upgrade only if you want human help.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Avery" autoComplete="name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} />
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="us-state">Your state <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="us-state" value={usState} onChange={(e) => setUsState(e.target.value)} placeholder="e.g. California" />
              <p className="text-xs text-muted-foreground">Helps surface jurisdiction-specific process notes.</p>
            </div>
            {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
            <Button type="submit" className="w-full">
              <UserPlus className="h-4 w-4" />
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
            By creating an account you agree to the{" "}
            <Link href="/legal/terms" className="text-primary hover:underline">Terms</Link>,{" "}
            <Link href="/legal/privacy" className="text-primary hover:underline">Privacy Policy</Link>, and{" "}
            <Link href="/legal/disclaimer" className="text-primary hover:underline">Legal Disclaimer</Link>.
            BureauOS is not a law firm and does not provide legal advice.
          </p>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">Log in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
