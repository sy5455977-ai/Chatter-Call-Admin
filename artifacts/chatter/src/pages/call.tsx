import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Volume2 } from "lucide-react";
import { useGetConversation } from "@workspace/api-client-react/generated/api";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function CallPage() {
  const [, params] = useRoute("/call/:id");
  const conversationId = params?.id ? parseInt(params.id) : 0;
  const [, setLocation] = useLocation();

  const { data: conversation } = useGetConversation(conversationId);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [callState, setCallState] = useState<"connecting" | "ringing" | "connected">("connecting");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Simulate connecting → ringing → connected
    const t1 = setTimeout(() => setCallState("ringing"), 800);
    const t2 = setTimeout(() => {
      setCallState("connected");
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    }, 3000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleEndCall = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setLocation(`/chats/${conversationId}`);
  };

  const otherUser = conversation?.otherUser as any;

  const statusLabel =
    callState === "connecting"
      ? "Connecting…"
      : callState === "ringing"
      ? "Ringing…"
      : formatTime(elapsed);

  return (
    <div className="h-screen bg-zinc-950 flex flex-col relative overflow-hidden select-none">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />

      {/* Remote video placeholder */}
      <div className="absolute inset-0 flex items-center justify-center z-0">
        {isVideoOff ? (
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-32 w-32 border-4 border-zinc-700 shadow-2xl">
              <AvatarImage src={otherUser?.avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-5xl font-bold">
                {(otherUser?.displayName?.[0] || otherUser?.username?.[0] || "?").toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        ) : (
          <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 opacity-30">
              <Video size={48} className="text-zinc-500" />
              <span className="text-zinc-500 text-sm">Camera connecting…</span>
            </div>
          </div>
        )}
      </div>

      {/* Local video (PiP) */}
      <div className="absolute top-16 right-4 w-24 h-36 bg-zinc-800 rounded-2xl overflow-hidden border border-zinc-700 shadow-2xl z-20">
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-zinc-500 text-[11px]">You</span>
        </div>
      </div>

      {/* Top bar */}
      <div className="relative z-10 pt-12 px-6 flex flex-col items-center">
        <h2 className="text-white text-xl font-semibold">
          {otherUser?.displayName || otherUser?.username || "…"}
        </h2>
        <p
          className={`text-sm mt-1 font-mono tracking-wide ${
            callState === "connected" ? "text-green-400" : "text-white/50"
          }`}
        >
          {statusLabel}
        </p>
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 mt-auto mb-12 flex items-center justify-center gap-5 px-8">
        {/* Mute */}
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`h-14 w-14 rounded-full flex items-center justify-center transition-colors ${
            isMuted ? "bg-white text-zinc-900" : "bg-zinc-800/80 text-white backdrop-blur-md border border-zinc-700"
          }`}
        >
          {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        {/* End call */}
        <button
          onClick={handleEndCall}
          className="h-18 w-18 h-[72px] w-[72px] rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl shadow-red-600/30 hover:bg-red-700 active:scale-95 transition-all"
        >
          <PhoneOff size={30} />
        </button>

        {/* Video toggle */}
        <button
          onClick={() => setIsVideoOff(!isVideoOff)}
          className={`h-14 w-14 rounded-full flex items-center justify-center transition-colors ${
            isVideoOff ? "bg-white text-zinc-900" : "bg-zinc-800/80 text-white backdrop-blur-md border border-zinc-700"
          }`}
        >
          {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
        </button>
      </div>

      {/* Speaker button (smaller, above main controls row) */}
      <div className="relative z-10 flex justify-center mb-4 -mt-6">
        <button
          onClick={() => setIsSpeakerOff(!isSpeakerOff)}
          className={`h-10 w-10 rounded-full flex items-center justify-center text-xs transition-colors ${
            isSpeakerOff ? "bg-zinc-700 text-zinc-400" : "bg-transparent text-zinc-500"
          }`}
        >
          <Volume2 size={16} />
        </button>
      </div>
    </div>
  );
}
