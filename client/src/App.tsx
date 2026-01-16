import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { Header } from "@/components/Header";
import { useState, useEffect } from "react";
import { Server, Database } from "lucide-react";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Book from "@/pages/Book";
import Admin from "@/pages/Admin";
import ClinicLogin from "@/pages/ClinicLogin";
import ClinicDashboard from "@/pages/ClinicDashboard";

function HealthIndicator() {
  const [healthStatus, setHealthStatus] = useState<{
    backend: boolean | null;
    database: boolean | null;
  }>({ backend: null, database: null });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          const data = await res.json();
          setHealthStatus({ backend: true, database: data.database });
        } else {
          setHealthStatus({ backend: false, database: false });
        }
      } catch (err) {
        setHealthStatus({ backend: false, database: false });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 left-4 z-[100] flex items-center gap-1.5 px-2 py-1 bg-background/50 backdrop-blur-sm rounded-full border border-border/30 shadow-sm opacity-40 hover:opacity-100 transition-opacity">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 cursor-help">
            <Server className={`h-2.5 w-2.5 ${healthStatus.backend === true ? 'text-green-500' : healthStatus.backend === false ? 'text-destructive' : 'text-muted-foreground'}`} />
            <div className={`h-1 w-1 rounded-full ${healthStatus.backend === true ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]' : healthStatus.backend === false ? 'bg-destructive shadow-[0_0_4px_rgba(239,68,68,0.5)]' : 'bg-muted-foreground'}`} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-[10px]">Backend: {healthStatus.backend === true ? 'Connected' : healthStatus.backend === false ? 'Error' : 'Checking...'}</p>
        </TooltipContent>
      </Tooltip>
      <div className="w-[1px] h-2 bg-border/30 mx-0.5" />
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 cursor-help">
            <Database className={`h-2.5 w-2.5 ${healthStatus.database === true ? 'text-green-500' : healthStatus.database === false ? 'text-destructive' : 'text-muted-foreground'}`} />
            <div className={`h-1 w-1 rounded-full ${healthStatus.database === true ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]' : healthStatus.database === false ? 'bg-destructive shadow-[0_0_4px_rgba(239,68,68,0.5)]' : 'bg-muted-foreground'}`} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-[10px]">Database: {healthStatus.database === true ? 'Connected' : healthStatus.database === false ? 'Error' : 'Checking...'}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/book" component={Book} />
      <Route path="/admin" component={Admin} />
      <Route path="/clinic-login" component={ClinicLogin} />
      <Route path="/clinic-dashboard" component={ClinicDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>
          <div className="min-h-screen bg-background font-sans antialiased relative">
            <Header />
            <main>
              <Router />
            </main>
            <HealthIndicator />
            <Toaster />
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
