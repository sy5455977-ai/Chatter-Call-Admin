import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetConversations, useSearchUsers, useCreateConversation } from "@workspace/api-client-react/generated/api";
import { formatDistanceToNow } from "date-fns";
import { Search, Plus, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "../lib/auth";
import { getAuthToken } from "../lib/auth";
import { useWebSocket } from "../lib/websocket";

export function ChatsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: conversations, isLoading, refetch } = useGetConversations();
  const [searchQuery, setSearchQuery] = useState("");
  const { data: searchResults } = useSearchUsers(
    { q: searchQuery },
    { query: { enabled: searchQuery.length > 0 } }
  );
  const createConversation = useCreateConversation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [deleteConvId, setDeleteConvId] = useState<number | null>(null);
  const [deleteName, setDeleteName] = useState("");
  const longPressTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useWebSocket((event) => {
    if (event.type === "new_message") {
      refetch();
    }
  });

  const handleStartChat = (userId: number) => {
    createConversation.mutate(
      { data: { otherUserId: userId } },
      {
        onSuccess: (conv) => {
          setIsSearchOpen(false);
          setLocation(`/chats/${conv.id}`);
        },
      }
    );
  };

  const startLongPress = (convId: number, name: string) => {
    const timer = setTimeout(() => {
      setDeleteConvId(convId);
      setDeleteName(name);
    }, 500);
    longPressTimers.current.set(convId, timer);
  };

  const cancelLongPress = (convId: number) => {
    const timer = longPressTimers.current.get(convId);
    if (timer) {
      clearTimeout(timer);
      longPressTimers.current.delete(convId);
    }
  };

  const handleDeleteConversation = async () => {
    if (!deleteConvId) return;
    const token = getAuthToken();
    await fetch(`/api/conversations/${deleteConvId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setDeleteConvId(null);
    queryClient.invalidateQueries();
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-10 border-b border-border">
        <h1 className="text-2xl font-bold text-foreground">Chats</h1>

        <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
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
              {searchResults?.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-secondary transition-colors cursor-pointer"
                  onClick={() => handleStartChat(u.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={u.avatarUrl || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {(u.displayName?.[0] || u.username[0]).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${
                          (u as any).isOnline ? "bg-green-400" : "bg-zinc-500"
                        }`}
                      />
                    </div>
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

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : conversations?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageCircle className="h-12 w-12 mb-4 opacity-20" />
            <p>No messages yet.</p>
            <p className="text-sm">Tap the + to start a chat.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {conversations?.map((conv) => {
              const name = conv.otherUser.displayName || conv.otherUser.username;
              const isOnline = (conv.otherUser as any).isOnline;

              return (
                <div
                  key={conv.id}
                  className="relative select-none"
                  onTouchStart={() => startLongPress(conv.id, name)}
                  onTouchEnd={() => cancelLongPress(conv.id)}
                  onTouchMove={() => cancelLongPress(conv.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setDeleteConvId(conv.id);
                    setDeleteName(name);
                  }}
                >
                  <Link href={`/chats/${conv.id}`} className="block">
                    <div className="flex items-center p-3 rounded-2xl hover:bg-secondary/50 active:bg-secondary/80 transition-colors">
                      <div className="relative mr-3 flex-shrink-0">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={conv.otherUser.avatarUrl || undefined} />
                          <AvatarFallback className="bg-primary/20 text-primary">
                            {(conv.otherUser.displayName?.[0] || conv.otherUser.username[0]).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                            isOnline ? "bg-green-400" : "bg-zinc-500"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h3 className="font-medium text-foreground truncate text-[15px]">{name}</h3>
                          {conv.lastMessageAt && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                              {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: false })}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.lastMessage
                            ? conv.lastMessage.length > 40
                              ? conv.lastMessage.slice(0, 40) + "…"
                              : conv.lastMessage
                            : "Tap to start chatting"}
                        </p>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={deleteConvId !== null} onOpenChange={(open) => !open && setDeleteConvId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your conversation with{" "}
              <span className="font-semibold text-foreground">{deleteName}</span> and all messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary border-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConversation}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
