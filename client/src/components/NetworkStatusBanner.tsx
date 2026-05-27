import { useState, useEffect } from "react";
import { WifiOff, ServerCrash, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/queryClient";

type BannerState = "offline" | "server-down" | "recovered" | null;

export function NetworkStatusBanner() {
  const [state, setState] = useState<BannerState>(null);
  const [retrying, setRetrying] = useState(false);

  async function checkServer() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/health`, { cache: "no-store" });
      if (res.ok) {
        setState(prev => {
          if (prev === "server-down" || prev === "offline") {
            setTimeout(() => setState(null), 3000);
            return "recovered";
          }
          return null;
        });
      } else {
        setState("server-down");
      }
    } catch {
      setState(navigator.onLine ? "server-down" : "offline");
    }
  }

  useEffect(() => {
    if (state !== "offline" && state !== "server-down") return;
    const iv = setInterval(checkServer, 30000);
    return () => clearInterval(iv);
  }, [state]);

  useEffect(() => {
    function handleOffline() { setState("offline"); }
    function handleOnline() { checkServer(); }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    if (!navigator.onLine) setState("offline");

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  async function handleRetry() {
    setRetrying(true);
    await checkServer();
    setTimeout(() => setRetrying(false), 800);
  }

  if (!state) return null;

  if (state === "recovered") {
    return (
      <div
        role="alert"
        className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium shadow-md bg-emerald-500 text-white animate-in fade-in duration-300"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Connection restored — you're back online.
      </div>
    );
  }

  const isOffline = state === "offline";

  return (
    <div
      role="alert"
      className={`fixed top-0 left-0 right-0 z-[200] flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium shadow-md ${
        isOffline
          ? "bg-amber-500 text-white"
          : "bg-destructive text-destructive-foreground"
      }`}
    >
      <span className="flex items-center gap-2">
        {isOffline ? (
          <WifiOff className="h-4 w-4 shrink-0" />
        ) : (
          <ServerCrash className="h-4 w-4 shrink-0" />
        )}
        {isOffline
          ? "You appear to be offline — please check your internet connection."
          : "Having trouble reaching the server — please try again in a moment."}
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-7 shrink-0 border-white/40 bg-white/10 text-white hover:bg-white/20"
        onClick={handleRetry}
        disabled={retrying}
      >
        {retrying ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        ) : (
          "Retry"
        )}
      </Button>
    </div>
  );
}
