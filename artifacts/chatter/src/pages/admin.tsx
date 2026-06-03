import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Users, BarChart3, ShieldOff, Shield, Wifi, WifiOff, Clock, RefreshCw } from "lucide-react";
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
    if (!user?.isAdmin) {
      setLocation("/profile");
      return;
    }
    fetchData();
  }, [user]);

  const handleBan = async (userId: number, isBanned: boolean) => {
    setActionLoading(userId);
    const token = getAuthToken();
    const endpoint = isBanned ? "unban" : "ban";
    await fetch(`/api/admin/users/${userId}/${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    await fetchData(true);
    setActionLoading(null);
  };

  const togglePass = (userId: number) => {
    setShowPassFor((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  if (!user?.isAdmin) return null;

  const totalLogins = stats.reduce((s, d) => s + d.loginCount, 0);
  const totalMessages = stats.reduce((s, d) => s + d.messageCount, 0);
  const onlineCount = users.filter((u) => u.isOnline).length;
  const bannedCount = users.filter((u) => u.isBanned).length;

  const chartData = stats.map((s) => ({
    date: s.date.slice(5),
    Logins: s.loginCount,
    Messages: s.messageCount,
  }));

  return (
    <div className="flex flex-col min-h-full bg-background pb-8">
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
          <h1 className="text-base font-bold leading-tight">Admin Dashboard</h1>
          <p className="text-[11px] text-muted-foreground">Chatter Control Panel</p>
        </div>
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
          { label: "Users", value: users.length, color: "text-primary" },
          { label: "Online", value: onlineCount, color: "text-green-400" },
          { label: "Banned", value: bannedCount, color: "text-destructive" },
          { label: "Msgs 7d", value: totalMessages, color: "text-blue-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl p-2.5 border border-border text-center">
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
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
            {t === "users" ? <Users size={14} /> : <BarChart3 size={14} />}
            {t === "users" ? "Users" : "Stats"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : tab === "users" ? (
        <div className="px-3 space-y-3">
          <p className="text-xs text-muted-foreground px-1">
            {users.length} registered users · Long-press password to reveal
          </p>
          {users.map((u) => (
            <div
              key={u.id}
              className={`bg-card rounded-2xl border overflow-hidden ${
                u.isBanned ? "border-destructive/50" : "border-border"
              }`}
            >
              {/* User header */}
              <div className="flex items-center gap-3 p-3 border-b border-border/50">
                <div className="relative flex-shrink-0">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={u.avatarUrl || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary text-sm">
                      {(u.displayName?.[0] || u.username[0]).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${
                      u.isOnline ? "bg-green-400" : "bg-zinc-500"
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm">{u.displayName || u.username}</span>
                    {u.email === ADMIN_EMAIL && (
                      <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
                        ADMIN
                      </span>
                    )}
                    {u.isBanned && (
                      <span className="text-[9px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full font-medium">
                        BANNED
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">@{u.username}</p>
                </div>
                {u.email !== ADMIN_EMAIL && (
                  <Button
                    size="sm"
                    variant={u.isBanned ? "outline" : "destructive"}
                    className={`text-xs h-7 px-3 rounded-lg flex-shrink-0 ${
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
                )}
              </div>

              {/* User details grid */}
              <div className="p-3 space-y-1.5 text-[12px]">
                <div className="flex items-start gap-1">
                  <span className="text-muted-foreground w-14 flex-shrink-0">Email</span>
                  <span className="text-foreground break-all">{u.email}</span>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground w-14 flex-shrink-0">Password</span>
                  <div className="flex items-center gap-2 flex-1">
                    <span className={`font-mono ${showPassFor.has(u.id) ? "text-foreground" : "text-muted-foreground tracking-widest"}`}>
                      {showPassFor.has(u.id)
                        ? (u.passwordPlain || "Not yet recorded")
                        : "••••••••"}
                    </span>
                    <button
                      onClick={() => togglePass(u.id)}
                      className="text-[10px] text-primary underline ml-1"
                    >
                      {showPassFor.has(u.id) ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground w-14 flex-shrink-0">Status</span>
                  {u.isOnline ? (
                    <span className="text-green-400 flex items-center gap-1">
                      <Wifi size={11} /> Online
                    </span>
                  ) : (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <WifiOff size={11} />
                      {u.lastSeen
                        ? `Offline · ${formatDistanceToNow(new Date(u.lastSeen), { addSuffix: true })}`
                        : "Never online"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground w-14 flex-shrink-0">Joined</span>
                  <span className="text-foreground flex items-center gap-1">
                    <Clock size={10} />
                    {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          ))}
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
                    contentStyle={{
                      background: "#0f0f1a",
                      border: "1px solid #333",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
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
              <p className="text-xs text-muted-foreground">Active Users</p>
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
