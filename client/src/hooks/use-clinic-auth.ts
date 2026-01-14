import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

interface ClinicSession {
  id: number;
  name: string;
}

async function fetchClinicSession(): Promise<ClinicSession | null> {
  const response = await fetch(`${API_BASE_URL}/api/clinic/me`, {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function clinicLogin(credentials: { username: string; password: string }): Promise<ClinicSession> {
  const response = await fetch(`${API_BASE_URL}/api/clinic/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Login failed");
  }

  return response.json();
}

async function clinicLogout(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/clinic/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export function useClinicAuth() {
  const queryClient = useQueryClient();
  
  const { data: clinic, isLoading } = useQuery<ClinicSession | null>({
    queryKey: ["/api/clinic/me"],
    queryFn: async () => {
      // Mock for demo_clinic
      if (localStorage.getItem("demo_clinic_active") === "true") {
        return { id: 999, name: "Demo Smile Clinic" };
      }
      return fetchClinicSession();
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      if (credentials.username === "demo_clinic" && credentials.password === "demo_password123") {
        localStorage.setItem("demo_clinic_active", "true");
        return { id: 999, name: "Demo Smile Clinic" };
      }
      return clinicLogin(credentials);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/clinic/me"], data);
      // Invalidate bookings cache so fresh data is fetched after login
      queryClient.invalidateQueries({ queryKey: ['/api/clinic/bookings'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      localStorage.removeItem("demo_clinic_active");
      if (clinic?.id !== 999) {
        await clinicLogout();
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/clinic/me"], null);
    },
  });

  return {
    clinic,
    isLoading,
    isAuthenticated: !!clinic,
    login: loginMutation.mutateAsync,
    loginError: loginMutation.error?.message,
    isLoggingIn: loginMutation.isPending,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
