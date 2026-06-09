/**
 * Local AI — No external API needed.
 * Understands Hinglish/Urdu/English commands and applies app changes.
 */

export interface AppContext {
  settings: Record<string, string>;
  totalUsers: number;
  onlineUsers: number;
  bannedUsers: number;
  totalMessages: number;
  recentStats: Array<{ date: string; loginCount: number; messageCount: number }>;
}

export interface AIResponse {
  text: string;
  changes: Record<string, string> | null;
}

// ─── Color name → HSL mapping ─────────────────────────────────────────────────
const COLOR_MAP: Record<string, string> = {
  // Reds
  red: "0 75% 50%", lal: "0 75% 50%", "laal": "0 75% 50%",
  rose: "347 77% 50%", pink: "330 70% 55%", gulaabi: "330 70% 55%",
  crimson: "348 83% 47%",

  // Oranges
  orange: "25 90% 55%", narangi: "25 90% 55%",
  amber: "45 93% 47%", sona: "45 93% 47%",

  // Yellows
  yellow: "55 90% 50%", peela: "55 90% 50%", pilaa: "55 90% 50%",

  // Greens
  green: "142 70% 45%", sabz: "142 70% 45%", hara: "142 70% 45%",
  lime: "83 78% 45%", teal: "177 65% 40%", emerald: "152 69% 40%",
  mint: "160 65% 42%",

  // Blues
  blue: "210 80% 55%", neela: "210 80% 55%", nila: "210 80% 55%",
  navy: "220 60% 35%", sky: "198 88% 50%", cyan: "190 80% 45%",
  indigo: "239 72% 58%",

  // Purples
  purple: "272 65% 55%", purpura: "272 65% 55%", baingan: "272 65% 55%",
  violet: "250 70% 58%", lavender: "260 60% 65%", magenta: "300 65% 50%",

  // Whites / Greys / Blacks
  white: "0 0% 90%", safed: "0 0% 90%",
  silver: "220 15% 60%", grey: "220 10% 50%", gray: "220 10% 50%",

  // Gold / Default
  gold: "45 68% 47%", sona2: "45 68% 47%", golden: "45 68% 47%",
};

