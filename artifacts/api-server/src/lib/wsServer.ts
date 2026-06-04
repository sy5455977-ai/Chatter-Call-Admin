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

/** Send a message to a specific user (all their open connections) */
function sendToUser(targetUserId: number, data: object) {
  const payload = JSON.stringify(data);
  for (const [, client] of clients) {
    if (client.userId === targetUserId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

/** Broadcast to ALL connected clients */
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
    const url     = new URL(req.url ?? "", `http://localhost`);
    const token   = url.searchParams.get("token") ?? "";
    const payload = verifyToken(token);

    if (!payload) {
      ws.close(4001, "Unauthorized");
      return;
    }

    const client: ChatterClient = { ws, userId: payload.userId };
    clients.set(ws, client);
    logger.info({ userId: payload.userId }, "WS client connected");

    try {
      await db.update(usersTable).set({ isOnline: true }).where(eq(usersTable.id, payload.userId));
    } catch {}

    broadcastAll({ type: "user_online", userId: payload.userId });

    ws.on("message", (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString()) as Record<string, unknown>;
        const fromUserId   = payload.userId;
        const targetUserId = msg.targetUserId as number | undefined;

        switch (msg.type) {
          // ── Chat events (broadcast so all participants can hear) ───────
          case "typing_start":
          case "typing_stop":
            broadcastAll({ type: msg.type, conversationId: msg.conversationId, userId: fromUserId });
            break;

          // ── WebRTC signaling (point-to-point) ─────────────────────────
          case "webrtc_call_request":
            if (targetUserId) {
              sendToUser(targetUserId, {
                type: "webrtc_call_request",
                conversationId: msg.conversationId,
                fromUserId,
                fromName: msg.fromName ?? "Someone",
              });
            }
            break;

          case "webrtc_call_accept":
            if (targetUserId) {
              sendToUser(targetUserId, {
                type: "webrtc_call_accept",
                conversationId: msg.conversationId,
                fromUserId,
              });
            }
            break;

          case "webrtc_call_decline":
          case "webrtc_call_end":
            if (targetUserId) {
              sendToUser(targetUserId, {
                type: msg.type,
                conversationId: msg.conversationId,
                fromUserId,
              });
            }
            break;

          case "webrtc_offer":
            if (targetUserId) {
              sendToUser(targetUserId, {
                type: "webrtc_offer",
                conversationId: msg.conversationId,
                fromUserId,
                offer: msg.offer,
              });
            }
            break;

          case "webrtc_answer":
            if (targetUserId) {
              sendToUser(targetUserId, {
                type: "webrtc_answer",
                conversationId: msg.conversationId,
                fromUserId,
                answer: msg.answer,
              });
            }
            break;

          case "webrtc_ice_candidate":
            if (targetUserId) {
              sendToUser(targetUserId, {
                type: "webrtc_ice_candidate",
                conversationId: msg.conversationId,
                fromUserId,
                candidate: msg.candidate,
              });
            }
            break;
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

/** Broadcast new message to all participants (used by messages route) */
export function broadcastToConversation(conversationId: number, data: object) {
  const payload = JSON.stringify(data);
  for (const [, client] of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}
