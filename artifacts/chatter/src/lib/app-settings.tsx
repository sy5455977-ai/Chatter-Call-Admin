import { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface AppSettings {
  primaryHsl: string;
  backgroundHsl: string;
  cardHsl: string;
  appName: string;
  tagline: string;
  callsEnabled: string;
  inviteEnabled: string;
  [key: string]: string;
}

const DEFAULT: AppSettings = {
  primaryHsl: "45 68% 47%",
  backgroundHsl: "216 28% 7%",
  cardHsl: "216 28% 9%",
  appName: "Chatter",
  tagline: "Real-time messaging app",
  callsEnabled: "true",
  inviteEnabled: "true",
};

function applySettings(s: AppSettings) {
  const root = document.documentElement;
  root.style.setProperty("--primary", s.primaryHsl);
  root.style.setProperty("--accent", s.primaryHsl);
  root.style.setProperty("--ring", s.primaryHsl);
  root.style.setProperty("--background", s.backgroundHsl);
  root.style.setProperty("--card", s.cardHsl);
  root.style.setProperty("--popover", s.cardHsl);
}

const AppSettingsContext = createContext<{
  settings: AppSettings;
  reload: () => Promise<void>;
}>({ settings: DEFAULT, reload: async () => {} });

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        const merged = { ...DEFAULT, ...data };
        setSettings(merged);
        applySettings(merged);
        try { localStorage.setItem("chatterSettings", JSON.stringify(merged)); } catch {}
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const cached = localStorage.getItem("chatterSettings");
      if (cached) {
        const parsed = JSON.parse(cached) as AppSettings;
        setSettings(parsed);
        applySettings(parsed);
      }
    } catch {}
    reload();
  }, [reload]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "chatterSettings" && e.newValue) {
        try {
          const s = JSON.parse(e.newValue) as AppSettings;
          setSettings(s);
          applySettings(s);
        } catch {}
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return (
    <AppSettingsContext.Provider value={{ settings, reload }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
