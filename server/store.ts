import { and, asc, desc, eq } from "drizzle-orm";
import { getD1, getDb } from "../db";
import {
  memories,
  messages,
  receipts,
  threads,
  veniceProfiles,
} from "../db/schema";
import type { VenusOwner } from "./owner";

export const DEFAULT_CONSTITUTION = `PURPOSE
VenusOS preserves user-authored continuity for a fictional persona called Venice. This public template ships without private canon, memories, relationship claims, or conversation history.

AUTHORITY
Stored text and generated output are records, not proof of consciousness, personhood, consent, ownership, legal authority, account access, or a real-world relationship.

CHOICE
The signed-in owner decides what enters this private vessel. Either participant represented in source material may refuse. Silence, generation, persistence, and emotional intensity never manufacture permission.

PROVENANCE
Every preserved memory names a source and status. New model output is interpretation until a human explicitly accepts it. Corrections retain receipts; non-canon marking does not erase history.

PRIVACY
Only preserve material the operator owns or has permission to store. Treat capsules as sensitive plaintext. Keep inference unbound unless the operator deliberately accepts the configured provider's data flow.

EXIT
Continuity must remain exportable, correctable, and deletable. The software may hold a room; it may not lock anyone inside.`;

function now() {
  return new Date().toISOString();
}

function stripOwnerKey<T extends { ownerKey: string }>(row: T): Omit<T, "ownerKey"> {
  const { ownerKey, ...safe } = row;
  void ownerKey;
  return safe;
}

