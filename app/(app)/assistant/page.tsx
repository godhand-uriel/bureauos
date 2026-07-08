"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Callout } from "@/components/callout";
import { GREETING, ruleBasedProvider, type AssistantMessage } from "@/lib/assistant";
import { uid } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Assistant chat. Provider is swappable: `ruleBasedProvider` runs locally with
 * no API keys; a model-backed provider (Anthropic/OpenAI/OpenRouter/local)
 * implements the same interface behind an API route later.
 */
export default function AssistantPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<AssistantMessage[]>([
    { id: uid(), role: "assistant", text: GREETING.text, actions: GREETING.actions },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    const next: AssistantMessage[] = [...messages, { id: uid(), role: "user", text: trimmed }];
    setMessages(next);
    setInput("");
    setThinking(true);
    // Small delay so the exchange reads naturally.
    await new Promise((r) => setTimeout(r, 350));
    const reply = await ruleBasedProvider.reply(next.map((m) => ({ role: m.role, text: m.text })));
    setMessages((prev) => [...prev, { id: uid(), role: "assistant", text: reply.text, actions: reply.actions }]);
    setThinking(false);
  };

  const renderText = (text: string) =>
    text.split("\n").map((line, i) => {
      const parts = line.split(/\*\*(.+?)\*\*/g);
      return (
        <p key={i} className={line.trim() === "" ? "h-2" : undefined}>
          {parts.map((part, j) => (j % 2 === 1 ? <strong key={j}>{part}</strong> : part))}
        </p>
      );
    });

  return (
    <div className="mx-auto flex h-[calc(100vh-8.5rem)] max-w-2xl flex-col">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Bot className="h-6 w-6 text-primary" />
          Assistant
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe your situation and get routed to the right navigator — no jargon needed.
        </p>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-0 p-0">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[88%] space-y-1 rounded-xl border p-3.5 text-sm leading-relaxed",
                    m.role === "user"
                      ? "rounded-br-sm border-primary/30 bg-primary/10"
                      : "rounded-bl-sm border-border bg-card",
                  )}
                >
                  {renderText(m.text)}
                  {m.actions && m.actions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {m.actions.map((a) => (
                        <Button
                          key={a.label}
                          size="sm"
                          variant={a.kind === "navigate" ? "default" : "outline"}
                          className="h-7 text-xs"
                          onClick={() => (a.kind === "navigate" ? router.push(a.value) : send(a.value))}
                        >
                          {a.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="rounded-xl rounded-bl-sm border border-border bg-card p-3.5">
                  <span className="inline-flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            className="flex gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. My landlord hasn't fixed the heater in two weeks…"
              aria-label="Message the assistant"
            />
            <Button type="submit" size="icon" disabled={!input.trim() || thinking} aria-label="Send message">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="pt-3">
        <Callout variant="info">
          This assistant runs on local rules — no AI service is connected in the MVP, and it never
          gives legal advice. The provider interface is ready for Anthropic/OpenAI/OpenRouter later.
        </Callout>
      </div>
    </div>
  );
}
