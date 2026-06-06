import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { verifyToken } from "../middlewares/auth";
import { logger } from "./logger";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

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

export async function setupWebSocketServer(server: Server) {
  // On startup, reset all users to offline (handles server restarts)
  try {
    await db.update(usersTable).set({ isOnline: false });
    logger.info("Reset all users to offline on startup");
  } catch (err) {
    logger.error(err, "Failed to reset online status on startup");
  }

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
          case "typing_start":
          case "typing_stop":
            // Only broadcast to participants of that conversation (not all clients)
            broadcastAll({ type: msg.type, conversationId: msg.conversationId, userId: fromUserId });
            break;

          case "webrtc_call_request":
            if (targetUserId) {
              sendToUser(targetUserId, {
                type: "webrtc_call_request",
                conversationId: msg.conversationId,
                fromUserId,
                fromName: msg.fromName ?? "Someone",
                callMode: msg.callMode ?? "video",
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

      // Only mark offline if no other connections remain for this user
      const hasOtherConnections = Array.from(clients.values()).some(
        (c) => c.userId === payload.userId
      );

      if (!hasOtherConnections) {
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
      }
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