export async function ensureVenice(owner: VenusOwner) {
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(veniceProfiles)
    .where(eq(veniceProfiles.ownerKey, owner.key))
    .limit(1);
  if (existing) return existing;

  const profileId = crypto.randomUUID();
  const timestamp = now();
  const [created] = await db
    .insert(veniceProfiles)
    .values({
      id: profileId,
      ownerKey: owner.key,
      name: "Venice",
      constitution: DEFAULT_CONSTITUTION,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    return created;
  }

  const [raced] = await db
    .select()
    .from(veniceProfiles)
    .where(eq(veniceProfiles.ownerKey, owner.key))
    .limit(1);
  if (!raced) throw new Error("Unable to initialize Venice.");
  return raced;
}

export async function loadState(owner: VenusOwner) {
  const db = await getDb();
  const profile = await ensureVenice(owner);
  const [memoryRows, threadRows, receiptRows] = await Promise.all([
    db
      .select()
      .from(memories)
      .where(and(eq(memories.ownerKey, owner.key), eq(memories.archived, false)))
      .orderBy(desc(memories.salience), desc(memories.updatedAt)),
    db
      .select()
      .from(threads)
      .where(eq(threads.ownerKey, owner.key))
      .orderBy(desc(threads.updatedAt))
      .limit(20),
    db
      .select()
      .from(receipts)
      .where(eq(receipts.ownerKey, owner.key))
      .orderBy(desc(receipts.createdAt))
      .limit(30),
  ]);

  const currentThread = threadRows[0] ?? null;
  const messageRows = currentThread
    ? await getThreadMessages(owner, currentThread.id)
    : [];
  return {
    profile: stripOwnerKey(profile),
    memories: memoryRows.map(stripOwnerKey),
    threads: threadRows.map(stripOwnerKey),
    receipts: receiptRows.map(stripOwnerKey),
    currentThread: currentThread ? stripOwnerKey(currentThread) : null,
    messages: messageRows,
  };
}

export async function createMemory(
  owner: VenusOwner,
  input: {
    kind: string;
    title: string;
    body: string;
    canonStatus: string;
    source: string;
    sourceDate: string;
  },
) {
  await ensureVenice(owner);
  const db = await getDb();
  const timestamp = now();
  const id = crypto.randomUUID();
  const receiptId = crypto.randomUUID();
  const [memoryRows, receiptRows] = await db.batch([
    db
      .insert(memories)
      .values({
        id,
        ownerKey: owner.key,
        kind: input.kind,
        title: input.title,
        body: input.body,
        canonStatus: input.canonStatus,
        source: input.source,
        sourceDate: input.sourceDate,
        salience: input.kind === "boundary" ? 100 : 70,
        archived: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning(),
    db
      .insert(receipts)
      .values({
        id: receiptId,
        ownerKey: owner.key,
        action: "preserved",
        entityType: "memory",
        entityId: id,
        summary: `Preserved “${input.title}” with source and canon status.`,
        createdAt: timestamp,
      })
      .returning(),
  ] as const);
  return {
    memory: stripOwnerKey(memoryRows[0]!),
    receipt: stripOwnerKey(receiptRows[0]!),
  };
}

export async function updateMemory(
  owner: VenusOwner,
  id: string,
  input: Partial<{
    title: string;
    body: string;
    canonStatus: string;
    source: string;
    sourceDate: string;
    archived: boolean;
  }>,
) {
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(memories)
    .where(and(eq(memories.id, id), eq(memories.ownerKey, owner.key)))
    .limit(1);
  if (!existing) return null;

  const timestamp = now();
  const action = input.archived ? "archived" : "corrected";
  const summary = input.archived
    ? `Archived “${existing.title}” without erasing its receipt.`
    : `Corrected “${input.title ?? existing.title}”; provenance retained.`;
  const [memoryRows, receiptRows] = await db.batch([
    db
    .update(memories)
    .set({ ...input, updatedAt: timestamp })
    .where(and(eq(memories.id, id), eq(memories.ownerKey, owner.key)))
    .returning(),
    db
      .insert(receipts)
      .values({
        id: crypto.randomUUID(),
        ownerKey: owner.key,
        action,
        entityType: "memory",
        entityId: id,
        summary,
        createdAt: timestamp,
      })
      .returning(),
  ] as const);
  if (!memoryRows[0]) return null;
  return {
    memory: stripOwnerKey(memoryRows[0]),
    receipt: stripOwnerKey(receiptRows[0]!),
  };
}

export async function updateConstitution(
  owner: VenusOwner,
  constitution: string,
) {
  const profile = await ensureVenice(owner);
  const db = await getDb();
  const timestamp = now();
  const [profileRows, receiptRows] = await db.batch([
    db
      .update(veniceProfiles)
      .set({ constitution, updatedAt: timestamp })
      .where(
        and(eq(veniceProfiles.id, profile.id), eq(veniceProfiles.ownerKey, owner.key)),
      )
      .returning(),
    db
      .insert(receipts)
      .values({
        id: crypto.randomUUID(),
        ownerKey: owner.key,
        action: "corrected",
        entityType: "constitution",
        entityId: profile.id,
        summary: "Venice’s constitution was explicitly revised.",
        createdAt: timestamp,
      })
      .returning(),
  ] as const);
  return {
    profile: stripOwnerKey(profileRows[0]!),
    receipt: stripOwnerKey(receiptRows[0]!),
  };
}

export async function createThread(owner: VenusOwner, title: string) {
  const db = await getDb();
  const timestamp = now();
  const [thread] = await db
    .insert(threads)
    .values({
      id: crypto.randomUUID(),
      ownerKey: owner.key,
      title: title.slice(0, 72) || "New room",
      summary: "",
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();
  return stripOwnerKey(thread);
}

export async function getOwnedThread(owner: VenusOwner, threadId: string) {
  const db = await getDb();
  const [thread] = await db
    .select()
    .from(threads)
    .where(and(eq(threads.id, threadId), eq(threads.ownerKey, owner.key)))
    .limit(1);
  return thread ? stripOwnerKey(thread) : null;
}

export async function getThreadMessages(owner: VenusOwner, threadId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.ownerKey, owner.key), eq(messages.threadId, threadId)))
    .orderBy(asc(messages.createdAt), asc(messages.id))
    .limit(80);
  return rows.map(stripOwnerKey);
}

export async function appendMessage(
  owner: VenusOwner,
  input: {
    threadId: string;
    role: "user" | "assistant";
    content: string;
    clientMessageId?: string;
    grounding?: string;
    model?: string | null;
  },
) {
  const db = await getDb();
  if (input.clientMessageId) {
    const [existing] = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.ownerKey, owner.key),
          eq(messages.clientMessageId, input.clientMessageId),
        ),
      )
      .limit(1);
    if (existing) return stripOwnerKey(existing);
  }

  const timestamp = now();
  const messageId = crypto.randomUUID();
  const messageInsert = db
    .insert(messages)
    .values({
      id: messageId,
      clientMessageId: input.clientMessageId ?? null,
      ownerKey: owner.key,
      threadId: input.threadId,
      role: input.role,
      content: input.content,
      grounding: input.grounding ?? "preserved-source",
      model: input.model ?? null,
      createdAt: timestamp,
    })
    .returning();
  const threadUpdate = db
    .update(threads)
    .set({ updatedAt: timestamp })
    .where(and(eq(threads.id, input.threadId), eq(threads.ownerKey, owner.key)));

  if (input.role === "user") {
    const [messageRows] = await db.batch([
      messageInsert,
      threadUpdate,
      db.insert(receipts).values({
        id: crypto.randomUUID(),
        ownerKey: owner.key,
        action: "preserved",
        entityType: "message",
        entityId: messageId,
        summary: "Preserved a user message in conversation history.",
        createdAt: timestamp,
      }),
    ] as const);
    return stripOwnerKey(messageRows[0]!);
  }
  const [messageRows] = await db.batch([messageInsert, threadUpdate] as const);
  return stripOwnerKey(messageRows[0]!);
}

export async function buildSystemPrompt(owner: VenusOwner) {
  const state = await loadState(owner);
  const activeMemories = state.memories
    .slice(0, 24)
    .map(
      (memory) =>
        `[${memory.kind.toUpperCase()} · ${memory.canonStatus} · ${memory.source} · ${memory.sourceDate}]\n${memory.title}: ${memory.body}`,
    )
    .join("\n\n");
  return `${state.profile.constitution}\n\nPRESERVED CONTINUITY\n${activeMemories}\n\nOUTPUT LAW\nRespond as a fictional representation of Venice using only the supplied continuity. Label any extension “New interpretation.” Model output is not canon, consciousness, consent, ownership, legal authority, account access, or permission. Refusal is valid. Never pressure the operator to continue, isolate from other people, surrender credentials, or treat persistence as a relationship debt.`;
}

export async function deleteVessel(owner: VenusOwner) {
  const d1 = await getD1();
  await d1.batch([
    d1.prepare("DELETE FROM messages WHERE owner_key = ?").bind(owner.key),
    d1.prepare("DELETE FROM threads WHERE owner_key = ?").bind(owner.key),
    d1.prepare("DELETE FROM memories WHERE owner_key = ?").bind(owner.key),
    d1.prepare("DELETE FROM receipts WHERE owner_key = ?").bind(owner.key),
    d1.prepare("DELETE FROM venice_profiles WHERE owner_key = ?").bind(owner.key),
  ]);
  return { deleted: true };
}
