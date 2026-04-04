const BASE_URL = import.meta.env.VITE_API_URL;

/**
 * Normalizes an endpoint by removing leading /api/ if BASE_URL already ends with /api/
 * This prevents double /api/api/ paths
 */
function normalizeEndpoint(endpoint: string): string {
  let normalized = endpoint;

  // Remove leading slash
  if (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }

  // Remove leading 'api/' if BASE_URL already ends with '/api/'
  // This prevents double /api/api/ paths
  if (BASE_URL?.endsWith('/api/') && normalized.startsWith('api/')) {
    normalized = normalized.slice(4); // Remove 'api/'
  }

  return normalized;
}

function buildUrl(endpoint: string, params?: Record<string, string | number | boolean>): string {
  const normalizedEndpoint = normalizeEndpoint(endpoint);
  const url = BASE_URL + normalizedEndpoint;

  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  return url;
}

async function getAuthToken(): Promise<string | null> {
  let token: string | null | undefined = null;

  // Try MetaMask token first
  if (typeof window !== "undefined" && localStorage.getItem("metamask_auth_token")) {
    token = localStorage.getItem("metamask_auth_token");
    if (token) return token;
  }

  try {
    if (typeof window !== "undefined" && (window as any).__getDynamicToken) {
      token = await (window as any).__getDynamicToken();
      if (!token) {
        console.warn("[api] __getDynamicToken returned null/empty");
      }
    }
  } catch (err) {
    console.warn("[api] Error getting __getDynamicToken:", err);
  }

  if (!token) {
    try {
      if (typeof window !== "undefined" && (window as any).getAuthToken) {
        token = (window as any).getAuthToken();
        if (!token) {
          console.warn("[api] getAuthToken fallback returned null/empty");
        }
      }
    } catch (err) {
      console.warn("[api] Error in fallback getAuthToken:", err);
    }
  }

  // Defensive: never return undefined, only string or null
  if (typeof token === 'undefined') {
    console.warn('[api] getAuthToken: token is undefined');
    return null;
  }
  if (typeof token === 'string' && token.trim() === '') {
    console.warn('[api] getAuthToken: token is empty string');
    return null;
  }
  return token ?? null;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export interface ApiCallOptions {
  endpoint: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  on401?: "throw" | "returnNull";
}

export async function apiCall<T = unknown>(options: ApiCallOptions): Promise<T> {
  const {
    endpoint,
    method = "GET",
    body,
    params,
    headers = {},
    on401 = "throw",
  } = options;


  // Fix: Always use backend URL for API calls and normalize endpoint to prevent /api/api/ paths
  const normalizedEndpoint = normalizeEndpoint(endpoint);
  const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${normalizedEndpoint}`;
  const finalUrl = params && Object.keys(params).length > 0 ? buildUrl(endpoint, params) : url;
  const token = await getAuthToken();
  if (!token) {
    console.warn(`[apiCall] No token found for endpoint: ${endpoint}, method: ${method}`);
  }

  const fetchOptions: RequestInit = {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    credentials: "include",
    ...(body ? { body: JSON.stringify(body) } : {}),
  };

  const res = await fetch(finalUrl, fetchOptions);

  if (on401 === "returnNull" && res.status === 401) {
    return null as T;
  }

  await throwIfResNotOk(res);

  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    const responseData = await res.json();

    // Backend returns { success: true, data: {...}, message: "..." }
    // Extract the data field if present
    if (responseData && typeof responseData === 'object' && 'data' in responseData) {
      return responseData.data as T;
    }

    return responseData as T;
  }

  const text = await res.text();
  const parsed = text ? JSON.parse(text) : null;

  // Handle standardized response format even for non-JSON content-type
  if (parsed && typeof parsed === 'object' && 'data' in parsed) {
    return parsed.data as T;
  }

  return parsed as T;
}

