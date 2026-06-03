import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, dailyStatsTable } from "@workspace/db";
import { eq, or, sql } from "drizzle-orm";
import { authMiddleware, signToken } from "../middlewares/auth";
import type { AuthPayload } from "../middlewares/auth";
import { nanoid } from "../lib/nanoid";

const ADMIN_EMAIL = "sy5455977@gmail.com";

const router = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    inviteCode: user.inviteCode,
    createdAt: user.createdAt.toISOString(),
    isAdmin: user.email === ADMIN_EMAIL,
  };
}

async function trackDailyLogin() {
  const today = new Date().toISOString().split("T")[0];
  await db
    .insert(dailyStatsTable)
    .values({ date: today, loginCount: 1, messageCount: 0 })
    .onConflictDoUpdate({
      target: dailyStatsTable.date,
      set: { loginCount: sql`${dailyStatsTable.loginCount} + 1` },
    });
}

router.post("/auth/register", async (req, res) => {
  try {
    const { email, username, password } = req.body;
    if (!email || !username || !password) {
      res.status(400).json({ error: "Email, username, and password required" });
      return;
    }

    const existing = await db
      .select()
      .from(usersTable)
      .where(or(eq(usersTable.username, username), eq(usersTable.email, email)))
      .limit(1);

    if (existing.length > 0) {
      const taken = existing[0];
      if (taken.username === username) {
        res.status(400).json({ error: "Username already taken" });
      } else {
        res.status(400).json({ error: "Email already registered" });
      }
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const inviteCode = nanoid(12);

    const [user] = await db
      .insert(usersTable)
      .values({ email, username, displayName: username, passwordHash, inviteCode })
      .returning();

    const token = signToken({ userId: user.id, username: user.username });
    await trackDailyLogin();

    res.status(201).json({ user: formatUser(user), token });
  } catch (err) {
    req.log.error(err, "register error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Username/email and password required" });
      return;
    }

    const isEmail = username.includes("@");
    const [user] = await db
      .select()
      .from(usersTable)
      .where(isEmail ? eq(usersTable.email, username) : eq(usersTable.username, username))
      .limit(1);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    if (user.isBanned) {
      res.status(403).json({ error: "Your account has been banned by admin." });
      return;
    }

    const token = signToken({ userId: user.id, username: user.username });
    await trackDailyLogin();

    res.json({ user: formatUser(user), token });
  } catch (err) {
    req.log.error(err, "login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/me", authMiddleware, async (req, res) => {
  try {
    const { userId } = (req as typeof req & { user: AuthPayload }).user;
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    if (user.isBanned) {
      res.status(403).json({ error: "Account banned" });
      return;
    }

    res.json(formatUser(user));
  } catch (err) {
    req.log.error(err, "getMe error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", (_req, res) => {
  res.json({ ok: true });
});

export default router;
