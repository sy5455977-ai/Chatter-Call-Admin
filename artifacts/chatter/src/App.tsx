import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { AuthPage }          from "./pages/auth";
import { ChatsPage }         from "./pages/chats";
import { ChatPage }          from "./pages/chat";
import { ProfilePage }       from "./pages/profile";
import { InvitePage }        from "./pages/invite";
import { InviteAcceptPage }  from "./pages/invite-accept";
import { CallPage }          from "./pages/call";
import { AdminPage }         from "./pages/admin";
import { Layout }            from "./components/layout";
import { getAuthToken, getAuthUser } from "./lib/auth";
import { initWebSocket, useWebSocket, sendWsMessage } from "./lib/websocket";
import { showNotification } from "./lib/notifications";

// ── React Query client ────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            20_000,
      gcTime:               5 * 60_000,
      retry:                2,
      retryDelay:           1000,
      refetchOnWindowFocus: false,
    },
  },
});

// ── Auth guard ────────────────────────────────────────────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const token = getAuthToken();
  useEffect(() => {
    if (!token) setLocation("/");
  }, [token]);
  if (!token) return null;
  return <>{children}</>;
}

// ── Incoming call overlay (shown globally) ────────────────────────────────────
interface IncomingCall {
  conversationId: number;
  fromUserId:     number;
  fromName:       string;
}

function IncomingCallBanner() {
  const [call, setCall]     = useState<IncomingCall | null>(null);
  const [, setLocation]     = useLocation();

  useWebSocket((event) => {
    const ev = event as any;
    if (ev.type === "webrtc_call_request") {
      // Show incoming call notification
      setCall({
        conversationId: ev.conversationId,
        fromUserId:     ev.fromUserId,
        fromName:       ev.fromName ?? "Someone",
      });
      showNotification("Incoming Call 📞", {
        body: `${ev.fromName ?? "Someone"} is calling you`,
        tag:  "incoming-call",
      });
    }
    if (ev.type === "webrtc_call_end" || ev.type === "webrtc_call_decline") {
      setCall(null);
    }
  });

  if (!call) return null;

  const handleAccept = () => {
    setCall(null);
    // Navigate to call page as callee (no ?caller=1)
    setLocation(`/call/${call.conversationId}`);
  };

  const handleDecline = () => {
    const currentUser = getAuthUser();
    sendWsMessage({
      type:           "webrtc_call_decline",
      conversationId: call.conversationId,
      targetUserId:   call.fromUserId,
    });
    setCall(null);
  };

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center pointer-events-none">
      <div
        className="mt-4 mx-4 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-4 flex items-center gap-4 pointer-events-auto"
        style={{ maxWidth: 380 }}
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm truncate">📞 Incoming call</p>
          <p className="text-xs text-zinc-400 truncate">{call.fromName}</p>
        </div>
        <button
          onClick={handleDecline}
          className="h-10 w-10 rounded-full bg-red-600 text-white flex items-center justify-center flex-shrink-0 text-lg"
        >
          ✕
        </button>
        <button
          onClick={handleAccept}
          className="h-10 w-10 rounded-full bg-green-500 text-white flex items-center justify-center flex-shrink-0 text-lg"
        >
          ✓
        </button>
      </div>
    </div>
  );
}

// ── Router ────────────────────────────────────────────────────────────────────
function Router() {
  return (
    <Switch>
      {/* Public pages */}
      <Route path="/"              component={AuthPage} />
      <Route path="/invite/:code"  component={InviteAcceptPage} />

      {/* Protected pages */}
      <Route path="/chats">
        <RequireAuth><Layout><ChatsPage /></Layout></RequireAuth>
      </Route>
      <Route path="/chats/:id">
        <RequireAuth><Layout hideNav><ChatPage /></Layout></RequireAuth>
      </Route>
      <Route path="/profile">
        <RequireAuth><Layout><ProfilePage /></Layout></RequireAuth>
      </Route>
      <Route path="/invite">
        <RequireAuth><Layout><InvitePage /></Layout></RequireAuth>
      </Route>
      <Route path="/call/:id">
        <RequireAuth><CallPage /></RequireAuth>
      </Route>
      <Route path="/admin">
        <RequireAuth><AdminPage /></RequireAuth>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

// ── Root app ──────────────────────────────────────────────────────────────────
function App() {
  useEffect(() => {
    if (getAuthToken()) initWebSocket();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <IncomingCallBanner />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
