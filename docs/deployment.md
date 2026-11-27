# Folio production deployment

For the static frontend and serverless API setup, follow [Vercel deployment](vercel.md). The steps below describe a long-running Node service.

Deploy the frontend and API as one Node service behind HTTPS. The Dockerfile builds the Vite bundle, installs production dependencies in the runtime image and runs Node as an unprivileged user. A Node host can also run npm ci, npm run build and npm start. The service binds to HOST and PORT, and the probe is GET /api/ready.

## Configure the host

| Variable | Production value |
| --- | --- |
| NODE_ENV | production |
| HOST | 0.0.0.0 for a container. Limit access to the platform ingress. |
| PORT | Listener port assigned by the host, or 4000 |
| APP_ORIGIN | Exact public HTTPS origin with no trailing slash, e.g. https://books.example.com |
| COOKIE_SECURE | true |
| TRUST_PROXY | 1 only when every request passes through one trusted ingress that overwrites forwarding headers. Otherwise leave 0 and configure request throttling at the ingress. |
| MONGODB_URI | Secret connection string for a separate production MongoDB replica set or sharded cluster. Use TLS, narrowly scoped credentials, encrypted backups and restricted network access. |
| STORE_LEGAL_NAME, STORE_ADDRESS | Public legal merchant name and business address |
| STORE_SUPPORT_EMAIL, STORE_SUPPORT_PHONE | Monitored public support details |
| STORE_PRIVACY_EMAIL | Monitored contact for data rights requests |
| STORE_RETENTION_NOTICE | Public retention periods and criteria for account, order and backup data. Match actual operations. |
| STORE_DELIVERY_NOTICE | Public service area, estimated dispatch and delivery, and returns procedure. Keep this consistent with the charges shown at checkout. |
| ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD | Provisioning-job settings. Supply a strong unique password through the host secret manager. |

Do not put credentials in the Docker build context or a Vite variable. The Docker context excludes dotenv files. Reject direct inbound traffic when trusting a proxy. Start with one instance or use shared limits at the ingress. The application stores its per-IP API and authentication counters in each process's memory.

## Build and initialize

1. Build the container with `docker build -t folio-bookshop .`, or use the Node host build steps above.
2. Point the one-time jobs at the production database. Run `npm run seed` to insert the reviewed catalog and `npm run admin` to create the first administrator. The seed skips existing book IDs. The same production image contains both commands. Supply admin provisioning secrets only to the one-time job.
3. Deploy the image or start Node. Configure the platform probe for `/api/ready` and HTTPS at the ingress. Keep the API and frontend on the same origin. API clients making production writes need the exact configured Origin and JSON when sending a body.
4. Confirm the production cookie starts with `__Host-` and has Secure, HttpOnly and SameSite=Lax. In staging check account signup, checkout, admin access, order ownership, sign-out and the privacy and terms links. Confirm the real proxy and database setup before moving traffic.

To rotate an existing administrator password, update ADMIN_PASSWORD in the one-time job's secrets and run `npm run admin -- --rotate-password`. The command changes the hash and revokes that administrator's active sessions in one transaction. For a fresh account, use `npm run admin`.

## Privacy and sales operations before public launch

Folio records the version and time of terms acceptance. Change the version in shared/policies.js when publishing revised terms. The privacy notice is a disclosure. The app does not use the terms checkbox as blanket consent for other processing.

- Confirm the controller and merchant identity, service area, deliveries and consumer support details. Confirm which Philippine seller obligations apply, including registration, receipts or invoices, remedies and complaint handling. [DTI Internet Transactions Act and implementing rules](https://ecommerce.dti.gov.ph/ra11967/)
- Document the actual retention and deletion schedule for live data and backups, who answers rights requests, identity verification and the incident response procedure. The application provides a contact and account editing. Retention enforcement, rights request fulfillment and breach reporting are operator duties and need an operational process. [NPC Data Privacy Act implementing rules](https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/) and [data subject rights](https://privacy.gov.ph/data-subject-rights/)
- Review provider and delivery partner access and use restricted production credentials. Confirm catalog images, descriptions, stock and prices are authorized and accurate before offering sales. The bundled data is for development and demonstration.
- Restrict logs and database backups to authorized operators. Use staging to verify recovery and prevent customer details, credentials and session cookies from entering infrastructure logs. Review changes to the privacy notice whenever providers, usage or retention changes.
