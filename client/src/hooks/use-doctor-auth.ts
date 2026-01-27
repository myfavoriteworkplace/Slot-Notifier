import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/queryClient";

interface DoctorSession {
  email: string;
  name: string;
  specialization: string;
  clinicId: number;
  clinicName: string;
  logoUrl?: string | null;
}

async function fetchDoctorSession(): Promise<DoctorSession | null> {
  const url = "/api/auth/doctor/me";
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

async function doctorLogin(credentials: { email: string; password: string }): Promise<DoctorSession> {
  const url = "/api/auth/doctor/login";
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

async function doctorLogout(): Promise<void> {
  const url = "/api/auth/doctor/logout";
  const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
  await fetch(fullUrl, {
    method: "POST",
    credentials: "include",
  });
}

export function useDoctorAuth() {
  const queryClient = useQueryClient();
  
  const { data: doctor, isLoading } = useQuery<DoctorSession | null>({
    queryKey: ["/api/auth/doctor/me"],
    queryFn: async () => {
      return fetchDoctorSession();
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      return doctorLogin(credentials);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/doctor/me"], data);
      queryClient.invalidateQueries({ queryKey: ['/api/clinic/bookings'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await doctorLogout();
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/doctor/me"], null);
    },
  });

  return {
    doctor,
    isLoading,
    isAuthenticated: !!doctor,
    login: loginMutation.mutateAsync,
    loginError: loginMutation.error?.message,
    isLoggingIn: loginMutation.isPending,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    refetch: () => queryClient.invalidateQueries({ queryKey: ["/api/auth/doctor/me"] }),
  };
}
