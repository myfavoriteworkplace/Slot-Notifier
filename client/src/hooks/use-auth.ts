import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";
import { apiRequest } from "@/lib/queryClient";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

async function fetchUser(): Promise<User | null> {
  // Check if demo super admin is active
  if (localStorage.getItem("demo_super_admin") === "true") {
    return {
      id: "999",
      email: "demo_super_admin@bookmyslot.com",
      firstName: "Super",
      lastName: "Admin",
      profileImageUrl: null,
      role: "superuser",
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  const url = "/api/auth/user";
  const apiBaseUrl = import.meta.env.VITE_API_URL || "";
  const fullUrl = url.startsWith("http") ? url : `${apiBaseUrl}${url}`;
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
  localStorage.removeItem("demo_super_admin");
  const apiBaseUrl = import.meta.env.VITE_API_URL || "";
  try {
    const url = "/api/auth/admin/logout";
    const fullUrl = url.startsWith("http") ? url : `${apiBaseUrl}${url}`;
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
  // Hardcoded demo login for super admin
  if (email === "demo_super_admin@bookmyslot.com") {
    console.log("Demo super admin login detected, using local storage path");
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
    // Clear any existing session by calling logout first
    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL || "";
      const logoutUrl = "/api/auth/admin/logout";
      const fullLogoutUrl = logoutUrl.startsWith("http") ? logoutUrl : `${apiBaseUrl}${logoutUrl}`;
      await fetch(fullLogoutUrl, { method: 'POST', credentials: "include" });
    } catch (e) {
      console.log("Pre-login logout failed (expected if no session)");
    }
    // Store in localStorage to persist across refreshes
    localStorage.setItem("demo_super_admin", "true");
    return demoUser;
  }
  
  const url = "/api/auth/admin/login";
  const apiBaseUrl = import.meta.env.VITE_API_URL || "";
  const fullUrl = url.startsWith("http") ? url : `${apiBaseUrl}${url}`;
  
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
