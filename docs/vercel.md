# Deploy Folio to Vercel

Import the repository into Vercel and choose the directory containing package.json and vercel.json as Root Directory. If GitHub shows the enclosing eCommerce Project directory, select InfoSec-Book-harvest. Set Framework Preset to Other and Node.js to 22.x. The tracked vercel.json supplies installation, build, static output and API routing.

The build copies cover files into client/dist/covers. Vercel serves the frontend and covers statically. api/index.js forwards API requests to Express after validating configuration and initializing a reusable MongoDB connection. Direct navigation to React pages returns index.html. Keep this deployment on a single canonical domain.

## Environment settings

Add these in Vercel Project Settings, Environment Variables, for Production.

| Name | Value |
| --- | --- |
| NODE_ENV | production |
| MONGODB_URI | Your private Atlas connection string including /folio |
| APP_ORIGIN | Your exact production origin, e.g. https://folio-yourname.vercel.app, without a trailing slash |
| COOKIE_SECURE | true |
| TRUST_PROXY | 1 for the Vercel ingress |
| STORE_LEGAL_NAME | Actual public operator name |
| STORE_ADDRESS | Actual public business address |
| STORE_SUPPORT_EMAIL | Monitored support email |
| STORE_SUPPORT_PHONE | Public support number |
| STORE_PRIVACY_EMAIL | Monitored privacy contact |
| STORE_RETENTION_NOTICE | Actual retention periods and criteria |
| STORE_DELIVERY_NOTICE | Service area, timing and returns procedure |

Do not prefix database credentials with VITE_. Host and port are managed by Vercel. ADMIN_* credentials are only needed for local or one-time account provisioning. Production startup rejects missing store details and insecure cookie configuration.

Use the domain shown by Vercel for APP_ORIGIN, then redeploy after changing variables. A preview domain needs its own exact origin and a separate staging database for meaningful signup and checkout testing. Keep preview deployment protection enabled.

## Atlas and account setup

Allow the Vercel backend's outbound connections in Atlas. The IP used by your laptop covers local access only. Use a static-egress networking option when available, or review the security tradeoff before opening Atlas access to all IPs. Atlas database authentication is still required. The regular Vercel runtime can use changing outbound addresses.

The cloud catalog was seeded separately from the Vercel build. Build and request handlers never seed the database. In a local terminal pointed at the intended Atlas database, run npm.cmd run admin to provision the admin using your local ADMIN_* values. Keep these values private. Run npm.cmd run seed only when initializing the catalog or inserting missing dataset records.

## Verify the deployed site

1. Open /api/ready and confirm status ready.
2. Open /api/books and confirm the catalog is returned.
3. Open the catalog and a book directly, refresh and confirm the cover loads.
4. Register, verify signed-in home redirect, then add a book and complete COD checkout.
5. Reload order history and verify the saved order.
6. Sign in as administrator, update fulfillment, then verify the customer sees it.

The bundled rate limits are per-process. Configure shared abuse protection at the platform or shared application layer before relying on rate limits across scaled function instances. Public Atlas connectivity, actual proxy headers, cookies, and CDN security headers require verification after deployment.

Local build, API adapter smoke tests and automated application tests provide preparation evidence. A live Vercel deployment remains unverified until the deployed checks above are executed.

Official references are the [Node.js function runtime](https://vercel.com/docs/functions/runtimes/node-js) and [project routing configuration](https://vercel.com/docs/project-configuration/vercel-json).
