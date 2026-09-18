"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api, errorMessage, getSession, queryString } from "./api";
import type { SystemStatus } from "./types";

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: ({ signal }) => getSession(signal),
    staleTime: 60_000,
    retry: false,
  });
}
export function useSystemStatus() {
  return useQuery({
    queryKey: ["status"],
    queryFn: ({ signal }) => api<SystemStatus>("/status", { signal }),
    staleTime: 60_000,
  });
}
export function useWorkspace<T>(
  resource: string,
  params: Record<string, string | number | boolean | undefined> = {},
  enabled = true,
) {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ["workspace", session?.user.id, resource, params],
    queryFn: ({ signal }) =>
      api<T>(`/${resource}${queryString(params)}`, { signal }),
    enabled: !!session && enabled,
  });
}
export function useWorkspaceMutation<T, V>(
  mutationFn: (value: V) => Promise<T>,
  message?: string,
) {
  const client = useQueryClient();
  const { data: session } = useSession();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: ["workspace", session?.user.id],
      });
      if (message) toast.success(message);
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      // A 409 may mean another tab changed an item. Refetch, do not overwrite it.
      void client.invalidateQueries({
        queryKey: ["workspace", session?.user.id],
      });
    },
  });
}
