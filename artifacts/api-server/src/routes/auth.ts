import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware, signToken } from "../middlewares/auth";
import type { AuthPayload } from "../middlewares/auth";
import { nanoid } from "../lib/nanoid";

const router = Router();

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
      .where(eq(usersTable.username, username))
      .limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Username already taken" });
      return;
    }

    const existingEmail = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    if (existingEmail.length > 0) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const inviteCode = nanoid(12);

    const [user] = await db
      .insert(usersTable)
      .values({
        email,
        username,
        displayName: username,
        passwordHash,
        inviteCode,
      })
      .returning();

    const token = signToken({ userId: user.id, username: user.username });

    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        inviteCode: user.inviteCode,
        createdAt: user.createdAt.toISOString(),
      },
      token,
    });
  } catch (err) {
    req.log.error(err, "register error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Username and password required" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const token = signToken({ userId: user.id, username: user.username });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        inviteCode: user.inviteCode,
        createdAt: user.createdAt.toISOString(),
      },
      token,
    });
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

    res.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      inviteCode: user.inviteCode,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err, "getMe error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", (_req, res) => {
  res.json({ ok: true });
});

export default router;
