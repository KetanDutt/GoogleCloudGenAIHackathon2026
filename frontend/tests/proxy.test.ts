import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../app/api/v1/[...path]/route";

const context = (path = ["tasks"]) => ({ params: Promise.resolve({ path }) });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it("forwards only the app's session/CSRF headers and preserves secure cookie attributes", async () => {
  vi.stubEnv("BACKEND_URL", "https://private-backend.example");
  const headers = new Headers({
    "content-type": "application/json",
    "x-request-id": "test-request",
  });
  headers.append(
    "set-cookie",
    "__Host-aiops_session=test; Path=/; HttpOnly; Secure; SameSite=None; Partitioned",
  );
  headers.append("set-cookie", "unrelated-platform-cookie=must-not-be-written");
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response("{}", { status: 201, headers }));
  vi.stubGlobal("fetch", fetch);
  const result = await POST(
    new NextRequest("https://workspace.example/api/v1/tasks?q=hello", {
      method: "POST",
      headers: {
        host: "workspace.example",
        origin: "https://workspace.example",
        "content-type": "application/json",
        cookie: "platform=must-not-leak; __Host-aiops_session=test",
        "x-csrf-token": "test-csrf",
        authorization: "Bearer must-not-leak",
      },
      body: JSON.stringify({ title: "Test" }),
    }),
    context(),
  );
  const [url, options] = fetch.mock.calls[0];
  expect(url.href).toBe("https://private-backend.example/api/v1/tasks?q=hello");
  expect(options.headers.get("cookie")).toBe("__Host-aiops_session=test");
  expect(options.headers.get("authorization")).toBeNull();
  expect(options.headers.get("x-csrf-token")).toBe("test-csrf");
  expect(result.status).toBe(201);
  expect(result.headers.get("cache-control")).toBe("no-store");
  expect(result.headers.getSetCookie()).toHaveLength(1);
  expect(result.headers.getSetCookie()[0]).toContain("Partitioned");
});

it("blocks cross-origin writes and cannot be fooled by X-Forwarded-Host", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const response = await POST(
    new NextRequest("https://workspace.example/api/v1/tasks", {
      method: "POST",
      headers: {
        host: "workspace.example",
        origin: "https://evil.invalid",
        "x-forwarded-host": "evil.invalid",
      },
    }),
    context(),
  );
  expect(response.status).toBe(403);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(fetch).not.toHaveBeenCalled();
});

it("rejects path traversal before contacting any upstream", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const response = await GET(
    new NextRequest("https://workspace.example/api/v1/tasks"),
    context(["..", "secret"]),
  );
  expect(response.status).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
});

it("enforces the body limit without relying on Content-Length", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const response = await POST(
    new NextRequest("https://workspace.example/api/v1/tasks", {
      method: "POST",
      body: "x".repeat(65_537),
    }),
    context(),
  );
  expect(response.status).toBe(413);
  expect(fetch).not.toHaveBeenCalled();
});

it("stops a stalled incoming request body before forwarding it", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const request = new NextRequest("https://workspace.example/api/v1/tasks", {
    method: "POST",
    body: new ReadableStream(),
    duplex: "half",
  } as ConstructorParameters<typeof NextRequest>[1]);
  const pending = POST(request, context());
  await vi.advanceTimersByTimeAsync(10_001);
  expect((await pending).status).toBe(408);
  expect(fetch).not.toHaveBeenCalled();
});

it("does not expose upstream URLs or exception details on connection failure", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("private upstream failure detail")),
  );
  const result = await GET(
    new NextRequest("https://workspace.example/api/v1/tasks"),
    context(),
  );
  expect(result.status).toBe(503);
  expect(await result.text()).not.toContain("private upstream");
});
