import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useClinicAuth } from "@/hooks/use-clinic-auth";
import { useDoctorAuth } from "@/hooks/use-doctor-auth";
import { useNotifications, useMarkNotificationRead } from "@/hooks/use-notifications";
import { useState, useEffect } from "react";
import logoPath from "@assets/Screenshot_2026-03-28_at_12.46.08_AM_1774639227884.png";
import {
  Bell,
  LogOut,
  CalendarPlus,
  LayoutDashboard,
  Shield,
  Building2,
  Sparkles,
  Stethoscope,
  Sun,
  Moon,
  ChevronDown,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/queryClient";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

export function Header() {
  const { user, logout, isAuthenticated } = useAuth();
  const { clinic, isAuthenticated: isClinicAuthenticated, logout: clinicLogout } = useClinicAuth();
  const { doctor, isAuthenticated: isDoctorAuthenticated, logout: doctorLogout } = useDoctorAuth();
  const [location] = useLocation();
  const { data: notifications = [] } = useNotifications();
  const { mutate: markRead } = useMarkNotificationRead();
  const { resolvedTheme, setTheme } = useTheme();

  const [healthStatus, setHealthStatus] = useState<{
    backend: boolean | null;
    database: boolean | null;
  }>({ backend: null, database: null });
  const [adminHovered, setAdminHovered] = useState(false);

  useEffect(() => {
    if (location === "/") {
      sessionStorage.removeItem("lastClinicId");
    }

    if (location.startsWith("/book/")) {
      const id = location.split("/").pop();
      if (id && id !== "book") sessionStorage.setItem("lastClinicId", id);
    } else {
      const clinicId = new URLSearchParams(window.location.search).get("clinicId");
      if (clinicId) sessionStorage.setItem("lastClinicId", clinicId);
    }

    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/health`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const data = await res.json();
            setHealthStatus({ backend: true, database: data.database });
          } else {
            setHealthStatus({ backend: false, database: false });
          }
        } else {
          setHealthStatus({ backend: false, database: false });
        }
      } catch {
        setHealthStatus({ backend: false, database: false });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [location]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const isSuperUser = isAuthenticated && user?.role === "superuser";

  const bookHref =
    location.startsWith("/book/") && !location.endsWith("/null")
      ? location
      : location === "/about" || location === "/clinic-login"
      ? (() => {
          const id =
            new URLSearchParams(window.location.search).get("clinicId") ||
            sessionStorage.getItem("lastClinicId");
          return id && id !== "null" ? `/book/${id}` : "/book";
        })()
      : "/book";

  const tabs = [
    ...(isClinicAuthenticated
      ? [{ href: "/clinic-dashboard", label: "Clinic Dashboard", icon: LayoutDashboard }]
      : []),
    ...(isDoctorAuthenticated
      ? [{ href: "/doctor-dashboard", label: "Doctor Portal", icon: Stethoscope }]
      : []),
    ...(!isClinicAuthenticated &&
    !isDoctorAuthenticated &&
    (location.startsWith("/book/") || location === "/about" || location === "/clinic-login")
      ? (() => {
          const clinicId =
            location.startsWith("/book/") && !location.endsWith("/null")
              ? location.split("/").pop()
              : new URLSearchParams(window.location.search).get("clinicId") ||
                sessionStorage.getItem("lastClinicId");
          return clinicId && clinicId !== "null"
            ? [{ href: `/about?clinicId=${clinicId}`, label: "About", icon: Building2 }]
            : [];
        })()
      : []),
  ];

  /* ── Auth block (right of separator) ── */
  const renderAuthBlock = () => {
    /* Superuser */
    if (isAuthenticated) {
      return (
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="relative h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                data-testid="button-notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent animate-pulse" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
              <div className="p-4 border-b bg-muted/30">
                <h4 className="text-sm font-semibold">Notifications</h4>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((n) => (
                    <DropdownMenuItem
                      key={n.id}
                      className={`flex flex-col items-start gap-1 p-4 cursor-pointer focus:bg-muted/50 ${!n.read ? "bg-primary/5" : ""}`}
                      onClick={() => !n.read && markRead(n.id)}
                    >
                      <p className={`text-sm ${!n.read ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                        {n.message}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(n.createdAt!), { addSuffix: true })}
                      </span>
                    </DropdownMenuItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Superuser avatar dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 h-8 px-2 rounded-md hover:bg-muted/60 transition-colors"
                data-testid="button-superuser-menu"
              >
                <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-primary">
                    {user?.firstName?.charAt(0)}
                  </span>
                </div>
                <div className="hidden sm:block text-left leading-none">
                  <p className="text-sm font-medium leading-none">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-[3px] capitalize">{user?.role}</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild>
                <Link href="/admin" className="flex items-center gap-2 cursor-pointer">
                  <LayoutDashboard className="h-4 w-4 text-primary" />
                  <span className="font-medium">Admin Dashboard</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/book" className="flex items-center gap-2 cursor-pointer text-muted-foreground">
                  <CalendarPlus className="h-4 w-4" />
                  <span>Book a Slot</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/deals" className="flex items-center gap-2 cursor-pointer text-muted-foreground">
                  <Sparkles className="h-4 w-4" />
                  <span>Dental Marketplace</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logout()}
                className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    }

    /* Clinic admin */
    if (isClinicAuthenticated) {
      return (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-primary">
                {clinic?.name?.charAt(0)}
              </span>
            </div>
            <div className="hidden sm:block text-left leading-none">
              <p className="text-sm font-medium leading-none max-w-[140px] truncate">
                {clinic?.name}
              </p>
              <p className="text-[11px] text-muted-foreground mt-[3px]">Clinic Admin</p>
            </div>
          </div>

          <button
            onClick={() => clinicLogout()}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-md text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors"
            data-testid="button-clinic-logout"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      );
    }

    /* Doctor */
    if (isDoctorAuthenticated) {
      const displayName = doctor?.name || "";
      return (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-primary">
                {displayName.replace(/^Dr\.\s*/i, "").charAt(0)}
              </span>
            </div>
            <div className="hidden sm:block text-left leading-none">
              <p className="text-sm font-medium leading-none max-w-[140px] truncate">
                {displayName}
              </p>
              <p className="text-[11px] text-muted-foreground mt-[3px]">Doctor</p>
            </div>
          </div>

          <button
            onClick={() => doctorLogout()}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-md text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors"
            data-testid="button-doctor-logout"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      );
    }

    /* Logged out */
    return (
      <div className="flex items-center gap-2">
        <Link href="/clinic-login">
          <Button
            variant={location === "/clinic-login" ? "default" : "ghost"}
            size="sm"
            className={`gap-2 h-8 px-3 text-xs font-semibold ${location === "/clinic-login" ? "" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="button-clinic-portal"
          >
            <Building2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Clinic Portal</span>
          </Button>
        </Link>

      </div>
    );
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-md">
      <div className="w-full px-4 sm:px-6">
        <div className="flex h-16 items-center gap-4">

          {/* ── Logo — always far left ── */}
          <Link
            href="/"
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0"
            data-testid="link-home"
          >
            <img src={logoPath} alt="bookMySlot logo" className="h-8 w-8 rounded-xl object-cover" />
            <div className="hidden sm:flex flex-col leading-none">
              <span
                className="text-[15px] font-bold tracking-tight"
                style={{ fontFamily: "'Sora', sans-serif", letterSpacing: "-.02em" }}
              >
                book<span style={{ color: "#0F9B6E" }}>My</span>Slot
              </span>
              {/* Fix 3: use text-primary/60 so it's visible in both light and dark mode */}
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary/60 mt-[2px]">
                Dental
              </span>
            </div>
          </Link>

          {/* ── Book a Slot — pinned left, next to logo ── */}
          {!isClinicAuthenticated && !isDoctorAuthenticated && !isSuperUser && (
            <Link href={bookHref}>
              <Button
                variant={location.startsWith("/book") ? "default" : "ghost"}
                size="sm"
                className={`gap-2 h-9 px-3 ${location.startsWith("/book") ? "" : "text-muted-foreground hover:text-foreground"}`}
                data-testid="tab-book-a-slot"
              >
                <CalendarPlus className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Book a Slot</span>
              </Button>
            </Link>
          )}

          {/* ── Nav tabs — flex-1 centered, fixed min-width per tab ── */}
          <nav className="flex-1 flex items-center justify-center gap-1">
            {tabs.map((tab) => {
              const isActive =
                location === tab.href ||
                (tab.label === "Clinic Dashboard" && location === "/clinic-dashboard") ||
                (tab.label === "Doctor Portal" && location === "/doctor-dashboard") ||
                (tab.label === "Book a Slot" && location.startsWith("/book/"));
              const Icon = tab.icon;

              return (
                <Link key={tab.href} href={tab.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className={`gap-2 h-9 min-w-[100px] justify-center ${
                      isActive ? "" : "text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`tab-${tab.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* ── Right utility bar: [auth] [smile deals] [separator] [theme toggle] ── */}
          <div className="flex items-center gap-3 shrink-0">

            {/* Auth block */}
            {renderAuthBlock()}

            {/* Smile Deals — pinned right, after Clinic Portal — hidden for superuser */}
            {!isSuperUser && (
              <Link href="/deals">
                <Button
                  variant={location === "/deals" ? "default" : "ghost"}
                  size="sm"
                  className={`gap-2 h-9 px-3 ${location === "/deals" ? "" : "text-muted-foreground hover:text-foreground"}`}
                  data-testid="tab-smile-deals"
                >
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Dental Marketplace</span>
                </Button>
              </Link>
            )}

            {/* Thin vertical separator */}
            <div className="w-px h-5 bg-border/60" />

            {/* Stealth admin — shield + keyhole, no label — hidden once superuser is logged in */}
            {!isSuperUser && <TooltipProvider delayDuration={400}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/admin">
                    <button
                      className="h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                      data-testid="button-admin-stealth"
                      onMouseEnter={() => setAdminHovered(true)}
                      onMouseLeave={() => setAdminHovered(false)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {/* Shield */}
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        {/* Keyhole — outline circle + tapered slot, fades in on hover */}
                        <g style={{
                          opacity: adminHovered ? 1 : 0,
                          transform: adminHovered ? "scale(1)" : "scale(0.6)",
                          transformOrigin: "12px 12px",
                          transition: "opacity 0.25s ease, transform 0.25s ease",
                        }}>
                          <circle cx="12" cy="10" r="2" strokeWidth="1.4" />
                          <path d="M10.8 11.8 L10 16 L14 16 L13.2 11.8 Z" strokeWidth="1.2" strokeLinejoin="round" />
                        </g>
                      </svg>
                    </button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  System Administrator Login
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>}

            {/* Single-click theme toggle — extreme right, tooltip shows next action */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                    className="h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    data-testid="button-theme-toggle"
                  >
                    <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

        </div>
      </div>
    </header>
  );
}
