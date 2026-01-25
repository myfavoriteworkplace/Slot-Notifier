import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useClinicAuth } from "@/hooks/use-clinic-auth";
import { useNotifications, useMarkNotificationRead } from "@/hooks/use-notifications";
import { useState, useEffect } from "react";
import { 
  Bell, 
  LogOut, 
  Calendar, 
  CalendarPlus,
  LayoutDashboard,
  Shield,
  Building2,
} from "lucide-react";
import { queryClient, apiRequest, API_BASE_URL } from "@/lib/queryClient";
import { ThemeToggle } from "./ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";

export function Header() {
  const { user, logout, isAuthenticated } = useAuth();
  const { clinic, isAuthenticated: isClinicAuthenticated, logout: clinicLogout } = useClinicAuth();
  const [location] = useLocation();
  const { data: notifications = [] } = useNotifications();
  const { mutate: markRead } = useMarkNotificationRead();
  
  const [healthStatus, setHealthStatus] = useState<{
    backend: boolean | null;
    database: boolean | null;
  }>({ backend: null, database: null });

  useEffect(() => {
    // Persist clinic context for navigation
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
          cache: 'no-store',
          headers: { 'Accept': 'application/json' }
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
      } catch (err) {
        setHealthStatus({ backend: false, database: false });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;
  const isSuperUser = isAuthenticated && user?.role === 'superuser';

  const tabs = [
    ...(isSuperUser ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
    ...(isClinicAuthenticated ? [{ href: "/clinic-dashboard", label: "Dashboard", icon: LayoutDashboard }] : []),
    // Only show Book a Slot and Clinic Portal when NOT logged in as clinic admin
    ...(!isClinicAuthenticated ? [
      { href: location.startsWith("/book/") ? location : (location === "/about" || location === "/clinic-login" ? `/book/${new URLSearchParams(window.location.search).get("clinicId") || (location === "/clinic-login" ? sessionStorage.getItem("lastClinicId") : null)}` : "/book"), label: "Book a Slot", icon: CalendarPlus },
      { href: "/clinic-login", label: "Clinic Portal", icon: Building2 },
    ] : []),
    ...(location.startsWith("/book/") || location === "/about" || location === "/clinic-login" ? (() => {
      const clinicId = location.startsWith("/book/") ? location.split("/").pop() : 
                      (new URLSearchParams(window.location.search).get("clinicId") || (location === "/clinic-login" ? sessionStorage.getItem("lastClinicId") : null));
      return clinicId ? [
        { href: `/about?clinicId=${clinicId}`, label: "About", icon: Building2 }
      ] : [];
    })() : []),
  ];

  const renderAuthButtons = () => {
    // Hide login button if we are in clinic context or login pages
    const hideAuth = location.startsWith("/book/") || 
                    location === "/about" || 
                    location === "/clinic-login" || 
                    location === "/admin";

    if (isAuthenticated) {
      return (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative hover:bg-muted/50 rounded-full" data-testid="button-notifications">
                <Bell className="h-5 w-5 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-accent animate-pulse" />
                )}
              </Button>
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
                  notifications.map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      className={`flex flex-col items-start gap-1 p-4 cursor-pointer focus:bg-muted/50 ${!notification.read ? 'bg-primary/5' : ''}`}
                      onClick={() => !notification.read && markRead(notification.id)}
                    >
                      <p className={`text-sm ${!notification.read ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                        {notification.message}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.createdAt!), { addSuffix: true })}
                      </span>
                    </DropdownMenuItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="hidden sm:flex items-center gap-3 pl-2 border-l ml-2">
            <div className="text-right">
              <p className="text-sm font-medium leading-none">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">{user?.role}</p>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => logout()}
              className="text-muted-foreground hover:text-destructive transition-colors"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </>
      );
    }

    if (isClinicAuthenticated) {
      return (
        <div className="flex items-center gap-2 sm:gap-3 pl-2 border-l ml-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium leading-none max-w-[150px] truncate">{clinic?.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Clinic Admin</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => clinicLogout()}
            className="text-muted-foreground hover:text-destructive transition-colors"
            data-testid="button-clinic-logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    if (!hideAuth) {
      return (
        <Button 
          onClick={() => window.location.href = "/admin"} 
          size="sm"
          className="font-semibold"
          data-testid="button-login"
        >
          Login
        </Button>
      );
    }

    return null;
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-primary hover:opacity-80 transition-opacity" data-testid="link-home">
            <Calendar className="h-6 w-6" />
            <span className="hidden sm:inline">BookMySlot</span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
            {tabs.map((tab) => {
              const isActive = location === tab.href || 
                (tab.href === "/clinic-login" && location === "/clinic-dashboard") ||
                (tab.label === "Book a Slot" && location.startsWith("/book/"));
              const Icon = tab.icon;
              
              return (
                <Link key={tab.href} href={tab.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className={`gap-2 h-9 px-3 sm:px-4 ${isActive ? "" : "text-muted-foreground hover:text-foreground"}`}
                    data-testid={`tab-${tab.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            {renderAuthButtons()}
          </div>
        </div>
      </div>
    </header>
  );
}
