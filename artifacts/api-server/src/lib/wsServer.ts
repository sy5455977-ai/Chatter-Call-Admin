import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { verifyToken } from "../middlewares/auth";
import { logger } from "./logger";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

interface ChatterClient {
  ws: WebSocket;
  userId: number;
}

const clients = new Map<WebSocket, ChatterClient>();

export function getOnlineUserIds(): number[] {
  return Array.from(clients.values()).map((c) => c.userId);
}

function broadcastAll(data: object) {
  const payload = JSON.stringify(data);
  for (const [, client] of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

export function setupWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? "", `http://localhost`);
    const token = url.searchParams.get("token") ?? "";
    const payload = verifyToken(token);

    if (!payload) {
      ws.close(4001, "Unauthorized");
      return;
    }

    const client: ChatterClient = { ws, userId: payload.userId };
    clients.set(ws, client);
    logger.info({ userId: payload.userId }, "WS client connected");

    try {
      await db
        .update(usersTable)
        .set({ isOnline: true })
        .where(eq(usersTable.id, payload.userId));
    } catch {}

    broadcastAll({ type: "user_online", userId: payload.userId });

    ws.on("message", (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString());
        if (msg.type === "typing_start" || msg.type === "typing_stop") {
          broadcastAll({
            type: msg.type,
            conversationId: msg.conversationId,
            userId: payload.userId,
          });
        }
      } catch {}
    });

    ws.on("close", async () => {
      clients.delete(ws);
      logger.info({ userId: payload.userId }, "WS client disconnected");

      const lastSeen = new Date();
      try {
        await db
          .update(usersTable)
          .set({ isOnline: false, lastSeen })
          .where(eq(usersTable.id, payload.userId));
      } catch {}

      broadcastAll({
        type: "user_offline",
        userId: payload.userId,
        lastSeen: lastSeen.toISOString(),
      });
    });

    ws.on("error", (err) => {
      logger.error({ err, userId: payload.userId }, "WS error");
    });
  });

  return wss;
}

export function broadcastToConversation(conversationId: number, data: object) {
  const payload = JSON.stringify(data);
  for (const [, client] of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}
