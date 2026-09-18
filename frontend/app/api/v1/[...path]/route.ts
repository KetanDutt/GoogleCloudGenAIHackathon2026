import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY = 65_536;
const sessionCookie = /^(?:__Host-)?aiops_session=/;
function reject(detail: string, status: number) {
  return Response.json(
    { detail },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

type Context = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: Context) {
  const { path } = await context.params;
  // Do not let path segments turn this fixed upstream proxy into an open proxy.
  if (path.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part))) {
    return reject("Invalid API path.", 400);
  }
  const mutating = !["GET", "HEAD"].includes(request.method);
  const origin = request.headers.get("origin");
  if (mutating && origin) {
    // A browser cannot forge Host. Do not trust arbitrary X-Forwarded-Host values.
    try {
      if (new URL(origin).host !== request.headers.get("host")) {
        return reject("Cross-origin request blocked.", 403);
      }
    } catch {
      return reject("Invalid request origin.", 403);
    }
  }
  const headers = new Headers();
  for (const name of ["content-type", "x-csrf-token"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  // Do not disclose unrelated platform/application cookies to the backend.
  const cookies = (request.headers.get("cookie") || "")
    .split(";")
    .map((value) => value.trim())
    .filter((value) => sessionCookie.test(value))
    .join("; ");
  if (cookies) headers.set("cookie", cookies);
  let body: Uint8Array | undefined;
  if (mutating && request.body) {
    const reader = request.body.getReader();
    let timedOut = false;
    const bodyTimeout = setTimeout(() => {
      timedOut = true;
      void reader.cancel().catch(() => undefined);
    }, 10_000);
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (timedOut) return reject("Request body timed out.", 408);
        if (done) break;
        length += value.byteLength;
        if (length > MAX_BODY) {
          await reader.cancel();
          return reject("Request body is too large.", 413);
        }
        if (value.byteLength) chunks.push(value);
      }
    } catch {
      return reject("Unable to read the request body.", 400);
    } finally {
      clearTimeout(bodyTimeout);
      reader.releaseLock();
    }
    body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.length;
    }
  }
  const upstream = process.env.BACKEND_URL || "http://127.0.0.1:8080";
  const url = new URL(`/api/v1/${path.join("/")}`, upstream);
  url.search = request.nextUrl.search;
  try {
    const response = await fetch(url, {
      method: request.method,
      headers,
      body: body as BodyInit | undefined,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(55_000)]),
    });
    const outgoing = new Headers({ "Cache-Control": "no-store" });
    for (const name of [
      "content-type",
      "content-disposition",
      "retry-after",
      "x-request-id",
    ]) {
      const value = response.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    for (const cookie of response.headers.getSetCookie()) {
      if (sessionCookie.test(cookie)) outgoing.append("set-cookie", cookie);
    }
    return new Response(response.body, {
      status: response.status,
      headers: outgoing,
    });
  } catch {
    return Response.json(
      {
        detail:
          "The workspace service is unavailable. Please try again shortly.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
