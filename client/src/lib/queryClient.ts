import { QueryClient, QueryFunction } from "@tanstack/react-query";

// api.ts (ONLY FILE)
// In development with Vite middleware mode, use same-origin (empty string)
// In production, use VITE_API_URL if defined, otherwise empty string
export const API_BASE_URL = import.meta.env.DEV ? "" : (import.meta.env.VITE_API_URL || "");

if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  console.warn("VITE_API_URL is not defined in production. Session issues may occur.");
}

console.log(`[QUERY-CLIENT] Using API_BASE_URL: "${API_BASE_URL}" (DEV=${import.meta.env.DEV})`);

// ------------------ HELPER ------------------
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// ------------------ API REQUEST ------------------
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown
): Promise<Response> {
  const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;

  return fetch(fullUrl, {
    method,
    credentials: "include",
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
  });
}

// ------------------ QUERY FUNCTION ------------------
type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> = ({ on401: unauthorizedBehavior }) => async ({ queryKey }) => {
  // Fix [object Object] bug: always use the first element as the base URL
  const path = queryKey[0];
  if (typeof path !== 'string') {
    console.error("[QUERY-CLIENT] Invalid queryKey[0], expected string path:", queryKey);
    throw new Error(`Invalid API path in queryKey: ${path}`);
  }
  
  const fullUrl = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  const res = await fetch(fullUrl, { credentials: "include" });

  if (unauthorizedBehavior === "returnNull" && res.status === 401) {
    return null;
  }

  await throwIfResNotOk(res);
  return await res.json();
};

// ------------------ QUERY CLIENT ------------------
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
