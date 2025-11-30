import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import AcceptInvite from "./pages/AcceptInvite";
import NotFound from "./pages/NotFound";
import { AppSidebar } from "./components/AppSidebar";
import { AdvisorSidebar } from "./components/AdvisorSidebar";
import { RoleSwitcher } from "./components/RoleSwitcher";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useUserRole } from "@/hooks/useUserRole";
import AdvisorDashboard from "./pages/advisor/AdvisorDashboard";
import ClientsPage from "./pages/advisor/ClientsPage";
import CycleSheetPage from "./pages/advisor/CycleSheetPage";

const queryClient = new QueryClient();

const AppContent = () => {
  const { isAdvisor, loading } = useUserRole();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        {isAdvisor ? <AdvisorSidebar /> : <AppSidebar />}
        <main className="flex-1 overflow-x-hidden">
          <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/50">
            <h1 className="text-lg font-semibold">The Wheel Terminal</h1>
            <RoleSwitcher />
          </div>
          <Routes>
            {isAdvisor ? (
              <>
                <Route path="/advisor" element={<AdvisorDashboard />} />
                <Route path="/advisor/clients" element={<ClientsPage />} />
                <Route path="/advisor/cyclesheet" element={<CycleSheetPage />} />
                <Route path="/advisor/trades" element={<div className="p-6">Model Trades (Coming Soon)</div>} />
                <Route path="/advisor/orders" element={<div className="p-6">Orders & Activity (Coming Soon)</div>} />
                <Route path="/advisor/settings" element={<Settings />} />
                <Route path="*" element={<AdvisorDashboard />} />
              </>
            ) : (
              <>
                <Route path="/" element={<Dashboard />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </>
            )}
          </Routes>
        </main>
      </div>
    </SidebarProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/accept-invite/:token" element={<AcceptInvite />} />
          <Route path="/*" element={<AppContent />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
