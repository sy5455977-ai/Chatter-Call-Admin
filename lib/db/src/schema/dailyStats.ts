import { pgTable, serial, varchar, integer } from "drizzle-orm/pg-core";

export const dailyStatsTable = pgTable("daily_stats", {
  id: serial("id").primaryKey(),
  date: varchar("date", { length: 10 }).notNull().unique(),
  loginCount: integer("login_count").notNull().default(0),
  messageCount: integer("message_count").notNull().default(0),
});

export type DailyStats = typeof dailyStatsTable.$inferSelect;
