import { useState, useRef, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useGetConversation, useListMessages, useSendMessage } from "@workspace/api-client-react/generated/api";
import { format } from "date-fns";
import { ArrowLeft, Phone, Send, Video } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "../lib/auth";

export function ChatPage() {
  const [, params] = useRoute("/chats/:id");
  const conversationId = params?.id ? parseInt(params.id) : 0;
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  
  const { data: conversation } = useGetConversation(conversationId);
  const { data: messages } = useListMessages(conversationId);
  const sendMessage = useSendMessage();
  
  const [content, setContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    sendMessage.mutate(
      { conversationId, data: { content, messageType: "text" } },
      {
        onSuccess: () => {
          setContent("");
        }
      }
    );
  };

  if (!conversation) {
    return <div className="flex h-full items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="px-4 py-3 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-10 border-b border-border">
        <div className="flex items-center gap-3">
          <Link href="/chats">
            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground">
              <ArrowLeft size={20} />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={conversation.otherUser.avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary">
                {conversation.otherUser.displayName?.[0] || conversation.otherUser.username[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold text-foreground">{conversation.otherUser.displayName || conversation.otherUser.username}</h2>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link href={`/call/${conversationId}`}>
            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground">
              <Video size={20} />
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages?.map((msg, index) => {
          const showTime = index === 0 || new Date(msg.createdAt).getTime() - new Date(messages[index-1].createdAt).getTime() > 1000 * 60 * 5;
          
          return (
            <div key={msg.id} className={`flex flex-col ${msg.isOwn ? "items-end" : "items-start"}`}>
              {showTime && (
                <span className="text-[10px] text-muted-foreground mb-2 mt-4 self-center px-3 py-1 bg-secondary rounded-full">
                  {format(new Date(msg.createdAt), "h:mm a")}
                </span>
              )}
              <div 
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
                  msg.isOwn 
                    ? "bg-primary text-primary-foreground rounded-tr-sm" 
                    : "bg-secondary text-foreground rounded-tl-sm"
                }`}
              >
                <p className="leading-relaxed">{msg.content}</p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-background/80 backdrop-blur-md border-t border-border pb-safe">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <Input 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type a message..." 
            className="flex-1 rounded-full bg-secondary border-0 px-4 py-6"
          />
          <Button 
            type="submit" 
            size="icon" 
            className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0"
            disabled={!content.trim() || sendMessage.isPending}
          >
            <Send size={20} className="ml-1" />
          </Button>
        </form>
      </div>
    </div>
  );
}
