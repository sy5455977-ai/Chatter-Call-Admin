import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { MessageCircle, User as UserIcon } from "lucide-react";
import { useWebSocket } from "../lib/websocket";

export function Layout({ children, hideNav = false }: { children: ReactNode; hideNav?: boolean }) {
  useWebSocket();
  const [location] = useLocation();

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-background text-foreground relative overflow-hidden">
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      
      {!hideNav && (
        <nav className="border-t border-border bg-card/80 backdrop-blur-md h-16 flex items-center justify-around px-4 pb-safe">
          <Link href="/chats" className={`flex flex-col items-center justify-center w-16 h-full ${location.startsWith("/chats") ? "text-primary" : "text-muted-foreground"}`}>
            <MessageCircle size={24} className={location.startsWith("/chats") ? "fill-primary/20" : ""} />
            <span className="text-[10px] mt-1 font-medium">Chats</span>
          </Link>
          <Link href="/profile" className={`flex flex-col items-center justify-center w-16 h-full ${location === "/profile" ? "text-primary" : "text-muted-foreground"}`}>
            <UserIcon size={24} className={location === "/profile" ? "fill-primary/20" : ""} />
            <span className="text-[10px] mt-1 font-medium">Profile</span>
          </Link>
        </nav>
      )}
    </div>
  );
}
