import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { API_BASE_URL } from "@/lib/queryClient";

export type ReminderRole = "clinic" | "doctor";

export interface ReminderBooking {
  bookingId: number;
  customerName: string;
  startTime: string;
  endTime: string;
  visitType: string | null;
  treatmentCategory: string | null;
  assignedDoctor: string | null;
  assignedDoctorEmail: string | null;
  clinicId: number;
  clinicName: string;
  clinicTimezone: string;
  localDate: string;
  dateGroup: "nextThreeDays" | "comingWeek";
}

export interface ReminderResult {
  nextThreeDays: ReminderBooking[];
  comingWeek: ReminderBooking[];
  totalCount: number;
  generatedAt: string;
}

const REMINDER_PATHS: Record<ReminderRole, string> = {
  clinic: "/api/auth/clinic/reminders",
  doctor: "/api/doctor/reminders",
};

export function useReminders(role: ReminderRole | null, panelOpen = false) {
  const queryClient = useQueryClient();
  const lastVisibleAt = useRef(Date.now());
  const query = useQuery<ReminderResult>({
    queryKey: ["reminders", role],
    enabled: role !== null,
    queryFn: async () => {
      if (!role) throw new Error("Reminder role is required");
      const response = await fetch(`${API_BASE_URL}${REMINDER_PATHS[role]}`, {
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("Your session does not have access to reminders");
        }
        throw new Error("Failed to fetch reminders");
      }
      return response.json() as Promise<ReminderResult>;
    },
    refetchInterval: 300000,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (!panelOpen || !role) return;
    queryClient.invalidateQueries({ queryKey: ["reminders", role] });
  }, [panelOpen, queryClient, role]);

  useEffect(() => {
    if (!role) return;
    const refreshAfterIdle = () => {
      const now = Date.now();
      if (now - lastVisibleAt.current >= 60000) {
        queryClient.invalidateQueries({ queryKey: ["reminders", role] });
      }
      lastVisibleAt.current = now;
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshAfterIdle();
    };
    window.addEventListener("online", refreshAfterIdle);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("online", refreshAfterIdle);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [queryClient, role]);

  return query;
}