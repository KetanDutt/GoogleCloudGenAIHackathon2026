import type { Session } from "./types";

let csrfToken: string | null = null;
export const setCsrfToken = (token: string | null) => {
  csrfToken = token;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

type ApiOptions = Omit<RequestInit, "body"> & { body?: unknown; raw?: boolean };

export async function api<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { body, raw, signal, ...rest } = options;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    path === "/chat" ? 60_000 : 20_000,
  );
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const headers = new Headers(options.headers);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (
    csrfToken &&
    options.method &&
    !["GET", "HEAD"].includes(options.method)
  ) {
    headers.set("X-CSRF-Token", csrfToken);
  }
  try {
    const response = await fetch(`/api/v1${path}`, {
      ...rest,
      headers,
      credentials: "same-origin",
      cache: "no-store",
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      let message =
        typeof data.detail === "string"
          ? data.detail
          : "The request could not be completed.";
      if (response.status === 422 && Array.isArray(data.errors)) {
        message = data.errors
          .map(
            (issue: { loc?: (string | number)[]; msg?: string }) =>
              `${String(issue.loc?.at(-1) ?? "Field").replaceAll("_", " ")}: ${issue.msg || "invalid value"}`,
          )
          .join(". ");
      }
      throw new ApiError(
        message,
        response.status,
        response.headers.get("x-request-id") || undefined,
      );
    }
    if (raw) return (await response.blob()) as T;
    return response.status === 204
      ? (undefined as T)
      : ((await response.json()) as T);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal?.aborted) throw error; // React Query owns cancellations.
    throw new ApiError(
      controller.signal.aborted
        ? "This request took too long. Refresh to check its status before retrying."
        : "Unable to connect. Check your connection and try again.",
      0,
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}

export async function getSession(
  signal?: AbortSignal,
): Promise<Session | null> {
  try {
    const session = await api<Session>("/auth/session", { signal });
    setCsrfToken(session.csrf_token);
    return session;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      setCsrfToken(null);
      return null;
    }
    throw error;
  }
}

export function queryString(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return query.size ? `?${query}` : "";
}
