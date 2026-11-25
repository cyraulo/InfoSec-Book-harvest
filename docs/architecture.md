# Folio architecture

Folio is a React and Vite single page application with an Express API and a MongoDB replica set. React Router owns page navigation. Vite forwards same-origin requests for the API and local covers in development. Express serves the built SPA, cover files and API in production.

| Location | Responsibility |
| --- | --- |
| client/src/main.jsx | Route tree, shared navigation and role-aware entry points |
| client/src/account.jsx, catalog.jsx, purchase.jsx, admin.jsx | Page and workflow components |
| client/src/shared.jsx, styles.css, api.js | Shared controls and tokens, request cancellation and pending state |
| server/app.js, routes.js, controllers.js | Express setup, endpoint and middleware wiring, validation and response mapping |
| server/validation.js, auth.js | Allowlisted input schemas, session and role checks, password hashing |
| server/services/ | Catalog, category, cart, stock and order business rules |
| server/models.js | Mongoose schemas, indexes and database startup |
| server/scripts/ | Repeatable seed, administrator provisioning and optional local MongoDB |
| server/test/, e2e/ | Real database API tests and Playwright browser workflows |
| dataset/, images/, scraper/ | Existing import source, book covers and Python collector |

A browser request flows through origin and content-type checks, authentication and role middleware where applicable, controller validation, business service, and then Mongoose. The API constrains queries by the authenticated customer before returning private data. Server failures use one JSON error envelope. Catalog filters live in the URL, drafts live in their forms and canonical store data lives in MongoDB. The API helper aborts obsolete requests and the checkout stores only an attempt key per browser tab for receipt recovery.

Passwords use Node's asynchronous scrypt with a random per-password salt and constant-time comparison. Login produces a random 256-bit opaque token. The database stores a SHA-256 hash with a seven-day expiry and TTL index. The browser receives an HttpOnly, SameSite=Lax cookie with Secure enabled by default in production. Login rotates the current presented token and logout deletes it. The API checks both expiry and the current role. Origin checks, JSON mutation bodies and SameSite cookies protect browser writes. Login and registration share an in-process limit of 25 attempts per IP per 15 minutes. Use a shared rate-limit store if deploying multiple API processes.

Checkout and cancellation use real multi-document transactions. The guarded stock decrement and order/cart writes commit together. The customer and checkout-key index ensures a retry returns the same receipt. A monotonically increasing cart revision and a client quote verified against the server total prevent checkout from silently accepting changed quantities or pricing. Cash on delivery begins Unpaid, becomes Paid on delivery and becomes Cancelled when an eligible order is cancelled. Payment reconciliation is a fulfillment assumption for this version.
