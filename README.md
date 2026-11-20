# antitrump Marketplace

A Next.js marketplace for customers and independent sellers. Buyers and sellers arrange payment and delivery directly; online payments are not integrated.

## Features

- Accounts, optional email verification and password recovery via SMTP.
- Searchable catalog, product and store pages, favorites and shopping cart.
- Seller dashboard for products, inventory, images and orders.
- Orders with price and stock checks, cancellations, tracking and duplicate-submission protection.
- Order messages, reviews, product reports and administrator moderation.
- Administration dashboard with order overview, moderation search and an audit log of administrative actions.

Prices are displayed in Russian rubles (RUB). Automated delivery integrations are not included.

## Local development

Requires Node.js 24 and npm:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. The catalog starts empty. Register, open the seller dashboard and add a product. Use a second account to test purchasing: sellers cannot buy their own products.

For a production build and integration tests:

```sh
npm run build
npm test
npm start
```

Set COOKIE_SECURE=false when testing the production build locally over HTTP. Use HTTPS and secure cookies on a public server.

## Configuration

Copy .env.example to .env.local. Next.js loads .env.local; Docker Compose reads .env or the process environment.

| Variable                   | Purpose                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| APP_URL                    | Public application origin, used in emails and origin checks.                                 |
| COOKIE_SECURE              | Set to false only for local HTTP; use true with HTTPS.                                       |
| DATA_DIR                   | Persistent directory for the database and uploads; defaults to ./data.                       |
| SMTP_URL                   | SMTP URL and credentials. Keep secrets out of the repository.                                |
| MAIL_FROM                  | Sender address for account emails.                                                           |
| REQUIRE_EMAIL_VERIFICATION | Require verified email; requires APP_URL, SMTP_URL and MAIL_FROM.                            |
| TRUST_PROXY                | Enable only behind a trusted proxy that strips incoming forwarding headers and sets its own. |

Without SMTP, password recovery emails are unavailable. If verification is required, registration is disabled until SMTP is configured. Existing users must request a verification email when verification is enabled. Without a trusted proxy, request limits are shared across clients.

## Administrator

Register an account, then run `npm run admin -- email@example.com` on the server with the same DATA_DIR as the application. This grants administrator rights to an existing account. Restrict server access: the command does not require confirmation through the web interface.

The administration screen shows overall counts and the latest 500 records in each section. Search applies to those loaded records. Moderation actions are recorded in the database with the administrator, target, action and time. Administrative access includes personal information, so grant it only to trusted operators.

## Docker

Copy .env.example to .env, configure APP_URL and run `docker compose up --build -d`. Compose binds to 127.0.0.1:3000. Configure an HTTPS reverse proxy and the correct APP_URL for public access. Preserve the marketplace-data volume across updates. To grant administrator rights in the container, run `docker compose exec marketplace npm run admin -- email@example.com`.

`GET /api/health` returns a minimal readiness status and checks database connectivity. Docker Compose uses this endpoint for its health check; configure external monitoring to alert on failures. A healthy response does not verify SMTP, backups or available disk space.

## Backups

Run `npm run backup -- /path/to/new-backup.sqlite` with the application's DATA_DIR to create a consistent database snapshot. Existing files are not overwritten. Back up DATA_DIR/uploads separately. Store backups off the server and test restoration. To restore, stop the application, preserve the current data, replace the database and restore the matching uploads directory.

## Structure

- app/ — Next.js page, HTTP API and image delivery.
- components/ — catalog, checkout, account and moderation interfaces.
- lib/ — database, authentication, validation and business logic.
- scripts/ — administrator management and backups.
- tests/ — integration tests for orders, permissions, email and migration.

## Operational limits

The application targets one Node.js instance with persistent SQLite storage; Node.js marks its built-in node:sqlite module as experimental. The catalog is loaded in full and dashboards cap displayed records. Larger deployments need pagination and a different storage architecture. Public operation also requires monitoring, tested backups, a security review, moderation procedures, legal documents and processes for personal data and disputes. Per-IP limits require a correctly configured trusted proxy. Do not use ephemeral storage for the database or uploads.
