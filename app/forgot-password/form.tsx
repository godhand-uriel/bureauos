"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ ok: true, text: data.message });
      } else if (res.status === 429) {
        setMessage({ ok: false, text: "Too many requests. Try again in a minute." });
      } else if (res.status === 400) {
        setMessage({ ok: false, text: "Enter a valid email address." });
      } else {
        setMessage({ ok: false, text: typeof data.error === "string" ? data.error : "That didn't work. Try again." });
      }
    } catch {
      setMessage({ ok: false, text: "Network error — check your connection and try again." });
    } finally {
      setBusy(false);
    }
  };

  if (message?.ok) {
    return (
      <p role="status" className="text-sm leading-relaxed text-emerald-300">
        {message.text}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      {message && (
        <p role="alert" className="text-sm text-red-400">
          {message.text}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        Email me a reset link
      </Button>
    </form>
  );
}
