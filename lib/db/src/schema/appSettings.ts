import { pgTable, serial, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const appSettingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const appSnapshotsTable = pgTable("app_snapshots", {
  id: serial("id").primaryKey(),
  label: varchar("label", { length: 128 }).notNull(),
  settingsJson: text("settings_json").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AppSetting = typeof appSettingsTable.$inferSelect;
export type AppSnapshot = typeof appSnapshotsTable.$inferSelect;
