import { useState } from "react";
import { CalendarDays, Clock3, RefreshCw, UserRound } from "lucide-react";
import { useReminders, type ReminderBooking, type ReminderRole } from "@/hooks/use-reminders";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface ReminderControlProps {
  role: ReminderRole;
  onSelectBooking?: (bookingId: number) => void;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function ReminderRow({ booking, onSelect }: { booking: ReminderBooking; onSelect?: (bookingId: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(booking.bookingId)}
      className="w-full min-h-[58px] rounded-lg border border-border/60 bg-background/70 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:pointer-events-none"
      disabled={!onSelect}
      data-testid={`reminder-booking-${booking.bookingId}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{booking.customerName}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5 shrink-0" />
            {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
          Confirmed
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>{booking.localDate}</span>
        {booking.assignedDoctor && (
          <span className="inline-flex items-center gap-1">
            <UserRound className="h-3 w-3" />
            {booking.assignedDoctor}
          </span>
        )}
      </div>
    </button>
  );
}

function ReminderPanelContent({ role, onSelectBooking, close, panelOpen }: ReminderControlProps & { close: () => void; panelOpen: boolean }) {
  const { data, isLoading, isError, error, refetch } = useReminders(role, panelOpen);
  const handleSelect = (bookingId: number) => {
    onSelectBooking?.(bookingId);
    close();
  };
  const groups = [
    { label: "Next 3 Days", items: data?.nextThreeDays ?? [] },
    { label: "Coming Week", items: data?.comingWeek ?? [] },
  ];

  return (
    <div className="flex max-h-[min(560px,85dvh)] flex-col">
      <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CalendarDays className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">Upcoming reminders</p>
          <p className="text-xs text-muted-foreground">{role === "clinic" ? "Your clinic schedule" : "Your assigned appointments"}</p>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-4">
          {isLoading && (
            <div className="space-y-3" data-testid="reminders-loading">
              {[1, 2, 3].map((item) => <Skeleton key={item} className="h-[74px] w-full rounded-lg" />)}
            </div>
          )}
          {isError && (
            <div className="flex flex-col items-center gap-3 py-8 text-center" data-testid="reminders-error">
              <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Unable to load reminders"}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Try again
              </Button>
            </div>
          )}
          {!isLoading && !isError && data?.totalCount === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center" data-testid="reminders-empty">
              <CalendarDays className="h-9 w-9 text-muted-foreground/50" />
              <p className="text-sm font-medium">No upcoming appointments</p>
              <p className="text-xs text-muted-foreground">Your seven-day reminder window is clear.</p>
            </div>
          )}
          {!isLoading && !isError && data?.totalCount !== 0 && groups.map((group) => (
            <section key={group.label}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
                <span className="text-xs text-muted-foreground">{group.items.length}</span>
              </div>
              <div className="space-y-2">
                {group.items.map((booking) => (
                  <ReminderRow key={booking.bookingId} booking={booking} onSelect={handleSelect} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function ReminderControl({ role, onSelectBooking }: ReminderControlProps) {
  const [open, setOpen] = useState(false);
  const { data } = useReminders(role);
  const count = data?.totalCount ?? 0;
  const trigger = (
    <button
      type="button"
      className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-colors ${count > 0 ? "bg-primary/10 text-primary hover:bg-primary/15" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}
      aria-label={count > 0 ? `${count} upcoming reminders` : "Upcoming reminders"}
      data-testid="button-reminders"
    >
      <CalendarDays className="h-4 w-4" />
      {count > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground">{count > 99 ? "99+" : count}</span>}
    </button>
  );

  return (
    <>
      <div className="hidden sm:block">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent align="end" sideOffset={10} className="w-[390px] overflow-hidden rounded-2xl p-0 shadow-2xl">
            <ReminderPanelContent role={role} onSelectBooking={onSelectBooking} close={() => setOpen(false)} panelOpen={open} />
          </PopoverContent>
        </Popover>
      </div>
      <div className="sm:hidden">
        <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
          <DrawerTrigger asChild>{trigger}</DrawerTrigger>
          <DrawerContent className="max-h-[85dvh] overflow-hidden rounded-t-2xl p-0">
            <DrawerTitle className="sr-only">Upcoming reminders</DrawerTitle>
            <DrawerDescription className="sr-only">Upcoming appointment reminders</DrawerDescription>
            <ReminderPanelContent role={role} onSelectBooking={onSelectBooking} close={() => setOpen(false)} panelOpen={open} />
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}