import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type InsertBooking } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useBookings() {
  return useQuery({
    queryKey: [api.bookings.list.path],
    queryFn: async () => {
      if (localStorage.getItem("demo_clinic_active") === "true") {
        // Return static demo data
        return [
          {
            id: 1,
            slotId: 101,
            customerName: "Jane Doe (Demo)",
            customerPhone: "+91 9876543210",
            customerEmail: "jane@example.com",
            verificationStatus: "verified",
            slot: {
              id: 101,
              clinicId: 999,
              clinicName: "Demo Smile Clinic",
              startTime: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(),
              endTime: new Date(new Date().setHours(11, 0, 0, 0)).toISOString(),
              isBooked: true
            }
          },
          {
            id: 2,
            slotId: 102,
            customerName: "John Smith (Demo)",
            customerPhone: "+91 9876543211",
            customerEmail: "john@example.com",
            verificationStatus: "verified",
            slot: {
              id: 102,
              clinicId: 999,
              clinicName: "Demo Smile Clinic",
              startTime: new Date(new Date().setHours(14, 0, 0, 0)).toISOString(),
              endTime: new Date(new Date().setHours(15, 0, 0, 0)).toISOString(),
              isBooked: true
            }
          }
        ];
      }
      
      const res = await fetch(api.bookings.list.path, { credentials: "include" });
      
      if (!res.ok) {
        if (res.status === 401) throw new Error("Unauthorized");
        throw new Error("Failed to fetch bookings");
      }
      
      return api.bookings.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { slotId: number; customerName: string; customerPhone: string; clinicName?: string; startTime?: string; endTime?: string }) => {
      const res = await fetch(api.bookings.create.path, {
        method: api.bookings.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.bookings.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        if (res.status === 401) throw new Error("Unauthorized");
        throw new Error("Failed to create booking");
      }

      return api.bookings.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.bookings.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.slots.list.path] });
      toast({ title: "Booking Confirmed!", description: "You have successfully booked this slot." });
    },
    onError: (error) => {
      toast({ 
        title: "Booking Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });
}
