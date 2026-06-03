import { Router } from "express";
import { db, usersTable, conversationsTable, messagesTable } from "@workspace/db";
import { eq, or, and, desc } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import type { AuthPayload } from "../middlewares/auth";
import { formatUser } from "./users";

const router = Router();

router.get("/conversations", authMiddleware, async (req, res) => {
  try {
    const { userId } = (req as typeof req & { user: AuthPayload }).user;

    const convos = await db
      .select()
      .from(conversationsTable)
      .where(
        or(
          eq(conversationsTable.user1Id, userId),
          eq(conversationsTable.user2Id, userId)
        )
      )
      .orderBy(desc(conversationsTable.createdAt));

    const result = await Promise.all(
      convos.map(async (c) => {
        const otherUserId = c.user1Id === userId ? c.user2Id : c.user1Id;
        const [otherUser] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, otherUserId))
          .limit(1);

        const [lastMsg] = await db
          .select()
          .from(messagesTable)
          .where(eq(messagesTable.conversationId, c.id))
          .orderBy(desc(messagesTable.createdAt))
          .limit(1);

        return {
          id: c.id,
          otherUser: formatUser(otherUser),
          lastMessage: lastMsg?.content ?? null,
          lastMessageAt: lastMsg?.createdAt?.toISOString() ?? null,
          unreadCount: 0,
        };
      })
    );

    res.json(result);
  } catch (err) {
    req.log.error(err, "getConversations error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/conversations", authMiddleware, async (req, res) => {
  try {
    const { userId } = (req as typeof req & { user: AuthPayload }).user;
    const { otherUserId } = req.body;

    if (!otherUserId) {
      res.status(400).json({ error: "otherUserId required" });
      return;
    }

    const [existing] = await db
      .select()
      .from(conversationsTable)
      .where(
        or(
          and(
            eq(conversationsTable.user1Id, userId),
            eq(conversationsTable.user2Id, otherUserId)
          ),
          and(
            eq(conversationsTable.user1Id, otherUserId),
            eq(conversationsTable.user2Id, userId)
          )
        )
      )
      .limit(1);

    const convo = existing ?? (await db
      .insert(conversationsTable)
      .values({ user1Id: userId, user2Id: otherUserId })
      .returning()
      .then((r) => r[0]));

    const [otherUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, otherUserId))
      .limit(1);

    if (!otherUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [lastMsg] = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, convo.id))
      .orderBy(desc(messagesTable.createdAt))
      .limit(1);

    res.json({
      id: convo.id,
      otherUser: formatUser(otherUser),
      lastMessage: lastMsg?.content ?? null,
      lastMessageAt: lastMsg?.createdAt?.toISOString() ?? null,
      unreadCount: 0,
    });
  } catch (err) {
    req.log.error(err, "createConversation error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/conversations/:conversationId", authMiddleware, async (req, res) => {
  try {
    const { userId } = (req as typeof req & { user: AuthPayload }).user;
    const conversationId = parseInt(req.params.conversationId);

    const [convo] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversationId))
      .limit(1);

    if (!convo) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    if (convo.user1Id !== userId && convo.user2Id !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const otherUserId = convo.user1Id === userId ? convo.user2Id : convo.user1Id;
    const [otherUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, otherUserId))
      .limit(1);

    const [lastMsg] = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, convo.id))
      .orderBy(desc(messagesTable.createdAt))
      .limit(1);

    res.json({
      id: convo.id,
      otherUser: formatUser(otherUser),
      lastMessage: lastMsg?.content ?? null,
      lastMessageAt: lastMsg?.createdAt?.toISOString() ?? null,
      unreadCount: 0,
    });
  } catch (err) {
    req.log.error(err, "getConversation error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
