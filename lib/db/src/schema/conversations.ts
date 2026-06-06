import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  user1Id: integer("user1_id").notNull().references(() => usersTable.id),
  user2Id: integer("user2_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  user1ClearedAt: timestamp("user1_cleared_at"),
  user2ClearedAt: timestamp("user2_cleared_at"),
});

export type Conversation = typeof conversationsTable.$inferSelect;
