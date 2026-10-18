import Link from "next/link";
import { Landmark } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** Centered logo + card frame for the password-reset pages. */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
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
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </CardContent>
      </Card>
    </div>
  );
}
