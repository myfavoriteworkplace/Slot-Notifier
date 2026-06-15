import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useClinicAuth } from "@/hooks/use-clinic-auth";
import { useDoctorAuth } from "@/hooks/use-doctor-auth";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useNotificationSocket,
} from "@/hooks/use-notifications";
import { useState } from "react";
import { useEffect } from "react";
import logoPath from "@assets/Screenshot_2026-03-28_at_12.46.08_AM_1774639227884.png";
import {
  Bell,
  LogOut,
  CalendarPlus,
  LayoutDashboard,
  Building2,
  Sparkles,
  Stethoscope,
  Sun,
  Moon,
  ChevronDown,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileCheck,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
import type { Notification } from "@shared/schema";

/* ── Notification icon inference ─────────────────────────────────────────── */
function getNotifMeta(message: string): {
  Icon: React.ComponentType<{ className?: string }>;
  bg: string;
  color: string;
} {
  const m = message.toLowerCase();
  if (m.includes("cancel"))
    return { Icon: XCircle,      bg: "bg-rose-100 dark:bg-rose-950/40",    color: "text-rose-500 dark:text-rose-400"    };
  if (m.includes("reschedul"))
    return { Icon: RefreshCw,    bg: "bg-amber-100 dark:bg-amber-950/40",  color: "text-amber-600 dark:text-amber-400"  };
  if (m.includes("consent") || m.includes("signed"))
    return { Icon: FileCheck,    bg: "bg-sky-100 dark:bg-sky-950/40",      color: "text-sky-600 dark:text-sky-400"      };
  if (m.includes("doctor") || m.includes("assigned"))
    return { Icon: Stethoscope,  bg: "bg-teal-100 dark:bg-teal-950/40",    color: "text-teal-600 dark:text-teal-400"    };
  if (m.includes("approved") || m.includes("confirmed"))
    return { Icon: CheckCircle2, bg: "bg-emerald-100 dark:bg-emerald-950/40", color: "text-emerald-600 dark:text-emerald-400" };
  return   { Icon: CalendarCheck, bg: "bg-primary/10",                      color: "text-primary"                        };
}

/* ── NotificationBellPanel ────────────────────────────────────────────────── */
interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
  onNavigate?: (n: Notification) => void;
}

