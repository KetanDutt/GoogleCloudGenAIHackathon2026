import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const python =
  process.env.PYTHON_BINARY ||
  path.join(
    root,
    ".venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
const external = process.env.E2E_BASE_URL;
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: external || "http://localhost:3001",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    timezoneId: "UTC",
    actionTimeout: 10_000,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH },
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: external
    ? undefined
    : [
        {
          command: `"${python}" -m uvicorn backend.main:app --host 0.0.0.0 --port 8081 --no-access-log`,
          cwd: root,
          url: "http://127.0.0.1:8081/ready",
          reuseExistingServer: false,
          env: {
            ENVIRONMENT: "test",
            DATABASE_URL: `sqlite:///${path.join(root, ".cache", "e2e.db")}`,
            AI_MODE: "demo",
            ALLOW_DEMO_LOGIN: "true",
            COOKIE_SECURE: "false",
            COOKIE_SAMESITE: "lax",
            COOKIE_PARTITIONED: "false",
            AUTH_RATE_LIMIT: "1000",
          },
          timeout: 60_000,
        },
        {
          command: "npx next dev --hostname 0.0.0.0 --port 3001",
          url: "http://localhost:3001/login",
          reuseExistingServer: false,
          env: {
            BACKEND_URL: "http://127.0.0.1:8081",
            NEXT_TELEMETRY_DISABLED: "1",
            NEXT_BUILD_DIR: ".next/e2e",
          },
          timeout: 90_000,
        },
      ],
});
