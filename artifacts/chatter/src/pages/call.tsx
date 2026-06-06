import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, Loader2 } from "lucide-react";
import { useGetConversation } from "@workspace/api-client-react/generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { sendWsMessage, useWebSocket } from "../lib/websocket";
import { getAuthUser } from "../lib/auth";

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

  const searchParams = new URLSearchParams(window.location.search);
  const isCaller = searchParams.get("caller") === "1";
  // voice mode: no video requested
  const isVoiceMode = searchParams.get("mode") === "voice";

  const { data: conversation } = useGetConversation(conversationId);
  const currentUser = getAuthUser();

  const otherUser       = conversation?.otherUser as any;
  const otherUserId     = otherUser?.id as number | undefined;

  const [phase, setPhase]               = useState<CallPhase>(isCaller ? "requesting" : "ringing");
  const [isMuted, setIsMuted]           = useState(false);
  const [isVideoOff, setIsVideoOff]     = useState(isVoiceMode);
  const [elapsed, setElapsed]           = useState(0);
  const [statusMsg, setStatusMsg]       = useState("");
  const [incomingIsVoice, setIncomingIsVoice] = useState(false);

  const peerRef         = useRef<RTCPeerConnection | null>(null);
  const localStreamRef  = useRef<MediaStream | null>(null);
  const localVideoRef   = useRef<HTMLVideoElement>(null);
  const remoteVideoRef  = useRef<HTMLVideoElement>(null);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const iceBufRef       = useRef<RTCIceCandidateInit[]>([]);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
  }, []);

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

  const getLocalStream = useCallback(async (voiceOnly = false) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: voiceOnly ? false : true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      if (voiceOnly) setIsVideoOff(true);
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

  // Caller
  useEffect(() => {
    if (!isCaller || !otherUserId) return;
    let cancelled = false;

    (async () => {
      sendWsMessage({
        type: "webrtc_call_request",
        conversationId,
        targetUserId: otherUserId,
        fromName: currentUser?.displayName || currentUser?.username || "Someone",
        callMode: isVoiceMode ? "voice" : "video",
      });

      const stream = await getLocalStream(isVoiceMode);
      if (!stream || cancelled) return;

      const pc = createPeer();
      peerRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    })();

    return () => { cancelled = true; };
  }, [isCaller, otherUserId]);

  // Callee
  useEffect(() => {
    if (isCaller || !otherUserId) return;
    let cancelled = false;
    (async () => {
      const stream = await getLocalStream(incomingIsVoice);
      if (!stream || cancelled) return;
      const pc = createPeer();
      peerRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    })();

    return () => { cancelled = true; };
  }, [isCaller, otherUserId, incomingIsVoice]);

  useWebSocket(async (event) => {
    const ev = event as any;

    if (ev.type === "webrtc_call_request" && !isCaller) {
      if (ev.callMode === "voice") setIncomingIsVoice(true);
    }

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

    if (ev.type === "webrtc_offer" && ev.conversationId === conversationId && !isCaller) {
      setPhase("connecting");
      const pc = peerRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(ev.offer));
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

    if (ev.type === "webrtc_answer" && ev.conversationId === conversationId && isCaller) {
      const pc = peerRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(ev.answer));
      for (const c of iceBufRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      iceBufRef.current = [];
    }

    if (ev.type === "webrtc_ice_candidate" && ev.conversationId === conversationId) {
      const pc = peerRef.current;
      if (!pc || !pc.remoteDescription) {
        iceBufRef.current.push(ev.candidate);
      } else {
        await pc.addIceCandidate(new RTCIceCandidate(ev.candidate)).catch(() => {});
      }
    }

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

  const handleEndCall = () => {
    sendWsMessage({ type: "webrtc_call_end", conversationId, targetUserId: otherUserId });
    cleanup();
    setLocation(`/chats/${conversationId}`);
  };

  const handleAccept = () => {
    setPhase("connecting");
    sendWsMessage({ type: "webrtc_call_accept", conversationId, targetUserId: otherUserId });
  };

  const handleDecline = () => {
    sendWsMessage({ type: "webrtc_call_decline", conversationId, targetUserId: otherUserId });
    cleanup();
    setLocation(`/chats/${conversationId}`);
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = isMuted));
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = isVideoOff));
    setIsVideoOff(!isVideoOff);
  };

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const phaseLabel =
    phase === "requesting"  ? "Calling…" :
    phase === "ringing"     ? "Incoming call" :
    phase === "connecting"  ? "Connecting…" :
    phase === "connected"   ? formatTime(elapsed) :
    phase === "declined"    ? "Call declined" :
    phase === "ended"       ? statusMsg || "Call ended" :
    phase === "error"       ? statusMsg || "Error" : "";

  const effectiveVoiceMode = isVoiceMode || incomingIsVoice;

  return (
    <div className="h-screen bg-zinc-950 flex flex-col relative overflow-hidden">
      {/* Remote video (hidden in voice mode) */}
      {!effectiveVoiceMode && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: phase === "connected" ? "block" : "none" }}
        />
      )}

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 z-10 pointer-events-none" />

      {/* Avatar when not connected or voice mode */}
      {(phase !== "connected" || effectiveVoiceMode) && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="h-28 w-28 border-4 border-white/20 shadow-2xl">
                <AvatarImage src={otherUser?.avatarUrl || undefined} />
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

      {/* Local video PiP (hidden in voice mode) */}
      {!effectiveVoiceMode && (
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
      )}

      {/* Voice mode: show call type badge */}
      {effectiveVoiceMode && phase === "connected" && (
        <div className="absolute top-20 left-0 right-0 flex justify-center z-20">
          <div className="bg-white/10 backdrop-blur-sm px-4 py-1.5 rounded-full flex items-center gap-2">
            <Phone size={13} className="text-white" />
            <span className="text-white text-xs font-medium">Voice Call · P2P</span>
          </div>
        </div>
      )}

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

      {/* Incoming call UI */}
      {!isCaller && phase === "ringing" && (
        <div className="relative z-20 mt-auto mb-16 flex items-center justify-center gap-12">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleDecline}
              className="h-16 w-16 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl hover:bg-red-700 active:scale-95 transition-all"
            >
              <PhoneOff size={28} />
            </button>
            <span className="text-white/60 text-xs">Decline</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleAccept}
              className="h-16 w-16 rounded-full bg-green-500 text-white flex items-center justify-center shadow-xl hover:bg-green-600 active:scale-95 transition-all"
            >
              <Phone size={28} />
            </button>
            <span className="text-white/60 text-xs">Accept</span>
          </div>
        </div>
      )}

      {/* In-call controls */}
      {(isCaller || phase === "connecting" || phase === "connected") && (
        <div className="relative z-20 mt-auto mb-12 flex items-center justify-center gap-5">
          {/* Mute */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={toggleMute}
              className={`h-14 w-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                isMuted ? "bg-white text-zinc-900" : "bg-zinc-800/90 text-white border border-white/10"
              }`}
            >
              {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>
            <span className="text-white/60 text-xs">{isMuted ? "Unmute" : "Mute"}</span>
          </div>

          {/* End call */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleEndCall}
              className="h-[72px] w-[72px] rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl shadow-red-600/30 hover:bg-red-700 active:scale-95 transition-all"
            >
              <PhoneOff size={30} />
            </button>
            <span className="text-white/60 text-xs">End</span>
          </div>

          {/* Video toggle (only in video mode) */}
          {!effectiveVoiceMode && (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={toggleVideo}
                className={`h-14 w-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                  isVideoOff ? "bg-white text-zinc-900" : "bg-zinc-800/90 text-white border border-white/10"
                }`}
              >
                {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
              </button>
              <span className="text-white/60 text-xs">Camera</span>
            </div>
          )}
        </div>
      )}

      {/* Ended / Error screen */}
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