// ─── Background presets ───────────────────────────────────────────────────────
const BG_MAP: Record<string, { bg: string; card: string }> = {
  dark: { bg: "220 30% 6%", card: "220 30% 9%" },
  asmani: { bg: "220 30% 6%", card: "220 30% 9%" },
  "dark blue": { bg: "220 30% 6%", card: "220 30% 9%" },
  navy: { bg: "222 50% 5%", card: "222 50% 8%" },
  black: { bg: "0 0% 4%", card: "0 0% 7%" },
  kaala: { bg: "0 0% 4%", card: "0 0% 7%" },
  "pure black": { bg: "0 0% 3%", card: "0 0% 6%" },
  purple: { bg: "260 30% 6%", card: "260 30% 9%" },
  "dark purple": { bg: "260 35% 5%", card: "260 35% 8%" },
  "purple dark": { bg: "260 35% 5%", card: "260 35% 8%" },
  green: { bg: "150 30% 5%", card: "150 30% 8%" },
  "dark green": { bg: "150 35% 5%", card: "150 35% 8%" },
  red: { bg: "0 30% 5%", card: "0 30% 8%" },
  "dark red": { bg: "0 30% 5%", card: "0 30% 8%" },
  default: { bg: "216 28% 7%", card: "216 28% 9%" },
  original: { bg: "216 28% 7%", card: "216 28% 9%" },
  reset: { bg: "216 28% 7%", card: "216 28% 9%" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function matchColor(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [key, hsl] of Object.entries(COLOR_MAP)) {
    if (lower.includes(key)) return hsl;
  }
  // Match hex color
  const hex = lower.match(/#([0-9a-f]{6})\b/);
  if (hex) return hexToHsl(hex[0]);
  // Match HSL directly
  const hslMatch = lower.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (hslMatch) return `${hslMatch[1]} ${hslMatch[2]}% ${hslMatch[3]}%`;
  return null;
}

function matchBg(text: string): { bg: string; card: string } | null {
  const lower = text.toLowerCase();
  for (const [key, val] of Object.entries(BG_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function extractQuotedOrAfter(text: string, ...keywords: string[]): string | null {
  // Try quoted first
  const q = text.match(/["'`""](.+?)["'`""]/);
  if (q) return q[1].trim();
  // Try after keyword
  for (const kw of keywords) {
    const idx = text.toLowerCase().indexOf(kw);
    if (idx !== -1) {
      const after = text.slice(idx + kw.length).trim().replace(/^[:\-\s]+/, "").trim();
      if (after.length > 0 && after.length < 60) return after;
    }
  }
  return null;
}

// ─── Main intent processor ────────────────────────────────────────────────────
export function processCommand(userMsg: string, ctx: AppContext): AIResponse {
  const msg = userMsg.trim();
  const lower = msg.toLowerCase();

  // ── STATS / INFO ───────────────────────────────────────────────────────────
  const isStatsQuery =
    lower.includes("stat") || lower.includes("kitne") || lower.includes("how many") ||
    lower.includes("user") || lower.includes("online") || lower.includes("info") ||
    lower.includes("batao") || lower.includes("bata do") || lower.includes("data") ||
    lower.includes("total") || lower.includes("count") || lower.includes("kya hai") ||
    lower.includes("settings") || lower.includes("current");

  // ── SNAPSHOT ───────────────────────────────────────────────────────────────
  const isSnapshot =
    lower.includes("snapshot") || lower.includes("snap") || lower.includes("save") ||
    lower.includes("backup");

  // ── RESET / ORIGINAL ───────────────────────────────────────────────────────
  const isReset =
    lower.includes("reset") || lower.includes("original") || lower.includes("pehle") ||
    lower.includes("default") || lower.includes("wapas") || lower.includes("restore") ||
    lower.includes("purana");

  // ── APP NAME CHANGE ────────────────────────────────────────────────────────
  const isNameChange =
    lower.includes("naam") || lower.includes("name") || lower.includes("app name") ||
    lower.includes("title") || lower.includes("badal");

  // ── TAGLINE CHANGE ─────────────────────────────────────────────────────────
  const isTaglineChange =
    lower.includes("tagline") || lower.includes("subtitle") || lower.includes("description") ||
    lower.includes("slogan") || lower.includes("neeche") || lower.includes("under");

  // ── COLOR CHANGE (primary) ─────────────────────────────────────────────────
  const isColorChange =
    lower.includes("color") || lower.includes("colour") || lower.includes("rang") ||
    lower.includes("theme") || lower.includes("karo") || lower.includes("kar do") ||
    lower.includes("change") || lower.includes("badlo") || lower.includes("set") ||
    lower.includes("primary") || lower.includes("accent") || lower.includes("button");

  // ── BACKGROUND CHANGE ─────────────────────────────────────────────────────
  const isBgChange =
    lower.includes("background") || lower.includes("bg ") || lower.includes("peeche") ||
    lower.includes("dark") || lower.includes("theme dark") || lower.includes("wallpaper");

  // ── HELP ───────────────────────────────────────────────────────────────────
  const isHelp =
    lower.includes("help") || lower.includes("kya kar") || lower.includes("capabilities") ||
    lower.includes("kya kuch") || lower.includes("kya badal") || msg.length < 10;


  // ─── PROCESS INTENTS ──────────────────────────────────────────────────────

  // HELP
  if (isHelp && !isColorChange && !isNameChange && !isTaglineChange && !isBgChange && !isStatsQuery) {
    return {
      text: `Salam! Main aapka **Built-in AI** hoon 🤖✨\n\nKoi bhi API key ki zaroorat nahi — main seedha kaam karta hoon!\n\nMain yeh sab kar sakta hoon:\n\n🎨 **Color badlna** — "Primary color blue kar do" ya "Green theme lao"\n📝 **Naam badlna** — "App ka naam ChatApp kar do"\n💬 **Tagline badlna** — "Tagline badal do: Best chat app"\n🌑 **Background badlna** — "Background dark purple kar do"\n📊 **Stats dekhna** — "Kitne users hain?" ya "Stats batao"\n📸 **Snapshot lena** — "Snapshot lo" (backup save hoga)\n🔄 **Reset karna** — "Default settings restore karo"\n\nBas seedha bol do, main instantly apply kar dunga! 🚀`,
      changes: null,
    };
  }

  // STATS
  if (isStatsQuery && !isColorChange && !isNameChange && !isTaglineChange && !isBgChange) {
    const lines = ctx.recentStats.slice(-3).map(
      (s) => `  • ${s.date.slice(5)}: ${s.loginCount} logins, ${s.messageCount} messages`
    );
    return {
      text: `📊 **App Stats — ${ctx.settings.appName}**\n\n👥 Total users: **${ctx.totalUsers}**\n🟢 Online: **${ctx.onlineUsers}**\n🚫 Banned: **${ctx.bannedUsers}**\n💬 Messages (7 din): **${ctx.totalMessages}**\n\n**Current Settings:**\n  • Naam: ${ctx.settings.appName}\n  • Tagline: ${ctx.settings.tagline}\n  • Primary Color: ${ctx.settings.primaryHsl}\n  • Background: ${ctx.settings.backgroundHsl}\n\n**Recent Activity:**\n${lines.join("\n") || "  • Abhi koi activity nahi"}`,
      changes: null,
    };
  }

  // RESET / DEFAULT
  if (isReset) {
    return {
      text: `✅ Default settings restore kar diye! App wapas original look mein aa gayi.\n\n• Primary: Gold (45 68% 47%)\n• Background: Dark Navy (216 28% 7%)\n• Card: Dark Navy (216 28% 9%)\n• Naam: Chatter\n• Tagline: Real-time messaging app`,
      changes: {
        primaryHsl: "45 68% 47%",
        backgroundHsl: "216 28% 7%",
        cardHsl: "216 28% 9%",
        appName: "Chatter",
        tagline: "Real-time messaging app",
      },
    };
  }

  // SNAPSHOT
  if (isSnapshot) {
    return {
      text: `📸 Snapshot lene ke liye upar "Snapshot" button press karo — current settings save ho jayenge aur rollback kar sakte ho kisi bhi waqt!\n\n(Snapshot feature admin studio mein available hai.)`,
      changes: null,
    };
  }

  // Collect all changes
  const changes: Record<string, string> = {};
  const applied: string[] = [];

  // ── PRIMARY COLOR ──────────────────────────────────────────────────────────
  if (isColorChange && !isBgChange) {
    const hsl = matchColor(lower);
    if (hsl) {
      changes.primaryHsl = hsl;
      const colorName = Object.entries(COLOR_MAP).find(([, v]) => v === hsl)?.[0] || hsl;
      applied.push(`🎨 Primary color: **${colorName}** (${hsl})`);
    }
  }

  // ── BACKGROUND ─────────────────────────────────────────────────────────────
  if (isBgChange) {
    const bg = matchBg(lower) || matchColor(lower)
      ? { bg: matchColor(lower)?.replace(/(\d+) (\d+)% (\d+)%/, (_, h, s, l) => `${h} ${Math.round(parseInt(s) * 0.3)}% ${Math.round(parseInt(l) * 0.2)}%`) || "220 30% 6%", card: "220 30% 9%" }
      : null;
    const bgPreset = matchBg(lower);
    if (bgPreset) {
      changes.backgroundHsl = bgPreset.bg;
      changes.cardHsl = bgPreset.card;
      applied.push(`🌑 Background: **dark theme** (${bgPreset.bg})`);
    } else {
      // Try to find color for background
      const hsl = matchColor(lower);
      if (hsl) {
        const parts = hsl.match(/(\d+) (\d+)% (\d+)%/);
        if (parts) {
          const darkBg = `${parts[1]} ${Math.min(parseInt(parts[2]), 35)}% ${Math.max(5, Math.min(10, Math.floor(parseInt(parts[3]) * 0.15)))}%`;
          const darkCard = `${parts[1]} ${Math.min(parseInt(parts[2]), 35)}% ${Math.max(7, Math.min(13, Math.floor(parseInt(parts[3]) * 0.2)))}%`;
          changes.backgroundHsl = darkBg;
          changes.cardHsl = darkCard;
          applied.push(`🌑 Background dark: (${darkBg})`);
        }
      }
    }
    // Also apply matching primary if color mentioned
    if (!changes.backgroundHsl) {
      const hsl = matchColor(lower);
      if (hsl) {
        changes.primaryHsl = hsl;
        applied.push(`🎨 Theme color: **${hsl}**`);
      }
    }
  }

  // Full theme — change both primary and background together
  if (isColorChange && isBgChange && !changes.primaryHsl) {
    const hsl = matchColor(lower);
    if (hsl) {
      changes.primaryHsl = hsl;
      applied.push(`🎨 Primary color: **${hsl}**`);
    }
  }

  // ── APP NAME ───────────────────────────────────────────────────────────────
  if (isNameChange) {
    // Try to extract name from message — look for "naam X", "name X", "naam: X", quoted text
    const name = extractQuotedOrAfter(msg,
      "naam", "name", "app ka naam", "title", "app name", "naam badal", "naam kar",
      "badal do", "kar do", "rename", "called", "naam ho"
    );
    if (name && name.length >= 2) {
      // Exclude non-name words
      const excluded = ["badal", "karo", "kar", "change", "update", "do", "dena", "please", "chahta", "chahiye"];
      const cleanName = name.split(" ").filter(w => !excluded.includes(w.toLowerCase())).join(" ").trim();
      if (cleanName.length >= 2) {
        changes.appName = cleanName;
        applied.push(`📝 App naam: **${cleanName}**`);
      }
    }
  }

  // ── TAGLINE ────────────────────────────────────────────────────────────────
  if (isTaglineChange) {
    const tag = extractQuotedOrAfter(msg,
      "tagline", "subtitle", "slogan", "description", "tagline:", "tagline badal",
      "tagline kar", "badal do", "tag line"
    );
    if (tag && tag.length >= 3) {
      changes.tagline = tag;
      applied.push(`💬 Tagline: **${tag}**`);
    }
  }

  // ─── BUILD RESPONSE ────────────────────────────────────────────────────────
  if (Object.keys(changes).length > 0) {
    const list = applied.join("\n");
    return {
      text: `✅ **Ho gaya!** Yeh changes apply ho gaye:\n\n${list}\n\nChanges instantly reflect ho jayenge! Kuch aur karna ho toh bol do. 🚀`,
      changes,
    };
  }

  // ─── FALLBACK — color mentioned but not matched ───────────────────────────
  if (isColorChange || isNameChange || isTaglineChange || isBgChange) {
    return {
      text: `Hmmm, main exactly samajh nahi paya. Thoda aur clearly batao:\n\n🎨 Color ke liye: *"Primary color blue kar do"*\n📝 Naam ke liye: *"App ka naam 'ChatZone' kar do"*\n💬 Tagline: *"Tagline: Connect with everyone"*\n🌑 Background: *"Background dark purple kar do"*\n\nKoi bhi ek command do! 😊`,
      changes: null,
    };
  }

  // ─── GENERAL RESPONSE ─────────────────────────────────────────────────────
  return {
    text: `Shukriya message ke liye! Main aapki app ko customize karne mein madad kar sakta hoon:\n\n🎨 **Colors** — *"Blue theme lao"*\n📝 **Naam** — *"App ka naam badlo"*\n📊 **Stats** — *"Kitne users hain?"*\n🌑 **Background** — *"Dark purple background"*\n\nKya karna chahte ho? Seedha bol do! 😊`,
    changes: null,
  };
}
