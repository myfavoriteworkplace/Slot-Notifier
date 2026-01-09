import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications, useMarkNotificationRead } from "@/hooks/use-notifications";
import { 
  Bell, 
  LogOut, 
  Calendar, 
  CalendarPlus,
  LayoutDashboard,
  Shield,
  Building2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

export function Header() {
  const { user, logout, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const { data: notifications = [] } = useNotifications();
  const { mutate: markRead } = useMarkNotificationRead();

  const unreadCount = notifications.filter(n => !n.read).length;

  const tabs = [
    { href: "/book", label: "Book a Slot", icon: CalendarPlus },
    { href: "/admin", label: "Admin", icon: Shield },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/clinic-login", label: "Clinic Portal", icon: Building2 },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-primary hover:opacity-80 transition-opacity" data-testid="link-home">
            <Calendar className="h-6 w-6" />
            <span className="hidden sm:inline">SlotBooker</span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
            {tabs.map((tab) => {
              const isActive = location === tab.href || 
                (tab.href === "/clinic-login" && location === "/clinic-dashboard");
              const Icon = tab.icon;
              
              return (
                <Link key={tab.href} href={tab.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className={`gap-2 ${isActive ? "" : "text-muted-foreground hover:text-foreground"}`}
                    data-testid={`tab-${tab.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden md:inline">{tab.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
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
            )}
            
            {!isAuthenticated && (
              <Button 
                onClick={() => window.location.href = "/api/login"} 
                size="sm"
                className="font-semibold"
                data-testid="button-login"
              >
                Login
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
