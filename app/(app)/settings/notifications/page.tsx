"use client";

import Link from "next/link";
import { ArrowLeft, BellRing, Inbox } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/callout";
import { useBureauStore, useCurrentUser, useHydrated } from "@/lib/store";
import { formatDateTime } from "@/lib/utils";
import type { NotificationPreferences } from "@/lib/types";

const CHANNEL_PREFS: { key: keyof NotificationPreferences; label: string; help: string }[] = [
  { key: "emailReminders", label: "Email reminders", help: "Receive notifications by email." },
  { key: "smsReminders", label: "SMS reminders", help: "Receive text messages for time-sensitive items." },
];

const TYPE_PREFS: { key: keyof NotificationPreferences; label: string; help: string }[] = [
  { key: "deadlineAlerts", label: "Deadline alerts", help: "Warnings before case deadlines come due." },
  { key: "caseStatusAlerts", label: "Case status alerts", help: "When your case status or review status changes." },
  { key: "missingDocumentReminders", label: "Missing document reminders", help: "Nudges for required documents still outstanding." },
  { key: "supportTicketUpdates", label: "Support ticket updates", help: "Replies and status changes on your tickets." },
];

export default function NotificationSettingsPage() {
  const hydrated = useHydrated();
  const user = useCurrentUser();
  const updateNotificationPrefs = useBureauStore((s) => s.updateNotificationPrefs);
  const notifications = useBureauStore((s) => s.notifications);

  if (!hydrated || !user) return null;

  const myNotifications = notifications
    .filter((n) => n.userId === user.id)
    .slice(0, 8);

  const PrefRow = ({ item }: { item: { key: keyof NotificationPreferences; label: string; help: string } }) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card/50 p-4">
      <Checkbox
        checked={user.notificationPrefs[item.key]}
        onCheckedChange={(v) => updateNotificationPrefs({ [item.key]: v })}
        aria-label={item.label}
        className="mt-0.5"
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
        <p className="mt-1 text-muted-foreground">
          Choose how BureauOS keeps you on top of deadlines and case activity.
        </p>
      </div>

      <Callout variant="info" title="Mock delivery">
        In this local MVP, notifications are recorded to the outbox below instead of being sent.
        Production BureauOS delivers through Resend/SendGrid (email) and Twilio (SMS) — the event
        model is already in place.
      </Callout>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="h-4 w-4 text-primary" />
            Channels
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {CHANNEL_PREFS.map((item) => <PrefRow key={item.key} item={item} />)}
          {user.notificationPrefs.smsReminders && !user.phone && (
            <p className="text-xs text-amber-400">
              Add a phone number in <Link href="/settings" className="underline">Settings</Link> for SMS to work in production.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What to notify about</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {TYPE_PREFS.map((item) => <PrefRow key={item.key} item={item} />)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Inbox className="h-4 w-4 text-primary" />
            Recent notifications (mock outbox)
          </CardTitle>
          <CardDescription>What would have been sent, most recent first.</CardDescription>
        </CardHeader>
        <CardContent>
          {myNotifications.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">Nothing yet — activity on your cases and tickets will show up here.</p>
          ) : (
            <ul className="divide-y divide-border">
              {myNotifications.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{n.subject}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">{formatDateTime(n.createdAt)}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px] uppercase">{n.channel}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
