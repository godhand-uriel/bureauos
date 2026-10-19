import Link from "next/link";
import { Landmark } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * The Building202 wordmark: the building mark beside the name, set as one
 * word in a single weight and colour. Links home; screen readers hear
 * "Building202, home" once rather than an icon plus the name.
 */
export function BrandWordmark({
  size = "md",
  className,
  iconClassName,
  onClick,
}: {
  size?: "md" | "lg";
  className?: string;
  /** Extra classes for the icon tile, e.g. to drop it where width is tight. */
  iconClassName?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href="/"
      onClick={onClick}
      aria-label={`${BRAND_NAME}, home`}
      className={cn("flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
    >
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground",
          size === "lg" ? "h-9 w-9" : "h-8 w-8",
          iconClassName,
        )}
      >
        <Landmark className="h-5 w-5" />
      </span>
      <span
        aria-hidden
        className={cn("whitespace-nowrap font-bold tracking-tight tabular-nums", size === "lg" ? "text-xl" : "text-lg")}
      >
        {BRAND_NAME}
      </span>
    </Link>
  );
}
