import asyncio
import json
import logging
import time
from uuid import uuid4

from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse

logger = logging.getLogger("aiops.http")


class RequestSafetyMiddleware:
    """Bound request bodies even without Content-Length, and attach safe request metadata."""

    def __init__(self, app, settings):
        self.app, self.settings = app, settings

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        started, request_id, status = time.monotonic(), str(uuid4()), 500
        scope.setdefault("state", {})["request_id"] = request_id
        headers = Headers(scope=scope)

        async def safe_send(message):
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                result_headers = MutableHeaders(scope=message)
                result_headers["X-Request-ID"] = request_id
                result_headers["Cache-Control"] = "no-store"
                result_headers["X-Content-Type-Options"] = "nosniff"
                result_headers["Referrer-Policy"] = "same-origin"
            await send(message)

        async def reject(code, detail):
            await JSONResponse({"detail": detail, "request_id": request_id}, status_code=code)(
                scope, receive, safe_send
            )

        try:
            if scope["method"] not in {"GET", "HEAD", "OPTIONS"}:
                origin = headers.get("origin")
                if origin and origin.rstrip("/") not in self.settings.origins:
                    return await reject(403, "This request origin is not allowed.")
                content_length = headers.get("content-length")
                if content_length:
                    try:
                        if (
                            int(content_length) < 0
                            or int(content_length) > self.settings.max_body_bytes
                        ):
                            return await reject(413, "Request body is too large.")
                    except ValueError:
                        return await reject(400, "Invalid Content-Length.")
                body = bytearray()
                try:
                    async with asyncio.timeout(10):
                        while True:
                            message = await receive()
                            if message["type"] == "http.disconnect":
                                return
                            body.extend(message.get("body", b""))
                            if len(body) > self.settings.max_body_bytes:
                                return await reject(413, "Request body is too large.")
                            if not message.get("more_body", False):
                                break
                except TimeoutError:
                    return await reject(408, "Request body timed out.")
                delivered = False

                async def bounded_receive():
                    nonlocal delivered
                    if delivered:
                        return await receive()
                    delivered = True
                    return {"type": "http.request", "body": bytes(body), "more_body": False}

                await self.app(scope, bounded_receive, safe_send)
            else:
                await self.app(scope, receive, safe_send)
        finally:
            # Never log bodies, query strings, cookies, passwords, or cloud exception text.
            logger.info(
                json.dumps(
                    {
                        "event": "http_request",
                        "request_id": request_id,
                        "method": scope["method"],
                        "status": status,
                        "route": getattr(scope.get("route"), "path", "unmatched"),
                        "duration_ms": round((time.monotonic() - started) * 1000, 1),
                    }
                )
            )
