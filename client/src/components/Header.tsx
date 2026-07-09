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
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
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

/* ── Shared panel content (used by both mobile drawer + desktop popover) ── */
function NotificationPanelContent({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
  onClose,
}: NotificationBellProps & { onClose: () => void }) {
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
    <>
      {/* Gradient accent strip */}
      <div className="h-[3px] w-full bg-gradient-to-r from-primary via-accent to-primary/50 shrink-0" />

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-3 border-b border-border/40 shrink-0">
        <div className="relative h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Bell className="h-4 w-4 text-primary" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-primary flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-40" />
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight">Notifications</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {unreadCount > 0
              ? `${unreadCount} unread update${unreadCount !== 1 ? "s" : ""}`
              : "All caught up"}
          </p>
        </div>
        <button
          onClick={onMarkAllRead}
          disabled={unreadCount === 0}
          className="shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all min-h-[32px] disabled:opacity-30 disabled:cursor-not-allowed text-primary hover:bg-primary/10 active:scale-95"
          data-testid="button-mark-all-read"
        >
          Mark all read
        </button>
      </div>

      {/* ── Body ── */}
      <ScrollArea className="flex-1 min-h-0 overflow-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
              <Bell className="h-8 w-8 text-muted-foreground/25" />
            </div>
            <div className="text-center px-6">
              <p className="text-sm font-medium text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">We'll let you know when something happens</p>
            </div>
          </div>
        ) : (
          <div className="pb-2">
            {groups.map((group, gi) => (
              <div key={group.label}>
                {/* Sticky group label */}
                <div className="sticky top-0 z-10 px-4 py-2 bg-background/95 backdrop-blur-sm">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 bg-muted/60 px-2.5 py-0.5 rounded-full">
                    {group.label}
                  </span>
                </div>

                {/* Rows */}
                {group.items.map(n => {
                  const { Icon, bg, color } = getNotifMeta(n.message);
                  return (
                    <div key={n.id} className="group relative">
                      <button
                        className={`w-full flex items-start gap-3 pl-4 pr-10 py-3.5 text-left transition-all hover:bg-muted/40 active:bg-muted/60 min-h-[56px] border-l-2 ${
                          !n.read
                            ? "bg-primary/[0.06] dark:bg-primary/[0.10] border-primary"
                            : "border-transparent"
                        }`}
                        onClick={() => {
                          if (!n.read) onMarkRead(n.id);
                          onClose();
                          onNavigate?.(n);
                        }}
                        data-testid={`notification-item-${n.id}`}
                      >
                        {/* Type icon */}
                        <div className={`h-8 w-8 rounded-xl ${bg} flex items-center justify-center shrink-0 mt-0.5`}>
                          <Icon className={`h-3.5 w-3.5 ${color}`} />
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] leading-snug ${
                            !n.read
                              ? "font-semibold text-foreground"
                              : "font-normal text-muted-foreground"
                          }`}>
                            {n.message}
                          </p>
                          <p className="text-[11px] text-muted-foreground/60 mt-1">
                            {formatDistanceToNow(new Date(n.createdAt!), { addSuffix: true })}
                          </p>
                        </div>
                      </button>

                      {/* Per-row mark-as-read hover button */}
                      {!n.read && (
                        <button
                          className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-primary/10 hover:bg-primary/20 text-primary"
                          onClick={e => { e.stopPropagation(); onMarkRead(n.id); }}
                          title="Mark as read"
                          data-testid={`notification-mark-read-${n.id}`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {gi < groups.length - 1 && (
                  <div className="mx-4 my-1 border-t border-border/20" />
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* ── Footer ── */}
      {notifications.length > 0 && (
        <div className="border-t border-border/40 px-4 py-2.5 flex items-center justify-between shrink-0 bg-muted/20">
          <span className="text-xs text-muted-foreground/70">
            {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
          </span>
          {unreadCount === 0 ? (
            <span className="text-xs text-muted-foreground/50 italic">All read ✓</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {unreadCount} unread
            </span>
          )}
        </div>
      )}
    </>
  );
}

function NotificationBellPanel({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /* Bell trigger — shared between drawer and popover */
  const bellTrigger = (
    <button
      className={`relative h-9 w-9 flex items-center justify-center rounded-full transition-all ${
        unreadCount > 0
          ? "text-primary bg-primary/8 hover:bg-primary/15 shadow-sm shadow-primary/20 active:scale-95"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60 active:bg-muted/80"
      }`}
      data-testid="button-notifications"
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center">
          <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-primary opacity-25" />
          <span className="relative min-w-[16px] h-4 px-0.5 rounded-full bg-primary text-[9px] font-bold text-white flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        </span>
      )}
    </button>
  );

  const panelProps = { notifications, unreadCount, onMarkRead, onMarkAllRead, onNavigate, onClose: () => setOpen(false) };

  /* ── MOBILE: Vaul bottom drawer (swipe to dismiss) ── */
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
        <DrawerTrigger asChild>{bellTrigger}</DrawerTrigger>
        <DrawerContent className="p-0 flex flex-col overflow-hidden max-h-[85dvh] rounded-t-2xl border border-border/50">
          <DrawerTitle className="sr-only">Notifications</DrawerTitle>
          <DrawerDescription className="sr-only">Your recent activity notifications</DrawerDescription>
          <NotificationPanelContent {...panelProps} />
        </DrawerContent>
      </Drawer>
    );
  }

  /* ── DESKTOP: Enhanced popover with glass + animation ── */
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{bellTrigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[400px] p-0 rounded-2xl overflow-hidden border border-border/50 shadow-2xl shadow-black/15 flex flex-col max-h-[520px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1 duration-200"
      >
        <NotificationPanelContent {...panelProps} />
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

    let targetPath: string | null = null;
    const detail: { bookingId?: number; notifType?: string; panel?: string } = {};

    if (type === "doctor_on_leave" || type === "doctor_leave_cancelled") {
      targetPath = "/clinic-dashboard";
      detail.panel = "manage-doctors";
    } else if (bookingId) {
      if (isClinicAuthenticated || isAuthenticated) {
        targetPath = "/clinic-dashboard";
        detail.bookingId = bookingId;
        detail.notifType = type;
      } else if (isDoctorAuthenticated) {
        targetPath = "/doctor-dashboard";
        detail.bookingId = bookingId;
        detail.notifType = type;
      }
    }

    if (!targetPath) return;

    if (window.location.pathname === targetPath) {
      // Already on the right page — fire event directly, no URL change
      window.dispatchEvent(new CustomEvent("notif-navigate", { detail }));
    } else {
      // Navigating from a different page — store detail for the dashboard to pick up on mount
      sessionStorage.setItem("pendingNotifNav", JSON.stringify(detail));
      setLocation(targetPath);
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
            <img src="/icons/logo.svg" alt="bookMySlot logo" className="h-8 w-8 object-contain" />
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
