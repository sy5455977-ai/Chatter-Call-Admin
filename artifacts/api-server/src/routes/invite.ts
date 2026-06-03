import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import type { AuthPayload } from "../middlewares/auth";
import { formatUser } from "./users";

const router = Router();

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

    const baseUrl =
      process.env.REPLIT_DOMAINS
        ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
        : "http://localhost";

    const link = `${baseUrl}/invite/${user.inviteCode}`;

    res.json({
      link,
      inviteCode: user.inviteCode,
      qrData: link,
    });
  } catch (err) {
    req.log.error(err, "getInviteLink error");
    res.status(500).json({ error: "Internal server error" });
  }
});

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
    req.log.error(err, "acceptInvite error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
