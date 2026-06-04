import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { MessageCircle, UserCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAuthToken } from "../lib/auth";

interface InviteUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export function InviteAcceptPage() {
  const [, params] = useRoute("/invite/:code");
  const [, setLocation] = useLocation();
  const inviteCode = params?.code ?? "";

  const [user, setUser] = useState<InviteUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!inviteCode) return;
    fetch(`/api/invite/accept/${inviteCode}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setUser(data);
        else setError("This invite link is invalid or expired.");
      })
      .catch(() => setError("Could not load invite. Please try again."))
      .finally(() => setLoading(false));
  }, [inviteCode]);

  const handleAccept = async () => {
    const token = getAuthToken();
    if (!token) {
      // Not logged in — go to auth, then come back
      sessionStorage.setItem("pendingInvite", inviteCode);
      setLocation("/");
      return;
    }

    setAccepting(true);
    try {
      const res = await fetch("/api/invite/start-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ inviteCode }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Failed to start chat.");
        return;
      }
      const data = await res.json();
      setLocation(`/chats/${data.conversationId}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6 text-destructive">
          <MessageCircle size={32} />
        </div>
        <h1 className="text-xl font-bold mb-2">Invalid Invite</h1>
        <p className="text-muted-foreground mb-6">{error || "This invite link is invalid."}</p>
        <Button onClick={() => setLocation("/")} variant="outline" className="rounded-xl">
          Go to Chatter
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
            <MessageCircle size={28} />
          </div>
          <h1 className="text-2xl font-bold text-center">You're invited!</h1>
          <p className="text-muted-foreground text-sm mt-1 text-center">
            Someone wants to chat with you on Chatter
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center gap-4 mb-6">
          <div className="relative">
            <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
              <AvatarImage src={user.avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">
                {(user.displayName?.[0] || user.username[0]).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">{user.displayName || user.username}</p>
            <p className="text-sm text-muted-foreground">@{user.username}</p>
          </div>
          <p className="text-sm text-center text-muted-foreground">
            wants to start a private conversation with you
          </p>
        </div>

        <Button
          className="w-full py-6 text-base font-semibold rounded-xl"
          onClick={handleAccept}
          disabled={accepting}
        >
          {accepting ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
              Starting chat…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <UserCheck size={20} />
              Accept &amp; Start Chatting
            </span>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center mt-4">
          You need a Chatter account to accept this invite.
        </p>
      </div>
    </div>
  );
}
