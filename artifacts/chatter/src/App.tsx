import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { AuthPage } from "./pages/auth";
import { ChatsPage } from "./pages/chats";
import { ChatPage } from "./pages/chat";
import { ProfilePage } from "./pages/profile";
import { InvitePage } from "./pages/invite";
import { InviteAcceptPage } from "./pages/invite-accept";
import { CallPage } from "./pages/call";
import { AdminPage } from "./pages/admin";
import { Layout } from "./components/layout";
import { getAuthToken } from "./lib/auth";
import { initWebSocket } from "./lib/websocket";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      gcTime: 5 * 60_000,
      retry: 2,
      retryDelay: 1000,
      refetchOnWindowFocus: false,
    },
  },
});

/** Redirect to / if not authenticated */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const token = getAuthToken();
  useEffect(() => {
    if (!token) setLocation("/");
  }, [token]);
  if (!token) return null;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={AuthPage} />

      {/* Public invite accept — no auth required (handled inside component) */}
      <Route path="/invite/:code" component={InviteAcceptPage} />

      <Route path="/chats">
        <RequireAuth>
          <Layout><ChatsPage /></Layout>
        </RequireAuth>
      </Route>

      <Route path="/chats/:id">
        <RequireAuth>
          <Layout hideNav><ChatPage /></Layout>
        </RequireAuth>
      </Route>

      <Route path="/profile">
        <RequireAuth>
          <Layout><ProfilePage /></Layout>
        </RequireAuth>
      </Route>

      <Route path="/invite">
        <RequireAuth>
          <Layout><InvitePage /></Layout>
        </RequireAuth>
      </Route>

      <Route path="/call/:id">
        <RequireAuth>
          <CallPage />
        </RequireAuth>
      </Route>

      <Route path="/admin">
        <RequireAuth>
          <AdminPage />
        </RequireAuth>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    // Connect WebSocket if user is already logged in on app start
    if (getAuthToken()) initWebSocket();

    // Resume any pending invite after login
    const pendingInvite = sessionStorage.getItem("pendingInvite");
    if (pendingInvite && getAuthToken()) {
      sessionStorage.removeItem("pendingInvite");
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
