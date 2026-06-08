import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type InsertBooking } from "@shared/schema";
import { notify } from "@/lib/notify";

export function useBookings() {
  return useQuery({
    queryKey: [api.bookings.list.path],
    queryFn: async () => {
      if (localStorage.getItem("demo_clinic_active") === "true") {
        const demoBookings = [];
        const patientNames = ["Jane Doe", "John Smith", "Alice Johnson", "Bob Wilson", "Charlie Brown", "David Miller", "Eva Garcia", "Frank Wright"];
        const phoneNumbers = ["+91 9876543210", "+91 9876543211", "+91 9876543212", "+91 9876543213", "+91 9876543214", "+91 9876543215", "+91 9876543216", "+91 9876543217"];

        for (let i = 1; i <= 15; i++) {
          const day = (i * 2) % 31 + 1;
          const startHour = 9 + (i % 8);
          const patientName = patientNames[i % patientNames.length] + " (Demo)";
          const phone = phoneNumbers[i % phoneNumbers.length];

          const startTime = new Date(2026, 0, day, startHour, 0, 0);
          const endTime = new Date(2026, 0, day, startHour + 1, 0, 0);

          demoBookings.push({
            id: 1000 + i,
            slotId: 2000 + i,
            customerName: patientName,
            customerPhone: phone,
            customerEmail: `${patientName.toLowerCase().replace(" ", ".")}@example.com`,
            verificationStatus: "verified",
            slot: {
              id: 2000 + i,
              clinicId: 999,
              clinicName: "Demo Smile Clinic",
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              isBooked: true,
            },
          });
        }

        const stored = localStorage.getItem("demo_bookings_persistent");
        if (stored) {
          try {
            const persistentBookings = JSON.parse(stored);
            demoBookings.push(...persistentBookings);
          } catch (e) {
            console.error("Failed to parse persistent demo bookings", e);
          }
        }

        return demoBookings;
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

  return useMutation({
    mutationFn: async (data: { slotId: number; customerName: string; customerPhone: string; clinicName?: string; startTime?: string; endTime?: string }) => {
      if (localStorage.getItem("demo_clinic_active") === "true") {
        const newBooking = {
          id: Math.floor(Math.random() * 10000) + 5000,
          slotId: data.slotId || Math.floor(Math.random() * 10000) + 6000,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: "patient@example.com",
          verificationStatus: "verified",
          slot: {
            id: data.slotId || Math.floor(Math.random() * 10000) + 6000,
            clinicId: 999,
            clinicName: data.clinicName || "Demo Smile Clinic",
            startTime: data.startTime || new Date().toISOString(),
            endTime: data.endTime || new Date(Date.now() + 3600000).toISOString(),
            isBooked: true,
          },
        };

        const stored = localStorage.getItem("demo_bookings_persistent");
        const persistentBookings = stored ? JSON.parse(stored) : [];
        persistentBookings.push(newBooking);
        localStorage.setItem("demo_bookings_persistent", JSON.stringify(persistentBookings));

        return newBooking;
      }

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
      notify.success("Booking confirmed", { description: "You have successfully booked this slot." });
    },
    onError: (error) => {
      notify.apiError(error, "Booking Failed");
    },
  });
}
