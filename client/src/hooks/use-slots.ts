import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertSlot } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

export function useSlots(filters?: { ownerId?: string; date?: string }) {
  const queryKey = [api.slots.list.path, filters];
  return useQuery({
    queryKey,
    queryFn: async () => {
      // Build query params
      const params = new URLSearchParams();
      if (filters?.ownerId) params.append("ownerId", filters.ownerId);
      if (filters?.date) params.append("date", filters.date);

      const url = `${api.slots.list.path}?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      
      if (!res.ok) {
        if (res.status === 401) throw new Error("Unauthorized");
        throw new Error("Failed to fetch slots");
      }
      
      return api.slots.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateSlot() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertSlot) => {
      const validated = api.slots.create.input.parse(data);
      const res = await fetch(api.slots.create.path, {
        method: api.slots.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.slots.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        if (res.status === 401) throw new Error("Unauthorized");
        throw new Error("Failed to create slot");
      }

      return api.slots.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.slots.list.path] });
      toast({ title: "Success", description: "Slot created successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });
}

export function useDeleteSlot() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.slots.delete.path, { id });
      const res = await fetch(url, { 
        method: api.slots.delete.method,
        credentials: "include" 
      });

      if (!res.ok) {
        if (res.status === 404) throw new Error("Slot not found");
        if (res.status === 401) throw new Error("Unauthorized");
        throw new Error("Failed to delete slot");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.slots.list.path] });
      toast({ title: "Success", description: "Slot deleted" });
    },
    onError: (error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });
}
