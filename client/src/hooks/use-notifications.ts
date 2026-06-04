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
  new_booking:          "New Booking Request",
  paid_booking:         "Paid Booking Confirmed",
  booking_rescheduled:  "Booking Rescheduled",
  doctor_approved:      "Doctor Confirmed",
  doctor_declined:      "Doctor Declined",
  consent_signed:       "Consent Signed",
  doctor_assigned:      "New Appointment Assigned",
  admin_confirmed:      "Appointment Confirmed",
  patient_checked_in:   "Patient Arrived",
  consultation_started: "Consultation Started",
  visit_completed:      "Visit Completed",
  case_closed_by_doctor:"Case Closed",
  case_closed_by_clinic:"Case Closed",
};

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
          const msg = JSON.parse(event.data);
          if (msg.type && msg.notification) {
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
