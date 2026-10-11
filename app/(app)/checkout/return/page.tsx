"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, BadgeCheck, CircleAlert, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBureauStore } from "@/lib/store";

type View =
  | { kind: "confirming" }
  | { kind: "active"; caseId: string }
  | { kind: "delayed"; caseId: string | null }
  | { kind: "not_paid"; caseId: string | null }
  | { kind: "reversed" }
  | { kind: "unknown" };

const POLL_MS = 2_000;
const MAX_POLLS = 30; // ~1 minute

/**
 * Where Stripe sends the customer after Checkout. Landing here proves
 * nothing: this page only reads what the server has recorded from Stripe's
 * signed webhook, and waits for it if the webhook hasn't arrived yet.
 */
function CheckoutReturn() {
  const sessionId = useSearchParams().get("session_id") ?? "";
  const checkoutStatus = useBureauStore((s) => s.checkoutStatus);
  const [view, setView] = useState<View>({ kind: "confirming" });
  const polls = useRef(0);

  useEffect(() => {
    if (!sessionId) {
      setView({ kind: "unknown" });
      return;
    }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      const data = await checkoutStatus(sessionId);
      if (stopped) return;
      polls.current += 1;
      if (!data) {
        setView({ kind: "unknown" });
        return;
      }
      if (data.entitled && data.caseId) {
        setView({ kind: "active", caseId: data.caseId });
        return;
      }
      if (data.status === "expired" || data.status === "failed") {
        setView({ kind: "not_paid", caseId: data.caseId });
        return;
      }
      if (data.status === "refunded" || data.status === "disputed" || data.status === "dispute_lost") {
        setView({ kind: "reversed" });
        return;
      }
      if (polls.current >= MAX_POLLS) {
        setView({ kind: "delayed", caseId: data.caseId });
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    };
    void tick();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, checkoutStatus]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center pt-12 text-center" aria-live="polite">
      {view.kind === "confirming" && (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <h1 className="mt-5 text-xl font-bold">Confirming your payment…</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Waiting for confirmation from Stripe. This usually takes a few seconds.
          </p>
        </>
      )}

      {view.kind === "active" && (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
            <BadgeCheck className="h-7 w-7 text-emerald-400" />
          </div>
          <h1 className="mt-5 text-xl font-bold">Payment confirmed — Case Pass active</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The letter generator is unlocked for your case. Your purchase is listed under Billing.
          </p>
          <Link href={`/cases/${view.caseId}/letters`} className="mt-6">
            <Button>
              Open letters
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </>
      )}

      {view.kind === "delayed" && (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15">
            <Clock className="h-7 w-7 text-amber-400" />
          </div>
          <h1 className="mt-5 text-xl font-bold">Still waiting for confirmation</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Stripe hasn&apos;t confirmed this payment to us yet, so the Case Pass isn&apos;t active.
            If you completed payment, it will unlock automatically once confirmation arrives — you
            don&apos;t need to pay again. Check Billing in a few minutes, and contact support if it
            still shows as pending.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/billing"><Button variant="outline">Go to Billing</Button></Link>
            <Link href="/support/new"><Button variant="outline">Contact support</Button></Link>
          </div>
        </>
      )}

      {view.kind === "not_paid" && (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15">
            <CircleAlert className="h-7 w-7 text-amber-400" />
          </div>
          <h1 className="mt-5 text-xl font-bold">Payment wasn&apos;t completed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No Case Pass was activated and you have not been charged for one.
          </p>
          {view.caseId && (
            <Link href={`/checkout?case=${view.caseId}`} className="mt-6">
              <Button>Try again</Button>
            </Link>
          )}
        </>
      )}

      {view.kind === "reversed" && (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
            <CircleAlert className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="mt-5 text-xl font-bold">This purchase was reversed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The payment was refunded or disputed, so the Case Pass is not active. See Billing for details.
          </p>
          <Link href="/billing" className="mt-6"><Button variant="outline">Go to Billing</Button></Link>
        </>
      )}

      {view.kind === "unknown" && (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
            <CircleAlert className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="mt-5 text-xl font-bold">We couldn&apos;t find that purchase</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your purchases and their status are listed under Billing.
          </p>
          <Link href="/billing" className="mt-6"><Button variant="outline">Go to Billing</Button></Link>
        </>
      )}
    </div>
  );
}

export default function CheckoutReturnPage() {
  return (
    <Suspense>
      <CheckoutReturn />
    </Suspense>
  );
}
