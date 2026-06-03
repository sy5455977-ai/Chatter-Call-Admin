import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { AuthPage } from "./pages/auth";
import { ChatsPage } from "./pages/chats";
import { ChatPage } from "./pages/chat";
import { ProfilePage } from "./pages/profile";
import { InvitePage } from "./pages/invite";
import { CallPage } from "./pages/call";
import { Layout } from "./components/layout";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={AuthPage} />
      <Route path="/chats">
        <Layout><ChatsPage /></Layout>
      </Route>
      <Route path="/chats/:id">
        <Layout hideNav><ChatPage /></Layout>
      </Route>
      <Route path="/profile">
        <Layout><ProfilePage /></Layout>
      </Route>
      <Route path="/invite">
        <Layout><InvitePage /></Layout>
      </Route>
      <Route path="/call/:id">
        <CallPage />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
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
