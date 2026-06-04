import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { MessageCircle, User as UserIcon } from "lucide-react";
import { useWebSocket } from "../lib/websocket";
import { requestNotificationPermission, showNotification } from "../lib/notifications";
import { getAuthUser } from "../lib/auth";

export function Layout({ children, hideNav = false }: { children: ReactNode; hideNav?: boolean }) {
  const [location] = useLocation();
  const currentUser = getAuthUser();

  // Request notification permission once on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Show browser notifications for new messages when tab is not focused
  useWebSocket((event) => {
    if (event.type === "new_message" && document.hidden) {
      const msg = event.message as any;
      if (msg && msg.senderId !== currentUser?.id) {
        showNotification("New message", {
          body: msg.content?.length > 80 ? msg.content.slice(0, 80) + "…" : msg.content,
          tag:  `msg-${event.conversationId}`,
        });
      }
    }
  });

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-background text-foreground relative overflow-hidden">
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {!hideNav && (
        <nav className="border-t border-border bg-card/80 backdrop-blur-md h-16 flex items-center justify-around px-4">
          <Link
            href="/chats"
            className={`flex flex-col items-center justify-center w-16 h-full ${
              location.startsWith("/chats") ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <MessageCircle size={24} className={location.startsWith("/chats") ? "fill-primary/20" : ""} />
            <span className="text-[10px] mt-1 font-medium">Chats</span>
          </Link>
          <Link
            href="/profile"
            className={`flex flex-col items-center justify-center w-16 h-full ${
              location === "/profile" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <UserIcon size={24} className={location === "/profile" ? "fill-primary/20" : ""} />
            <span className="text-[10px] mt-1 font-medium">Profile</span>
          </Link>
        </nav>
      )}
    </div>
  );
}
