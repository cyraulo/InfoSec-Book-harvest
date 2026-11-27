# Folio testing and verification

The page-motion update passed lint, the production build and all four Chromium scenarios. E2E-04 opens a book by keyboard, checks focus on the destination, returns to the filtered catalog with Back, changes the search, and opens the book again with reduced motion enabled. It observes one entrance per page change with normal motion and none on direct load, a same-page search, or reduced-motion navigation.

The storefront refresh passed 13 API tests, three Chromium browser scenarios, lint and the production build. The home and catalog axe scans returned zero violations for the configured WCAG tags. Desktop and narrow screenshots are written under `test-results` by the browser suite.

Security and deployment follow-up. The 12 API tests cover current terms validation, stronger password hash migration, administrator password rotation and session revocation, secure cookie attributes, allowed write origins, rate limits, clean error responses and order ownership. The 2 browser scenarios cover signed-in home redirect and reload after signup, policy pages, and the existing purchase and administration flows. Lint and the production build passed. The npm audit reported zero known dependency vulnerabilities at the time of the check.

The production Node entry point started against an isolated replica set using test merchant details and served the readiness endpoint and built privacy route. It refused to start with secure cookies disabled. The Docker build could not run because the Docker Desktop engine was unavailable. An external HTTPS endpoint, production database and actual merchant policies still need staging verification before a public release.

The API suite uses Supertest and a disposable real MongoDB replica set. It checks writes through Express and re-reads via the API or Mongoose. The browser suite serves the production build and seeds a separate disposable database. Playwright exercises the UI using labeled fields and role-based selectors. The suite records Playwright traces on assertion failures and captures review screenshots under test-results.

## Commands

    npm run lint
    npm test
    npm run build
    npx playwright install chromium
    npm run test:e2e

The first run may need access to download the MongoDB binary and browser. Set MONGOMS_SYSTEM_BINARY if a compatible local mongod is already available. Browser tests use local port 4175.

The original Windows verification used Node 22.20 and Vite 7.3.8. The local development smoke test started the on-disk replica set, seeded 193 books and fetched the Vite home page, the proxied MongoDB catalog and a local cover. The retained Python collector suite passed all six tests in that run.

## Execution matrix

