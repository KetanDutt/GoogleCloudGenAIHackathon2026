"use client";

import {
  QueryCache,
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { ApiError, setCsrfToken } from "@/lib/api";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => {
    function expireSession(error: Error) {
      if (!(error instanceof ApiError) || error.status !== 401) return;
      setCsrfToken(null);
      queryClient.setQueryData(["session"], null);
      void queryClient.cancelQueries({ queryKey: ["workspace"] });
      queryClient.removeQueries({ queryKey: ["workspace"] });
    }
    const queryClient = new QueryClient({
      mutationCache: new MutationCache({ onError: expireSession }),
      queryCache: new QueryCache({
        onError: (error, query) => {
          if (query.queryKey[0] === "workspace") expireSession(error);
        },
      }),
      defaultOptions: {
        queries: {
          staleTime: 20_000,
          networkMode: "always",
          retry: (count, error) =>
            count < 1 &&
            (!(error instanceof ApiError) ||
              error.status === 0 ||
              error.status >= 500),
        },
        mutations: { retry: false, networkMode: "always" },
      },
    });
    return queryClient;
  });
  useEffect(() => {
    // Remove the retired v1 credential without touching non-sensitive theme preferences.
    try {
      localStorage.removeItem("token");
    } catch {
      /* Storage may be blocked in an iframe. */
    }
  }, []);
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={client}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "rgb(var(--surface))",
              color: "rgb(var(--ink))",
              border: "1px solid rgb(var(--line))",
              borderRadius: 12,
              fontSize: 13,
            },
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
