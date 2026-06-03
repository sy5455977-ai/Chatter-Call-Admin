import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import type { AuthPayload } from "../middlewares/auth";

const router = Router();

router.patch("/profile", authMiddleware, async (req, res) => {
  try {
    const { userId } = (req as typeof req & { user: AuthPayload }).user;
    const { displayName, bio, avatarUrl } = req.body;

    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (bio !== undefined) updates.bio = bio;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

    const [updated] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, userId))
      .returning();

    res.json({
      id: updated.id,
      username: updated.username,
      displayName: updated.displayName,
      bio: updated.bio,
      avatarUrl: updated.avatarUrl,
      inviteCode: updated.inviteCode,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err, "updateProfile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
