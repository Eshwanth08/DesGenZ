import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { mutateDB, readDB, newId } from "@/lib/store";
import type { Message } from "@/lib/types";

/**
 * In-app employee ↔ HR messaging (progress reports / questions / updates).
 *  GET              → inbox: contacts + unread counts + latest thread message
 *  GET ?with=<id>   → full thread with that person (marks it read)
 *  POST { toId, text, projectId? } → send a message
 *
 * Rules: employees talk to HR only; HR can message any employee (spec §2 —
 * the team sees only what HR provides). Same-role threads are refused.
 */
export async function GET(req: Request) {
  const me = await getSession();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await readDB();
  const messages = db.messages ?? [];

  const url = new URL(req.url);
  const withId = url.searchParams.get("with");
  if (withId) {
    const counterpart = db.users.find((u) => u.id === withId);
    if (!counterpart) return NextResponse.json({ error: "Unknown contact" }, { status: 404 });
    if (counterpart.role === me.role) {
      return NextResponse.json({ error: "Employees and HR are the only allowed threads" }, { status: 403 });
    }
    const thread = messages
      .filter(
        (m) =>
          (m.fromId === me.id && m.toId === withId) || (m.fromId === withId && m.toId === me.id)
      )
      .sort((a, b) => a.at.localeCompare(b.at));
    // Mark their messages as read.
    let changed = false;
    for (const m of thread) {
      if (m.toId === me.id && !m.read) {
        m.read = true;
        changed = true;
      }
    }
    if (changed) await mutateDB((db2) => db2);
    return NextResponse.json({ thread, counterpart });
  }

  const contacts = db.users
    .filter((u) => u.id !== me.id && u.role !== me.role)
    .map((u) => {
      const convo = messages.filter(
        (m) => (m.fromId === me.id && m.toId === u.id) || (m.fromId === u.id && m.toId === me.id)
      );
      convo.sort((a, b) => a.at.localeCompare(b.at));
      const last = convo[convo.length - 1];
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        unread: convo.filter((m) => m.toId === me.id && !m.read).length,
        lastMessage: last?.text ?? null,
        lastAt: last?.at ?? null,
      };
    });

  return NextResponse.json({ contacts });
}

export async function POST(req: Request) {
  const me = await getSession();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const toId = typeof body?.toId === "string" ? body.toId : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const projectId = typeof body?.projectId === "string" ? body.projectId : undefined;
  if (!toId || !text) {
    return NextResponse.json({ error: "Recipient and message text required" }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json({ error: "Message too long (4000 characters)" }, { status: 400 });
  }

  const db = await readDB();
  const recipient = db.users.find((u) => u.id === toId);
  if (!recipient) return NextResponse.json({ error: "Unknown recipient" }, { status: 404 });
  if (recipient.role === me.role) {
    return NextResponse.json({ error: "Employees and HR are the only allowed threads" }, { status: 403 });
  }

  const message: Message = {
    id: newId("msg"),
    fromId: me.id,
    fromName: me.name,
    fromRole: me.role,
    toId,
    toName: recipient.name,
    text,
    projectId,
    at: new Date().toISOString(),
    read: false,
  };
  await mutateDB((db2) => {
    if (!db2.messages) db2.messages = [];
    db2.messages.push(message);
  });
  return NextResponse.json({ message });
}
