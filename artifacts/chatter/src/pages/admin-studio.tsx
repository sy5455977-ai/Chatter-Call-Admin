import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Send, Loader2, CheckCircle2,
  Bot, User, RefreshCw, History, X,
  MessageSquare, Plus, Trash2, Camera, RotateCcw, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAuthToken } from "../lib/auth";
import { useAppSettings } from "../lib/app-settings";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  imagePreview?: string;
  changes?: Record<string, string> | null;
  applied?: boolean;
}

interface StoredSession {
  id: string;
  createdAt: string;
  firstMessage: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    changes?: Record<string, string> | null;
    applied?: boolean;
  }>;
  changesApplied: string[];
}

interface Snapshot {
  id: number;
  label: string;
  createdAt: string;
}

const SETTING_LABELS: Record<string, string> = {
  primaryHsl: "Primary Color",
  backgroundHsl: "Background Color",
  cardHsl: "Card Color",
  appName: "App Name",
  tagline: "Tagline",
};

const MAX_SESSIONS = 30;
const STORAGE_KEY = "adminStudioHistory_v2";

const WELCOME_MSG: ChatMessage = {
  role: "assistant",
  content: `Salam! Main hun aapka **Built-in AI** 🤖✨\n\nKoi API key ki zaroorat nahi — main seedha kaam karta hoon!\n\n🎨 **"Primary color blue kar do"** → instantly ho jaayega\n📝 **"App ka naam badal do"** → abhi badal deta hun\n🌑 **"Background dark purple karo"** → done!\n📊 **"Kitne users hain?"** → sab data mere paas hai\n💾 **"Snapshot lo"** → current state save ho jaayegi\n🔄 **"Reset karo"** → original settings wapas\n\nKya karna hai? Seedha bol do! 🚀`,
};

