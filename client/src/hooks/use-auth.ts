import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";
import { apiRequest, API_BASE_URL } from "@/lib/queryClient";

async function fetchUser(): Promise<User | null> {
  const url = "/api/auth/user";
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

async function logout(): Promise<void> {
  try {
    const url = "/api/auth/admin/logout";
    const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
    await fetch(fullUrl, {
      method: 'POST',
      credentials: "include",
    });
  } catch {
    // If admin logout fails, continue
  }
  // Redirect to home page instead of /api/logout which is for Replit OIDC
  window.location.href = "/";
}

async function adminLogin(email: string, password: string): Promise<User> {
  const url = "/api/auth/admin/login";
  const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
  
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || 'Login failed');
  }
  const data = await response.json();
  return data.user;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => 
      adminLogin(email, password),
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/user"], user);
      // Skip query invalidation for demo super admin to prevent 404/login loop
      if (user?.email !== "demo_super_admin@bookmyslot.com") {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      }
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    login: loginMutation.mutate,
    loginError: loginMutation.error,
    isLoggingIn: loginMutation.isPending,
  };
}
