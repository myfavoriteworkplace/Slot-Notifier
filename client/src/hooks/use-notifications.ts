import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/queryClient";

export function useNotifications() {
  return useQuery({
    queryKey: [api.notifications.list.path],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}${api.notifications.list.path}`, { credentials: "include" });
      
      if (!res.ok) {
        if (res.status === 401) throw new Error("Unauthorized");
        throw new Error("Failed to fetch notifications");
      }
      
      return api.notifications.list.responses[200].parse(await res.json());
    },
    refetchInterval: 30000,
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark all as read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.notifications.list.path] });
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      const url = `${API_BASE_URL}${buildUrl(api.notifications.markRead.path, { id })}`;
      const res = await fetch(url, { 
        method: api.notifications.markRead.method,
        credentials: "include" 
      });

      if (!res.ok) {
        if (res.status === 404) throw new Error("Notification not found");
        throw new Error("Failed to mark as read");
      }
      
      return api.notifications.markRead.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.notifications.list.path] });
    },
  });
}

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const resume = ctx.state === "suspended" ? ctx.resume() : Promise.resolve();
    resume.then(() => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
      osc.onended = () => ctx.close();
    });
  } catch {
    // AudioContext not supported or blocked — fail silently
  }
}

const TOAST_TITLES: Record<string, string> = {
  new_booking:              "New Booking Request",
  paid_booking_confirmed:   "Paid Booking Confirmed",
  booking_rescheduled:      "Booking Rescheduled",
  booking_cancelled:        "Booking Cancelled",
  doctor_approved:          "Doctor Confirmed",
  doctor_declined:          "Doctor Declined",
  doctor_assigned:          "New Appointment Assigned",
  admin_confirmed:          "Appointment Confirmed",
  patient_checked_in:       "Patient Arrived",
  consultation_started:     "Consultation Started",
  visit_completed:          "Visit Completed",
  visit_auto_completed:     "Visit Auto-Completed",
  visit_override_completed: "Visit Completed by Admin",
  patient_no_show:          "Patient No-Show",
  patient_left_early:       "Patient Left Early",
  case_closed_by_doctor:    "Case Closed",
  case_closed_by_clinic:    "Case Closed",
  clinical_status_updated:  "Clinical Status Updated",
  clinical_record_created:  "Clinical Record Added",
  clinical_record_updated:  "Clinical Record Updated",
  booking_note_added:       "New Booking Note",
  consent_requested:        "Consent Form Sent",
  consent_signed:           "Consent Signed",
  doctor_on_leave:          "Doctor On Leave",
  doctor_leave_cancelled:   "Doctor Available",
};

/**
 * Events that require the bookings list to be refetched.
 * Covers both clinic and doctor views — same queryKey is used by both dashboards.
 */
const BOOKING_LIST_EVENTS = new Set([
  "new_booking",
  "paid_booking_confirmed",
  "booking_rescheduled",
  "booking_cancelled",
  "doctor_approved",
  "doctor_declined",
  "doctor_assigned",
  "admin_confirmed",
  "patient_checked_in",
  "consultation_started",
  "visit_completed",
  "visit_auto_completed",
  "visit_override_completed",
  "patient_no_show",
  "patient_left_early",
  "clinical_status_updated",
  "case_closed_by_doctor",
  "case_closed_by_clinic",
  "consent_signed",
  "consent_requested",
  "booking_note_added",
]);

/**
 * Apply query invalidations for a WebSocket message.
 * Called for EVERY message regardless of whether it has a notification payload.
 */
function applyQueryInvalidations(
  queryClient: ReturnType<typeof useQueryClient>,
  msg: { type: string; bookingId?: number; [key: string]: unknown },
) {
  const { type, bookingId } = msg;

  // ── Bookings list (clinic dashboard + doctor dashboard) ─────────────────────
  if (BOOKING_LIST_EVENTS.has(type)) {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/bookings"] });
  }

  // ── Doctor leaves ────────────────────────────────────────────────────────────
  if (type === "doctor_on_leave" || type === "doctor_leave_cancelled") {
    queryClient.invalidateQueries({ queryKey: ["/api/clinic/doctor-leaves/all"] });
    queryClient.invalidateQueries({ queryKey: ["/api/doctor/leaves"] });
  }

  // ── Bills — refetch when visit auto-completes (all bills settled) ────────────
  if (type === "visit_auto_completed") {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/bills"] });
    if (bookingId) {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/clinic/bills/booking", bookingId] });
    }
  }

  // ── Clinical records — targeted by bookingId when available ─────────────────
  if (type === "clinical_record_created" || type === "clinical_record_updated") {
    if (bookingId) {
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-records/booking", bookingId] });
    }
  }

  // ── Booking notes — targeted by bookingId so the thread updates live ─────────
  if (type === "booking_note_added" && bookingId) {
    queryClient.invalidateQueries({ queryKey: ["/api/booking", bookingId, "notes"] });
  }
}

export function useNotificationSocket(clinicId?: number, doctorId?: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!clinicId && !doctorId) return;

    let cancelled = false;

    function connect() {
      if (cancelled) return;

      const wsUrl = API_BASE_URL
        ? API_BASE_URL.replace(/^https/, "wss").replace(/^http/, "ws") + "/ws/notifications"
        : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws/notifications`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (clinicId) {
          ws.send(JSON.stringify({ type: "auth", clinicId }));
        } else if (doctorId) {
          ws.send(JSON.stringify({ type: "auth", doctorId }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as {
            type: string;
            notification?: { message: string };
            bookingId?: number;
            [key: string]: unknown;
          };

          if (!msg.type) return;

          // 1. Always apply data-layer cache invalidations so the UI refreshes
          applyQueryInvalidations(queryClient, msg);

          // 2. Show toast + play sound only when there is a human-readable notification
          if (msg.notification) {
            queryClient.invalidateQueries({ queryKey: [api.notifications.list.path] });
            playNotificationSound();
            const title = TOAST_TITLES[msg.type] ?? "New Notification";
            toast({
              title,
              description: msg.notification.message,
              duration: 6000,
            });
          }
        } catch {}
      };

      ws.onclose = () => {
        if (!cancelled) {
          reconnectTimerRef.current = setTimeout(connect, 5000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [clinicId, doctorId, queryClient, toast]);
}
