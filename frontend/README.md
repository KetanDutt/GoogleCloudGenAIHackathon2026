# AI Ops frontend

Next.js App Router workspace, React, TypeScript, Tailwind, TanStack Query, and Radix dialogs. Requires Node **22.12+**.

```bash
npm ci
# Copy .env.example to .env.local only if missing.
npm run dev
```

Open http://localhost:3000, with the backend on port 8080. Every browser request uses relative `/api/v1`; the Next server reads the private, runtime `BACKEND_URL`. Never put backend credentials or a remote user's localhost address into `NEXT_PUBLIC_*` variables.

```bash
npm run lint
npm run typecheck
npm test
npm run format:check
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

Playwright starts isolated API/UI servers by default and covers desktop/mobile flows plus axe checks. See [Testing](../docs/TESTING.md) for setup, alternative browser paths, and limitations. The production container uses the standalone build, self-hosted fonts, and a non-root user.

- [Development](../docs/DEVELOPMENT.md)
- [Configuration and embedded HTTPS preview cookies](../docs/CONFIGURATION.md)
- [API contract](../docs/API.md)
- [Deployment](../docs/DEPLOYMENT.md)
- [Known limitations and roadmap](../docs/AUDIT_AND_ROADMAP.md)
