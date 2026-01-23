import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, API_BASE_URL } from "@/lib/queryClient";

interface ClinicSession {
  id: number;
  name: string;
  doctorName?: string | null;
  doctorSpecialization?: string | null;
  doctors?: { name: string; specialization: string; degree: string }[];
}

async function fetchClinicSession(): Promise<ClinicSession | null> {
  const url = "/api/auth/clinic/me";
  const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
  const response = await fetch(fullUrl, {
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
  const url = "/api/auth/clinic/login";
  const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
  
  const response = await fetch(fullUrl, {
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
  const url = "/api/auth/clinic/logout";
  const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
  await fetch(fullUrl, {
    method: "POST",
    credentials: "include",
  });
}

export function useClinicAuth() {
  const queryClient = useQueryClient();
  
  const { data: clinic, isLoading } = useQuery<ClinicSession | null>({
    queryKey: ["/api/auth/clinic/me"],
    queryFn: async () => {
      return fetchClinicSession();
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      return clinicLogin(credentials);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/clinic/me"], data);
      // Invalidate bookings cache so fresh data is fetched after login
      queryClient.invalidateQueries({ queryKey: ['/api/clinic/bookings'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Always call backend logout to clear session cookies
      await clinicLogout();
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/clinic/me"], null);
      // Also clear super admin data to prevent cross-contamination
      queryClient.setQueryData(["/api/auth/user"], null);
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
