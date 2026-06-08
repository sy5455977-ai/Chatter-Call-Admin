import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Send, Loader2, Camera, CheckCircle2, RotateCcw, Bot, User, ChevronDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAuthToken } from "../lib/auth";
import { useAppSettings } from "../lib/app-settings";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  changes?: Record<string, string> | null;
  applied?: boolean;
}

interface Snapshot {
  id: number;
  label: string;
  createdAt: string;
}

const SETTING_LABELS: Record<string, string> = {
  primaryHsl: "Primary Color (HSL)",
  backgroundHsl: "Background Color (HSL)",
  cardHsl: "Card Color (HSL)",
  appName: "App Name",
  tagline: "Tagline",
};

export function AdminStudioPage() {
  const [, setLocation] = useLocation();
  const { settings, reload: reloadSettings } = useAppSettings();
  const { toast } = useToast();
  const token = getAuthToken();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Namaste! Main hun aapka **${settings.appName} AI Secretary** 🤖\n\nMujhe pata hai app ke baare mein sab kuch - users, stats, settings. Aap mujhse keh sakte ho:\n- 🎨 "Primary color change kar ke green kar do"\n- 📝 "App ka naam badal do MyChat"\n- 🌑 "Background aur dark kar do"\n- 💾 "Current settings ka snapshot le lo"\n\nKya badalna hai?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "preview">("chat");
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [savingSnap, setSavingSnap] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [pendingChanges, setPendingChanges] = useState<{ msgIdx: number; changes: Record<string, string> } | null>(null);
  const [applyingChanges, setApplyingChanges] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");

    const history = messages
      .filter((m) => !m.changes || m.applied)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);

    try {
      const res = await fetch("/api/admin/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text, history }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "no_key") {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `⚠️ **OpenAI API Key nahi mila!**\n\nAI Secretary ke liye ek baar apni OpenAI API key add karni hogi:\n1. [platform.openai.com](https://platform.openai.com) pe jaao\n2. API Keys section mein new key banao\n3. Replit ke **Secrets** tab mein jaao (left sidebar)\n4. **OPENAI_API_KEY** naam se key daalo\n\nKey add karne ke baad yahan wapas aao! 🔑`,
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `❌ Error: ${data.error || "Kuch galat ho gaya. Dobara try karo."}` },
          ]);
        }
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
        { role: "assistant", content: "❌ Network error. Server se connect nahi ho pa raha. Dobara try karo." },
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
    return content
      .split("\n")
      .map((line, i) => {
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
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-muted-foreground gap-1"
            onClick={saveSnapshot}
            disabled={savingSnap}
          >
            {savingSnap ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
            Snapshot
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2 text-[11px] gap-1 ${showSnapshots ? "text-primary" : "text-muted-foreground"}`}
            onClick={() => setShowSnapshots((v) => !v)}
          >
            <RotateCcw size={11} />
            Rollback
            <ChevronDown size={11} className={`transition-transform ${showSnapshots ? "rotate-180" : ""}`} />
          </Button>
        </div>
      </header>

      {/* Snapshots Dropdown */}
      {showSnapshots && (
        <div className="border-b border-border bg-card px-3 py-2 flex-shrink-0 max-h-40 overflow-y-auto">
          {snapshots.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Koi snapshot nahi hai abhi. "Snapshot" button se save karo.</p>
          ) : (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-1.5">Saved Snapshots</p>
              {snapshots.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 py-1">
                  <div className="min-w-0">
                    <p className="text-xs text-foreground truncate">{s.label}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(s.createdAt).toLocaleString("en-IN")}</p>
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
        {(["chat", "preview"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
            }`}
          >
            {t === "chat" ? "💬 AI Chat" : "👁️ Preview"}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Chat panel */}
        <div
          className={`flex flex-col w-full md:w-[42%] md:border-r border-border min-h-0 ${
            activeTab !== "chat" ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${
                    msg.role === "assistant" ? "bg-primary/20 text-primary" : "bg-secondary text-foreground"
                  }`}
                >
                  {msg.role === "assistant" ? <Bot size={13} /> : <User size={13} />}
                </div>
                <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  <div
                    className={`px-3 py-2 rounded-2xl text-[13px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-card border border-border rounded-tl-sm text-foreground"
                    }`}
                  >
                    {renderMessageContent(msg.content)}
                  </div>

                  {/* Changes preview */}
                  {msg.changes && Object.keys(msg.changes).length > 0 && (
                    <div className="w-full bg-primary/5 border border-primary/20 rounded-xl p-2.5 space-y-2">
                      <p className="text-[11px] font-semibold text-primary">📋 Proposed Changes:</p>
                      <div className="space-y-1">
                        {Object.entries(msg.changes).map(([k, v]) => (
                          <div key={k} className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground">{SETTING_LABELS[k] || k}:</span>
                            <span className="text-[11px] font-mono text-foreground">{v}</span>
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
                            {applyingChanges ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                            Apply
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-7 text-[11px] gap-1"
                            onClick={() => discardChanges(idx)}
                            disabled={applyingChanges}
                          >
                            <RotateCcw size={10} /> Discard
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <CheckCircle2 size={12} className="text-green-400" />
                          <span className="text-[11px] text-green-400">Changes applied!</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Bot size={13} className="text-primary" />
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-3 py-2">
                  <div className="flex gap-1 items-center h-4">
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
              "Color green kar do",
              "App ka naam badlo",
              "Stats batao",
              "Dark theme banao",
            ].map((s) => (
              <button
                key={s}
                onClick={() => { setInput(s); inputRef.current?.focus(); }}
                className="flex-shrink-0 text-[11px] px-2.5 py-1 bg-secondary rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input area */}
          <div className="px-3 pb-3 flex gap-2 flex-shrink-0">
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
              className="h-10 w-10 rounded-full flex-shrink-0"
              onClick={sendMessage}
              disabled={!input.trim() || sending}
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </Button>
          </div>
        </div>

        {/* Right: App preview */}
        <div
          className={`flex flex-col flex-1 min-h-0 ${
            activeTab !== "preview" ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card flex-shrink-0">
            <span className="text-[11px] text-muted-foreground font-medium">Live Preview — {settings.appName}</span>
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
              ref={iframeRef}
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
