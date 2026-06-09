import { Router } from "express";
import { db, usersTable, dailyStatsTable, appSettingsTable, appSnapshotsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import type { AuthPayload } from "../middlewares/auth";
import { DEFAULT_SETTINGS } from "./settings";
import { processCommand } from "../lib/localAI";

const ADMIN_EMAIL = "sy5455977@gmail.com";
const router = Router();

async function adminMiddleware(req: any, res: any, next: any) {
  const authReq = req as typeof req & { user: AuthPayload };
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, authReq.user.userId))
    .limit(1);
  if (!user || user.email !== ADMIN_EMAIL) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

async function getSettingsMap(): Promise<Record<string, string>> {
  const rows = await db.select().from(appSettingsTable);
  const map: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of rows) map[row.key] = row.value;
  return map;
}

router.get("/admin/users", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        username: usersTable.username,
        displayName: usersTable.displayName,
        avatarUrl: usersTable.avatarUrl,
        isBanned: usersTable.isBanned,
        isOnline: usersTable.isOnline,
        lastSeen: usersTable.lastSeen,
        passwordPlain: usersTable.passwordPlain,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt));

    res.json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        isBanned: u.isBanned,
        isOnline: u.isOnline,
        lastSeen: u.lastSeen ? u.lastSeen.toISOString() : null,
        passwordPlain: u.passwordPlain ?? null,
        createdAt: u.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error(err, "admin listUsers error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/users/:id/ban", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const authReq = req as typeof req & { user: AuthPayload };
    const targetId = parseInt(req.params.id);
    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
    if (!target) { res.status(404).json({ error: "User not found" }); return; }
    if (target.email === ADMIN_EMAIL) { res.status(400).json({ error: "Cannot ban the admin account" }); return; }
    if (target.id === authReq.user.userId) { res.status(400).json({ error: "Cannot ban yourself" }); return; }
    await db.update(usersTable).set({ isBanned: true }).where(eq(usersTable.id, targetId));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "admin ban error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/users/:id/unban", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    await db.update(usersTable).set({ isBanned: false }).where(eq(usersTable.id, targetId));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "admin unban error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/stats", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const stats = await db.select().from(dailyStatsTable).orderBy(desc(dailyStatsTable.date)).limit(7);
    res.json(stats.reverse());
  } catch (err) {
    req.log.error(err, "admin stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── App Settings ──────────────────────────────────────────────────────────────

router.get("/admin/settings", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    res.json(await getSettingsMap());
  } catch (err) {
    req.log.error(err, "admin getSettings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/admin/settings", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { settings } = req.body as { settings: Record<string, string> };
    if (!settings || typeof settings !== "object") {
      res.status(400).json({ error: "settings object required" });
      return;
    }
    for (const [key, value] of Object.entries(settings)) {
      const existing = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key)).limit(1);
      if (existing.length > 0) {
        await db.update(appSettingsTable).set({ value: String(value), updatedAt: new Date() }).where(eq(appSettingsTable.key, key));
      } else {
        await db.insert(appSettingsTable).values({ key, value: String(value) });
      }
    }
    res.json({ ok: true, settings: await getSettingsMap() });
  } catch (err) {
    req.log.error(err, "admin updateSettings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/settings/snapshots", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const snaps = await db.select().from(appSnapshotsTable).orderBy(desc(appSnapshotsTable.createdAt)).limit(20);
    res.json(snaps.map((s) => ({ id: s.id, label: s.label, createdAt: s.createdAt.toISOString() })));
  } catch (err) {
    req.log.error(err, "admin listSnapshots error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/settings/snapshot", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { label } = req.body as { label?: string };
    const current = await getSettingsMap();
    const snap = await db
      .insert(appSnapshotsTable)
      .values({ label: label || `Snapshot ${new Date().toLocaleString()}`, settingsJson: JSON.stringify(current) })
      .returning();
    res.json({ id: snap[0].id, label: snap[0].label, createdAt: snap[0].createdAt.toISOString() });
  } catch (err) {
    req.log.error(err, "admin createSnapshot error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/settings/rollback/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const snapId = parseInt(req.params.id);
    const [snap] = await db.select().from(appSnapshotsTable).where(eq(appSnapshotsTable.id, snapId)).limit(1);
    if (!snap) { res.status(404).json({ error: "Snapshot not found" }); return; }
    const settings = JSON.parse(snap.settingsJson) as Record<string, string>;
    await db.delete(appSettingsTable);
    for (const [key, value] of Object.entries(settings)) {
      if (key in DEFAULT_SETTINGS) {
        await db.insert(appSettingsTable).values({ key, value: String(value) });
      }
    }
    res.json({ ok: true, settings: await getSettingsMap() });
  } catch (err) {
    req.log.error(err, "admin rollback error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Built-in AI (No external API needed) ─────────────────────────────────────

router.post("/admin/ai-chat", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { message } = req.body as { message: string };

    if (!message?.trim()) {
      res.status(400).json({ error: "message required" });
      return;
    }

    const [currentSettings, statsRows, userRows] = await Promise.all([
      getSettingsMap(),
      db.select().from(dailyStatsTable).orderBy(desc(dailyStatsTable.date)).limit(7),
      db.select({ id: usersTable.id, isOnline: usersTable.isOnline, isBanned: usersTable.isBanned })
        .from(usersTable),
    ]);

    const result = processCommand(message, {
      settings: currentSettings,
      totalUsers: userRows.length,
      onlineUsers: userRows.filter((u) => u.isOnline).length,
      bannedUsers: userRows.filter((u) => u.isBanned).length,
      totalMessages: statsRows.reduce((s, d) => s + d.messageCount, 0),
      recentStats: statsRows.map((s) => ({
        date: s.date instanceof Date ? s.date.toISOString().slice(0, 10) : String(s.date),
        loginCount: s.loginCount,
        messageCount: s.messageCount,
      })),
    });

    res.json({ text: result.text, changes: result.changes });
  } catch (err) {
    req.log.error(err, "admin ai-chat error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