function loadSessions(): StoredSession[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function persistSessions(sessions: StoredSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch {}
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Abhi";
  if (diffMins < 60) return `${diffMins}m pehle`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h pehle`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function AdminStudioPage() {
  const [, setLocation] = useLocation();
  const { settings, reload: reloadSettings } = useAppSettings();
  const { toast } = useToast();
  const token = getAuthToken();

  const [activeTab, setActiveTab] = useState<"history" | "chat" | "preview">("chat");
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);

  const [sessions, setSessions] = useState<StoredSession[]>(loadSessions);
  const sessionIdRef = useRef<string>(Date.now().toString());

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<{ msgIdx: number; changes: Record<string, string> } | null>(null);
  const [applyingChanges, setApplyingChanges] = useState(false);

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [savingSnap, setSavingSnap] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchSnapshots = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings/snapshots", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setSnapshots(await res.json());
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  // Auto-save current session to localStorage after every exchange
  useEffect(() => {
    const userMsgs = messages.filter((m) => m.role === "user");
    if (userMsgs.length === 0) return;

    const changesApplied = messages
      .filter((m) => m.changes && m.applied)
      .flatMap((m) => Object.keys(m.changes!));

    const sessionData: StoredSession = {
      id: sessionIdRef.current,
      createdAt: new Date().toISOString(),
      firstMessage: userMsgs[0].content.slice(0, 70),
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        changes: m.changes,
        applied: m.applied,
      })),
      changesApplied,
    };

    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionIdRef.current);
      const updated = [sessionData, ...filtered].slice(0, MAX_SESSIONS);
      persistSessions(updated);
      return updated;
    });
  }, [messages]);

  const loadSession = (session: StoredSession) => {
    sessionIdRef.current = session.id;
    setMessages(
      session.messages.map((m) => ({
        role: m.role,
        content: m.content,
        changes: m.changes || null,
        applied: m.applied,
      }))
    );
    setPendingChanges(null);
    setInput("");
    setShowHistorySidebar(false);
    setActiveTab("chat");
    toast({ title: "📂 Session loaded", description: session.firstMessage });
  };

  const startNewChat = () => {
    sessionIdRef.current = Date.now().toString();
    setMessages([WELCOME_MSG]);
    setPendingChanges(null);
    setInput("");
    setShowHistorySidebar(false);
    setActiveTab("chat");
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      persistSessions(updated);
      return updated;
    });
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
    ]);
    setSending(true);

    try {
      const res = await fetch("/api/admin/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `❌ Error: ${data.error || "Kuch galat ho gaya. Dobara try karo."}` },
        ]);
        return;
      }

      const newMsg: ChatMessage = {
        role: "assistant",
        content: data.text || "Done!",
        changes: data.changes || null,
      };
      const newIdx = messages.length + 1;
      setMessages((prev) => [...prev, newMsg]);
      if (data.changes && Object.keys(data.changes).length > 0) {
        setPendingChanges({ msgIdx: newIdx, changes: data.changes });
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "❌ Network error. Server se connect nahi ho pa raha. Dobara try karo.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const applyChanges = async (changes: Record<string, string>, msgIdx: number) => {
    setApplyingChanges(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ settings: changes }),
      });
      if (res.ok) {
        await reloadSettings();
        setMessages((prev) =>
          prev.map((m, i) => (i === msgIdx ? { ...m, applied: true } : m))
        );
        setPendingChanges(null);
        setPreviewKey((k) => k + 1);
        toast({ title: "✅ Changes applied!", description: "App settings update ho gaye." });
      }
    } catch {
      toast({ title: "Error", description: "Changes apply nahi ho sake.", variant: "destructive" });
    } finally {
      setApplyingChanges(false);
    }
  };

  const discardChanges = (msgIdx: number) => {
    setMessages((prev) =>
      prev.map((m, i) => (i === msgIdx ? { ...m, applied: false, changes: null } : m))
    );
    setPendingChanges(null);
  };

  const saveSnapshot = async () => {
    setSavingSnap(true);
    try {
      const label = `Snap ${new Date().toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}`;
      const res = await fetch("/api/admin/settings/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ label }),
      });
      if (res.ok) {
        await fetchSnapshots();
        toast({ title: "📸 Snapshot saved!", description: label });
      }
    } catch {
      toast({ title: "Error", description: "Snapshot nahi lia gaya.", variant: "destructive" });
    } finally {
      setSavingSnap(false);
    }
  };

  const rollback = async (snapId: number, label: string) => {
    try {
      const res = await fetch(`/api/admin/settings/rollback/${snapId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await reloadSettings();
        setPreviewKey((k) => k + 1);
        setShowSnapshots(false);
        toast({ title: "⏪ Rollback ho gaya!", description: `Restored: ${label}` });
      }
    } catch {
      toast({ title: "Error", description: "Rollback fail ho gaya.", variant: "destructive" });
    }
  };

  const iframeSrc = `${window.location.origin}${import.meta.env.BASE_URL}chats`;

  function renderMessageContent(content: string) {
    return content.split("\n").map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <p key={i} className={i > 0 ? "mt-1" : ""}>
          {parts.map((p, j) =>
            p.startsWith("**") && p.endsWith("**") ? (
              <strong key={j}>{p.slice(2, -2)}</strong>
            ) : (
              <span key={j}>{p}</span>
            )
          )}
        </p>
      );
    });
  }

  const HistoryPanel = () => (
    <div className="flex flex-col h-full bg-background md:bg-card/30">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border flex-shrink-0">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <History size={13} className="text-primary" />
          Chat History
        </span>
        <Button
          size="sm"
          className="h-6 text-[10px] px-2 gap-1 bg-primary/20 hover:bg-primary/30 text-primary border-0"
          onClick={startNewChat}
        >
          <Plus size={10} /> New Chat
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <MessageSquare size={24} className="text-muted-foreground/40 mb-2" />
            <p className="text-[11px] text-muted-foreground">
              Abhi koi history nahi. Chat start karo!
            </p>
          </div>
        ) : (
          <div className="py-1">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`group flex items-start gap-2 px-3 py-2.5 hover:bg-secondary/50 cursor-pointer transition-colors border-b border-border/20 ${
                  session.id === sessionIdRef.current
                    ? "bg-primary/8 border-l-2 border-l-primary"
                    : ""
                }`}
                onClick={() => loadSession(session)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-foreground truncate font-medium leading-tight">
                    {session.firstMessage || "New chat"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(session.createdAt)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      · {session.messages.filter((m) => m.role === "user").length} msgs
                    </span>
                    {session.changesApplied.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-green-500/15 text-green-400 rounded-full font-medium">
                        {session.changesApplied.length} changes
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-destructive transition-all mt-0.5 p-1 rounded flex-shrink-0"
                  onClick={(e) => deleteSession(e, session.id)}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <header className="px-3 py-2.5 flex items-center gap-2 border-b border-border bg-background/95 backdrop-blur-sm z-20 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-8 w-8 text-muted-foreground flex-shrink-0"
          onClick={() => setLocation("/admin")}
        >
          <ArrowLeft size={16} />
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Bot size={15} className="text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold leading-tight">Admin Studio</h1>
            <p className="text-[10px] text-muted-foreground leading-tight">AI Secretary · App Control</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* History toggle — desktop */}
          <Button
            variant="ghost"
            size="sm"
            className={`hidden md:flex h-7 px-2 text-[11px] gap-1 relative ${showHistorySidebar ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
            onClick={() => setShowHistorySidebar((v) => !v)}
          >
            <History size={11} />
            History
            {sessions.length > 0 && (
              <span className="w-4 h-4 bg-primary rounded-full text-[8px] text-primary-foreground flex items-center justify-center">
                {Math.min(sessions.length, 9)}+
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-muted-foreground gap-1"
            onClick={saveSnapshot}
            disabled={savingSnap}
          >
            {savingSnap ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
            <span className="hidden sm:inline">Snap</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2 text-[11px] gap-1 ${showSnapshots ? "text-primary" : "text-muted-foreground"}`}
            onClick={() => setShowSnapshots((v) => !v)}
          >
            <RotateCcw size={11} />
            <span className="hidden sm:inline">Rollback</span>
            <ChevronDown size={11} className={`transition-transform ${showSnapshots ? "rotate-180" : ""}`} />
          </Button>
        </div>
      </header>

      {/* Snapshots Dropdown */}
      {showSnapshots && (
        <div className="border-b border-border bg-card px-3 py-2 flex-shrink-0 max-h-44 overflow-y-auto z-10">
          {snapshots.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              Koi snapshot nahi hai. Upar "Snap" button se save karo.
            </p>
          ) : (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-1.5">Saved Snapshots</p>
              {snapshots.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 py-1">
                  <div className="min-w-0">
                    <p className="text-xs text-foreground truncate">{s.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(s.createdAt).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px] border-primary/40 text-primary flex-shrink-0"
                    onClick={() => rollback(s.id, s.label)}
                  >
                    <RotateCcw size={9} className="mr-1" /> Restore
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mobile tabs */}
      <div className="flex md:hidden border-b border-border flex-shrink-0">
        {(["history", "chat", "preview"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-2 text-xs font-medium transition-colors relative ${
              activeTab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
            }`}
          >
            {t === "history" ? "📋 History" : t === "chat" ? "💬 AI Chat" : "👁️ Preview"}
            {t === "history" && sessions.length > 0 && (
              <span className="absolute top-1 right-3 w-3.5 h-3.5 bg-primary rounded-full text-[8px] text-primary-foreground flex items-center justify-center">
                {Math.min(sessions.length, 9)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* History sidebar — desktop only */}
        <div
          className={`hidden md:flex flex-col border-r border-border overflow-hidden transition-all duration-200 flex-shrink-0 ${
            showHistorySidebar ? "w-56" : "w-0"
          }`}
        >
          <HistoryPanel />
        </div>

        {/* History panel — mobile full screen */}
        {activeTab === "history" && (
          <div className="flex md:hidden flex-col flex-1 min-h-0">
            <HistoryPanel />
          </div>
        )}

        {/* Chat panel */}
        <div
          className={`flex flex-col flex-1 border-r border-border min-h-0 ${
            activeTab !== "chat" ? "hidden md:flex" : "flex"
          }`}
          style={{ maxWidth: activeTab === "chat" ? undefined : undefined }}
        >
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${
                    msg.role === "assistant"
                      ? "bg-primary/20 text-primary"
                      : "bg-secondary text-foreground"
                  }`}
                >
                  {msg.role === "assistant" ? <Bot size={13} /> : <User size={13} />}
                </div>
                <div
                  className={`max-w-[82%] flex flex-col gap-1 ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  {/* Image preview */}
                  {msg.imagePreview && (
                    <img
                      src={msg.imagePreview}
                      alt="attached"
                      className="max-w-[200px] rounded-xl border border-border object-cover"
                    />
                  )}
                  {/* Text bubble */}
                  {msg.content && (
                    <div
                      className={`px-3 py-2 rounded-2xl text-[13px] leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-card border border-border rounded-tl-sm text-foreground"
                      }`}
                    >
                      {renderMessageContent(msg.content)}
                    </div>
                  )}

                  {/* Proposed changes card */}
                  {msg.changes && Object.keys(msg.changes).length > 0 && (
                    <div className="w-full bg-primary/5 border border-primary/25 rounded-xl p-2.5 space-y-2">
                      <p className="text-[11px] font-semibold text-primary">📋 Proposed Changes:</p>
                      <div className="space-y-1.5">
                        {Object.entries(msg.changes).map(([k, v]) => (
                          <div key={k} className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] text-muted-foreground">
                              {SETTING_LABELS[k] || k}:
                            </span>
                            <span className="text-[11px] font-mono text-foreground bg-secondary px-1.5 py-0.5 rounded">
                              {v}
                            </span>
                            {k.endsWith("Hsl") && (
                              <div
                                className="w-4 h-4 rounded-full border border-border flex-shrink-0"
                                style={{ background: `hsl(${v})` }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                      {!msg.applied ? (
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            className="flex-1 h-7 text-[11px] gap-1"
                            onClick={() => applyChanges(msg.changes!, idx)}
                            disabled={applyingChanges}
                          >
                            {applyingChanges ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={10} />
                            )}
                            Apply
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-7 text-[11px] gap-1"
                            onClick={() => discardChanges(idx)}
                            disabled={applyingChanges}
                          >
                            <X size={10} /> Discard
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <CheckCircle2 size={12} className="text-green-400" />
                          <span className="text-[11px] text-green-400">Applied ✓</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {sending && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Bot size={13} className="text-primary" />
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-3 py-2.5">
                  <div className="flex gap-1 items-center">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick suggestions */}
          <div className="px-3 pb-1.5 flex gap-1.5 overflow-x-auto flex-shrink-0 scrollbar-none">
            {[
              "Blue color kar do",
              "Green theme lao",
              "App ka naam badlo",
              "Stats batao",
              "Background dark purple",
              "Reset karo",
            ].map((s) => (
              <button
                key={s}
                onClick={() => {
                  setInput(s);
                  inputRef.current?.focus();
                }}
                className="flex-shrink-0 text-[11px] px-2.5 py-1 bg-secondary rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors whitespace-nowrap"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input area */}
          <div className="px-3 pb-3 flex gap-2 items-end flex-shrink-0">
            <div className="flex-1 bg-secondary rounded-2xl flex items-end gap-2 px-3 py-2">
              <textarea
                ref={inputRef}
                className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none resize-none max-h-24 min-h-[20px]"
                placeholder="Kuch bhi poocho ya badalne ko kaho…"
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 96) + "px";
                }}
                onKeyDown={handleKeyDown}
                disabled={sending}
              />
            </div>
            <Button
              size="icon"
              className="h-9 w-9 rounded-full flex-shrink-0"
              onClick={sendMessage}
              disabled={!input.trim() || sending}
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </Button>
          </div>
        </div>

        {/* Preview panel */}
        <div
          className={`flex flex-col flex-1 min-h-0 ${
            activeTab !== "preview" ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card flex-shrink-0">
            <span className="text-[11px] text-muted-foreground font-medium">
              Live Preview — {settings.appName}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              onClick={() => setPreviewKey((k) => k + 1)}
              title="Refresh preview"
            >
              <RefreshCw size={11} />
            </Button>
          </div>
          <div className="flex-1 relative">
            <iframe
              key={previewKey}
              src={iframeSrc}
              className="absolute inset-0 w-full h-full border-0"
              title="App Preview"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
