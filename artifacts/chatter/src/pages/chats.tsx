import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetConversations, useSearchUsers, useCreateConversation } from "@workspace/api-client-react/generated/api";
import { formatDistanceToNow } from "date-fns";
import { Search, Plus, UserPlus, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "../lib/auth";

export function ChatsPage() {
  const [, setLocation] = useLocation();
  const { data: conversations, isLoading } = useGetConversations();
  const [searchQuery, setSearchQuery] = useState("");
  const { data: searchResults } = useSearchUsers({ q: searchQuery }, { query: { enabled: searchQuery.length > 0 } });
  const createConversation = useCreateConversation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { user } = useAuth();

  const handleStartChat = (userId: number) => {
    createConversation.mutate({ data: { otherUserId: userId } }, {
      onSuccess: (conv) => {
        setIsSearchOpen(false);
        setLocation(`/chats/${conv.id}`);
      }
    });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-10 border-b border-border">
        <h1 className="text-2xl font-bold text-foreground">Chats</h1>
        
        <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary">
              <Plus size={24} />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle>New Chat</DialogTitle>
            </DialogHeader>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                className="pl-9 bg-secondary border-0 rounded-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
              {searchResults?.map(u => (
                <div 
                  key={u.id} 
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-secondary transition-colors cursor-pointer"
                  onClick={() => handleStartChat(u.id)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={u.avatarUrl || undefined} />
                      <AvatarFallback className="bg-primary/20 text-primary">{u.displayName?.[0] || u.username[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{u.displayName || u.username}</p>
                      <p className="text-xs text-muted-foreground">@{u.username}</p>
                    </div>
                  </div>
                </div>
              ))}
              {searchQuery && searchResults?.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">No users found</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : conversations?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageCircle className="h-12 w-12 mb-4 opacity-20" />
            <p>No messages yet.</p>
            <p className="text-sm">Tap the + to start a chat.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations?.map(conv => (
              <Link key={conv.id} href={`/chats/${conv.id}`} className="block">
                <div className="flex items-center p-3 rounded-2xl hover:bg-secondary/50 transition-colors">
                  <div className="relative">
                    <Avatar className="h-12 w-12 mr-4">
                      <AvatarImage src={conv.otherUser.avatarUrl || undefined} />
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {conv.otherUser.displayName?.[0] || conv.otherUser.username[0]}
                      </AvatarFallback>
                    </Avatar>
                    {conv.unreadCount > 0 && (
                      <span className="absolute top-0 right-3 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-foreground truncate">{conv.otherUser.displayName || conv.otherUser.username}</h3>
                      {conv.lastMessageAt && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                          {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: false })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.lastMessage || "Started a conversation"}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

