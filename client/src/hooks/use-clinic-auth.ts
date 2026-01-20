import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

interface ClinicSession {
  id: number;
  name: string;
}

async function fetchClinicSession(): Promise<ClinicSession | null> {
  const response = await fetch(`${API_BASE_URL}/api/auth/clinic/me`, {
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
  await fetch(`${API_BASE_URL}/api/auth/clinic/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export function useClinicAuth() {
  const queryClient = useQueryClient();
  
  const { data: clinic, isLoading } = useQuery<ClinicSession | null>({
    queryKey: ["/api/auth/clinic/me"],
    queryFn: async () => {
      // Mock for demo clinics
      if (localStorage.getItem("demo_clinic_active") === "true") {
        const id = localStorage.getItem("demo_clinic_id");
        const name = localStorage.getItem("demo_clinic_name");
        if (id && name) {
          return { id: parseInt(id), name };
        }
        return { id: 999, name: "Demo Smile Clinic" };
      }
      return fetchClinicSession();
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      // Check localStorage for demo clinics first
      const demoCredentialsRaw = localStorage.getItem("demo_clinic_credentials");
      if (demoCredentialsRaw) {
        const demoCredentials = JSON.parse(demoCredentialsRaw);
        if (demoCredentials[credentials.username] === credentials.password) {
          console.log("Demo clinic login detected via localStorage");
          const demoClinicsRaw = localStorage.getItem("demo_clinics");
          const demoClinics = demoClinicsRaw ? JSON.parse(demoClinicsRaw) : [];
          const clinic = demoClinics.find((c: any) => c.username === credentials.username);
          if (clinic) {
            localStorage.setItem("demo_clinic_active", "true");
            localStorage.setItem("demo_clinic_id", clinic.id.toString());
            localStorage.setItem("demo_clinic_name", clinic.name);
            return { id: clinic.id, name: clinic.name };
          }
        }
      }

      if (credentials.username === "demo_clinic" && credentials.password === "demo_password123") {
        localStorage.setItem("demo_clinic_active", "true");
        return { id: 999, name: "Demo Smile Clinic" };
      }
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
      localStorage.removeItem("demo_clinic_active");
      localStorage.removeItem("demo_clinic_id");
      localStorage.removeItem("demo_clinic_name");
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
