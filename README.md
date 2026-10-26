# Botticello Auto Repair — public website and backend

Public HTML pages, CSS, and JavaScript live directly in this repository root. `convex/` is the shared backend. The independent React admin repository is checked out locally in `admin/`, which this repository ignores.

## Local development

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Public preview: http://127.0.0.1:5174. `npm run build` produces `dist/` for static hosting. No React is used in the public pages. Vite bundles vanilla JavaScript and the public Convex URL.

## Production Convex

- Project: https://dashboard.convex.dev/t/re-image-business-solutions/botticello-auto-repair
- Production deployment: `sincere-turtle-299`
- API: https://sincere-turtle-299.convex.cloud
- The project was created with a production deployment; no development deployment was created.

The public site submits appointments and estimates through `requests:start`, authenticated submission photo operations, and `requests:finish`. The React admin uses Convex Auth and server-side membership checks. Only available vehicle listings are public. Quotes and status updates are internal; staff must contact the customer to share pricing or confirm appointments.

Run `npm test`, `npm run typecheck`, and `npm run build` before `npm run convex:deploy`. This checkout targets production explicitly. Use a separate development deployment if future changes require live integration testing. Tests use an isolated in-memory database.

## Admin repository

From `admin/`, run `npm ci`, copy `.env.example` to `.env.local`, then `npm run dev`. The admin builds independently and references Convex functions through the installed client, without importing files from its parent directory. Both front ends must use the same `VITE_CONVEX_URL`.

Admin credentials are not stored in the source. Public sign-up is disabled. Account provisioning is an internal Convex action available only to deployment administrators. Password recovery currently requires the deployment administrator; email delivery is not configured.

## Hosting

For each repository, build command: `npm ci && npm run build`; output: `dist`. Set `VITE_CONVEX_URL=https://sincere-turtle-299.convex.cloud` at build time. Publish only the build output, never the source tree. This source push does not switch the business's existing domain or host.

## Business information and assets

Name, address, phone, weekday hours, family ownership, and Spanish-language service were checked against https://www.botticelloautorepair.com/contact/2788433 and the homepage on October 26, 2026. The user confirmed Saturday and Sunday are closed. Light, medium, and heavy duty scope was supplied by the user.

`assets/shop.png` is the temporary shop exterior from the existing business website: https://le-cdn.hibuwebsites.com/7553a00c2342458bb97d3e89cace7949/dms3rep/multi/opt/contact-1920w.png . Replace with the user's supplied photos. The DoorDash screenshot and additional photos have not yet been supplied, so the current layout is an initial design.
