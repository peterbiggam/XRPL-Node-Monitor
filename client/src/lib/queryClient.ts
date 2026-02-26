/**
 * queryClient.ts — TanStack React Query configuration and fetch helpers.
 *
 * Provides:
 *  - throwIfResNotOk: Throws on non-2xx responses with status + body text.
 *  - apiRequest: General-purpose fetch wrapper for mutations (POST/PATCH/DELETE).
 *    Automatically sets Content-Type and stringifies the body when data is provided.
 *  - getQueryFn: Factory that returns a QueryFunction using the queryKey as the URL.
 *    Supports a configurable 401 behavior (return null vs throw) for auth scenarios.
 *  - queryClient: Pre-configured QueryClient instance with aggressive caching
 *    (staleTime: Infinity, no auto-refetch) — callers opt in to refetchInterval
 *    per-query as needed (e.g. alerts every 10s, node info every 10s).
 */

import { QueryClient, QueryFunction } from "@tanstack/react-query";

/** Reads the response body and throws an Error if status is not 2xx. */
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Convenience wrapper for non-GET API calls.
 * Sets JSON Content-Type when a body is provided, includes cookies via credentials.
 */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

/**
 * Creates a default query function that uses queryKey segments joined as the URL.
 * on401 controls whether a 401 response returns null (for optional auth) or throws.
 */
type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

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
