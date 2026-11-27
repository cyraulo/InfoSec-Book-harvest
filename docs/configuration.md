# Configuration and troubleshooting

Copy the root .env.example to .env. Vite proxies /api and /covers to the Express process. There are no client-side credentials or cross-origin API requirements.

| Variable | Required and example | Purpose |
| --- | --- | --- |
| MONGODB_URI | Required. mongodb://127.0.0.1:27018/folio?replicaSet=folio | Replica set or sharded MongoDB URI. Use authentication and TLS for a deployed database. |
| HOST | Optional. 127.0.0.1 | API bind address |
| PORT | Optional. 4000 | API port and Vite proxy target port |
| APP_ORIGIN | Set to the browser URL. http://localhost:5173 | Exact allowed browser origin for writes, without trailing slash |
| NODE_ENV | Optional. production when deployed | Controls Secure cookie default |
| COOKIE_SECURE | Optional. false on local HTTP, true behind production HTTPS | HttpOnly session cookie Secure flag |
| TRUST_PROXY | Optional. 0 or 1 | Trust exactly one controlled ingress proxy when set to 1 |
| ADMIN_NAME | Optional. Folio Administrator | Provisioned admin display name |
| ADMIN_EMAIL | Required for npm run admin. admin@example.test | Unique admin account email |
| ADMIN_PASSWORD | Required for npm run admin. Replace the sample | Initial password with 10 to 128 characters |
| BROWSER_CHANNEL | Optional for Playwright. chrome | Use installed Chrome instead of Playwright Chromium |
| MONGOMS_SYSTEM_BINARY | Optional. Absolute path to a compatible mongod | Skip binary download for local development or test databases |
| MONGOMS_VERSION | Optional. A supported MongoDB release | Choose the MongoDB version used by mongodb-memory-server |
| GOOGLE_BOOKS_API_KEY | Optional for the separate Python collector | API credential supplied through the collector process environment. The MERN application does not use it. |

Local development URLs are http://localhost:5173 for Vite and http://127.0.0.1:4000 for the Express listener. The browser should use one host consistently. To preview the built bundle over local HTTP, use NODE_ENV=development, APP_ORIGIN=http://localhost:4000 and COOKIE_SECURE=false. For internet deployment, follow [the deployment runbook](deployment.md). Production refuses to start without an exact HTTPS origin, secure cookies and the operator's public details.

The local database script can download a MongoDB binary on its first run. Its data directory is .local/mongo. Do not run two database instances against that directory. For a managed service create a test database and configure access from your deployment before running seed and admin. Production Express serves cover files from images/. Missing and broken images show the same fallback. Admin cover paths are local and must match /covers/category/file.ext.

| Symptom | Recovery |
| --- | --- |
| Cannot connect to MongoDB | Start the local replica set or check your managed connection string and access rules. |
| Standalone MongoDB rejected | Start a replica set. Multi-document transactions are required. |
| Login works but the browser loses the session | Check the browser hostname, cookie Secure setting and origin. Do not mix localhost and 127.0.0.1 URLs. |
| Mutations return 403 | Match APP_ORIGIN to the browser scheme, host and port. |
| Cover is unavailable | Confirm the file exists below images/ at the matching local path, with the correct case. |
| First test cannot download MongoDB | Use MONGOMS_SYSTEM_BINARY or set up access to the MongoDB binary download. |
| Port in use | Free ports 27018 or 5173 for the documented local commands. Change PORT and restart both dev processes to move the API. The browser test server uses port 4175. |
