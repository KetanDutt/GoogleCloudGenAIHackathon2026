import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  ApiError,
  getSession,
  queryString,
  setCsrfToken,
} from "../lib/api";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  setCsrfToken(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("same-origin API client", () => {
  it("uses relative URLs and a CSRF header for writes, not localStorage tokens", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "saved" }), { status: 201 }),
    );
    setCsrfToken("csrf-test");
    expect(
      await api("/tasks", { method: "POST", body: { title: "New" } }),
    ).toEqual({ id: "saved" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/tasks");
    expect(options?.credentials).toBe("same-origin");
    expect(new Headers(options?.headers).get("x-csrf-token")).toBe("csrf-test");
    expect(new Headers(options?.headers).has("authorization")).toBe(false);
  });
  it("handles empty successful delete responses", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect(await api("/tasks/id", { method: "DELETE" })).toBeUndefined();
  });
  it("surfaces readable validation errors, not raw objects", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: "Invalid",
          errors: [{ loc: ["body", "due_at"], msg: "A timezone is required" }],
        }),
        { status: 422 },
      ),
    );
    await expect(api("/tasks")).rejects.toThrow(
      "due at: A timezone is required",
    );
  });
  it("preserves safe request IDs on errors", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Not found" }), {
        status: 404,
        headers: { "x-request-id": "safe-id" },
      }),
    );
    await expect(api("/tasks/id")).rejects.toMatchObject({
      status: 404,
      requestId: "safe-id",
    });
  });
  it("treats an expired session as signed out", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Expired" }), { status: 401 }),
    );
    expect(await getSession()).toBeNull();
  });
  it("does not sign a user out just because the network is unavailable", async () => {
    fetchMock.mockRejectedValue(new TypeError("Fetch failed"));
    await expect(getSession()).rejects.toBeInstanceOf(ApiError);
  });
  it("does not automatically retry mutation failures", async () => {
    fetchMock.mockRejectedValue(new TypeError("Fetch failed"));
    await expect(
      api("/tasks", { method: "POST", body: { title: "Only once" } }),
    ).rejects.toThrow("Unable to connect");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("encodes search values and includes explicit false and zero filters", () => {
    expect(
      queryString({
        q: "plan & focus",
        offset: 0,
        overdue: false,
        empty: "",
        optional: undefined,
      }),
    ).toBe("?q=plan+%26+focus&offset=0&overdue=false");
  });
});

it("formats numeric validation paths without reporting a false network failure", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: "Invalid input",
          errors: [{ loc: ["body", "items", 0], msg: "Invalid item" }],
        }),
        { status: 422 },
      ),
    ),
  );
  await expect(
    api("/tasks", { method: "POST", body: {} }),
  ).rejects.toMatchObject({ status: 422, message: "0: Invalid item" });
});
