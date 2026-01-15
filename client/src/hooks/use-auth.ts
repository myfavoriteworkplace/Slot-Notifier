import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";
import { apiRequest } from "@/lib/queryClient";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

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
    await apiRequest('POST', '/api/auth/admin/logout');
  } catch {
    // If admin logout fails, try Replit logout
  }
  window.location.href = "/api/logout";
}

async function adminLogin(email: string, password: string): Promise<User> {
  // Hardcoded demo login for super admin
  if (email === "demo_super_admin@bookmyslot.com") {
    console.log("Demo super admin login detected, bypassing backend");
    const demoUser: User = {
      id: "999",
      email: "demo_super_admin@bookmyslot.com",
      firstName: "Super",
      lastName: "Admin",
      profileImageUrl: null,
      role: "superuser",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    // Store in localStorage to persist across refreshes if needed by other parts of the app
    localStorage.setItem("demo_super_admin", "true");
    return demoUser;
  }
  
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
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
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
