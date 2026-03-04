import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import AppLayout from "@/components/layout/AppLayout";
import Chats from "@/pages/Chats";
import ChatDetail from "@/pages/ChatDetail";
import Posts from "@/pages/Posts";
import UserProfile from "@/pages/UserProfile";
import Board from "@/pages/Board";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Chats} />
        <Route path="/chat/:id" component={ChatDetail} />
        <Route path="/posts" component={Posts} />
        <Route path="/profile/:id" component={UserProfile} />
        <Route path="/board" component={Board} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
