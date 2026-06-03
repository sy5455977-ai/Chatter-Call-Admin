import { Router } from "express";
import { db, messagesTable, conversationsTable, dailyStatsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import type { AuthPayload } from "../middlewares/auth";
import { broadcastToConversation } from "../lib/wsServer";

const router = Router();

router.get("/conversations/:conversationId/messages", authMiddleware, async (req, res) => {
  try {
    const { userId } = (req as typeof req & { user: AuthPayload }).user;
    const conversationId = parseInt(req.params.conversationId);

    const [convo] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversationId))
      .limit(1);

    if (!convo || (convo.user1Id !== userId && convo.user2Id !== userId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(desc(messagesTable.createdAt))
      .limit(100);

    res.json(
      messages.reverse().map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        content: m.content,
        messageType: m.messageType,
        createdAt: m.createdAt.toISOString(),
        isOwn: m.senderId === userId,
      }))
    );
  } catch (err) {
    req.log.error(err, "listMessages error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/conversations/:conversationId/messages", authMiddleware, async (req, res) => {
  try {
    const { userId } = (req as typeof req & { user: AuthPayload }).user;
    const conversationId = parseInt(req.params.conversationId);

    const [convo] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversationId))
      .limit(1);

    if (!convo || (convo.user1Id !== userId && convo.user2Id !== userId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { content, messageType = "text" } = req.body;
    if (!content) {
      res.status(400).json({ error: "Content required" });
      return;
    }

    const [msg] = await db
      .insert(messagesTable)
      .values({ conversationId, senderId: userId, content, messageType })
      .returning();

    const today = new Date().toISOString().split("T")[0];
    await db
      .insert(dailyStatsTable)
      .values({ date: today, loginCount: 0, messageCount: 1 })
      .onConflictDoUpdate({
        target: dailyStatsTable.date,
        set: { messageCount: sql`${dailyStatsTable.messageCount} + 1` },
      });

    const formatted = {
      id: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      content: msg.content,
      messageType: msg.messageType,
      createdAt: msg.createdAt.toISOString(),
      isOwn: true,
    };

    broadcastToConversation(conversationId, {
      type: "new_message",
      message: formatted,
      conversationId,
    });

    res.status(201).json(formatted);
  } catch (err) {
    req.log.error(err, "sendMessage error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/conversations/:conversationId/messages", authMiddleware, async (req, res) => {
  try {
    const { userId } = (req as typeof req & { user: AuthPayload }).user;
    const conversationId = parseInt(req.params.conversationId);

    const [convo] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversationId))
      .limit(1);

    if (!convo || (convo.user1Id !== userId && convo.user2Id !== userId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await db.delete(messagesTable).where(eq(messagesTable.conversationId, conversationId));

    broadcastToConversation(conversationId, { type: "chat_cleared", conversationId });

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "clearChat error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/messages/:messageId", authMiddleware, async (req, res) => {
  try {
    const { userId } = (req as typeof req & { user: AuthPayload }).user;
    const messageId = parseInt(req.params.messageId);

    const [msg] = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.id, messageId))
      .limit(1);

    if (!msg) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
    if (msg.senderId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await db.delete(messagesTable).where(eq(messagesTable.id, messageId));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "deleteMessage error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
