import { Router } from "express";
import { db, usersTable, dailyStatsTable, appSettingsTable, appSnapshotsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import type { AuthPayload } from "../middlewares/auth";
import { DEFAULT_SETTINGS } from "./settings";

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

// ── AI Secretary Chat ─────────────────────────────────────────────────────────

router.post("/admin/ai-chat", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: "no_key",
        message: "OpenAI API key not configured. Please add OPENAI_API_KEY in Replit Secrets.",
      });
      return;
    }

    const { message, history = [] } = req.body as {
      message: string;
      history: Array<{ role: "user" | "assistant"; content: string }>;
    };

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

    const totalUsers = userRows.length;
    const onlineUsers = userRows.filter((u) => u.isOnline).length;
    const bannedUsers = userRows.filter((u) => u.isBanned).length;
    const totalMsgs = statsRows.reduce((s, d) => s + d.messageCount, 0);

    const systemPrompt = `You are the Admin AI Secretary for "${currentSettings.appName}", a real-time chat application. You are a powerful assistant who can customize and control the entire app.

CURRENT APP STATS:
- Total users: ${totalUsers}
- Online now: ${onlineUsers}
- Banned users: ${bannedUsers}
- Messages (last 7 days): ${totalMsgs}

CURRENT SETTINGS:
${Object.entries(currentSettings).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

WHAT YOU CAN CHANGE (respond with CHANGES block when you want to apply changes):
- primaryHsl: Primary/accent color in HSL format (e.g., "120 60% 50%" for green, "210 80% 60%" for blue, "0 80% 60%" for red)
- backgroundHsl: App background color in HSL (e.g., "0 0% 5%" for near-black)
- cardHsl: Card/panel background in HSL (e.g., "0 0% 8%")
- appName: App name (string)
- tagline: Subtitle shown on login page (string)

RESPONSE FORMAT:
- Reply in a friendly, conversational way (Hindi/English mix is fine).
- If you want to make changes, end your reply with a special block EXACTLY like this:
CHANGES:{"key":"value","key2":"value2"}
- Only include the CHANGES block if you are actually making changes.
- Keep HSL values as "H S% L%" format (e.g., "45 68% 47%").
- Make sure HSL values are valid and reasonable for a dark-themed chat app.

Be helpful, friendly, and knowledgeable about the app. You know everything about its users, settings, and stats.`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.slice(-10),
      { role: "user" as const, content: message },
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      req.log.error({ status: response.status, body: errText }, "OpenAI API error");
      res.status(502).json({ error: "AI service error. Check your OpenAI API key and billing." });
      return;
    }

    const data = await response.json() as any;
    const rawText: string = data.choices?.[0]?.message?.content ?? "";

    let text = rawText;
    let changes: Record<string, string> | null = null;

    const changesMatch = rawText.match(/CHANGES:\s*(\{[\s\S]*?\})\s*$/m);
    if (changesMatch) {
      try {
        changes = JSON.parse(changesMatch[1]);
        text = rawText.slice(0, changesMatch.index).trim();
      } catch {}
    }

    res.json({ text, changes });
  } catch (err) {
    req.log.error(err, "admin ai-chat error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
