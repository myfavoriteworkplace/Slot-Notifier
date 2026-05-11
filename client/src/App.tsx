import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient, API_BASE_URL } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { Header } from "@/components/Header";
import { useState, useEffect } from "react";
import { Server, Database, ShieldCheck, CalendarPlus } from "lucide-react";
import logoPath from "@assets/Screenshot_2026-03-28_at_12.46.08_AM_1774639227884.png";
import { useAuth } from "@/hooks/use-auth";
import { useClinicAuth } from "@/hooks/use-clinic-auth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Book from "@/pages/Book";
import Admin from "@/pages/Admin";
import ClinicLogin from "@/pages/ClinicLogin";
import ClinicDashboard from "@/pages/ClinicDashboard";
import ClinicAbout from "@/pages/ClinicAbout";
import SetupPassword from "@/pages/SetupPassword";
import SmileDeals from "@/pages/SmileDeals";
import DoctorDashboard from "@/pages/DoctorDashboard";
import DoctorPublicProfile from "@/pages/DoctorPublicProfile";
import GettingStarted from "@/pages/GettingStarted";
import RegisterClinic from "@/pages/RegisterClinic";
import ConsentForm from "@/pages/ConsentForm";
import Pricing from "@/pages/Pricing";
import Activate from "@/pages/Activate";
import ResetPassword from "@/pages/ResetPassword";

function HealthIndicator() {
  const { isAuthenticated: isUserAuth } = useAuth();
  const { isAuthenticated: isClinicAuth } = useClinicAuth();
  const isSessionActive = isUserAuth || isClinicAuth;

  const [healthStatus, setHealthStatus] = useState<{
    backend: boolean | null;
    database: boolean | null;
    timestamp?: string;
  }>({ backend: null, database: null });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        // Use relative paths to ensure it works in both dev (5001 -> 5000 proxy) and prod
        const backendRes = await fetch(`${API_BASE_URL}/api/health/backend`, { cache: 'no-store' });
        const backendData = backendRes.ok ? await backendRes.json() : null;
        
        const dbRes = await fetch(`${API_BASE_URL}/api/health/database`, { cache: 'no-store' });
        const dbData = dbRes.ok ? await dbRes.json() : null;
        
        setHealthStatus({ 
          backend: !!backendData, 
          database: dbData?.status === "ok",
          timestamp: backendData?.timestamp || dbData?.timestamp 
        });
      } catch (err) {
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

        <div className="w-[1px] h-3 bg-border/50" />

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-help">
              <ShieldCheck className={`h-3 w-3 ${isSessionActive ? 'text-green-500' : 'text-muted-foreground'}`} />
              <div className={`h-1.5 w-1.5 rounded-full ${isSessionActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-muted-foreground'}`} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[11px]">
            Session: {isSessionActive ? 'Active' : 'Not Authenticated'}
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
      <Route path="/getting-started" component={GettingStarted} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/register-clinic" component={RegisterClinic} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/book/:clinicId" component={Book} />
      <Route path="/book" component={Book} />
      <Route path="/admin" component={Admin} />
      <Route path="/clinic-login" component={ClinicLogin} />
      <Route path="/clinic-dashboard" component={ClinicDashboard} />
      <Route path="/clinic/:slug" component={ClinicAbout} />
      <Route path="/about" component={ClinicAbout} />
      <Route path="/setup-password" component={SetupPassword} />
      <Route path="/deals" component={SmileDeals} />
      <Route path="/doctor-dashboard" component={DoctorDashboard} />
      <Route path="/doctor/:id" component={DoctorPublicProfile} />
      <Route path="/consent/:token" component={ConsentForm} />
      <Route path="/activate/:token" component={Activate} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route component={NotFound} />
    </Switch>
  );
}

/* ── Minimal bar shown on standalone clinic profile pages ── */
function ClinicMinimalBar() {
  const [location] = useLocation();
  const [bookHref, setBookHref] = useState("/book");

  useEffect(() => {
    const id = sessionStorage.getItem("lastClinicId");
    if (id && id !== "null") {
      setBookHref(`/book/${id}`);
    } else {
      setBookHref("/book");
    }
  }, [location]);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-md">
      <div className="w-full px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
            data-testid="link-home-minimal"
          >
            <img src={logoPath} alt="bookMySlot logo" className="h-8 w-8 rounded-xl object-cover" />
            <div className="hidden sm:flex flex-col leading-none">
              <span
                className="text-[15px] font-bold tracking-tight"
                style={{ fontFamily: "'Sora', sans-serif", letterSpacing: "-.02em" }}
              >
                book<span style={{ color: "#0F9B6E" }}>My</span>Slot
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary/60 mt-[2px]">
                Dental
              </span>
            </div>
          </Link>

          {/* Book Appointment CTA */}
          <Link href={bookHref}>
            <button
              className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background: "#0F9B6E", boxShadow: "0 2px 10px rgba(15,155,110,.3)" }}
              data-testid="button-book-appointment-minimal"
            >
              <CalendarPlus className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Book Appointment</span>
              <span className="sm:hidden">Book</span>
            </button>
          </Link>

        </div>
      </div>
    </header>
  );
}

function AppLayout() {
  const [location] = useLocation();
  const isClinicAboutPage = location.startsWith("/clinic/") || location === "/about";

  return (
    <div className="min-h-screen bg-background font-sans antialiased relative overflow-x-hidden">
      {/* Global ambient glow blobs */}
      <div
        aria-hidden="true"
        className="fixed -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-primary/10 blur-3xl pointer-events-none z-0"
      />
      <div
        aria-hidden="true"
        className="fixed -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-accent/10 blur-3xl pointer-events-none z-0"
      />
      {isClinicAboutPage ? <ClinicMinimalBar /> : <Header />}
      <main className="relative z-10">
        <Router />
      </main>
      <HealthIndicator />
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>
          <AppLayout />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
