import { Router } from "express";
import { db, usersTable, dailyStatsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import type { AuthPayload } from "../middlewares/auth";

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
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (target.email === ADMIN_EMAIL) {
      res.status(400).json({ error: "Cannot ban the admin account" });
      return;
    }
    if (target.id === authReq.user.userId) {
      res.status(400).json({ error: "Cannot ban yourself" });
      return;
    }

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
    const stats = await db
      .select()
      .from(dailyStatsTable)
      .orderBy(desc(dailyStatsTable.date))
      .limit(7);

    res.json(stats.reverse());
  } catch (err) {
    req.log.error(err, "admin stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
