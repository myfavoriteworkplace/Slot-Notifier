export const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export async function apiRequest(
  method: string,
  endpoint: string,
  body?: any
): Promise<Response> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  };

  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }
  
  return response;
}

export async function apiGet<T>(endpoint: string): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    credentials: "include",
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}
