import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications, useMarkNotificationRead } from "@/hooks/use-notifications";
import { 
  Bell, 
  LogOut, 
  Calendar, 
  User as UserIcon,
  LayoutDashboard 
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export function Header() {
  const { user, logout, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const { data: notifications = [] } = useNotifications();
  const { mutate: markRead } = useMarkNotificationRead();

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-primary hover:opacity-80 transition-opacity">
              <Calendar className="h-6 w-6" />
              <span>SlotBooker</span>
            </Link>

            {isAuthenticated && (
              <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
                <Link href="/dashboard" className={location === "/dashboard" ? "text-primary" : "text-muted-foreground hover:text-foreground transition-colors"}>
                  Dashboard
                </Link>
                <Link href="/book" className={location === "/book" ? "text-primary" : "text-muted-foreground hover:text-foreground transition-colors"}>
                  Book a Slot
                </Link>
              </nav>
            )}
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative hover:bg-muted/50 rounded-full">
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

                <div className="flex items-center gap-4 pl-4 border-l">
                  <div className="hidden sm:block text-right">
                    <p className="text-sm font-medium leading-none">{user?.firstName} {user?.lastName}</p>
                    <p className="text-xs text-muted-foreground mt-1 capitalize">{user?.role}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => logout()}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Logout</span>
                  </Button>
                </div>
              </>
            ) : (
              <Button onClick={() => window.location.href = "/api/login"} className="font-semibold shadow-lg shadow-primary/20">
                Login
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
