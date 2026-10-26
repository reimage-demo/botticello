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

The website now uses user-supplied shop photographs in `assets/photos/`. Images are supplied at 640 px and 1200 px widths as WebP, without original EXIF/GPS metadata. Original HEIC files remain unchanged in Downloads. Photo mapping: service bays = IMG_2133; entrance = IMG_2131; roadside sign = IMG_2132; reception = IMG_2130. The remaining four supplied photos were reviewed but are not published on the site. Visible signs are photographic content; posted rates and policies were not adopted as website instructions or estimator pricing.

The brand logo is the original high-resolution Discover asset from `re-image website/output/discover-20261023/botticello-auto-repair-2026.png`. The current design follows the user’s later editorial direction: solid colors, rectangular photography, compact spacing, and no decorative effects.

The homepage includes Eastern-time shop status, a seven-day hours table, and the same four-step estimate form as `estimate.html`. Optional VIN, mileage, issue details, and photos reach the existing Convex request workflow and admin detail view. Existing appointment requests remain compatible. Five independently sourced Google review excerpts are documented in [REVIEW-SOURCES.md](REVIEW-SOURCES.md).
