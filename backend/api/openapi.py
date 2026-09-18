"""Document the actual cookie/CSRF contract and sanitized error format."""

from fastapi.openapi.utils import get_openapi

PUBLIC = {
    "/health",
    "/ready",
    "/api/v1/status",
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/demo",
}


def configure_openapi(app, settings):
    def build():
        if app.openapi_schema:
            return app.openapi_schema
        schema = get_openapi(
            title=app.title, version=app.version, description=app.description, routes=app.routes
        )
        schema.setdefault("components", {}).setdefault("securitySchemes", {})["CookieSession"] = {
            "type": "apiKey",
            "in": "cookie",
            "name": settings.cookie_name,
        }
        schema["components"]["schemas"]["SafeError"] = {
            "type": "object",
            "required": ["detail"],
            "properties": {
                "detail": {"type": "string"},
                "request_id": {"type": "string"},
                "errors": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "loc": {
                                "type": "array",
                                "items": {"anyOf": [{"type": "string"}, {"type": "integer"}]},
                            },
                            "msg": {"type": "string"},
                            "type": {"type": "string"},
                        },
                    },
                },
            },
        }
        for path, operations in schema["paths"].items():
            for method, operation in operations.items():
                if method not in {"get", "post", "patch", "delete"}:
                    continue
                if path not in PUBLIC:
                    operation["security"] = [{"CookieSession": []}]
                    if method != "get":
                        operation.setdefault("parameters", []).append(
                            {
                                "name": "X-CSRF-Token",
                                "in": "header",
                                "required": True,
                                "schema": {"type": "string"},
                                "description": "Use the csrf_token returned by /auth/session. Never store the session cookie in JavaScript.",
                            }
                        )
                for code, description in {
                    "401": "Sign-in required",
                    "403": "Invalid CSRF token or origin",
                    "404": "Item not found",
                    "409": "Conflict or stale version",
                    "422": "Invalid input",
                    "429": "Rate limited (see Retry-After)",
                    "503": "Service unavailable",
                }.items():
                    if (
                        code == "422"
                        or (path not in PUBLIC)
                        or (
                            path.startswith("/api/v1/auth/")
                            and code in {"401", "403", "409", "429"}
                        )
                    ):
                        operation["responses"][code] = {
                            "description": description,
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/SafeError"}
                                }
                            },
                        }
        app.openapi_schema = schema
        return schema

    app.openapi = build
