import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface ClinicSession {
  id: number;
  name: string;
}

async function fetchClinicSession(): Promise<ClinicSession | null> {
  const response = await fetch("/api/clinic/me", {
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
  const response = await fetch("/api/clinic/login", {
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
  await fetch("/api/clinic/logout", {
    method: "POST",
    credentials: "include",
  });
}

export function useClinicAuth() {
  const queryClient = useQueryClient();
  
  const { data: clinic, isLoading } = useQuery<ClinicSession | null>({
    queryKey: ["/api/clinic/me"],
    queryFn: fetchClinicSession,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const loginMutation = useMutation({
    mutationFn: clinicLogin,
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/clinic/me"], data);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: clinicLogout,
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