function NotificationBellPanel({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);

  const todayItems     = notifications.filter(n => isToday(new Date(n.createdAt!)));
  const yesterdayItems = notifications.filter(n => isYesterday(new Date(n.createdAt!)));
  const earlierItems   = notifications.filter(
    n => !isToday(new Date(n.createdAt!)) && !isYesterday(new Date(n.createdAt!))
  );

  const groups = [
    { label: "Today",     items: todayItems     },
    { label: "Yesterday", items: yesterdayItems  },
    { label: "Earlier",   items: earlierItems    },
  ].filter(g => g.items.length > 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative h-9 w-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 active:bg-muted/80 transition-colors"
          data-testid="button-notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-primary text-[9px] font-bold text-white flex items-center justify-center leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[380px] p-0 shadow-xl rounded-2xl overflow-hidden"
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border/50">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Bell className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">Notifications</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {unreadCount > 0
                ? `${unreadCount} unread update${unreadCount !== 1 ? "s" : ""}`
                : "All caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="shrink-0 text-xs font-semibold text-primary hover:text-primary/80 active:scale-95 transition-all px-2 py-1.5 rounded-lg hover:bg-primary/8 min-h-[32px]"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* ── Body ── */}
        <ScrollArea className="max-h-[360px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                <Bell className="h-6 w-6 text-muted-foreground/30" />
              </div>
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <div className="py-1.5">
              {groups.map((group, gi) => (
                <div key={group.label}>
                  {/* Group label */}
                  <div className="px-4 pb-1 pt-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </span>
                  </div>

                  {/* Rows */}
                  {group.items.map(n => {
                    const { Icon, bg, color } = getNotifMeta(n.message);
                    return (
                      <button
                        key={n.id}
                        className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 active:bg-muted/70 ${
                          !n.read ? "bg-primary/5" : ""
                        }`}
                        onClick={() => {
                          if (!n.read) onMarkRead(n.id);
                          setOpen(false);
                          onNavigate?.(n);
                        }}
                      >
                        {/* Unread dot */}
                        <div className="shrink-0 w-2 flex justify-center pt-2.5">
                          {!n.read && (
                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          )}
                        </div>

                        {/* Type icon */}
                        <div
                          className={`h-8 w-8 rounded-xl ${bg} flex items-center justify-center shrink-0 mt-0.5`}
                        >
                          <Icon className={`h-3.5 w-3.5 ${color}`} />
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm leading-snug ${
                              !n.read
                                ? "font-medium text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {n.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(n.createdAt!), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </button>
                    );
                  })}

                  {/* Group divider */}
                  {gi < groups.length - 1 && (
                    <div className="mx-4 my-0.5 border-t border-border/30" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* ── Footer ── */}
        {notifications.length > 0 && (
          <div className="border-t border-border/50 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs font-semibold text-primary">
              {unreadCount} unread
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ── Header ──────────────────────────────────────────────────────────────── */
export function Header() {
  const { user, logout, isAuthenticated } = useAuth();
  const { clinic, isAuthenticated: isClinicAuthenticated, logout: clinicLogout } = useClinicAuth();
  const { doctor, isAuthenticated: isDoctorAuthenticated, logout: doctorLogout } = useDoctorAuth();
  const [location, setLocation] = useLocation();
  const { data: notifications = [] } = useNotifications();
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead } = useMarkAllNotificationsRead();
  useNotificationSocket(clinic?.id ?? undefined, doctor?.id ?? undefined);
  const { resolvedTheme, setTheme } = useTheme();

  const [adminHovered, setAdminHovered] = useState(false);

  useEffect(() => {
    if (location === "/") {
      sessionStorage.removeItem("lastClinicId");
    }
    if (location.startsWith("/book/")) {
      const id = location.split("/").pop();
      if (id && id !== "book") sessionStorage.setItem("lastClinicId", id);
    } else if (location.startsWith("/clinic/")) {
      const slug = location.split("/")[2];
      if (slug) sessionStorage.setItem("lastClinicSlug", slug);
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
          const ct = res.headers.get("content-type");
          if (ct && ct.includes("application/json")) {
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
    const iv = setInterval(checkHealth, 30000);
    return () => clearInterval(iv);
  }, [location]);

  const [healthStatus, setHealthStatus] = useState<{
    backend: boolean | null;
    database: boolean | null;
  }>({ backend: null, database: null });

  const unreadCount = notifications.filter(n => !n.read).length;
  const isSuperUser = isAuthenticated && user?.role === "superuser";
  const isNoone     = !isAuthenticated && !isClinicAuthenticated && !isDoctorAuthenticated;

  const bookHref =
    location.startsWith("/book/") && !location.endsWith("/null")
      ? location
      : location === "/about" ||
        location.startsWith("/clinic/") ||
        location === "/clinic-login"
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
    (location.startsWith("/book/") ||
      location === "/about" ||
      location.startsWith("/clinic/") ||
      location === "/clinic-login")
      ? (() => {
          if (location.startsWith("/clinic/")) {
            const slug = location.split("/")[2];
            return slug ? [{ href: `/clinic/${slug}`, label: "About", icon: Building2 }] : [];
          }
          const slug = sessionStorage.getItem("lastClinicSlug");
          if (slug) return [{ href: `/clinic/${slug}`, label: "About", icon: Building2 }];
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

  /* ── Notification deep-link navigation ── */
  const handleNotifNavigate = (n: Notification) => {
    const type = n.type ?? undefined;
    const bookingId = n.bookingId ?? undefined;

    if (type === "doctor_on_leave" || type === "doctor_leave_cancelled") {
      setLocation("/clinic-dashboard?panel=manage-doctors");
      return;
    }
    if (bookingId) {
      if (isClinicAuthenticated || isAuthenticated) {
        const notifType = type ?? "";
        setLocation(`/clinic-dashboard?openBooking=${bookingId}&notifType=${notifType}`);
      } else if (isDoctorAuthenticated) {
        setLocation(`/doctor-dashboard?openBooking=${bookingId}`);
      }
    }
  };

  /* ── Bell props (shared for all roles) ── */
  const bellProps: NotificationBellProps = {
    notifications,
    unreadCount,
    onMarkRead:    (id: number) => markRead(id),
    onMarkAllRead: ()           => markAllRead(),
    onNavigate:    handleNotifNavigate,
  };

  /* ── Auth block ── */
  const renderAuthBlock = () => {

    /* SUPERUSER */
    if (isAuthenticated) {
      return (
        <div className="flex items-center gap-2">
          <NotificationBellPanel {...bellProps} />

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
                  <p className="text-[11px] text-muted-foreground mt-[3px] capitalize">
                    {user?.role}
                  </p>
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

    /* CLINIC ADMIN */
    if (isClinicAuthenticated) {
      return (
        <div className="flex items-center gap-2">
          <NotificationBellPanel {...bellProps} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 h-8 px-2 rounded-md hover:bg-muted/60 transition-colors"
                data-testid="button-clinic-menu"
              >
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
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild>
                <Link href="/clinic-dashboard" className="flex items-center gap-2 cursor-pointer">
                  <LayoutDashboard className="h-4 w-4 text-primary" />
                  <span className="font-medium">Clinic Dashboard</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/deals" className="flex items-center gap-2 cursor-pointer text-muted-foreground">
                  <Sparkles className="h-4 w-4" />
                  <span>Dental Marketplace</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => clinicLogout()}
                className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                data-testid="button-clinic-logout"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    }

    /* DOCTOR */
    if (isDoctorAuthenticated) {
      const displayName = doctor?.name || "";
      return (
        <div className="flex items-center gap-2">
          <NotificationBellPanel {...bellProps} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 h-8 px-2 rounded-md hover:bg-muted/60 transition-colors"
                data-testid="button-doctor-menu"
              >
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
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild>
                <Link href="/doctor-dashboard" className="flex items-center gap-2 cursor-pointer">
                  <Stethoscope className="h-4 w-4 text-primary" />
                  <span className="font-medium">Doctor Portal</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/deals" className="flex items-center gap-2 cursor-pointer text-muted-foreground">
                  <Sparkles className="h-4 w-4" />
                  <span>Dental Marketplace</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => doctorLogout()}
                className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                data-testid="button-doctor-logout"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    }

    /* LOGGED OUT */
    return (
      <Link href="/clinic-login">
        <button
          className="flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-semibold text-white transition-all"
          style={{ background: "#0F9B6E", boxShadow: "0 2px 10px rgba(15,155,110,.3)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#0A7A56"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#0F9B6E"; }}
          data-testid="button-clinic-portal"
        >
          <Building2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Clinic Portal</span>
        </button>
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-md">
      <div className="w-full px-4 sm:px-6">
        <div className="flex h-16 items-center gap-4">

          {/* Logo */}
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
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary/60 mt-[2px]">
                Dental
              </span>
            </div>
          </Link>

          {/* Book a Slot — unauthenticated only */}
          {isNoone && (
            <Link href={bookHref}>
              <Button
                variant={location.startsWith("/book") ? "default" : "ghost"}
                size="sm"
                className={`gap-2 h-9 px-2 sm:px-3 ${
                  location.startsWith("/book") ? "" : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="tab-book-a-slot"
              >
                <CalendarPlus className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Book a Slot</span>
              </Button>
            </Link>
          )}

          {/* Centre nav tabs */}
          <nav className="flex-1 flex items-center justify-center gap-1">
            {tabs.map(tab => {
              const isActive =
                location === tab.href ||
                (tab.label === "Clinic Dashboard" && location === "/clinic-dashboard") ||
                (tab.label === "Doctor Portal"    && location === "/doctor-dashboard") ||
                (tab.label === "Book a Slot"      && location.startsWith("/book/"));
              const Icon = tab.icon;
              return (
                <Link key={tab.href} href={tab.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className={`gap-2 h-9 sm:min-w-[100px] justify-center ${
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

          {/* Right utility bar */}
          <div className="flex items-center gap-3 shrink-0">

            {renderAuthBlock()}

            {/* Dental Marketplace — unauthenticated only */}
            {isNoone && (
              <Link href="/deals">
                <Button
                  variant={location === "/deals" ? "default" : "ghost"}
                  size="sm"
                  className={`gap-2 h-9 px-2 sm:px-3 ${
                    location === "/deals" ? "" : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid="tab-smile-deals"
                >
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Dental Marketplace</span>
                </Button>
              </Link>
            )}

            {/* Separator */}
            <div className="w-px h-5 bg-border/60" />

            {/* Stealth admin — unauthenticated only */}
            {isNoone && (
              <TooltipProvider delayDuration={700}>
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
                          viewBox="0 0 24 24" width="16" height="16"
                          fill="none" stroke="currentColor"
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        >
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
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
                  <TooltipContent side="bottom">System Administrator Login</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Theme toggle */}
            <TooltipProvider delayDuration={700}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                    className="h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    data-testid="button-theme-toggle"
                  >
                    <Sun  className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
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
