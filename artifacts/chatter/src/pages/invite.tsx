import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import QRCode from "qrcode";
import { ArrowLeft, Copy, CheckCircle2, Share } from "lucide-react";
import { useGetInviteLink, useAcceptInvite } from "@workspace/api-client-react/generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export function InvitePage() {
  const [, setLocation] = useLocation();
  const { data: inviteLink } = useGetInviteLink();
  const acceptInvite = useAcceptInvite();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (inviteLink && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, inviteLink.link, {
        width: 200,
        margin: 2,
        color: {
          dark: '#c9a227', // primary color
          light: '#0d1117' // background color
        }
      }, (err) => {
        if (err) console.error("QR gen error", err);
      });
    }
  }, [inviteLink]);

  const handleCopy = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Link copied",
        description: "Invite link copied to clipboard",
      });
    }
  };

  const handleAcceptInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput.trim()) return;

    acceptInvite.mutate(
      { inviteCode: inviteCodeInput },
      {
        onSuccess: () => {
          toast({
            title: "Success",
            description: "Friend added successfully!",
          });
          setInviteCodeInput("");
          setLocation("/chats");
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Invalid invite code or already friends.",
            variant: "destructive"
          });
        }
      }
    );
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <header className="px-4 py-3 flex items-center sticky top-0 bg-background/80 backdrop-blur-md z-10 border-b border-border">
        <Link href="/profile">
          <Button variant="ghost" size="icon" className="rounded-full mr-2">
            <ArrowLeft size={20} />
          </Button>
        </Link>
        <h1 className="text-xl font-bold">Invite Friends</h1>
      </header>

      <div className="p-6 space-y-8 flex-1 flex flex-col items-center pt-12">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-primary">Your Invite QR</h2>
          <p className="text-muted-foreground text-sm max-w-[250px] mx-auto">
            Have your friend scan this code to start a private conversation.
          </p>
        </div>

        <div className="bg-card p-6 rounded-3xl border border-border shadow-2xl">
          <canvas ref={canvasRef} className="rounded-xl"></canvas>
        </div>

        <div className="w-full max-w-sm space-y-3">
          <div className="flex items-center gap-2 bg-secondary p-2 rounded-2xl">
            <div className="flex-1 truncate px-3 text-sm font-mono text-muted-foreground">
              {inviteLink?.link || "Loading..."}
            </div>
            <Button 
              size="icon" 
              className={`rounded-xl flex-shrink-0 transition-colors ${copied ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
              onClick={handleCopy}
            >
              {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
            </Button>
          </div>
        </div>

        <div className="w-full max-w-sm pt-8 border-t border-border mt-8">
          <h3 className="font-medium mb-4 text-center">Have an invite code?</h3>
          <form onSubmit={handleAcceptInvite} className="flex gap-2">
            <Input 
              value={inviteCodeInput}
              onChange={(e) => setInviteCodeInput(e.target.value)}
              placeholder="Enter invite code..." 
              className="bg-secondary border-0 rounded-xl"
            />
            <Button 
              type="submit" 
              className="rounded-xl bg-card hover:bg-secondary border border-border text-foreground"
              disabled={!inviteCodeInput.trim() || acceptInvite.isPending}
            >
              Add
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
