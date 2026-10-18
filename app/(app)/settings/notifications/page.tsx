"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, BellRing, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Callout } from "@/components/callout";
import { useBureauStore, useCapabilities, useCurrentUser, useHydrated } from "@/lib/store";
import { formatDateTime } from "@/lib/utils";
import type { NotificationPreferences, NotificationStatus } from "@/lib/types";

type PrefItem = { key: keyof NotificationPreferences; label: string; help: string };

const TYPE_PREFS: PrefItem[] = [
  {
    key: "deadlineAlerts",
    label: "Deadline reminders",
    help: "7, 3 and 1 days before, and on the day, for deadlines that have a date. Never for ones still marked NEEDS VERIFICATION.",
  },
  { key: "caseStatusAlerts", label: "Case updates", help: "When BureauOS staff change your case's status." },
  { key: "supportTicketUpdates", label: "Support replies", help: "Replies and status changes on your support tickets." },
];

const STATUS: Record<NotificationStatus, { label: string; variant: "success" | "secondary" | "warning" | "destructive" | "info" }> = {
  sent: { label: "Emailed", variant: "success" },
  queued: { label: "Sending", variant: "info" },
  failed: { label: "Not delivered", variant: "destructive" },
  skipped: { label: "Not sent", variant: "secondary" },
  mock_sent: { label: "Dev outbox", variant: "warning" },
};

export default function NotificationSettingsPage() {
  const hydrated = useHydrated();
  const user = useCurrentUser();
  const caps = useCapabilities();
  const updateNotificationPrefs = useBureauStore((s) => s.updateNotificationPrefs);
  const notifications = useBureauStore((s) => s.notifications);
  const refresh = useBureauStore((s) => s.refresh);

  // Pull the latest from the server (staff actions and reminders create
  // entries this session's cache hasn't seen).
  useEffect(() => {
    if (hydrated && user) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  if (!hydrated || !user || !caps) return null;

  const mine = notifications.filter((n) => n.userId === user.id && n.channel === "email").slice(0, 10);
  const emailOn = user.notificationPrefs.emailReminders;

  const PrefRow = ({ item, disabled = false }: { item: PrefItem; disabled?: boolean }) => (
    <label className={`flex items-start gap-3 rounded-lg border border-border bg-card/50 p-4 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <Checkbox
        checked={user.notificationPrefs[item.key]}
        onCheckedChange={(v) => updateNotificationPrefs({ [item.key]: v })}
        aria-label={item.label}
        className="mt-0.5"
        disabled={disabled}
      />
      <span>
        <span className="block text-sm font-medium">{item.label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{item.help}</span>
      </span>
    </label>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/settings" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          Settings
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="mt-1 text-muted-foreground">Emails go to {user.email}.</p>
      </div>

      {caps.emailDelivery === "off" && (
        <Callout variant="warning" title="Email isn't being sent">
          Email delivery isn&apos;t set up on this deployment, so nothing is being sent right now —
          including deadline reminders. Check your deadlines in the app. Your choices below are saved
          for when it is.
        </Callout>
      )}
      {caps.emailDelivery === "mock" && (
        <Callout variant="info" title="Development environment">
          No email provider is configured, so messages are recorded in the outbox below and printed to
          the server log instead of being sent.
        </Callout>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="h-4 w-4 text-primary" />
            Email
          </CardTitle>
          <CardDescription>
            Account and payment emails (password changes, receipts, refunds) are always sent. Text
            messages (SMS) are not offered.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <PrefRow item={{ key: "emailReminders", label: "Send me email updates", help: "Turn off to stop every email below." }} />
          {TYPE_PREFS.map((item) => (
            <PrefRow key={item.key} item={item} disabled={!emailOn} />
          ))}
          <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
            A reminder is a convenience, not a guarantee: email can be delayed or filtered as spam.
            Keep track of your deadlines in the app, and go by the dates on your official notices.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Inbox className="h-4 w-4 text-primary" />
            Recent emails
          </CardTitle>
          <CardDescription>The last few messages for your account and whether each was sent.</CardDescription>
        </CardHeader>
        <CardContent>
          {mine.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {mine.map((n) => {
                const status = STATUS[n.status] ?? STATUS.skipped;
                return (
                  <li key={n.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{n.subject}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{n.body}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground/70">{formatDateTime(n.sentAt ?? n.createdAt)}</p>
                    </div>
                    <Badge variant={status.variant} className="shrink-0 text-[10px]">{status.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
