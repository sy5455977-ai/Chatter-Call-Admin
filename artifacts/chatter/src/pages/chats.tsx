import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetConversations,
  useCreateConversation,
} from "@workspace/api-client-react/generated/api";
import { formatDistanceToNow } from "date-fns";
import { Search, MessageCircle, MoreVertical, Users, Trash2, X, CheckSquare } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAuthToken } from "../lib/auth";
import { useWebSocket } from "../lib/websocket";

export function ChatsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: conversations, isLoading, refetch } = useGetConversations();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [deleteConvId, setDeleteConvId] = useState<number | null>(null);
  const [deleteName, setDeleteName] = useState("");

  // Select mode (for multi-select delete/group)
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const longPressTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const createConversation = useCreateConversation();

  useWebSocket((event) => {
    if (event.type === "new_message") refetch();
  });

  // Filter contacts from existing conversations only (WhatsApp style)
  const contactList = conversations ?? [];
  const filteredContacts = searchQuery.trim()
    ? contactList.filter((c) => {
        const name = (c.otherUser.displayName || c.otherUser.username).toLowerCase();
        const uname = c.otherUser.username.toLowerCase();
        const q = searchQuery.toLowerCase();
        return name.includes(q) || uname.includes(q);
      })
    : [];

  const handleStartChat = (convId: number) => {
    setIsSearchOpen(false);
    setLocation(`/chats/${convId}`);
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

  const toggleSelect = (convId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(convId)) next.delete(convId);
      else if (next.size < 5) next.add(convId);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} conversation(s)?`)) return;
    const token = getAuthToken();
    for (const id of selectedIds) {
      await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    setSelectedIds(new Set());
    setSelectMode(false);
    queryClient.invalidateQueries();
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="px-4 py-3.5 flex items-center justify-between sticky top-0 bg-background/90 backdrop-blur-md z-10 border-b border-border">
        {selectMode ? (
          <>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={exitSelectMode}>
                <X size={18} />
              </Button>
              <span className="font-semibold text-foreground">
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select chats"}
              </span>
            </div>
            <div className="flex gap-2">
              {selectedIds.size >= 2 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full text-xs h-8 px-3 border-primary text-primary"
                  onClick={() => alert("Group chat feature coming soon!")}
                >
                  <Users size={13} className="mr-1" />
                  Group
                </Button>
              )}
              {selectedIds.size > 0 && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="rounded-full text-xs h-8 px-3"
                  onClick={handleDeleteSelected}
                >
                  <Trash2 size={13} className="mr-1" />
                  Delete
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-foreground">Chats</h1>
            <div className="flex items-center gap-1">
              {/* Search icon (replaces +) — only searches contacts */}
              <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary h-9 w-9">
                    <Search size={20} />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-card border-border">
                  <DialogHeader>
                    <DialogTitle>Search Contacts</DialogTitle>
                  </DialogHeader>
                  <div className="relative mt-3">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search your contacts..."
                      className="pl-9 bg-secondary border-0 rounded-full"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
                    {filteredContacts.map((c) => {
                      const u = c.otherUser;
                      const name = u.displayName || u.username;
                      return (
                        <div
                          key={c.id}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors cursor-pointer"
                          onClick={() => handleStartChat(c.id)}
                        >
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
                            <p className="font-medium text-sm">{name}</p>
                            <p className="text-xs text-muted-foreground">@{u.username}</p>
                          </div>
                        </div>
                      );
                    })}
                    {searchQuery && filteredContacts.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-6">No contacts found</p>
                    )}
                    {!searchQuery && (
                      <p className="text-center text-sm text-muted-foreground py-6">Type a name to search</p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              {/* 3-dot menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary h-9 w-9">
                    <MoreVertical size={20} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-border min-w-[160px]">
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer"
                    onClick={() => setSelectMode(true)}
                  >
                    <CheckSquare size={15} />
                    Select Chats
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : conversations?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <MessageCircle className="h-14 w-14 opacity-10" />
            <p className="font-semibold text-base">No chats yet</p>
            <p className="text-sm text-center opacity-70">Share your invite link to connect with friends</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {conversations?.map((conv) => {
              const name = conv.otherUser.displayName || conv.otherUser.username;
              const isOnline = (conv.otherUser as any).isOnline;
              const isSelected = selectedIds.has(conv.id);

              return (
                <div
                  key={conv.id}
                  className={`relative select-none rounded-2xl transition-colors ${
                    isSelected ? "bg-primary/10" : ""
                  }`}
                  onTouchStart={() => !selectMode && startLongPress(conv.id, name)}
                  onTouchEnd={() => !selectMode && cancelLongPress(conv.id)}
                  onTouchMove={() => !selectMode && cancelLongPress(conv.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (!selectMode) {
                      setDeleteConvId(conv.id);
                      setDeleteName(name);
                    }
                  }}
                  onClick={() => {
                    if (selectMode) {
                      toggleSelect(conv.id);
                    }
                  }}
                >
                  {selectMode ? (
                    <div className="flex items-center p-3">
                      <div className={`mr-3 h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? "bg-primary border-primary" : "border-border"
                      }`}>
                        {isSelected && <div className="h-2.5 w-2.5 rounded-full bg-white" />}
                      </div>
                      <div className="relative mr-3 flex-shrink-0">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={conv.otherUser.avatarUrl || undefined} />
                          <AvatarFallback className="bg-primary/20 text-primary">
                            {(conv.otherUser.displayName?.[0] || conv.otherUser.username[0]).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${isOnline ? "bg-green-400" : "bg-zinc-500"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate text-[15px]">{name}</h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.lastMessage || "Tap to start chatting"}
                        </p>
                      </div>
                    </div>
                  ) : (
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
                            <h3 className="font-semibold text-foreground truncate text-[15px]">{name}</h3>
                            {conv.lastMessageAt && (
                              <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: false })}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {conv.lastMessage
                              ? conv.lastMessage.length > 42
                                ? conv.lastMessage.slice(0, 42) + "…"
                                : conv.lastMessage
                              : "Tap to start chatting"}
                          </p>
                        </div>
                      </div>
                    </Link>
                  )}
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
              Permanently delete your conversation with{" "}
              <span className="font-semibold text-foreground">{deleteName}</span> and all messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary border-0">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConversation} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
