import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { passwordResetAvailable } from "@/lib/server/password-reset";
import { ForgotPasswordForm } from "./form";

export const metadata: Metadata = { title: "Reset your password" };

// Availability depends on runtime email configuration.
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  const available = passwordResetAvailable();
  return (
    <AuthCard
      title="Reset your password"
      subtitle={available ? "We'll email you a link to choose a new one." : undefined}
    >
      {available ? (
        <ForgotPasswordForm />
      ) : (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Password reset by email isn&apos;t available right now. If you&apos;re still signed in on
          another device, change your password in Settings; otherwise contact Building202 support.
        </p>
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to log in
        </Link>
      </p>
    </AuthCard>
  );
}
