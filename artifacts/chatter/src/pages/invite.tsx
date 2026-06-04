import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import QRCode from "qrcode";
import { ArrowLeft, Copy, CheckCircle2, Share2 } from "lucide-react";
import { useGetInviteLink } from "@workspace/api-client-react/generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "../lib/auth";

export function InvitePage() {
  const [, setLocation] = useLocation();
  const { data: inviteData } = useGetInviteLink();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [accepting, setAccepting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (inviteData && canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        inviteData.link,
        {
          width: 220,
          margin: 2,
          color: { dark: "#c9a227", light: "#0d1117" },
        },
        (err) => {
          if (err) console.error("QR gen error", err);
        }
      );
    }
  }, [inviteData]);

  const handleCopy = async () => {
    if (!inviteData) return;
    try {
      await navigator.clipboard.writeText(inviteData.link);
    } catch {
      // Fallback for older browsers
      const el = document.createElement("textarea");
      el.value = inviteData.link;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast({ title: "Copied!", description: "Invite link copied to clipboard." });
  };

  const handleShare = async () => {
    if (!inviteData) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join me on Chatter", url: inviteData.link });
      } catch {}
    } else {
      handleCopy();
    }
  };

  const handleAcceptCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = inviteCodeInput.trim();
    if (!code) return;

    const token = getAuthToken();
    setAccepting(true);
    try {
      const res = await fetch("/api/invite/start-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ inviteCode: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Invalid code",
          description: data.error || "Invite code not found.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Chat started!", description: "Opening conversation…" });
      setInviteCodeInput("");
      setLocation(`/chats/${data.conversationId}`);
    } catch {
      toast({ title: "Error", description: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <header className="px-4 py-3 flex items-center sticky top-0 bg-background/80 backdrop-blur-md z-10 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full mr-2 text-muted-foreground"
          onClick={() => setLocation("/profile")}
        >
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-xl font-bold">Invite Friends</h1>
      </header>

      <div className="flex-1 flex flex-col items-center px-6 py-8 gap-6">
        {/* Title */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-primary">Share Your Invite</h2>
          <p className="text-muted-foreground text-sm mt-1 max-w-xs">
            Share this QR code or link — your friend clicks it and can start chatting with you instantly.
          </p>
        </div>

        {/* QR Card */}
        <div className="bg-card p-5 rounded-3xl border border-border shadow-2xl">
          <canvas ref={canvasRef} className="rounded-2xl block" />
        </div>

        {/* Invite link */}
        <div className="w-full max-w-sm space-y-3">
          <div className="flex items-center gap-2 bg-secondary rounded-2xl p-2 pr-2">
            <div className="flex-1 min-w-0 px-3">
              <p className="text-[11px] text-muted-foreground mb-0.5">Your invite link</p>
              <p className="text-xs font-mono text-foreground truncate">
                {inviteData?.link || "Loading…"}
              </p>
            </div>
            <Button
              size="icon"
              className={`rounded-xl flex-shrink-0 h-9 w-9 transition-colors ${
                copied
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
              onClick={handleCopy}
            >
              {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="rounded-xl flex-shrink-0 h-9 w-9 text-muted-foreground"
              onClick={handleShare}
            >
              <Share2 size={16} />
            </Button>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full max-w-sm flex items-center gap-3">
          <div className="flex-1 border-t border-border" />
          <span className="text-xs text-muted-foreground">OR</span>
          <div className="flex-1 border-t border-border" />
        </div>

        {/* Accept invite code */}
        <div className="w-full max-w-sm space-y-3">
          <h3 className="font-semibold text-sm text-center text-foreground">
            Enter a friend's invite code
          </h3>
          <p className="text-xs text-muted-foreground text-center">
            Invite codes are 12-character codes. Found in the invite link after /invite/
          </p>
          <form onSubmit={handleAcceptCode} className="flex gap-2">
            <Input
              value={inviteCodeInput}
              onChange={(e) => setInviteCodeInput(e.target.value)}
              placeholder="e.g. CwatT9WbFUy4"
              className="bg-secondary border-0 rounded-xl font-mono text-sm flex-1"
              maxLength={32}
            />
            <Button
              type="submit"
              className="rounded-xl flex-shrink-0"
              disabled={!inviteCodeInput.trim() || accepting}
            >
              {accepting ? (
                <div className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
              ) : (
                "Go"
              )}
            </Button>
          </form>
        </div>

        {/* Your invite code */}
        {inviteData && (
          <div className="w-full max-w-sm">
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Your invite code</p>
              <p className="font-mono text-lg font-bold text-primary tracking-wider">
                {inviteData.inviteCode}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
