import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { Mic, MicOff, Video, VideoOff, PhoneOff, FlipHorizontal, Loader2 } from "lucide-react";
import { useGetConversation } from "@workspace/api-client-react/generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { sendWsMessage, useWebSocket } from "../lib/websocket";
import { getAuthUser } from "../lib/auth";

// ── STUN servers for ICE negotiation ────────────────────────────────────────
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

function formatTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

type CallPhase = "requesting" | "ringing" | "connecting" | "connected" | "declined" | "ended" | "error";

export function CallPage() {
  const [, params]       = useRoute("/call/:id");
  const conversationId   = params?.id ? parseInt(params.id) : 0;
  const [, setLocation]  = useLocation();

  // URL search params tell us if we are the caller or callee
  const isCaller = new URLSearchParams(window.location.search).get("caller") === "1";

  const { data: conversation } = useGetConversation(conversationId);
  const currentUser = getAuthUser();

  const otherUser       = conversation?.otherUser as any;
  const otherUserId     = otherUser?.id as number | undefined;

  // ── State ────────────────────────────────────────────────────────────────
  const [phase, setPhase]               = useState<CallPhase>(isCaller ? "requesting" : "ringing");
  const [isMuted, setIsMuted]           = useState(false);
  const [isVideoOff, setIsVideoOff]     = useState(false);
  const [elapsed, setElapsed]           = useState(0);
  const [statusMsg, setStatusMsg]       = useState("");

  // ── Refs ─────────────────────────────────────────────────────────────────
  const peerRef         = useRef<RTCPeerConnection | null>(null);
  const localStreamRef  = useRef<MediaStream | null>(null);
  const localVideoRef   = useRef<HTMLVideoElement>(null);
  const remoteVideoRef  = useRef<HTMLVideoElement>(null);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const iceBufRef       = useRef<RTCIceCandidateInit[]>([]);

  // ── Cleanup ──────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
  }, []);

  // ── Create RTCPeerConnection ─────────────────────────────────────────────
  const createPeer = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate && otherUserId) {
        sendWsMessage({
          type: "webrtc_ice_candidate",
          conversationId,
          targetUserId: otherUserId,
          candidate: e.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (e) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0] ?? null;
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setPhase("connected");
        timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
      } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setPhase("ended");
        setStatusMsg("Call ended");
      }
    };

    return pc;
  }, [conversationId, otherUserId]);

  // ── Get local media ──────────────────────────────────────────────────────
  const getLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch {
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = audioOnly;
        setIsVideoOff(true);
        return audioOnly;
      } catch {
        setPhase("error");
        setStatusMsg("Camera/microphone access denied");
        return null;
      }
    }
  }, []);

  // ── Caller: send call request then create offer ──────────────────────────
  useEffect(() => {
    if (!isCaller || !otherUserId) return;

    let cancelled = false;

    (async () => {
      // Step 1: notify the other user
      sendWsMessage({
        type: "webrtc_call_request",
        conversationId,
        targetUserId: otherUserId,
        fromName: currentUser?.displayName || currentUser?.username || "Someone",
      });

      // Step 2: get media
      const stream = await getLocalStream();
      if (!stream || cancelled) return;

      // Step 3: create peer
      const pc = createPeer();
      peerRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      // Wait for callee to accept before creating offer
    })();

    return () => {
      cancelled = true;
    };
  }, [isCaller, otherUserId]);

  // ── Callee: get media (waiting to accept) ────────────────────────────────
  useEffect(() => {
    if (isCaller || !otherUserId) return;

    let cancelled = false;
    (async () => {
      const stream = await getLocalStream();
      if (!stream || cancelled) return;
      const pc = createPeer();
      peerRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    })();

    return () => {
      cancelled = true;
    };
  }, [isCaller, otherUserId]);

  // ── WebSocket events ────────────────────────────────────────────────────
  useWebSocket(async (event) => {
    const ev = event as any;

    // ── Callee accepted → create offer ────────────────────────────────────
    if (ev.type === "webrtc_call_accept" && ev.conversationId === conversationId && isCaller) {
      setPhase("connecting");
      const pc = peerRef.current;
      if (!pc) return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendWsMessage({
        type: "webrtc_offer",
        conversationId,
        targetUserId: otherUserId,
        offer: pc.localDescription,
      });
    }

    // ── Callee received offer → create answer ─────────────────────────────
    if (ev.type === "webrtc_offer" && ev.conversationId === conversationId && !isCaller) {
      setPhase("connecting");
      const pc = peerRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(ev.offer));

      // Flush buffered ICE candidates
      for (const c of iceBufRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      iceBufRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendWsMessage({
        type: "webrtc_answer",
        conversationId,
        targetUserId: otherUserId,
        answer: pc.localDescription,
      });
    }

    // ── Caller received answer ────────────────────────────────────────────
    if (ev.type === "webrtc_answer" && ev.conversationId === conversationId && isCaller) {
      const pc = peerRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(ev.answer));

      // Flush buffered ICE
      for (const c of iceBufRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      iceBufRef.current = [];
    }

    // ── ICE candidate received ────────────────────────────────────────────
    if (ev.type === "webrtc_ice_candidate" && ev.conversationId === conversationId) {
      const pc = peerRef.current;
      if (!pc || !pc.remoteDescription) {
        iceBufRef.current.push(ev.candidate);
      } else {
        await pc.addIceCandidate(new RTCIceCandidate(ev.candidate)).catch(() => {});
      }
    }

    // ── Remote end / decline ──────────────────────────────────────────────
    if (
      (ev.type === "webrtc_call_end" || ev.type === "webrtc_call_decline") &&
      ev.conversationId === conversationId
    ) {
      cleanup();
      setPhase("ended");
      setStatusMsg(ev.type === "webrtc_call_decline" ? "Call declined" : "Call ended");
      setTimeout(() => setLocation(`/chats/${conversationId}`), 2000);
    }
  });

  // ── End call ─────────────────────────────────────────────────────────────
  const handleEndCall = () => {
    sendWsMessage({ type: "webrtc_call_end", conversationId, targetUserId: otherUserId });
    cleanup();
    setLocation(`/chats/${conversationId}`);
  };

  // ── Callee accepts incoming call ──────────────────────────────────────────
  const handleAccept = () => {
    setPhase("connecting");
    sendWsMessage({ type: "webrtc_call_accept", conversationId, targetUserId: otherUserId });
  };

  // ── Callee declines ───────────────────────────────────────────────────────
  const handleDecline = () => {
    sendWsMessage({ type: "webrtc_call_decline", conversationId, targetUserId: otherUserId });
    cleanup();
    setLocation(`/chats/${conversationId}`);
  };

  // ── Toggle mute ───────────────────────────────────────────────────────────
  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = isMuted));
    setIsMuted(!isMuted);
  };

  // ── Toggle video ──────────────────────────────────────────────────────────
  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = isVideoOff));
    setIsVideoOff(!isVideoOff);
  };

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // ── Ringing state (caller waiting) ────────────────────────────────────────
  const phaseLabel =
    phase === "requesting"  ? "Calling…" :
    phase === "ringing"     ? "Incoming call" :
    phase === "connecting"  ? "Connecting…" :
    phase === "connected"   ? formatTime(elapsed) :
    phase === "declined"    ? "Call declined" :
    phase === "ended"       ? statusMsg || "Call ended" :
    phase === "error"       ? statusMsg || "Error" : "";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-zinc-950 flex flex-col relative overflow-hidden">
      {/* Remote video background */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: phase === "connected" ? "block" : "none" }}
      />

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 z-10 pointer-events-none" />

      {/* Dimmed avatar when not connected yet */}
      {phase !== "connected" && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="h-28 w-28 border-4 border-white/20 shadow-2xl">
                <AvatarFallback className="bg-primary/20 text-primary text-4xl font-bold">
                  {(otherUser?.displayName?.[0] || otherUser?.username?.[0] || "?").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {(phase === "requesting" || phase === "connecting") && (
                <span className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1.5">
                  <Loader2 size={16} className="text-primary-foreground animate-spin" />
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Local video (PiP) */}
      <div className="absolute top-14 right-4 w-24 h-36 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl z-30">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ display: isVideoOff ? "none" : "block" }}
        />
        {isVideoOff && (
          <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
            <VideoOff size={20} className="text-zinc-500" />
          </div>
        )}
      </div>

      {/* Top info */}
      <div className="relative z-20 pt-12 px-6 flex flex-col items-center">
        <h2 className="text-white text-xl font-semibold drop-shadow">
          {otherUser?.displayName || otherUser?.username || "…"}
        </h2>
        <p className={`text-sm mt-1 font-mono tracking-wide drop-shadow ${
          phase === "connected" ? "text-green-400" :
          phase === "error" || phase === "declined" || phase === "ended" ? "text-red-400" :
          "text-white/60"
        }`}>
          {phaseLabel}
        </p>
      </div>

      {/* ── Incoming call UI (callee, before accepting) ── */}
      {!isCaller && (phase === "ringing") && (
        <div className="relative z-20 mt-auto mb-16 flex items-center justify-center gap-12">
          {/* Decline */}
          <button
            onClick={handleDecline}
            className="h-16 w-16 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl hover:bg-red-700 active:scale-95 transition-all"
          >
            <PhoneOff size={28} />
          </button>
          {/* Accept */}
          <button
            onClick={handleAccept}
            className="h-16 w-16 rounded-full bg-green-500 text-white flex items-center justify-center shadow-xl hover:bg-green-600 active:scale-95 transition-all"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── In-call controls ── */}
      {(isCaller || phase === "connecting" || phase === "connected") && (
        <div className="relative z-20 mt-auto mb-12 flex items-center justify-center gap-5">
          {/* Mute */}
          <button
            onClick={toggleMute}
            className={`h-14 w-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${
              isMuted ? "bg-white text-zinc-900" : "bg-zinc-800/90 text-white border border-white/10"
            }`}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          {/* End call */}
          <button
            onClick={handleEndCall}
            className="h-[72px] w-[72px] rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl shadow-red-600/30 hover:bg-red-700 active:scale-95 transition-all"
          >
            <PhoneOff size={30} />
          </button>

          {/* Video toggle */}
          <button
            onClick={toggleVideo}
            className={`h-14 w-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${
              isVideoOff ? "bg-white text-zinc-900" : "bg-zinc-800/90 text-white border border-white/10"
            }`}
          >
            {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
          </button>
        </div>
      )}

      {/* ── Ended / Error screen ── */}
      {(phase === "ended" || phase === "error" || phase === "declined") && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-zinc-950/95">
          <p className="text-white text-lg font-semibold mb-6">{phaseLabel}</p>
          <Link href={`/chats/${conversationId}`}>
            <button className="px-8 py-3 bg-zinc-800 text-white rounded-2xl font-medium hover:bg-zinc-700 transition-colors">
              Back to Chat
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
