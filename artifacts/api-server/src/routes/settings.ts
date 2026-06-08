import { Router } from "express";
import { db, appSettingsTable } from "@workspace/db";

const router = Router();

const DEFAULT_SETTINGS: Record<string, string> = {
  primaryHsl: "45 68% 47%",
  backgroundHsl: "216 28% 7%",
  cardHsl: "216 28% 9%",
  appName: "Chatter",
  tagline: "Real-time messaging app",
  callsEnabled: "true",
  inviteEnabled: "true",
};

router.get("/settings", async (req, res) => {
  try {
    const rows = await db.select().from(appSettingsTable);
    const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    res.json(settings);
  } catch (err) {
    res.json(DEFAULT_SETTINGS);
  }
});

export { DEFAULT_SETTINGS };
export default router;
