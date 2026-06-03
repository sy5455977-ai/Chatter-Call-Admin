import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Users, BarChart3, Shield, ShieldOff, Wifi, WifiOff, Clock } from "lucide-react";
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
  createdAt: string;
}

interface DailyStat {
  id: number;
  date: string;
  loginCount: number;
  messageCount: number;
}

export function AdminPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<DailyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"users" | "stats">("users");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchData = async () => {
    const token = getAuthToken();
    const headers = { Authorization: `Bearer ${token}` };
    const [usersRes, statsRes] = await Promise.all([
      fetch("/api/admin/users", { headers }),
      fetch("/api/admin/stats", { headers }),
    ]);
    if (usersRes.ok) setUsers(await usersRes.json());
    if (statsRes.ok) setStats(await statsRes.json());
    setLoading(false);
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
    await fetchData();
    setActionLoading(null);
  };

  if (!user?.isAdmin) return null;

  const totalLogins = stats.reduce((sum, s) => sum + s.loginCount, 0);
  const totalMessages = stats.reduce((sum, s) => sum + s.messageCount, 0);
  const onlineCount = users.filter((u) => u.isOnline).length;

  const chartData = stats.map((s) => ({
    date: s.date.slice(5),
    Logins: s.loginCount,
    Messages: s.messageCount,
  }));

  return (
    <div className="flex flex-col min-h-full bg-background">
      <header className="px-4 py-3 flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-9 w-9 text-muted-foreground"
          onClick={() => setLocation("/profile")}
        >
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-lg font-bold">Admin Dashboard</h1>
          <p className="text-xs text-muted-foreground">Chatter Control Panel</p>
        </div>
      </header>

      <div className="px-4 py-3 grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl p-3 border border-border text-center">
          <p className="text-2xl font-bold text-primary">{users.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Users</p>
        </div>
        <div className="bg-card rounded-xl p-3 border border-border text-center">
          <p className="text-2xl font-bold text-green-400">{onlineCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Online Now</p>
        </div>
        <div className="bg-card rounded-xl p-3 border border-border text-center">
          <p className="text-2xl font-bold text-yellow-400">{totalMessages}</p>
          <p className="text-xs text-muted-foreground mt-1">7d Messages</p>
        </div>
      </div>

      <div className="px-4 flex gap-2 mb-3">
        <button
          onClick={() => setTab("users")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            tab === "users"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground border border-border"
          }`}
        >
          <Users size={16} /> Users
        </button>
        <button
          onClick={() => setTab("stats")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            tab === "stats"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground border border-border"
          }`}
        >
          <BarChart3 size={16} /> Stats
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : tab === "users" ? (
        <div className="px-4 pb-8 space-y-3">
          {users.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No users found</p>
          )}
          {users.map((u) => (
            <div
              key={u.id}
              className={`bg-card rounded-2xl border p-4 ${
                u.isBanned ? "border-destructive/40 opacity-70" : "border-border"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="relative flex-shrink-0">
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={u.avatarUrl || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {(u.displayName?.[0] || u.username[0]).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${
                      u.isOnline ? "bg-green-400" : "bg-zinc-500"
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground text-sm">
                      {u.displayName || u.username}
                    </span>
                    {u.isBanned && (
                      <span className="text-[10px] bg-destructive/20 text-destructive px-2 py-0.5 rounded-full">
                        BANNED
                      </span>
                    )}
                    {u.email === "sy5455977@gmail.com" && (
                      <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                        ADMIN
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">@{u.username}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-medium">Password:</span>{" "}
                    <span className="tracking-widest">••••••••</span>
                  </p>
                  <div className="mt-1">
                    {u.isOnline ? (
                      <span className="text-[11px] text-green-400 flex items-center gap-1">
                        <Wifi size={10} /> Online
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <WifiOff size={10} />
                        {u.lastSeen
                          ? `Offline · ${formatDistanceToNow(new Date(u.lastSeen), { addSuffix: true })}`
                          : "Never online"}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock size={10} />
                    Joined {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
              {u.email !== "sy5455977@gmail.com" && (
                <div className="mt-3 flex justify-end">
                  <Button
                    size="sm"
                    variant={u.isBanned ? "outline" : "destructive"}
                    className={`text-xs h-8 rounded-lg ${
                      u.isBanned
                        ? "border-green-500 text-green-400 hover:bg-green-500/10"
                        : ""
                    }`}
                    onClick={() => handleBan(u.id, u.isBanned)}
                    disabled={actionLoading === u.id}
                  >
                    {actionLoading === u.id ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b border-current" />
                    ) : u.isBanned ? (
                      <>
                        <ShieldOff size={12} className="mr-1" />
                        Unban
                      </>
                    ) : (
                      <>
                        <Shield size={12} className="mr-1" />
                        Ban
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 pb-8">
          <div className="bg-card rounded-2xl border border-border p-4 mb-4">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground">
              Last 7 Days Activity
            </h3>
            {chartData.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#888" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#888" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#1a1a2e",
                      border: "1px solid #333",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#aaa" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Logins" fill="#c9a227" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Messages" fill="#4a9eff" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Logins (7d)</p>
              <p className="text-2xl font-bold text-primary">{totalLogins}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Messages (7d)</p>
              <p className="text-2xl font-bold text-blue-400">{totalMessages}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
