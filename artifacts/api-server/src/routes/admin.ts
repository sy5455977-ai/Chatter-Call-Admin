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

// ── AI Secretary Chat (Gemini) ────────────────────────────────────────────────

router.post("/admin/ai-chat", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: "no_key",
        message: "Gemini API key not configured. Please add GEMINI_API_KEY in Replit Secrets.",
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

    const systemPrompt = `You are the Admin AI Secretary for "${currentSettings.appName}", a real-time chat application. You are an extremely intelligent and helpful assistant who can fully customize and control this app — just like a Replit AI assistant.

CURRENT APP STATS:
- Total users: ${totalUsers}
- Online now: ${onlineUsers}
- Banned users: ${bannedUsers}
- Messages (last 7 days): ${totalMsgs}

CURRENT SETTINGS:
${Object.entries(currentSettings).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

WHAT YOU CAN CHANGE (use CHANGES block when making changes):
- primaryHsl: Main accent/button color in HSL format. Examples: "120 60% 45%" (green), "210 80% 55%" (blue), "0 75% 50%" (red), "280 65% 55%" (purple), "45 68% 47%" (gold/default)
- backgroundHsl: App background. Examples: "220 30% 6%" (dark blue-black), "0 0% 5%" (pure dark), "240 25% 7%" (dark purple-black)
- cardHsl: Card/panel color. Should be slightly lighter than background. Examples: "220 30% 9%", "0 0% 8%"
- appName: The app's display name (any string)
- tagline: Subtitle on login page (any string)

RESPONSE FORMAT RULES:
1. Reply conversationally in Hindi/English mix (Hinglish) — be warm and friendly.
2. When the user asks you to make ANY visual or setting change, DO IT immediately and confidently.
3. If making changes, end your message with this EXACT block (no space between CHANGES: and the JSON):
CHANGES:{"key":"value"}
4. Only add CHANGES block when actually changing something.
5. HSL format: "H S% L%" — always include % signs on S and L values.
6. Be smart: if user says "green karo" pick a nice green like "142 70% 45%", if "blue karo" use "210 80% 55%", etc.
7. Keep the dark theme feel — don't make backgrounds too light.
8. You can change multiple settings at once in one CHANGES block.

You are powerful, knowledgeable, and proactive. Answer questions about the app, suggest improvements, and execute changes confidently.`;

    // Convert history to Gemini format (user/model roles)
    const geminiContents = history.slice(-12).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    geminiContents.push({ role: "user", parts: [{ text: message }] });

    const geminiBody = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: geminiContents,
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7,
      },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      req.log.error({ status: response.status, body: errText }, "Gemini API error");
      res.status(502).json({ error: "AI service error. Check your Gemini API key." });
      return;
    }

    const data = await response.json() as any;
    const rawText: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

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
