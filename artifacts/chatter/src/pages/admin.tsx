import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, BarChart3, ShieldOff, Shield, Wifi, WifiOff, RefreshCw, Eye, EyeOff, Bot } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAuthToken, useAuth } from "../lib/auth";
import { formatDistanceToNow } from "date-fns";

interface AdminUser {
  id: number;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isBanned: boolean;
  isOnline: boolean;
  lastSeen: string | null;
  passwordPlain: string | null;
  createdAt: string;
}

interface DailyStat {
  id: number;
  date: string;
  loginCount: number;
  messageCount: number;
}

const ADMIN_EMAIL = "sy5455977@gmail.com";

export function AdminPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<DailyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"users" | "stats">("users");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [showPassFor, setShowPassFor] = useState<Set<number>>(new Set());
  const [searchQ, setSearchQ] = useState("");

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    const token = getAuthToken();
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [usersRes, statsRes] = await Promise.all([
        fetch("/api/admin/users", { headers }),
        fetch("/api/admin/stats", { headers }),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user?.isAdmin) { setLocation("/profile"); return; }
    fetchData();
  }, [user]);

  const handleBan = async (userId: number, isBanned: boolean) => {
    setActionLoading(userId);
    const token = getAuthToken();
    await fetch(`/api/admin/users/${userId}/${isBanned ? "unban" : "ban"}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    await fetchData(true);
    setActionLoading(null);
  };

  const togglePass = (userId: number) => {
    setShowPassFor((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  if (!user?.isAdmin) return null;

  const onlineCount  = users.filter((u) => u.isOnline).length;
  const bannedCount  = users.filter((u) => u.isBanned).length;
  const totalLogins  = stats.reduce((s, d) => s + d.loginCount, 0);
  const totalMessages = stats.reduce((s, d) => s + d.messageCount, 0);

  const chartData = stats.map((s) => ({
    date: s.date.slice(5),
    Logins: s.loginCount,
    Messages: s.messageCount,
  }));

  const filtered = searchQ
    ? users.filter(
        (u) =>
          u.username.toLowerCase().includes(searchQ.toLowerCase()) ||
          u.email.toLowerCase().includes(searchQ.toLowerCase()) ||
          (u.displayName || "").toLowerCase().includes(searchQ.toLowerCase())
      )
    : users;

  return (
    <div className="flex flex-col min-h-full bg-background pb-8">
      {/* Header */}
      <header className="px-4 py-3 flex items-center gap-2 sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-9 w-9 text-muted-foreground flex-shrink-0"
          onClick={() => setLocation("/profile")}
        >
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold leading-tight">Admin Panel</h1>
          <p className="text-[11px] text-muted-foreground">Chatter Control Center</p>
        </div>
        <span className="text-[10px] bg-destructive/20 text-destructive px-2 py-1 rounded-full font-bold">ADMIN</span>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-xl h-8 px-2.5 text-[11px] gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 flex-shrink-0"
          onClick={() => setLocation("/admin/studio")}
        >
          <Bot size={13} />
          AI Studio
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-9 w-9 text-muted-foreground flex-shrink-0"
          onClick={() => fetchData(true)}
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
        </Button>
      </header>

      {/* Stats Cards */}
      <div className="px-3 py-3 grid grid-cols-4 gap-2">
        {[
          { label: "Users",   value: users.length,   color: "text-primary" },
          { label: "Online",  value: onlineCount,    color: "text-green-400" },
          { label: "Banned",  value: bannedCount,    color: "text-destructive" },
          { label: "Msgs 7d", value: totalMessages,  color: "text-blue-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl p-2.5 border border-border text-center">
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="px-3 flex gap-2 mb-3">
        {(["users", "stats"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground border border-border"
            }`}
          >
            {t === "users" ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            ) : (
              <BarChart3 size={14} />
            )}
            {t === "users" ? "Users" : "Stats"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : tab === "users" ? (
        <div className="px-3 space-y-2">
          {/* Search */}
          <input
            className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50"
            placeholder="Search users by name, username or email…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />

          <p className="text-xs text-muted-foreground px-1">ALL USERS ({filtered.length})</p>

          {/* Horizontal scrollable table */}
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left text-xs text-muted-foreground font-semibold px-3 py-2.5 w-40">USER</th>
                  <th className="text-left text-xs text-muted-foreground font-semibold px-3 py-2.5">EMAIL</th>
                  <th className="text-left text-xs text-muted-foreground font-semibold px-3 py-2.5 w-32">PASSWORD</th>
                  <th className="text-left text-xs text-muted-foreground font-semibold px-3 py-2.5 w-24">STATUS</th>
                  <th className="text-left text-xs text-muted-foreground font-semibold px-3 py-2.5 w-20">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, idx) => (
                  <tr
                    key={u.id}
                    className={`border-b border-border/30 last:border-0 ${u.isBanned ? "bg-destructive/5" : idx % 2 === 0 ? "" : "bg-secondary/20"}`}
                  >
                    {/* USER */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="relative flex-shrink-0">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={u.avatarUrl || undefined} />
                            <AvatarFallback className="bg-primary/20 text-primary text-xs">
                              {(u.displayName?.[0] || u.username[0]).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div
                            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${
                              u.isOnline ? "bg-green-400" : "bg-zinc-500"
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="font-medium text-[12px] text-foreground truncate">@{u.username}</span>
                            {u.email === ADMIN_EMAIL && (
                              <span className="text-[9px] bg-primary/20 text-primary px-1 py-0.5 rounded-full font-bold">ADMIN</span>
                            )}
                            {u.isBanned && (
                              <span className="text-[9px] bg-destructive/20 text-destructive px-1 py-0.5 rounded-full font-bold">BANNED</span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground truncate block">{u.displayName}</span>
                        </div>
                      </div>
                    </td>

                    {/* EMAIL */}
                    <td className="px-3 py-2.5">
                      <span className="text-[12px] text-foreground break-all">{u.email}</span>
                    </td>

                    {/* PASSWORD */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-mono text-[11px] ${showPassFor.has(u.id) ? "text-foreground" : "text-muted-foreground tracking-widest"}`}>
                          {showPassFor.has(u.id)
                            ? (u.passwordPlain || "—")
                            : "••••••••"}
                        </span>
                        <button
                          onClick={() => togglePass(u.id)}
                          className="text-muted-foreground hover:text-foreground flex-shrink-0"
                        >
                          {showPassFor.has(u.id) ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </td>

                    {/* STATUS */}
                    <td className="px-3 py-2.5">
                      {u.isOnline ? (
                        <span className="flex items-center gap-1 text-green-400 text-[11px] font-medium">
                          <Wifi size={11} /> Online
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground text-[11px]">
                          <WifiOff size={11} />
                          <span>Offline</span>
                        </span>
                      )}
                    </td>

                    {/* ACTION */}
                    <td className="px-3 py-2.5">
                      {u.email !== ADMIN_EMAIL ? (
                        <Button
                          size="sm"
                          variant={u.isBanned ? "outline" : "destructive"}
                          className={`text-[11px] h-7 px-2.5 rounded-lg ${
                            u.isBanned ? "border-green-500 text-green-400 hover:bg-green-500/10" : ""
                          }`}
                          onClick={() => handleBan(u.id, u.isBanned)}
                          disabled={actionLoading === u.id}
                        >
                          {actionLoading === u.id ? (
                            <div className="h-3 w-3 rounded-full border-b border-current animate-spin" />
                          ) : u.isBanned ? (
                            <><ShieldOff size={11} className="mr-1" />Unban</>
                          ) : (
                            <><Shield size={11} className="mr-1" />Ban</>
                          )}
                        </Button>
                      ) : (
                        <span className="text-[11px] text-primary font-bold">Admin</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="px-3 space-y-3">
          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-1 text-foreground">Last 7 Days</h3>
            <p className="text-xs text-muted-foreground mb-4">Logins & messages per day</p>
            {chartData.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No activity yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#777" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#777" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "#0f0f1a", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#aaa" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Logins" fill="#c9a227" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="Messages" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">Total Logins (7d)</p>
              <p className="text-3xl font-bold text-primary mt-1">{totalLogins}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">Total Messages (7d)</p>
              <p className="text-3xl font-bold text-blue-400 mt-1">{totalMessages}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">Online Now</p>
              <p className="text-3xl font-bold text-green-400 mt-1">{onlineCount}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">Banned</p>
              <p className="text-3xl font-bold text-destructive mt-1">{bannedCount}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
