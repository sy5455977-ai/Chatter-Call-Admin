import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import { useGetConversation } from "@workspace/api-client-react/generated/api";
import { Button } from "@/components/ui/button";

export function CallPage() {
  const [, params] = useRoute("/call/:id");
  const conversationId = params?.id ? parseInt(params.id) : 0;
  const [, setLocation] = useLocation();
  
  const { data: conversation } = useGetConversation(conversationId);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const handleEndCall = () => {
    setLocation(`/chats/${conversationId}`);
  };

  if (!conversation) {
    return <div className="h-[100dvh] bg-black flex items-center justify-center text-white">Connecting...</div>;
  }

  return (
    <div className="h-[100dvh] bg-black flex flex-col relative overflow-hidden">
      {/* Remote Video Placeholder */}
      <div className="absolute inset-0 flex items-center justify-center">
        {isVideoOff ? (
          <div className="w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center text-4xl text-primary font-bold">
            {conversation.otherUser.displayName?.[0] || conversation.otherUser.username[0]}
          </div>
        ) : (
          <div className="w-full h-full bg-slate-900 flex items-center justify-center animate-pulse">
            <span className="text-slate-600">Waiting for video...</span>
          </div>
        )}
      </div>

      {/* Local Video Placeholder */}
      <div className="absolute top-6 right-4 w-28 h-40 bg-zinc-800 rounded-xl overflow-hidden border border-zinc-700 shadow-2xl z-10">
        <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs">
          You
        </div>
      </div>

      {/* Top Header */}
      <div className="absolute top-0 inset-x-0 p-6 bg-gradient-to-b from-black/80 to-transparent z-10 pt-safe">
        <h2 className="text-white text-xl font-medium text-center">
          {conversation.otherUser.displayName || conversation.otherUser.username}
        </h2>
        <p className="text-white/60 text-sm text-center mt-1">00:00</p>
      </div>

      {/* Bottom Controls */}
      <div className="mt-auto mb-10 pb-safe z-10 flex items-center justify-center gap-6 px-6">
        <Button
          variant="outline"
          size="icon"
          className={`h-14 w-14 rounded-full border-0 ${isMuted ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-800/80 text-white hover:bg-zinc-700 backdrop-blur-md'}`}
          onClick={() => setIsMuted(!isMuted)}
        >
          {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          className="h-16 w-16 rounded-full border-0 bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20"
          onClick={handleEndCall}
        >
          <PhoneOff size={28} />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className={`h-14 w-14 rounded-full border-0 ${isVideoOff ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-800/80 text-white hover:bg-zinc-700 backdrop-blur-md'}`}
          onClick={() => setIsVideoOff(!isVideoOff)}
        >
          {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
        </Button>
      </div>
    </div>
  );
}
