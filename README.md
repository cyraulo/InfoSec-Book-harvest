# Folio Bookstore

Folio is a single-store MERN bookstore for an academic e-commerce project. Customers can browse 193 seeded books, manage a persistent cart, check out with cash on delivery, and track their orders. Administrators can manage categories, titles, stock, and fulfillment from a separate dashboard. MongoDB stores account, catalog, cart, order, and session data.

## Install and run

Use Node.js 22.12 or newer, npm, and a MongoDB replica set. The local development command downloads a MongoDB binary on its first run and stores the database on disk under .local/mongo. Alternatively, supply an authenticated replica set or sharded cluster URI. A standalone MongoDB server cannot run the required transactions.

From the InfoSec-Book-harvest directory in PowerShell:

```powershell
npm ci
Copy-Item .env.example .env
```

Set ADMIN_EMAIL and a unique ADMIN_PASSWORD in .env. In one terminal start the local replica set and keep it running:

```powershell
npm run db:ephemeral
```

In another terminal import the catalog, create the administrator, and start both the API and Vite:

```powershell
npm run seed
npm run admin
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Register on the site for a customer account. Use your configured administrator credentials for the dashboard. The local API listens on port 4000. The insert-only seed supports reruns and reports existing records, problems and missing covers. The catalog prices are demo amounts in Philippine pesos. Stock starts at 12 per imported title and delivery is free for this version.

## Build, run and test

```powershell
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

API and browser tests provision isolated real MongoDB replica sets. The first run can download a database binary. To use an existing Chrome installation in PowerShell, set `$env:BROWSER_CHANNEL = 'chrome'` before running browser tests.

To serve the built SPA and API together on local HTTP:

```powershell
$env:APP_ORIGIN = 'http://localhost:4000'
$env:COOKIE_SECURE = 'false'
npm run start
```

Open [http://localhost:4000](http://localhost:4000). For deployment set NODE_ENV=production, APP_ORIGIN to the public HTTPS origin, COOKIE_SECURE=true and MONGODB_URI to your protected cluster. Keep the API and SPA on the same origin. Set HOST according to the deployment and keep the database private.

## Documentation

- [Requirements and grading checklist](docs/requirements.md)
- [Architecture and authentication](docs/architecture.md)
- [Database, indices and dataset mapping](docs/database.md)
- [API reference](docs/api.md)
- [Design and accessibility](docs/design.md)
- [Environment configuration and troubleshooting](docs/configuration.md)
- [Testing evidence and limitations](docs/testing.md)
- [Customer and administrator user guide](docs/user-guide.md)
- [Implementation progress](docs/progress.md)
- [Original Python collector](docs/collector.md)

The original Python collector remains available for refreshing catalog source data. It regenerates the input CSV and JSON and may output blank prices. The bookstore uses the existing priced CSV via the seed command.
