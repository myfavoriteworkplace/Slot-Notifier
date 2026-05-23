import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useNotifications() {
  return useQuery({
    queryKey: [api.notifications.list.path],
    queryFn: async () => {
      const res = await fetch(api.notifications.list.path, { credentials: "include" });
      
      if (!res.ok) {
        if (res.status === 401) throw new Error("Unauthorized");
        throw new Error("Failed to fetch notifications");
      }
      
      return api.notifications.list.responses[200].parse(await res.json());
    },
    // Keep 30s polling as fallback in case WebSocket drops
    refetchInterval: 30000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.notifications.markRead.path, { id });
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

export function useNotificationSocket(clinicId?: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!clinicId) return;

    let cancelled = false;

    function connect() {
      if (cancelled) return;

      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${protocol}://${window.location.host}/ws/notifications`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "auth", clinicId }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "new_booking" && msg.notification) {
            // Instantly refresh the notification list
            queryClient.invalidateQueries({ queryKey: [api.notifications.list.path] });
            // Show a toast so the clinic admin sees it even if the bell is closed
            toast({
              title: "New Booking Request",
              description: msg.notification.message,
              duration: 6000,
            });
          }
        } catch {}
      };

      ws.onclose = () => {
        if (!cancelled) {
          // Reconnect after 5 seconds — polling fallback covers the gap
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
  }, [clinicId, queryClient, toast]);
}
