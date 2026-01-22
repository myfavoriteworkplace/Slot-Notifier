import { QueryClient, QueryFunction } from "@tanstack/react-query";

// ------------------ BASE URL ------------------
// Use VITE_API_URL from env for production; fallback to localhost for development
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === "development"
    ? "http://localhost:5000"
    : "https://book-my-slot-1.onrender.com");

console.log(`[QUERY-CLIENT] Using API_BASE_URL: ${API_BASE_URL}`);
console.log("[QUERY-CLIENT] MODE:", import.meta.env.MODE);
console.log("[QUERY-CLIENT] DEV:", import.meta.env.DEV);
console.log("[QUERY-CLIENT] PROD:", import.meta.env.PROD);
console.log("[QUERY-CLIENT] VITE_API_URL:", import.meta.env.VITE_API_URL);


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
  // Construct full URL automatically
  const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;

  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // important for session cookies
  });

  return res;
}

// ------------------ QUERY FUNCTION ------------------
type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> = ({ on401: unauthorizedBehavior }) => async ({ queryKey }) => {
  const url = queryKey.join("/") as string;
  const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;

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
