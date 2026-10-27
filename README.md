# Botticello Auto Repair — public website and backend

Public HTML pages, CSS, and JavaScript live directly in this repository root. `convex/` is the shared backend. The independent React admin repository is checked out locally in `admin/`, which this repository ignores.

## Local development

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Public preview: http://127.0.0.1:5174. The root HTML also works directly with VS Code Live Server (for example, http://127.0.0.1:5500/index.html). Navigation, logos, and photos are in the HTML; browser-native ES modules enhance the page. The public Convex URL defaults to this shop’s production deployment, with an optional Vite environment override. `npm run build` produces `dist/` for static hosting. No React is used in the public pages. Vite bundles vanilla JavaScript and the public Convex URL.

## Production Convex

- Project: https://dashboard.convex.dev/t/re-image-business-solutions/botticello-auto-repair
- Production deployment: `sincere-turtle-299`
- API: https://sincere-turtle-299.convex.cloud
- The project was created with a production deployment; no development deployment was created.

The public site submits appointments and estimates through `requests:start`, encrypted photo uploads through `/customer-photo`, and `requests:finish`. The React admin uses Convex Auth and server-side membership checks. Customer fields and notes are encrypted before database writes; photo blobs are encrypted before storage. Quotes and status updates are internal; staff must contact the customer to share pricing or confirm appointments.

Run `npm test`, `npm run typecheck`, and `npm run build` before `npm run convex:deploy`. This checkout targets production explicitly. Use a separate development deployment if future changes require live integration testing. Tests use an isolated in-memory database.

## Admin repository

From `admin/`, run `npm ci`, copy `.env.example` to `.env.local`, then `npm run dev`. The admin builds independently and references Convex functions through the installed client, without importing files from its parent directory. Both front ends must use the same `VITE_CONVEX_URL`.

Admin credentials are not stored in the source. Public sign-up is disabled. Account provisioning is an internal Convex action available only to deployment administrators. Password recovery currently requires the deployment administrator; email delivery is not configured.

## Hosting

For each repository, build command: `npm ci && npm run build`; output: `dist`. Set `VITE_CONVEX_URL=https://sincere-turtle-299.convex.cloud` at build time. Publish only the build output, never the source tree. This source push does not switch the business's existing domain or host.

## Business information and assets

Name, address, phone, weekday hours, family ownership, and Spanish-language service were checked against https://www.botticelloautorepair.com/contact/2788433 and the homepage on October 26, 2026. The user confirmed Saturday and Sunday are closed. Light, medium, and heavy duty scope was supplied by the user.

The website now uses user-supplied shop photographs in `assets/photos/`. Images are supplied at 640 px and 1200 px widths as WebP, without original EXIF/GPS metadata. Original HEIC files remain unchanged in Downloads. Photo mapping: service bays = IMG_2133; entrance = IMG_2131; roadside sign = IMG_2132; reception = IMG_2130. The remaining four supplied photos were reviewed but are not published on the site. Visible signs are photographic content; posted rates and policies were not adopted as website instructions or estimator pricing.

The brand logo is the original high-resolution Discover asset from `re-image website/output/discover-20261023/botticello-auto-repair-2026.png`. The current design follows the supplied DoorDash reference with a single solid charcoal hero, real shop photos framing the centered headline and calls to action, rounded buttons, and locally hosted Barlow Condensed headlines with Barlow body typography. The rest of the site keeps clear alignment, generous spacing, real photography, and no decorative effects. Form stages use descriptive labels without visible numbers.

The homepage includes Eastern-time shop status, a seven-day hours table, and the same four-step estimate form as `estimate.html`. Optional VIN, mileage, issue details, and photos reach the existing Convex request workflow and admin detail view. Existing appointment requests remain compatible. Five independently sourced Google review excerpts are documented in [REVIEW-SOURCES.md](REVIEW-SOURCES.md).

## Security and performance

Customer records use AES-256-GCM with a fresh nonce and record-bound authenticated data. Email rate-limit identifiers and submission keys use keyed HMAC indexes. Photos are encrypted in Convex storage and served only through an authenticated, no-store HTTP endpoint; the admin lazily loads them as short-lived browser blob URLs. Public pages and API endpoints require HTTPS, except localhost page previews (the API still uses HTTPS).

Admin passwords use PBKDF2-HMAC-SHA-256 (600,000 iterations), unique random salts, and a server-only HMAC pepper. After five consecutive failed attempts, the account locks for 30 minutes. Successful authentication clears the failure count. An internal `login:unlock` operation is available to deployment administrators. Public signup and password reset are disabled.

Sessions have a hard 30-minute lifetime, short-lived access tokens, and server checks against the current session row on every customer-data operation. The portal clears its customer view at expiration, including on returning from a background tab, and stores auth tokens in sessionStorage. Existing long-lived sessions were revoked during the rollout.

Production-only secrets: CUSTOMER_DATA_KEY, CUSTOMER_INDEX_KEY, ADMIN_PASSWORD_PEPPER. These are separate random 32-byte keys, kept in Convex environment settings, never in frontend bundles or source control. Preserve backups through your secret-management process. Do not replace encryption keys without a versioned migration: old ciphertext cannot be recovered without the old key. ALLOWED_WEB_ORIGINS is a comma-separated list for the public/admin photo HTTP endpoints; add the actual hosting origins before changing hosts. Current defaults include the business domain and local previews.

The internal securityMigration functions support one-record-at-a-time legacy migration and aggregate-only audit results. Existing password verifiers are first sealed with the pepper, then upgraded after a valid login. The production account has completed that upgrade. Migration and provisioning functions are internal, not browser-callable.

There are no vehicle-sales pages, admin controls, or inventory endpoints. Below-the-fold photographs use native lazy loading; the estimate module loads as its section approaches view. Scroll reveals use opacity only and respect reduced-motion preferences. Content remains visible if animation support is unavailable.

The root `landing-page.html` provides a compact, mobile-first shop directory based on the Tuff Cuts layout: location, phone, hours, and call, appointment, estimate, and social actions. The social panel awaits the shop’s verified social profile URL. Font files are distributed under the SIL Open Font License included in `assets/fonts/OFL.txt`.
