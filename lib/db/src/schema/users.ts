import { pgTable, serial, text, timestamp, varchar, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  displayName: varchar("display_name", { length: 128 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  passwordPlain: varchar("password_plain", { length: 128 }),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  inviteCode: varchar("invite_code", { length: 32 }).notNull().unique(),
  isBanned: boolean("is_banned").notNull().default(false),
  isOnline: boolean("is_online").notNull().default(false),
  lastSeen: timestamp("last_seen"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
