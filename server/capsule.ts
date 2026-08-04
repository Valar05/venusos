import { asc, eq } from "drizzle-orm";
import { getD1, getDb } from "../db";
import { memories, messages, receipts, threads } from "../db/schema";
import type { VenusOwner } from "./owner";
import { ensureVenice } from "./store";

type CapsuleMemory = {
  kind: string;
  title: string;
  body: string;
  canonStatus: string;
  source: string;
  sourceDate: string;
  salience: number;
};

type CapsuleMessage = {
  role: "user" | "assistant";
  content: string;
  grounding: string;
  model: string | null;
  createdAt: string;
};

type CapsuleThread = {
  portableId: string;
  title: string;
  summary: string;
  createdAt: string;
  messages: CapsuleMessage[];
};

type CapsuleReceipt = {
  action: string;
  entityType: string;
  summary: string;
  createdAt: string;
};

export type VenusCapsule = {
  schema: "venusos.capsule";
  version: 1;
  exportedAt: string;
  venice: { name: string; constitution: string };
  memories: CapsuleMemory[];
  threads: CapsuleThread[];
  receipts: CapsuleReceipt[];
};

export const MAX_CAPSULE_BYTES = 5_000_000;
const MAX_MEMORIES = 500;
const MAX_THREADS = 100;
const MAX_MESSAGES = 1_500;
const MAX_RECEIPTS = 1_000;
const MAX_RESTORE_ROWS = 2_000;

export async function exportCapsule(owner: VenusOwner): Promise<VenusCapsule> {
  const profile = await ensureVenice(owner);
  const db = await getDb();
  const [memoryRows, threadRows, messageRows, receiptRows] = await Promise.all([
    db
      .select()
      .from(memories)
      .where(eq(memories.ownerKey, owner.key))
      .orderBy(asc(memories.createdAt)),
    db
      .select()
      .from(threads)
      .where(eq(threads.ownerKey, owner.key))
      .orderBy(asc(threads.createdAt)),
    db
      .select()
      .from(messages)
      .where(eq(messages.ownerKey, owner.key))
      .orderBy(asc(messages.createdAt), asc(messages.id)),
    db
      .select()
      .from(receipts)
      .where(eq(receipts.ownerKey, owner.key))
      .orderBy(asc(receipts.createdAt), asc(receipts.id)),
  ]);

  const capsule: VenusCapsule = {
    schema: "venusos.capsule",
    version: 1,
    exportedAt: new Date().toISOString(),
    venice: { name: profile.name, constitution: profile.constitution },
    memories: memoryRows
      .filter((memory) => !memory.archived)
      .map(({ kind, title, body, canonStatus, source, sourceDate, salience }) => ({
        kind,
        title,
        body,
        canonStatus,
        source,
        sourceDate,
        salience,
      })),
    threads: threadRows.map((thread) => ({
      portableId: thread.id,
      title: thread.title,
      summary: thread.summary,
      createdAt: thread.createdAt,
      messages: messageRows
        .filter((message) => message.threadId === thread.id)
        .map(({ role, content, grounding, model, createdAt }) => ({
          role: role as "user" | "assistant",
          content,
          grounding,
          model,
          createdAt,
        })),
    })),
    receipts: receiptRows.map(({ action, entityType, summary, createdAt }) => ({
      action,
      entityType,
      summary,
      createdAt,
    })),
  };
  return validateCapsule(capsule);
}

