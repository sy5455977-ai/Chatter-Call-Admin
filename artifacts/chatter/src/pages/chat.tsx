import { useState, useRef, useEffect, useCallback } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetConversation, useListMessages, useSendMessage } from "@workspace/api-client-react/generated/api";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowLeft, Video, Send, Paperclip, MoreVertical, Trash2, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "../lib/auth";
import { getAuthToken } from "../lib/auth";
import { useWebSocket, sendWsMessage } from "../lib/websocket";

export function ChatPage() {
  const [, params] = useRoute("/chats/:id");
  const conversationId = params?.id ? parseInt(params.id) : 0;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: conversation, refetch: refetchConvo } = useGetConversation(conversationId);
  const { data: messages, refetch: refetchMessages } = useListMessages(conversationId);
  const sendMessage = useSendMessage();

  const [content, setContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadingName, setUploadingName] = useState("");
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState<boolean>(false);
  const [otherLastSeen, setOtherLastSeen] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Set initial online status from conversation data
  useEffect(() => {
    if (conversation?.otherUser) {
      const u = conversation.otherUser as any;
      setOtherOnline(u.isOnline ?? false);
      setOtherLastSeen(u.lastSeen ?? null);
    }
  }, [conversation]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useWebSocket((event) => {
    if (event.type === "new_message" && event.conversationId === conversationId) {
      refetchMessages();
    }
    if (event.type === "chat_cleared" && event.conversationId === conversationId) {
      refetchMessages();
    }
    if (
      event.type === "typing_start" &&
      (event.conversationId as number) === conversationId &&
      (event.userId as number) !== user?.id
    ) {
      setIsOtherTyping(true);
    }
    if (
      event.type === "typing_stop" &&
      (event.conversationId as number) === conversationId &&
      (event.userId as number) !== user?.id
    ) {
      setIsOtherTyping(false);
    }
    if (event.type === "user_online" && (event.userId as number) === (conversation?.otherUser as any)?.id) {
      setOtherOnline(true);
    }
    if (event.type === "user_offline" && (event.userId as number) === (conversation?.otherUser as any)?.id) {
      setOtherOnline(false);
      setOtherLastSeen((event.lastSeen as string) ?? null);
    }
  });

  const handleTyping = (value: string) => {
    setContent(value);
    sendWsMessage({ type: "typing_start", conversationId });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      sendWsMessage({ type: "typing_stop", conversationId });
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      sendWsMessage({ type: "typing_stop", conversationId });
    };
  }, [conversationId]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    const text = content.trim();
    setContent("");
    sendWsMessage({ type: "typing_stop", conversationId });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    sendMessage.mutate({ conversationId, data: { content: text, messageType: "text" } });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(true);
    setUploadingName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = getAuthToken();
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();

      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const msgType = isImage ? "image" : isVideo ? "video" : "file";
      const msgContent = isImage || isVideo ? data.url : `${file.name}||${data.url}`;

      sendMessage.mutate({ conversationId, data: { content: msgContent, messageType: msgType } });
    } catch {
      alert("File upload failed. Please try again.");
    } finally {
      setUploading(false);
      setUploadingName("");
    }
  };

  const handleClearChat = async () => {
    if (!confirm("Delete all messages in this chat?")) return;
    const token = getAuthToken();
    await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    queryClient.invalidateQueries();
  };

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const otherUser = conversation.otherUser as any;

  const statusText = isOtherTyping
    ? "typing..."
    : otherOnline
    ? "Online"
    : otherLastSeen
    ? `Last seen ${formatDistanceToNow(new Date(otherLastSeen), { addSuffix: true })}`
    : "Offline";

  const statusColor = isOtherTyping
    ? "text-primary"
    : otherOnline
    ? "text-green-400"
    : "text-muted-foreground";

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="px-3 py-2.5 flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/chats">
            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground h-9 w-9 flex-shrink-0">
              <ArrowLeft size={18} />
            </Button>
          </Link>
          <div className="relative flex-shrink-0">
            <Avatar className="h-9 w-9">
              <AvatarImage src={otherUser.avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-sm">
                {(otherUser.displayName?.[0] || otherUser.username[0]).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${
                otherOnline ? "bg-green-400" : "bg-zinc-500"
              }`}
            />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground text-sm leading-tight truncate">
              {otherUser.displayName || otherUser.username}
            </h2>
            <p className={`text-[11px] leading-tight truncate ${statusColor}`}>
              {statusText}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <Link href={`/call/${conversationId}`}>
            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground h-9 w-9">
              <Video size={18} />
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground h-9 w-9">
                <MoreVertical size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-border">
              <DropdownMenuItem
                onClick={handleClearChat}
                className="text-destructive focus:text-destructive cursor-pointer gap-2"
              >
                <Trash2 size={15} />
                Clear Chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {messages?.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
            <p className="text-sm">No messages yet. Say hi! 👋</p>
          </div>
        )}
        {messages?.map((msg, index) => {
          const prevMsg = messages[index - 1];
          const showTime =
            !prevMsg ||
            new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() > 5 * 60 * 1000;

          return (
            <div key={msg.id} className={`flex flex-col ${msg.isOwn ? "items-end" : "items-start"}`}>
              {showTime && (
                <span className="text-[10px] text-muted-foreground my-2 self-center px-3 py-0.5 bg-secondary/50 rounded-full">
                  {format(new Date(msg.createdAt), "h:mm a")}
                </span>
              )}
              <div
                className={`max-w-[78%] rounded-2xl overflow-hidden ${
                  msg.isOwn
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-secondary text-foreground rounded-tl-sm"
                }`}
              >
                {msg.messageType === "image" ? (
                  <img
                    src={msg.content}
                    alt="image"
                    className="max-w-[220px] max-h-[220px] object-cover block"
                    loading="lazy"
                  />
                ) : msg.messageType === "video" ? (
                  <video
                    src={msg.content}
                    controls
                    className="max-w-[220px] max-h-[180px] block"
                    preload="metadata"
                  />
                ) : msg.messageType === "file" ? (
                  (() => {
                    const [name, url] = msg.content.split("||");
                    return (
                      <a
                        href={url || msg.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-3 hover:opacity-80"
                      >
                        <FileText size={18} className="flex-shrink-0" />
                        <span className="text-sm truncate max-w-[150px]">{name || "File"}</span>
                      </a>
                    );
                  })()
                ) : (
                  <p className="px-4 py-2.5 leading-relaxed text-[15px] break-words">{msg.content}</p>
                )}
              </div>
            </div>
          );
        })}

        {isOtherTyping && (
          <div className="flex items-start">
            <div className="bg-secondary rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
              <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
              <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
              <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {uploading && (
        <div className="px-3 py-2 bg-secondary/40 border-t border-border flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary flex-shrink-0" />
          <span className="text-xs text-muted-foreground truncate">Uploading {uploadingName}…</span>
        </div>
      )}

      <div className="p-3 bg-background border-t border-border">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full text-muted-foreground hover:text-primary h-11 w-11 flex-shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Paperclip size={20} />
          </Button>
          <Input
            value={content}
            onChange={(e) => handleTyping(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-full bg-secondary border-0 px-4 h-11 text-[15px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (content.trim()) handleSend(e as any);
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0"
            disabled={!content.trim() || sendMessage.isPending}
          >
            <Send size={18} className="ml-0.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
