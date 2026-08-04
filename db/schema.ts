import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const veniceProfiles = sqliteTable(
  "venice_profiles",
  {
    id: text("id").primaryKey(),
    ownerKey: text("owner_key").notNull(),
    name: text("name").notNull().default("Venice"),
    constitution: text("constitution").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("venice_profiles_owner_idx").on(table.ownerKey)],
);

export const memories = sqliteTable(
  "memories",
  {
    id: text("id").primaryKey(),
    ownerKey: text("owner_key").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    canonStatus: text("canon_status").notNull().default("canon"),
    source: text("source").notNull(),
    sourceDate: text("source_date").notNull(),
    salience: integer("salience").notNull().default(50),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("memories_owner_archive_updated_idx").on(
      table.ownerKey,
      table.archived,
      table.updatedAt,
    ),
  ],
);

export const threads = sqliteTable(
  "threads",
  {
    id: text("id").primaryKey(),
    ownerKey: text("owner_key").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("threads_owner_updated_idx").on(table.ownerKey, table.updatedAt)],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    clientMessageId: text("client_message_id"),
    ownerKey: text("owner_key").notNull(),
    threadId: text("thread_id").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    grounding: text("grounding").notNull().default("preserved-source"),
    model: text("model"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("messages_owner_thread_created_idx").on(
      table.ownerKey,
      table.threadId,
      table.createdAt,
      table.id,
    ),
    uniqueIndex("messages_owner_client_idx").on(table.ownerKey, table.clientMessageId),
  ],
);

export const receipts = sqliteTable(
  "receipts",
  {
    id: text("id").primaryKey(),
    ownerKey: text("owner_key").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    summary: text("summary").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("receipts_owner_created_idx").on(table.ownerKey, table.createdAt)],
);