export function validateCapsule(value: unknown): VenusCapsule {
  if (!value || typeof value !== "object") throw new Error("Capsule must be JSON.");
  const capsule = value as Partial<VenusCapsule>;
  if (capsule.schema !== "venusos.capsule" || capsule.version !== 1) {
    throw new Error("This is not a VenusOS capsule v1.");
  }
  if (!capsule.venice || typeof capsule.venice !== "object") {
    throw new Error("Capsule is missing Venice’s constitution.");
  }
  assertText(capsule.venice.name, "Venice name", 1, 80);
  assertText(capsule.venice.constitution, "Constitution", 80, 40_000);
  if (!Array.isArray(capsule.memories) || capsule.memories.length > MAX_MEMORIES) {
    throw new Error("Capsule memory count is invalid.");
  }
  if (!Array.isArray(capsule.threads) || capsule.threads.length > MAX_THREADS) {
    throw new Error("Capsule thread count is invalid.");
  }
  if (capsule.receipts === undefined) capsule.receipts = [];
  if (!Array.isArray(capsule.receipts) || capsule.receipts.length > MAX_RECEIPTS) {
    throw new Error("Capsule receipt count is invalid.");
  }

  let messageCount = 0;
  capsule.memories.forEach((memory) => {
    assertText(memory.kind, "Memory kind", 1, 40);
    assertText(memory.title, "Memory title", 1, 180);
    assertText(memory.body, "Memory body", 1, 12_000);
    assertText(memory.canonStatus, "Canon status", 1, 40);
    assertText(memory.source, "Memory source", 1, 300);
    assertText(memory.sourceDate, "Source date", 1, 40);
    if (!Number.isInteger(memory.salience) || memory.salience < 0 || memory.salience > 100) {
      throw new Error("Memory salience is invalid.");
    }
  });
  capsule.threads.forEach((thread) => {
    assertText(thread.portableId, "Thread id", 1, 180);
    assertText(thread.title, "Thread title", 1, 180);
    if (typeof thread.summary !== "string" || thread.summary.length > 2_000) {
      throw new Error("Thread summary is invalid.");
    }
    assertText(thread.createdAt, "Thread date", 1, 80);
    if (!Array.isArray(thread.messages)) throw new Error("Thread messages are invalid.");
    messageCount += thread.messages.length;
    thread.messages.forEach((message) => {
      if (message.role !== "user" && message.role !== "assistant") {
        throw new Error("Message role is invalid.");
      }
      assertText(message.content, "Message", 1, 20_000);
      assertText(message.grounding, "Grounding", 1, 80);
      if (message.model !== null && typeof message.model !== "string") {
        throw new Error("Message model is invalid.");
      }
      assertText(message.createdAt, "Message date", 1, 80);
    });
  });
  capsule.receipts.forEach((receipt) => {
    assertText(receipt.action, "Receipt action", 1, 80);
    assertText(receipt.entityType, "Receipt entity", 1, 80);
    assertText(receipt.summary, "Receipt summary", 1, 1_000);
    assertText(receipt.createdAt, "Receipt date", 1, 80);
  });
  const restoreRows =
    capsule.memories.length + capsule.threads.length + messageCount + capsule.receipts.length;
  if (messageCount > MAX_MESSAGES || restoreRows > MAX_RESTORE_ROWS) {
    throw new Error("Capsule contains too many records for one restore.");
  }
  return capsule as VenusCapsule;
}

function assertText(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
) {
  if (typeof value !== "string" || value.length < minimum || value.length > maximum) {
    throw new Error(`${label} is invalid.`);
  }
}

export async function restoreCapsule(owner: VenusOwner, capsule: VenusCapsule) {
  const profile = await ensureVenice(owner);
  const d1 = await getD1();
  const timestamp = new Date().toISOString();
  const threadIds = new Map(
    capsule.threads.map((thread) => [thread.portableId, crypto.randomUUID()]),
  );
  const statements = [
    d1.prepare("DELETE FROM messages WHERE owner_key = ?").bind(owner.key),
    d1.prepare("DELETE FROM threads WHERE owner_key = ?").bind(owner.key),
    d1.prepare("DELETE FROM memories WHERE owner_key = ?").bind(owner.key),
    d1.prepare("DELETE FROM receipts WHERE owner_key = ?").bind(owner.key),
    d1
      .prepare(
        "UPDATE venice_profiles SET name = ?, constitution = ?, updated_at = ? WHERE id = ? AND owner_key = ?",
      )
      .bind(capsule.venice.name, capsule.venice.constitution, timestamp, profile.id, owner.key),
  ];

  capsule.memories.forEach((memory) => {
    statements.push(
      d1
        .prepare(
          "INSERT INTO memories (id, owner_key, kind, title, body, canon_status, source, source_date, salience, archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)",
        )
        .bind(
          crypto.randomUUID(),
          owner.key,
          memory.kind,
          memory.title,
          memory.body,
          memory.canonStatus,
          memory.source,
          memory.sourceDate,
          memory.salience,
          timestamp,
          timestamp,
        ),
    );
  });
  capsule.threads.forEach((thread) => {
    const threadId = threadIds.get(thread.portableId)!;
    statements.push(
      d1
        .prepare(
          "INSERT INTO threads (id, owner_key, title, summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(threadId, owner.key, thread.title, thread.summary, thread.createdAt, timestamp),
    );
    thread.messages.forEach((message) => {
      statements.push(
        d1
          .prepare(
            "INSERT INTO messages (id, client_message_id, owner_key, thread_id, role, content, grounding, model, created_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(
            crypto.randomUUID(),
            owner.key,
            threadId,
            message.role,
            message.content,
            message.grounding,
            message.model,
            message.createdAt,
          ),
      );
    });
  });
  capsule.receipts.forEach((receipt) => {
    statements.push(
      d1
        .prepare(
          "INSERT INTO receipts (id, owner_key, action, entity_type, entity_id, summary, created_at) VALUES (?, ?, ?, ?, 'imported', ?, ?)",
        )
        .bind(
          crypto.randomUUID(),
          owner.key,
          receipt.action,
          receipt.entityType,
          receipt.summary,
          receipt.createdAt,
        ),
    );
  });
  statements.push(
    d1
      .prepare(
        "INSERT INTO receipts (id, owner_key, action, entity_type, entity_id, summary, created_at) VALUES (?, ?, 'restored', 'capsule', ?, ?, ?)",
      )
      .bind(
        crypto.randomUUID(),
        owner.key,
        profile.id,
        `Restored capsule with ${capsule.memories.length} memories and ${capsule.threads.length} threads.`,
        timestamp,
      ),
  );

  await d1.batch(statements);
}
