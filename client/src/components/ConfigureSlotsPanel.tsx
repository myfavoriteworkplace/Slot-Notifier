import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { useClinicAuth } from "@/hooks/use-clinic-auth";
import {
  Loader2, Clock, CalendarDays, Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  X, Save, Sun, Info, ChevronDown, ChevronUp, AlertTriangle,
} from "lucide-react";
import {
  DayConfig, DEFAULT_SLOT_TIMINGS, DEFAULT_SECTION_CAPACITY, BookingWithSlot,
} from "@/lib/clinic-constants";
import {
  Dialog, DialogContent, DialogDescription, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  format, startOfDay, startOfToday, addDays, isSameDay,
  differenceInCalendarDays, startOfWeek, isAfter,
} from "date-fns";

interface Props {
  clinic: any;
  bookings?: BookingWithSlot[];
}

const slotTimings = DEFAULT_SLOT_TIMINGS;

function formatTime(hour: number, minute: number): string {
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, "0");
  return `${h}:${m} ${hour < 12 ? "AM" : "PM"}`;
}

export default function ConfigureSlotsPanel({ clinic, bookings }: Props) {
  const { isAuthenticated } = useClinicAuth();

  const [configDate, setConfigDate] = useState<Date>(startOfToday());
  const [dayConfigCache, setDayConfigCache] = useState<Record<string, DayConfig>>({});
  const [calendarWeekStart, setCalendarWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isBulkApplying, setIsBulkApplying] = useState(false);
  const [pendingBulkAction, setPendingBulkAction] = useState<'future-days' | 'sundays-this-month' | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showSaveRangeConfirm, setShowSaveRangeConfirm] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState<Date | null>(startOfToday());
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);

  const { data: savedSlotConfigs } = useQuery<{ startTime: string; maxBookings: number; isCancelled: boolean }[]>({
    queryKey: ['/api/auth/clinic/slots/configs'],
    queryFn: async () => {
      const from = format(addDays(startOfToday(), -1), 'yyyy-MM-dd');
      const to = format(addDays(startOfToday(), 31), 'yyyy-MM-dd');
      const res = await apiRequest('GET', `/api/auth/clinic/slots/configs?from=${from}&to=${to}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: defaultConfigData } = useQuery<{ defaultSlotConfig: object | null }>({
    queryKey: ['/api/auth/clinic/default-config'],
    enabled: isAuthenticated,
  });
  const hasDefaultConfig = !!defaultConfigData?.defaultSlotConfig;

  useEffect(() => {
    if (!savedSlotConfigs?.length) return;
    const newEntries: Record<string, { isClosed: boolean; sections: Record<string, { maxBookings: number; isCancelled: boolean }> }> = {};
    for (const slot of savedSlotConfigs) {
      const dt = new Date(slot.startTime);
      const dateStr = format(dt, 'yyyy-MM-dd');
      const matchedTiming = DEFAULT_SLOT_TIMINGS.find(st =>
        st.startHour === dt.getHours() && st.startMinute === dt.getMinutes()
      );
      if (!matchedTiming) continue;
      if (!newEntries[dateStr]) newEntries[dateStr] = { isClosed: dt.getDay() === 0, sections: {} };
      newEntries[dateStr].sections[matchedTiming.id] = { maxBookings: slot.maxBookings, isCancelled: slot.isCancelled };
    }
    for (const [dateStr, cfg] of Object.entries(newEntries)) {
      const allCancelled = Object.values(cfg.sections).length === DEFAULT_SLOT_TIMINGS.length &&
        Object.values(cfg.sections).every(s => s.isCancelled);
      if (allCancelled) newEntries[dateStr].isClosed = true;
    }
    setDayConfigCache(prev => ({ ...newEntries, ...prev }));
  }, [savedSlotConfigs]);

  const getDefaultSectionsForDate = (date: Date) => Object.fromEntries(
    slotTimings.map(s => {
      const slotTime = new Date(date);
      slotTime.setHours(s.startHour, s.startMinute, 0, 0);
      const isoStr = slotTime.toISOString();
      const match = bookings?.find(b => new Date(b.slot.startTime).toISOString() === isoStr);
      return [s.id, {
        maxBookings: match?.slot.maxBookings ?? DEFAULT_SECTION_CAPACITY[s.id] ?? 3,
        isCancelled: match?.slot.isCancelled ?? false,
      }];
    })
  );

  const getConfigForDate = (date: Date): DayConfig => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return dayConfigCache[dateStr] ?? {
      isClosed: date.getDay() === 0,
      sections: getDefaultSectionsForDate(date),
    };
  };

  const updateDayClosedState = (date: Date, isClosed: boolean) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setDayConfigCache(prev => {
      const existing = prev[dateStr] ?? { isClosed: date.getDay() === 0, sections: getDefaultSectionsForDate(date) };
      return { ...prev, [dateStr]: { ...existing, isClosed } };
    });
  };

  const updateSectionCapacity = (date: Date, slotId: string, value: number) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setDayConfigCache(prev => {
      const existing = prev[dateStr] ?? { isClosed: date.getDay() === 0, sections: getDefaultSectionsForDate(date) };
      return {
        ...prev,
        [dateStr]: {
          ...existing,
          sections: {
            ...existing.sections,
            [slotId]: { ...(existing.sections[slotId] ?? { maxBookings: DEFAULT_SECTION_CAPACITY[slotId] ?? 3, isCancelled: false }), maxBookings: value }
          }
        }
      };
    });
  };

  const updateSectionCancelled = (date: Date, slotId: string, isCancelled: boolean) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setDayConfigCache(prev => {
      const existing = prev[dateStr] ?? { isClosed: date.getDay() === 0, sections: getDefaultSectionsForDate(date) };
      return {
        ...prev,
        [dateStr]: {
          ...existing,
          sections: {
            ...existing.sections,
            [slotId]: { ...(existing.sections[slotId] ?? { maxBookings: DEFAULT_SECTION_CAPACITY[slotId] ?? 3, isCancelled: false }), isCancelled }
          }
        }
      };
    });
  };

  const getDatesInRange = (start: Date, end: Date): Date[] => {
    const dates: Date[] = [];
    let cur = startOfDay(start);
    const last = startOfDay(end);
    while (cur <= last) { dates.push(new Date(cur)); cur = addDays(cur, 1); }
    return dates;
  };

  const getActiveDates = (): Date[] =>
    rangeStart && rangeEnd ? getDatesInRange(rangeStart, rangeEnd) : [configDate];

  const handleSlotDateClick = (day: Date) => {
    setConfigDate(day);
    setRangeStart(day);
    setRangeEnd(null);
  };

  const isDateInSelection = (day: Date): boolean => {
    if (!rangeStart) return isSameDay(day, configDate);
    if (!rangeEnd) return isSameDay(day, rangeStart);
    const d = startOfDay(day);
    return d >= startOfDay(rangeStart) && d <= startOfDay(rangeEnd);
  };

  const saveDayConfiguration = async () => {
    if (!clinic) return;
    setIsSavingConfig(true);
    try {
      const datesToSave = rangeStart && rangeEnd
        ? getDatesInRange(rangeStart, rangeEnd)
        : [configDate];
      const cfg = getConfigForDate(configDate);
      const slotsPayload = datesToSave.flatMap(date =>
        slotTimings.map(slot => {
          const startTime = new Date(date);
          startTime.setHours(slot.startHour, slot.startMinute, 0, 0);
          const secCfg = cfg.sections[slot.id] ?? { maxBookings: DEFAULT_SECTION_CAPACITY[slot.id] ?? 3, isCancelled: false };
          return { startTime: startTime.toISOString(), maxBookings: secCfg.maxBookings, isCancelled: cfg.isClosed || secCfg.isCancelled };
        })
      );
      const response = await apiRequest('POST', '/api/auth/clinic/slots/configure-bulk', { slots: slotsPayload });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to save slot');
      }
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/slots/configs'] });
      const label = rangeStart && rangeEnd
        ? `Range ${format(rangeStart, 'd MMM')} – ${format(rangeEnd, 'd MMM')} saved`
        : `${format(configDate, 'd MMM')} configuration saved`;
      notify.success(label);
    } catch (e: any) {
      notify.apiError(e, "Failed to save configuration");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const applyBulkConfig = async (type: 'future-days' | 'sundays-this-month') => {
    if (!clinic) return;
    setIsBulkApplying(true);
    try {
      const sourceCfg = getConfigForDate(configDate);
      const today = startOfToday();

      if (type === 'future-days') {
        const response = await apiRequest('PATCH', '/api/auth/clinic/default-config', {
          isClosed: sourceCfg.isClosed,
          sections: sourceCfg.sections,
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to save default config');
        }
        queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/default-config'] });
        notify.success('Default schedule saved — applies to all future dates automatically');
        return;
      }

      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const targetDates = getDatesInRange(monthStart, monthEnd).filter(d => d.getDay() === 0);
      setDayConfigCache(prev => {
        const updates: Record<string, typeof sourceCfg> = {};
        for (const date of targetDates) updates[format(date, 'yyyy-MM-dd')] = { ...sourceCfg };
        return { ...prev, ...updates };
      });
      const slotsPayload = targetDates.flatMap(date =>
        slotTimings.map(slot => {
          const startTime = new Date(date);
          startTime.setHours(slot.startHour, slot.startMinute, 0, 0);
          const secCfg = sourceCfg.sections[slot.id] ?? { maxBookings: DEFAULT_SECTION_CAPACITY[slot.id] ?? 3, isCancelled: false };
          return { startTime: startTime.toISOString(), maxBookings: secCfg.maxBookings, isCancelled: sourceCfg.isClosed || secCfg.isCancelled };
        })
      );
      const response = await apiRequest('POST', '/api/auth/clinic/slots/configure-bulk', { slots: slotsPayload });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to apply bulk config');
      }
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/slots/configs'] });
      notify.success(`Applied to all Sundays in ${format(today, 'MMMM yyyy')}`);
    } catch (e: any) {
      notify.apiError(e, "Failed to apply bulk configuration");
    } finally {
      setIsBulkApplying(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
      <div className="flex border-b border-border/40">
        <div className="w-1.5 bg-blue-500/60 shrink-0" />
        <div className="flex-1 px-5 py-4 bg-gradient-to-r from-blue-500/[0.06] to-transparent flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Clock className="h-[18px] w-[18px] text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight">Configure Slots</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Set capacity per slot, close days, and apply bulk schedules</p>
          </div>
        </div>
      </div>
      {defaultConfigData !== undefined && !hasDefaultConfig && (
        <div className="flex items-start gap-3 px-5 py-3.5 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/25">
          <div className="h-7 w-7 rounded-lg bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 leading-tight">No default schedule set</p>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5 leading-relaxed">
              Your booking page currently shows only <span className="font-semibold">3 slots</span> per session as a fallback. Configure your capacity below, then click <span className="font-semibold">All Future Days</span> to apply it as your clinic's default.
            </p>
          </div>
        </div>
      )}
      <div className="p-3 sm:p-5">
        <div className="flex flex-col lg:flex-row gap-5 lg:items-start">

          {/* LEFT: Grid & Selection */}
          <div className="w-full flex-1 min-w-0 space-y-3 sm:space-y-4">

            {/* Date Range Selection */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date range</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
                {/* Start Date */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">From</span>
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline" size="sm"
                        className="h-11 gap-2 text-sm font-normal w-full sm:min-w-[155px] justify-start"
                        data-testid="button-start-date"
                      >
                        <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        {rangeStart ? format(rangeStart, 'd MMM yyyy') : <span className="text-muted-foreground">Start date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={rangeStart ?? undefined}
                        onSelect={(day) => {
                          if (!day) return;
                          setRangeStart(day);
                          setConfigDate(day);
                          if (rangeEnd && day > rangeEnd) setRangeEnd(null);
                          setDatePickerOpen(false);
                        }}
                        disabled={{ before: startOfToday() }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <ChevronRight className="h-4 w-4 text-muted-foreground mb-2 hidden sm:block shrink-0" />

                {/* End Date */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">To <span className="normal-case font-normal">(optional)</span></span>
                  <div className="flex items-center gap-1">
                    <Popover open={endDatePickerOpen} onOpenChange={setEndDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline" size="sm"
                          className={`h-11 gap-2 text-sm font-normal w-full sm:min-w-[155px] justify-start ${rangeEnd ? 'text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-500/5' : ''}`}
                          data-testid="button-end-date"
                        >
                          <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                          {rangeEnd ? format(rangeEnd, 'd MMM yyyy') : <span className="text-muted-foreground">End date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={rangeEnd ?? undefined}
                          onSelect={(day) => {
                            if (!day) return;
                            setRangeEnd(day);
                            setEndDatePickerOpen(false);
                          }}
                          disabled={{ before: rangeStart ?? startOfToday() }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {rangeEnd && (
                      <button
                        onClick={() => setRangeEnd(null)}
                        className="h-11 w-11 flex items-center justify-center rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50 active:scale-95 transition-all"
                        data-testid="button-clear-end-date"
                        aria-label="Clear end date"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Range badge */}
                {rangeStart && rangeEnd && (
                  <div className="col-span-2 sm:col-span-1 mb-0.5 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 sm:self-end">
                    <CalendarDays className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {differenceInCalendarDays(rangeEnd, rangeStart) + 1} days selected
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Week Navigation */}
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => setCalendarWeekStart(prev => addDays(prev, -7))}
                className="h-11 w-11 p-0 shrink-0"
                disabled={!isAfter(calendarWeekStart, startOfWeek(startOfToday(), { weekStartsOn: 1 }))}
                data-testid="button-prev-week"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-0 text-sm font-semibold text-center tabular-nums flex flex-col items-center leading-tight">
                <span className="text-xs font-normal text-muted-foreground uppercase tracking-wide">Viewing week</span>
                <span className="truncate w-full text-center">{format(calendarWeekStart, "d MMM")} – {format(addDays(calendarWeekStart, 6), "d MMM yyyy")}</span>
              </span>
              <Button
                variant="outline" size="sm"
                onClick={() => setCalendarWeekStart(prev => addDays(prev, 7))}
                className="h-11 w-11 p-0 shrink-0"
                data-testid="button-next-week"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Grid legend */}
            <div className="flex items-center justify-between gap-3 px-1 py-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                  <span className="h-2.5 w-2.5 rounded-sm bg-blue-500/30 border border-blue-400/60 inline-block" />
                  Selected
                </span>
                <span className="flex items-center gap-1 text-xs font-medium text-rose-500">
                  <span className="h-2.5 w-2.5 rounded-sm bg-rose-500/20 border border-rose-400/40 inline-block" />
                  Closed
                </span>
                <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded text-xs font-bold bg-muted border border-border/60 text-foreground leading-none">3</span>
                  max bookings
                </span>
                <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground/50">
                  <span className="h-2.5 w-2.5 rounded-sm bg-muted/60 border border-border/30 inline-block" />
                  Past — locked
                </span>
              </div>
              <span className="hidden sm:block text-xs font-medium text-primary/70 whitespace-nowrap shrink-0">Click a date header below to configure, then Save to apply</span>
            </div>

            {/* Calendar Grid */}
            {(() => {
              const weekDays = Array.from({ length: 7 }, (_, i) => addDays(calendarWeekStart, i));
              return (
                <div className="w-full overflow-x-auto rounded-xl border border-border/40">
                  <div className="min-w-[580px]">
                    {/* Day header row */}
                    <div className="grid border-b-2 border-border/60 bg-muted/60" style={{ gridTemplateColumns: '100px repeat(7, 1fr)' }}>
                      <div className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-r border-border/40 flex items-center">Slots</div>
                      {weekDays.map((day, i) => {
                        const isSun = day.getDay() === 0;
                        const isSat = day.getDay() === 6;
                        const isToday = isSameDay(day, new Date());
                        const isPast = !isToday && startOfDay(day) < startOfToday();
                        const isSelected = !isPast && isDateInSelection(day);
                        const isEdge = !isPast && (isSameDay(day, rangeStart ?? configDate) || (rangeEnd !== null && isSameDay(day, rangeEnd)));
                        const dayCfg = getConfigForDate(day);
                        return (
                          <button
                            key={i}
                            onClick={isPast ? undefined : () => handleSlotDateClick(day)}
                            disabled={isPast}
                            data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                            className={`relative px-1 py-2.5 text-center border-l border-border/40 transition-all ${
                              isPast
                                ? 'opacity-40 cursor-not-allowed bg-muted/40'
                                : isEdge
                                ? 'bg-blue-500/30 ring-1 ring-inset ring-blue-400/60'
                                : isSelected
                                ? 'bg-blue-500/15'
                                : 'hover:bg-primary/5 cursor-pointer'
                            }`}
                          >
                            {!isPast && (isEdge || isSelected) && (
                              <div className="absolute top-0 left-0 right-0 h-[3px] bg-blue-500/70 rounded-b-sm" />
                            )}
                            <div className={`text-xs uppercase tracking-wide font-bold ${
                              isPast ? 'text-muted-foreground/40' : isSun || isSat ? 'text-rose-500' : isToday ? 'text-primary' : 'text-foreground/70'
                            }`}>{format(day, 'EEE')}</div>
                            <div className={`text-base font-black mt-0.5 leading-none ${
                              isPast
                                ? 'text-muted-foreground/40'
                                : isToday
                                ? 'h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto text-[13px] font-bold'
                                : isSun || isSat ? 'text-rose-500' : 'text-foreground'
                            }`}>
                              {format(day, 'd')}
                            </div>
                            {!isPast && dayCfg.isClosed && (
                              <div className="text-xs font-bold uppercase text-rose-500 mt-0.5 leading-none">closed</div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Section rows */}
                    {slotTimings.map((slot) => (
                      <div
                        key={slot.id}
                        className="grid border-b border-border/20 last:border-0"
                        style={{ gridTemplateColumns: '100px repeat(7, 1fr)' }}
                      >
                        <div className="px-3 py-2.5 bg-muted/10 border-r border-border/20 flex flex-col justify-center">
                          <span className="text-xs font-semibold leading-tight">{slot.label}</span>
                          <span className="text-xs text-muted-foreground leading-tight mt-0.5">
                            {formatTime(slot.startHour, slot.startMinute)}–{formatTime(slot.endHour, slot.endMinute)}
                          </span>
                        </div>
                        {weekDays.map((day, di) => {
                          const cfg = getConfigForDate(day);
                          const secCfg = cfg.sections[slot.id] ?? { maxBookings: DEFAULT_SECTION_CAPACITY[slot.id] ?? 3, isCancelled: false };
                          const isClosed = cfg.isClosed || secCfg.isCancelled;
                          const isSelected = isDateInSelection(day);
                          const isToday = isSameDay(day, new Date());
                          const isPast = !isToday && startOfDay(day) < startOfToday();
                          return (
                            <button
                              key={di}
                              onClick={isPast ? undefined : () => handleSlotDateClick(day)}
                              disabled={isPast}
                              className={`px-1 py-2 border-l border-border/20 flex flex-col items-center justify-center min-h-[44px] transition-all ${
                                isPast
                                  ? 'opacity-35 cursor-not-allowed bg-muted/20'
                                  : isSelected ? 'bg-blue-500/15 active:bg-blue-500/25' : isToday ? 'bg-primary/5 active:bg-primary/10' : 'hover:bg-muted/25 active:bg-muted/40'
                              }`}
                            >
                              {isClosed ? (
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full leading-none ${
                                  isPast
                                    ? 'text-muted-foreground/60 bg-muted border border-border/30'
                                    : 'text-rose-500 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25'
                                }`}>Closed</span>
                              ) : (
                                <>
                                  <span className={`text-sm font-bold leading-none ${isPast ? 'text-muted-foreground/50' : 'text-foreground'}`}>{secCfg.maxBookings}</span>
                                  <span className="text-xs text-muted-foreground mt-0.5 leading-none">slots</span>
                                </>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Close Bookings for Selected Date(s) */}
            {(() => {
              const cbCfg = getConfigForDate(configDate);
              return (
                <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  cbCfg.isClosed
                    ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30'
                    : 'bg-muted/20 border-border/40'
                }`}>
                  <Switch
                    checked={cbCfg.isClosed}
                    onCheckedChange={(val) => getActiveDates().forEach(d => updateDayClosedState(d, val))}
                    data-testid="toggle-day-closed"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold leading-tight">Close Bookings for Selected Date(s)</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Prevents patients from booking any slot on the selected date(s)</p>
                  </div>
                  {cbCfg.isClosed && <Badge className="text-xs bg-rose-500 text-white border-0 shrink-0">Closed</Badge>}
                </div>
              );
            })()}

          </div>{/* end left col */}

          {/* RIGHT: Day Editor */}
          <div className="w-full lg:w-72 shrink-0">
            <div className="sticky top-[70px]">

              {/* Day Editor */}
              {(() => {
                const cfg = getConfigForDate(configDate);
                const isSunday = configDate.getDay() === 0;
                return (
                  <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
                    {/* Header band */}
                    <div className={`px-4 py-3 border-b transition-colors ${
                      cfg.isClosed
                        ? 'bg-gradient-to-r from-rose-500/[0.08] to-transparent border-rose-200/50 dark:border-rose-500/20'
                        : 'bg-gradient-to-r from-blue-500/[0.08] to-transparent border-blue-200/40 dark:border-blue-500/25'
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold leading-tight">
                            {rangeStart && rangeEnd
                              ? `${format(rangeStart, 'EEE d MMM')} – ${format(rangeEnd, 'EEE d MMM yyyy')}`
                              : format(configDate, 'EEEE, d MMMM yyyy')}
                          </p>
                        </div>
                        {isSunday && (
                          <Badge variant="outline" className="text-xs border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 shrink-0">
                            Sunday
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      {/* Slots configuration */}
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs font-bold text-foreground leading-tight">Slots configuration</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Adjust values below, then click Save to apply</p>
                          <p className="text-xs text-primary/70 mt-1 font-medium">1 slot ≈ 25 min (20 min treatment + 5 min buffer)</p>
                        </div>
                        {cfg.isClosed ? (
                          <div className="py-4 px-3 text-center rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10">
                            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 leading-relaxed">All bookings closed for selected date(s)</p>
                            <p className="text-xs text-rose-500/70 mt-1">Toggle "Close Bookings" below the grid to re-enable slots</p>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center px-3 pb-0.5">
                              <div className="flex-1" />
                              <span className="w-12 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Max</span>
                              <span className="w-10 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Close</span>
                            </div>
                            {slotTimings.map((slot) => {
                              const secCfg = cfg.sections[slot.id] ?? { maxBookings: DEFAULT_SECTION_CAPACITY[slot.id] ?? 3, isCancelled: false };
                              return (
                                <div
                                  key={slot.id}
                                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                                    secCfg.isCancelled
                                      ? 'bg-muted/20 border-border/20 opacity-60'
                                      : 'bg-background border-border/40 hover:border-blue-300/50 dark:hover:border-blue-500/30'
                                  }`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold leading-tight truncate">{slot.label}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{formatTime(slot.startHour, slot.startMinute)}–{formatTime(slot.endHour, slot.endMinute)}</p>
                                  </div>
                                  <div className="flex items-center shrink-0">
                                    <Input
                                      type="number"
                                      min={0}
                                      max={30}
                                      value={secCfg.maxBookings}
                                      onChange={(e) => { const v = parseInt(e.target.value) || 0; getActiveDates().forEach(d => updateSectionCapacity(d, slot.id, v)); }}
                                      className="w-12 min-h-[44px] text-center text-sm px-1 font-semibold"
                                      inputMode="numeric"
                                      onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                      disabled={secCfg.isCancelled}
                                      data-testid={`input-capacity-${slot.id}`}
                                    />
                                  </div>
                                  <div className="flex items-center justify-center w-10 shrink-0 border-l border-border/30">
                                    <Switch
                                      checked={secCfg.isCancelled}
                                      onCheckedChange={(val) => getActiveDates().forEach(d => updateSectionCancelled(d, slot.id, val))}
                                      className="scale-[0.80] data-[state=checked]:bg-rose-500"
                                      data-testid={`switch-close-${slot.id}`}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>

                      {/* Save Button */}
                      <Button
                        className="w-full h-11 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white border-0 shadow-md shadow-blue-500/20 dark:bg-blue-500 dark:hover:bg-blue-600 transition-all"
                        onClick={() => rangeStart && rangeEnd ? setShowSaveRangeConfirm(true) : saveDayConfiguration()}
                        disabled={isSavingConfig}
                        data-testid="button-save-day-config"
                      >
                        {isSavingConfig ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
                        ) : (
                          <><Save className="h-4 w-4 mr-2" /> Save Slot Configuration</>
                        )}
                      </Button>

                      {/* Apply to */}
                      <div className="border-t border-border/30 pt-3 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                          Apply to <ChevronRight className="h-3.5 w-3.5 inline-block" />
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setPendingBulkAction('future-days')}
                            disabled={isBulkApplying}
                            className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl border-2 border-primary/30 bg-primary/[0.04] hover:bg-primary/[0.10] hover:border-primary/50 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            data-testid="button-apply-all-future"
                          >
                            {isBulkApplying
                              ? <Loader2 className="h-4 w-4 text-primary animate-spin" />
                              : <CalendarDays className="h-4 w-4 text-primary" />}
                            <span className="text-xs font-bold text-primary text-center leading-tight">All Future Days</span>
                            <span className="text-xs text-primary/60 text-center leading-tight">Default for all dates</span>
                          </button>
                          <button
                            onClick={() => setPendingBulkAction('sundays-this-month')}
                            disabled={isBulkApplying}
                            className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl border-2 border-amber-500/30 bg-amber-50/40 dark:bg-amber-500/[0.04] hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:border-amber-500/50 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            data-testid="button-apply-sundays"
                          >
                            {isBulkApplying
                              ? <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                              : <Sun className="h-4 w-4 text-amber-500" />}
                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 text-center leading-tight">All Sundays</span>
                            <span className="text-xs text-amber-600/60 dark:text-amber-400/60 text-center leading-tight">This month</span>
                          </button>
                        </div>
                      </div>

                      {/* How it works */}
                      <div className="rounded-xl border border-border/40 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setShowHowItWorks(h => !h)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30 active:bg-muted/50 transition-colors"
                          data-testid="button-toggle-how-it-works"
                        >
                          <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs font-semibold text-muted-foreground flex-1">How to configure slots</span>
                          {showHowItWorks
                            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                        </button>
                        {showHowItWorks && (
                          <div className="px-4 pb-4 pt-2.5 grid grid-cols-1 gap-y-2.5 border-t border-border/30 bg-muted/10">
                            {([
                              { icon: "📅", node: <>Tap any column in the grid above to load that day's config here.</> },
                              { icon: "↔️", node: <>For a date range: use the <strong className="text-foreground">From</strong> and <strong className="text-foreground">To</strong> pickers above the grid.</> },
                              { icon: "🔴", node: <><strong className="text-foreground font-bold">Close Bookings</strong> blocks all slots on the selected date(s).</> },
                              { icon: "🔢", node: <>Adjust <strong className="text-foreground">Max</strong> to control how many patients can book each session.</> },
                              { icon: "🔕", node: <>The <strong className="text-foreground">Close</strong> switch cancels a single session without closing the whole day.</> },
                              { icon: "💾", node: <><strong className="text-foreground">Save</strong> writes the config to the selected date(s).</> },
                              { icon: "📋", node: <><strong className="text-primary font-bold">All Future Days</strong> sets this as your clinic's default schedule.</> },
                              { icon: "☀️", node: <><strong className="text-amber-600 dark:text-amber-400 font-bold">All Sundays</strong> writes this config to every Sunday this month.</> },
                            ] as { icon: string; node: ReactNode }[]).map(({ icon, node }, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <span className="text-sm shrink-0 leading-5 mt-0.5">{icon}</span>
                                <p className="text-xs text-muted-foreground leading-relaxed">{node}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Bulk Apply Confirmation Dialog */}
                      {(() => {
                        const today = new Date();
                        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                        const monthEnd   = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                        const sundaysThisMonth = getDatesInRange(monthStart, monthEnd).filter((d: Date) => d.getDay() === 0);
                        const isDefaultAction  = pendingBulkAction === 'future-days';

                        return (
                          <Dialog open={!!pendingBulkAction} onOpenChange={(open) => { if (!open) setPendingBulkAction(null); }}>
                            <DialogContent className="w-[95vw] max-w-md rounded-2xl p-0 overflow-hidden gap-0">
                              <div className={`px-5 pt-5 pb-4 border-b border-border/40 ${cfg.isClosed ? 'bg-rose-50/60 dark:bg-rose-500/10' : 'bg-primary/[0.03]'}`}>
                                <DialogTitle className="text-base font-bold leading-tight">
                                  {isDefaultAction ? 'Apply to All Future Days?' : `Apply to All Sundays in ${format(today, 'MMMM yyyy')}?`}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground mt-1">
                                  {isDefaultAction
                                    ? "This updates your clinic's default template for future dates."
                                    : `This overwrites slot config for every Sunday in ${format(today, 'MMMM yyyy')}.`}
                                </DialogDescription>
                              </div>

                              <div className="px-5 py-4 space-y-3">
                                <div className={`rounded-xl border p-3 space-y-1.5 ${
                                  cfg.isClosed
                                    ? 'border-rose-300/60 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10'
                                    : 'border-primary/25 bg-primary/[0.04]'
                                }`}>
                                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What will be applied</p>
                                  {cfg.isClosed ? (
                                    <div className="flex items-center gap-2">
                                      <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                                      <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">Day Closed — no bookings accepted</p>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                                        <p className="text-sm font-semibold text-primary">Day Open — bookings accepted</p>
                                      </div>
                                      {slotTimings.map(slot => {
                                        const secCfg = cfg.sections[slot.id] ?? { maxBookings: 3, isCancelled: false };
                                        return (
                                          <p key={slot.id} className="text-xs text-muted-foreground pl-4">
                                            {secCfg.isCancelled
                                              ? `${slot.label}: Closed`
                                              : `${slot.label}: up to ${secCfg.maxBookings} slot${secCfg.maxBookings !== 1 ? 's' : ''} (≈${secCfg.maxBookings * 25} min)`}
                                          </p>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2">
                                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Applies to</p>
                                  {isDefaultAction ? (
                                    <p className="text-sm text-foreground leading-relaxed">
                                      All future dates that <span className="font-semibold">haven't been individually configured</span>. Dates you've already saved separately will not be changed.
                                    </p>
                                  ) : (
                                    <div className="space-y-1.5">
                                      <p className="text-sm text-foreground">
                                        {sundaysThisMonth.length} Sunday{sundaysThisMonth.length !== 1 ? 's' : ''} in {format(today, 'MMMM yyyy')}:
                                      </p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {sundaysThisMonth.map(d => (
                                          <span key={d.toISOString()} className="text-xs font-medium bg-background border border-border/60 px-2 py-0.5 rounded-full">
                                            {format(d, 'EEE d MMM')}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-start gap-2 px-0.5">
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                                  <p className="text-xs text-muted-foreground">
                                    Bookings already confirmed on those dates will <span className="font-semibold">not</span> be cancelled automatically.
                                  </p>
                                </div>
                              </div>

                              <div className="px-5 pb-5 flex gap-2.5">
                                <Button
                                  variant="outline"
                                  onClick={() => setPendingBulkAction(null)}
                                  className="flex-1"
                                  data-testid="button-bulk-cancel"
                                >
                                  Go Back
                                </Button>
                                <Button
                                  onClick={() => { if (pendingBulkAction) { applyBulkConfig(pendingBulkAction); setPendingBulkAction(null); } }}
                                  disabled={isBulkApplying}
                                  className={`flex-1 border-0 shadow-sm ${
                                    cfg.isClosed
                                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20'
                                      : 'bg-primary hover:bg-primary/90 text-white shadow-primary/20'
                                  }`}
                                  data-testid="button-bulk-confirm"
                                >
                                  {isBulkApplying
                                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Applying…</>
                                    : isDefaultAction
                                      ? 'Yes, Set as Default'
                                      : `Yes, Apply to ${sundaysThisMonth.length} Sunday${sundaysThisMonth.length !== 1 ? 's' : ''}`}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        );
                      })()}

                      {/* Save Range Confirmation Dialog */}
                      {(() => {
                        if (!rangeStart || !rangeEnd) return null;
                        const rangeDays = getDatesInRange(rangeStart, rangeEnd);
                        const n = rangeDays.length;
                        return (
                          <Dialog open={showSaveRangeConfirm} onOpenChange={(open) => { if (!open) setShowSaveRangeConfirm(false); }}>
                            <DialogContent className="w-[95vw] max-w-md rounded-2xl p-0 overflow-hidden gap-0">
                              <div className={`px-5 pt-5 pb-4 border-b border-border/40 ${cfg.isClosed ? 'bg-rose-50/60 dark:bg-rose-500/10' : 'bg-blue-50/60 dark:bg-blue-500/10'}`}>
                                <DialogTitle className="text-base font-bold leading-tight">
                                  Save Range — {format(rangeStart, 'd MMM')} to {format(rangeEnd, 'd MMM yyyy')}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground mt-1">
                                  This will overwrite slot configuration for {n} day{n !== 1 ? 's' : ''}. Review what will be saved.
                                </DialogDescription>
                              </div>

                              <div className="px-5 py-4 space-y-3">
                                <div className={`rounded-xl border p-3 space-y-1.5 ${
                                  cfg.isClosed
                                    ? 'border-rose-300/60 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10'
                                    : 'border-blue-300/40 dark:border-blue-500/20 bg-blue-50/40 dark:bg-blue-500/[0.04]'
                                }`}>
                                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What will be saved to each day</p>
                                  {cfg.isClosed ? (
                                    <div className="flex items-center gap-2">
                                      <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                                      <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">Day Closed — no bookings accepted</p>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                                        <p className="text-sm font-semibold text-primary">Day Open — bookings accepted</p>
                                      </div>
                                      {slotTimings.map(slot => {
                                        const secCfg = cfg.sections[slot.id] ?? { maxBookings: 3, isCancelled: false };
                                        return (
                                          <p key={slot.id} className="text-xs text-muted-foreground pl-4">
                                            {secCfg.isCancelled
                                              ? `${slot.label}: Closed`
                                              : `${slot.label}: up to ${secCfg.maxBookings} slot${secCfg.maxBookings !== 1 ? 's' : ''} (≈${secCfg.maxBookings * 25} min)`}
                                          </p>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2">
                                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Applies to {n} day{n !== 1 ? 's' : ''}
                                  </p>
                                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                                    {rangeDays.map(d => (
                                      <span key={d.toISOString()} className={`text-xs font-medium border px-2 py-0.5 rounded-full ${
                                        d.getDay() === 0 || d.getDay() === 6
                                          ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/25 text-rose-600 dark:text-rose-400'
                                          : 'bg-background border-border/60'
                                      }`}>
                                        {format(d, 'EEE d MMM')}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                <div className="flex items-start gap-2 px-0.5">
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                                  <p className="text-xs text-muted-foreground">
                                    Bookings already confirmed on those dates will <span className="font-semibold">not</span> be cancelled automatically.
                                  </p>
                                </div>
                              </div>

                              <div className="px-5 pb-5 flex gap-2.5">
                                <Button
                                  variant="outline"
                                  onClick={() => setShowSaveRangeConfirm(false)}
                                  className="flex-1"
                                  data-testid="button-save-range-cancel"
                                >
                                  Go Back
                                </Button>
                                <Button
                                  onClick={() => { setShowSaveRangeConfirm(false); saveDayConfiguration(); }}
                                  disabled={isSavingConfig}
                                  className={`flex-1 border-0 shadow-sm ${
                                    cfg.isClosed
                                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20'
                                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                                  }`}
                                  data-testid="button-save-range-confirm"
                                >
                                  {isSavingConfig
                                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Saving…</>
                                    : `Yes, Save ${n} Day${n !== 1 ? 's' : ''}`}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        );
                      })()}

                    </div>
                  </div>
                );
              })()}

            </div>
          </div>{/* end right col */}
        </div>{/* end flex row */}
      </div>
    </div>
  );
}