| ID | Feature and operation | Preconditions | Steps | Expected | Actual result | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-01 | Register, sign in, read/edit profile, logout, expiry | Fresh test DB, customer accounts | Submit invalid and valid credentials, repeat email in other case, patch permitted fields, try role update and cross-origin write, expire token and repeat | Valid credentials create a session, profile persists, unauthorized and invalid actions fail | HTTP and database assertions matched. HttpOnly cookie and withheld password hash checked. | Pass | server/test/workflows.test.js |
| AUTH-02 | Throttle authentication | Test limit of 1 | Submit two invalid logins | First 401, second 429 | Both statuses and error body matched | Pass | API suite |
| CAT-01 | Category create, read, list, edit, delete | Admin and customer sessions | Create and edit, re-read, delete, re-read. Try invalid name, duplicate, missing ID and customer write | Valid edits persist, delete removes record, forbidden and invalid calls fail | CRUD and 400/403/404/409 responses matched | Pass | API suite, E2E-01 |
| BOOK-01 | Book CRUD, catalog search, category protection | Category exists | Try guest/customer API access, invalid price, category and stock, create with blank pages, edit and re-read, search by title/author/ISBN, remove unused title | Required validation and permissions. Used category remains. | Valid writes/readbacks and search matched. Used category returned 409. | Pass | API suite, E2E-01 |
| CART-01 | Add, read, update, remove and clear | Two shoppers, stocked title | Add line, re-read, update and reload, remove, clear. Try invalid/missing line, excess stock and wrong role. | Separate persistent carts and controlled quantities | Quantity and ownership responses matched, cart empty after removal/clear | Pass | API suite, E2E-01 |
| ORDER-01 | Checkout, replay, order privacy, archive and cancellation | Cart with two lines, administrator | Submit wrong total, reduce stock, retry, then send same key concurrently. Read under two users. Cancel twice and remove referenced book. | Failures roll back, one order, exact amount, owner access, stock restored once | 409s caused no partial deduction, 201/200 returned same receipt, non-owner read 404, cancellation restored exact stock | Pass | API suite |
| ORDER-02 | Simultaneous purchase and fulfillment | Two carts, one copy | Checkout simultaneously, advance winning order through statuses | One purchase, no oversell, delivered COD becomes paid | 201 and 409, stock zero, delivered Paid and post-shipment cancellation blocked | Pass | API suite |
| SEED-01 | Real source import and replay | Test replica set, CSV and images present | Seed, inspect price and ISBN, edit stock, seed again, request cover paths | 193 entries with preserved IDs and edits, correct image responses | 193 imports, 193 skips on replay, zero invalid rows or missing covers | Pass | API suite |
| SETUP-01 | Environment-based seed and admin CLI | Replica set URL and disposable admin config | Execute seed CLI and admin CLI twice, sign in with provisioned account | Seed is replayable and admin setup produces one user | Replay reported 193 existing records, admin provisioned then recognized, login succeeded | Pass | API suite |
| E2E-01 | Full cross-role browser workflow | Built site, test admin, seeded database | Admin create/edit/remove a test book and category. Customer register, change profile, find a book, change cart quantity, checkout, reload order history. Admin confirm order. | Saved CRUD, one receipt after retry, order status visible on customer reload | Admin CRUD and profile persisted. Checkout double click sent one request. A lost response replay returned one receipt. Confirmed was visible after reload. Keyboard dialog focus and long, unavailable title with no cover also passed. | Pass | e2e/store.spec.js, admin-order.png |
| E2E-02 | Catalog and error states, accessibility and reflow | Built catalog served in Chromium | Resize to 320/700/1280 px, enlarge root to 200%, scan catalog with axe, simulate offline read, no results, empty catalog/cart, invalid session | No document overflow, recovery retains query, states visible | All three widths and 32 px root type passed. No axe violations in the configured catalog scan. Narrow filters expand on demand. Retry, empty and expired-session states passed. | Pass | e2e/store.spec.js, home-desktop.png, catalog-320.png |
| MAN-01 | Screen reader announcements, phone keyboard, additional browsers, field performance | Physical devices, assistive technology and real traffic | Complete checkout and dialogs with assistive tools, measure actual traffic | Document applicable WCAG behavior and real LCP/INP/CLS | No devices, assistive technology session or traffic used | Not run | Follow-up manual evaluation |
| SHELF-01 | Featured book inventory | Seeded test database | Read display order after a stock edit, archive the first pick, fetch again | Current stock and nine distinct active titles | Live stock matched, next edition moved up and a catalog title filled the vacancy | Pass | server/test/workflows.test.js |
| E2E-03 | Home browsing and reflow | Built site with seeded database | Change the feature by keyboard, open its detail page, switch genre, open catalog and search. Resize to 320, 700 and 1280 px at normal and doubled text. Fail the display request, retry and serve an empty shelf. | Correct title, category and stock context, reachable controls and distinct recovery states | All checks passed. At 320 px and doubled text the jacket stacks below the title. A separate emulated touch check opened the active Fantasy filter. | Pass | e2e/store.spec.js, home-320.png |

## Defects resolved

- Vite initially could not resolve its config under the Windows sandbox. Building with the normal host permissions exposed an unterminated JSX interpolation in the inventory table, which was corrected and rebuilt.
- A blank page count passed request validation and failed Mongoose validation. Optional integer fields now allow null and the API and browser tests cover a book with no page count.
- The original Windows test-server subprocess held its listener during runner shutdown. Playwright setup now owns the Express server and replica-set teardown.
- Screenshot review found that the full hero and narrow filters used too much of the first screen. The hero was reduced and the optional filters now use a native disclosure on narrow screens.
- At 320 px with doubled text, the featured title initially broke inside words. A container query now stacks the book display and gives the enlarged search field its own line. A browser assertion checks that the cover sits below the title at this size.

## Interpretation

A local cold-load trace used the built home page, 193 seeded books, headless Chromium at 1280 × 850, a disabled cache, 80 ms simulated latency and a 200 kB/s download limit. The featured jacket was the largest visible element. Reserving space for the loading shelf reduced cumulative layout shift from 0.132 to 0.007 in two comparable traces. Largest contentful paint measured 2.98 s before and 2.94 s after. That last measurement exceeds the 2.5 s target under this network profile. These are single lab observations.

The browser suite checks Chromium and injects a computed 32 px root font size for its 200% text test. An axe catalog scan and keyboard dialog assertions cover specific accessibility behavior. Full WCAG 2.2 AA conformance, platform assistive technology testing, cross-browser coverage, mobile software keyboard layout and field performance remain unverified. Testing exercises a local single-node replica set, so managed-cluster failover and public TLS deployment are outside this verification.
