import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright e2e config. Playwright itself builds and starts the app
 * (`npm run build && npm run start`) on port 3000 and tears it down after; the
 * tests never start a server themselves. Everything runs offline against the
 * local Postgres named by DATABASE_URL, with dummy Auth.js env so the build
 * succeeds without a real GitHub OAuth app.
 */
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

// Dummy dev-only values so `next build`/`next start` boot without real secrets.
// The Prisma datasource reads the Neon/Vercel-injected names
// (Database_POSTGRES_PRISMA_URL / Database_DATABASE_URL_UNPOOLED); these are
// forwarded only when the environment defines them (CI service container).
// Locally they are left unset so Next loads them from `.env`, avoiding a bogus
// fallback that would override real local credentials. AUTH_TRUST_HOST lets
// Auth.js accept the localhost host under `next start`.
const webServerEnv: Record<string, string> = {
  AUTH_SECRET: process.env.AUTH_SECRET ?? "dev-secret-e2e-only",
  AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID ?? "dev",
  AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET ?? "dev",
  AUTH_TRUST_HOST: "true",
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? BASE_URL,
};
for (const key of [
  "Database_POSTGRES_PRISMA_URL",
  "Database_DATABASE_URL_UNPOOLED",
]) {
  const value = process.env[key];
  if (value) webServerEnv[key] = value;
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? "list" : "line",
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: webServerEnv,
  },
});
