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
    timestamp?: string;
  }>({ backend: null, database: null });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const API_BASE_URL = import.meta.env.VITE_API_URL || "";
        
        // Try to fetch backend health
        const backendRes = await fetch(`${API_BASE_URL}/api/health/backend`, { cache: 'no-store' });
        const backendData = backendRes.ok ? await backendRes.json() : null;
        
        // Try to fetch database health
        const dbRes = await fetch(`${API_BASE_URL}/api/health/database`, { cache: 'no-store' });
        const dbData = dbRes.ok ? await dbRes.json() : null;
        
        setHealthStatus({ 
          backend: !!backendData, 
          database: dbData?.database || false,
          timestamp: backendData?.timestamp || dbData?.timestamp 
        });
      } catch (err) {
        console.error("Health check failed", err);
        setHealthStatus({ backend: false, database: false });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 left-4 z-[100] flex items-center gap-2 px-3 py-1.5 bg-background/80 backdrop-blur-md rounded-full border border-border/50 shadow-lg opacity-60 hover:opacity-100 transition-all group">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-help">
              <Server className={`h-3 w-3 ${healthStatus.backend === true ? 'text-green-500' : healthStatus.backend === false ? 'text-destructive' : 'text-muted-foreground'}`} />
              <div className={`h-1.5 w-1.5 rounded-full ${healthStatus.backend === true ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : healthStatus.backend === false ? 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-muted-foreground'}`} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[11px]">
            Backend: {healthStatus.backend === true ? 'Connected' : healthStatus.backend === false ? 'Error' : 'Checking...'}
          </TooltipContent>
        </Tooltip>
        
        <div className="w-[1px] h-3 bg-border/50" />
        
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-help">
              <Database className={`h-3 w-3 ${healthStatus.database === true ? 'text-green-500' : healthStatus.database === false ? 'text-destructive' : 'text-muted-foreground'}`} />
              <div className={`h-1.5 w-1.5 rounded-full ${healthStatus.database === true ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : healthStatus.database === false ? 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-muted-foreground'}`} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[11px]">
            Database: {healthStatus.database === true ? 'Connected' : healthStatus.database === false ? 'Error' : 'Checking...'}
          </TooltipContent>
        </Tooltip>
      </div>

      {healthStatus.timestamp && (
        <>
          <div className="w-[1px] h-3 bg-border/50" />
          <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap tabular-nums">
            Build: {new Date(healthStatus.timestamp).toLocaleString([], { 
              month: 'short', 
              day: '2-digit',
              hour: '2-digit', 
              minute: '2-digit', 
              second: '2-digit' 
            })}
          </span>
        </>
      )}
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
