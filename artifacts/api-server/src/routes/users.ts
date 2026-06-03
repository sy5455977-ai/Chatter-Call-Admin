import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, ilike } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import type { AuthPayload } from "../middlewares/auth";

const router = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    inviteCode: user.inviteCode,
    createdAt: user.createdAt.toISOString(),
  };
}

router.get("/users/search", authMiddleware, async (req, res) => {
  try {
    const q = req.query.q as string;
    if (!q) {
      res.status(400).json({ error: "Query required" });
      return;
    }
    const { userId } = (req as typeof req & { user: AuthPayload }).user;
    const users = await db
      .select()
      .from(usersTable)
      .where(ilike(usersTable.username, `%${q}%`))
      .limit(20);

    res.json(users.filter((u) => u.id !== userId).map(formatUser));
  } catch (err) {
    req.log.error(err, "searchUsers error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/:userId", authMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(formatUser(user));
  } catch (err) {
    req.log.error(err, "getUser error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
export { formatUser };
