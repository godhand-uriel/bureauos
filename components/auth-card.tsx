import { Card, CardContent } from "@/components/ui/card";
import { BrandWordmark } from "@/components/brand-wordmark";

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
      <BrandWordmark size="lg" className="mb-8" />
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
