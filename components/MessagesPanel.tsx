"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, Badge, Button } from "@/components/ui";
import { api } from "@/lib/client";
import type { Message } from "@/lib/types";

interface Contact {
  id: string;
  name: string;
  role: "hr" | "employee";
  unread: number;
  lastMessage: string | null;
  lastAt: string | null;
}

/**
 * In-app employee ↔ HR chat. Employees message HR (progress updates, questions);
 * HR messages their team. Threads live inside the app — nothing leaves it.
 */
export default function MessagesPanel({ meId, projectId }: { meId: string; projectId?: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [active, setActive] = useState<Contact | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadContacts = useCallback(async () => {
    try {
      const data = await api<{ contacts: Contact[] }>("/api/messages");
      setContacts(data.contacts);
      setActive((prev) => (prev ? data.contacts.find((c) => c.id === prev.id) ?? null : data.contacts[0] ?? null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load messages");
    }
  }, []);

  const loadThread = useCallback(async (contactId: string) => {
    try {
      const data = await api<{ thread: Message[] }>(`/api/messages?with=${contactId}`);
      setThread(data.thread);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load thread");
    }
  }, []);

  useEffect(() => {
    void loadContacts();
    const t = setInterval(() => {
      void loadContacts();
      if (active) void loadThread(active.id);
    }, 15_000);
    return () => clearInterval(t);
  }, [loadContacts, loadThread, active]);

  useEffect(() => {
    if (active) void loadThread(active.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread.length]);

  function pick(c: Contact) {
    setActive(c);
    setContacts((prev) => prev.map((x) => (x.id === c.id ? { ...x, unread: 0 } : x)));
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !active) return;
    setSending(true);
    setError(null);
    try {
      await api("/api/messages", {
        method: "POST",
        body: JSON.stringify({ toId: active.id, text, projectId }),
      });
      setDraft("");
      await loadThread(active.id);
      void loadContacts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card hover={false} className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Messages</h2>
        <Badge tone="blue">in-app</Badge>
      </div>
      <p className="text-sm text-text-secondary mt-1">
        Direct line between the team and HR — progress updates and questions stay inside the software.
      </p>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-4 grid md:grid-cols-[200px_1fr] gap-4">
        <div className="space-y-1.5">
          {contacts.length === 0 && (
            <p className="text-xs text-text-muted">
              {contacts.length === 0 ? "No contacts available yet." : ""}
            </p>
          )}
          {contacts.map((c) => (
            <button
              key={c.id}
              onClick={() => pick(c)}
              className={`w-full text-left rounded-md px-3 py-2 transition-colors duration-150 ${
                active?.id === c.id
                  ? "bg-accent-muted"
                  : "hover:bg-accent-muted/50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{c.name}</span>
                {c.unread > 0 && (
                  <span className="shrink-0 grid h-5 min-w-5 place-items-center rounded-full bg-accent text-accent-contrast text-[10px] font-bold px-1">
                    {c.unread}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted capitalize">{c.role === "hr" ? "HR" : "Employee"}</p>
              {c.lastMessage && (
                <p className="text-xs text-text-secondary truncate mt-0.5">{c.lastMessage}</p>
              )}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-border-subtle flex flex-col h-80">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {thread.length === 0 && (
              <p className="text-xs text-text-muted text-center pt-10">
                No messages yet — say hello, or send your first progress update.
              </p>
            )}
            {thread.map((m) => {
              const mine = m.fromId === meId;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                      mine
                        ? "bg-accent text-accent-contrast rounded-br-sm"
                        : "bg-bg-faint text-text-primary rounded-bl-sm"
                    }`}>
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    <p className={`text-[10px] mt-1 ${mine ? "text-accent-contrast/70" : "text-text-muted"}`}>
                      {new Date(m.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={send} className="border-t border-border-subtle p-2 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={active ? `Message ${active.name}…` : "Pick a contact first"}
              disabled={!active || sending}
              className="flex-1 rounded-md border border-border-subtle px-3 py-2 text-sm focus:border-accent disabled:opacity-50"
            />
            <Button type="submit" disabled={!active || sending || !draft.trim()}>
              {sending ? "…" : "Send"}
            </Button>
          </form>
        </div>
      </div>
    </Card>
  );
}
