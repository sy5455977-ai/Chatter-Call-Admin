import { Router } from "express";
import { db, usersTable, conversationsTable } from "@workspace/db";
import { eq, or, and } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import type { AuthPayload } from "../middlewares/auth";
import { formatUser } from "./users";

const router = Router();

/** Get the current user's invite link */
router.get("/invite/link", authMiddleware, async (req, res) => {
  try {
    const { userId } = (req as typeof req & { user: AuthPayload }).user;
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Use REPLIT_DOMAINS in production, current host as fallback
    const domain =
      process.env.REPLIT_DOMAINS
        ? process.env.REPLIT_DOMAINS.split(",")[0].trim()
        : req.headers.host || "localhost";

    const protocol = process.env.REPLIT_DOMAINS ? "https" : "http";
    const link = `${protocol}://${domain}/invite/${user.inviteCode}`;

    res.json({ link, inviteCode: user.inviteCode, qrData: link });
  } catch (err) {
    req.log.error(err, "getInviteLink error");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** Public: look up who owns this invite code (no auth needed) */
router.get("/invite/accept/:inviteCode", async (req, res) => {
  try {
    const { inviteCode } = req.params;
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.inviteCode, inviteCode))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }

    res.json(formatUser(user));
  } catch (err) {
    req.log.error(err, "getInviteUser error");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** Authenticated: accept invite code → create/find conversation */
router.post("/invite/start-chat", authMiddleware, async (req, res) => {
  try {
    const { userId } = (req as typeof req & { user: AuthPayload }).user;
    const { inviteCode } = req.body;

    if (!inviteCode) {
      res.status(400).json({ error: "Invite code required" });
      return;
    }

    const [inviteOwner] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.inviteCode, inviteCode))
      .limit(1);

    if (!inviteOwner) {
      res.status(404).json({ error: "Invite code not found" });
      return;
    }

    if (inviteOwner.id === userId) {
      res.status(400).json({ error: "You cannot chat with yourself" });
      return;
    }

    if (inviteOwner.isBanned) {
      res.status(403).json({ error: "This user is not available" });
      return;
    }

    // Find existing conversation or create one
    const [existing] = await db
      .select()
      .from(conversationsTable)
      .where(
        or(
          and(
            eq(conversationsTable.user1Id, userId),
            eq(conversationsTable.user2Id, inviteOwner.id)
          ),
          and(
            eq(conversationsTable.user1Id, inviteOwner.id),
            eq(conversationsTable.user2Id, userId)
          )
        )
      )
      .limit(1);

    const convo =
      existing ??
      (await db
        .insert(conversationsTable)
        .values({ user1Id: userId, user2Id: inviteOwner.id })
        .returning()
        .then((r) => r[0]));

    res.json({ conversationId: convo.id, user: formatUser(inviteOwner) });
  } catch (err) {
    req.log.error(err, "startChatFromInvite error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
