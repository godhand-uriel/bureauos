"use client";

import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CASE_PASS, formatPrice } from "@/lib/launch";
import { useBureauStore } from "@/lib/store";
import { formatDateTime } from "@/lib/utils";

const PURCHASE_LABEL: Record<string, string> = {
  pending: "awaiting payment",
  paid: "paid",
  failed: "payment failed",
  expired: "not completed",
  refunded: "refunded",
  disputed: "disputed",
  dispute_lost: "dispute lost",
};

/**
 * Staff view of a case's Case Pass: its state, the purchases behind it, and
 * the two overrides (grant / remove). Both overrides require a reason and are
 * written to the audit log by the server. Refunds themselves are issued in
 * the Stripe Dashboard — the webhook then removes the pass automatically.
 */
export function CasePassAdminCard({ caseId }: { caseId: string }) {
  const entitlement = useBureauStore((s) =>
    s.entitlements.find((e) => e.caseId === caseId && e.product === CASE_PASS),
  );
  const allPurchases = useBureauStore((s) => s.purchases);
  const grantCasePass = useBureauStore((s) => s.grantCasePass);
  const revokeCasePass = useBureauStore((s) => s.revokeCasePass);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const purchases = allPurchases.filter((p) => p.caseId === caseId);
  const active = entitlement?.status === "active";

  const run = async (fn: typeof grantCasePass) => {
    setBusy(true);
    setError(null);
    const result = await fn(caseId, reason.trim());
    setBusy(false);
    if (!result.ok) setError(result.error);
    else setReason("");
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <BadgeCheck className="h-4 w-4 text-primary" />
          Case Pass
        </CardTitle>
        <Badge variant={active ? "success" : "secondary"}>
          {active ? "Active" : entitlement ? "Removed" : "None"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {entitlement && (
          <p className="text-muted-foreground">
            {active ? "Granted" : "Last granted"} {formatDateTime(entitlement.grantedAt)} via{" "}
            {entitlement.source.replace(/_/g, " ")}
            {!active && entitlement.revokeReason && <> · removed: {entitlement.revokeReason}</>}
          </p>
        )}

        {purchases.length > 0 && (
          <ul className="space-y-1">
            {purchases.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-muted-foreground">
                <span>
                  {formatDateTime(p.createdAt)} · {PURCHASE_LABEL[p.status] ?? p.status}
                  {!p.livemode && " · test/simulation"}
                </span>
                <span>{formatPrice(p.amountCents, p.currency)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required, recorded in the audit log)"
            aria-label="Reason for Case Pass change"
            maxLength={300}
          />
          {active ? (
            <Button size="sm" variant="outline" disabled={busy || reason.trim().length < 3} onClick={() => run(revokeCasePass)}>
              Remove Case Pass
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled={busy || reason.trim().length < 3} onClick={() => run(grantCasePass)}>
              Grant Case Pass without payment
            </Button>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          To refund a payment, issue the refund in the Stripe Dashboard. A full refund removes the
          Case Pass automatically.
        </p>
      </CardContent>
    </Card>
  );
}
