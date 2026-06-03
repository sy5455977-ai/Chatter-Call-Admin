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

    await db
      .update(usersTable)
      .set({ isOnline: true })
      .where(eq(usersTable.id, payload.userId));

    ws.on("close", async () => {
      clients.delete(ws);
      logger.info({ userId: payload.userId }, "WS client disconnected");
      await db
        .update(usersTable)
        .set({ isOnline: false, lastSeen: new Date() })
        .where(eq(usersTable.id, payload.userId));
    });

    ws.on("error", (err) => {
      logger.error({ err, userId: payload.userId }, "WS error");
    });
  });

  return wss;
}

export function broadcastToConversation(
  conversationId: number,
  data: object
) {
  const payload = JSON.stringify(data);
  for (const [, client] of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}
