# What Where When - Server

Backend server for the **What Where When** game platform.

Built with:
- Node.js
- NestJS
- Prisma
- PostgreSQL
- JWT authentication

---

## Requirements

- Node.js >= 18 (recommended 20)
- npm
- Docker (for PostgreSQL, required for e2e tests)

---

## Installation

```bash
npm install
````

---

## Environment variables

Create `.env` file in the project root:

```env
DATABASE_URL=postgresql://www:www@localhost:5432/www?schema=public
JWT_SECRET=change_me
```

See [.env.example](.env.example) for the full list.

---

## Database (local development)

Start PostgreSQL using Docker:

```bash
docker compose up -d
```

Apply Prisma schema:

```bash
npx prisma migrate dev
```

If you see `P2021` / “table does not exist” on startup, the database URL points at an empty or wrong database. Create the schema with the commands above (dev) or `npx prisma migrate deploy` on servers/CI after `docker compose up -d` (or your managed Postgres).

Generate test data:

```bash
npx prisma db seed
```


---

## Running the app

```bash
npm run start:dev
```

Server will be available at:

```
http://localhost:3000
```

---

## Tests

### Unit tests

```bash
npm run test:unit
```

### E2E tests (uses separate test database)

```bash
docker compose -f docker-compose.test.yml up -d
npm run db:test:push
npm run test:e2e
```

E2E tests automatically use a test database and JWT test secret.

---

## Linting

```bash
npm run lint
```

---

## CI

This repository uses **GitHub Actions** to check pull requests:

* ESLint
* Unit tests
* E2E tests with PostgreSQL

All checks must pass before merging to `main`.

---

## Monitoring

### Metrics (Prometheus + Grafana) — MVP

This repository ships a minimal “batteries-included” metrics stack for
local testing and for deployment on Hetzner:

- **Prometheus** (scrapes metrics)
- **Grafana** (dashboards)
- **postgres_exporter** (Postgres metrics)
- **redis_exporter** (Redis metrics)
- **node_exporter** (host/container saturation metrics)

The NestJS app exposes Prometheus-format metrics at:

- `GET /metrics`

#### Local run (macOS / Docker Desktop)

1. Start Postgres + Redis:

```bash
docker compose up -d
```

2. Start Prometheus + Grafana:

```bash
docker compose -f docker-compose.monitoring.yml up -d
```

3. Start the server (in another terminal):

```bash
npm run start:dev
```

4. Open:

- Grafana: `http://localhost:3001` (login `admin` / `admin`)
- Prometheus: `http://localhost:9090`
- App metrics: `http://localhost:3000/metrics`

The default provisioned dashboard is **“What Where When — MVP”** (folder
“MVP”).

Provisioned Prometheus datasource UID is **`www-prometheus`** (see
`monitoring/grafana/provisioning/datasources/datasource.yml`); all bundled
dashboards reference that UID. After changing provisioning, restart Grafana
(`docker compose … restart grafana`) so it reloads JSON. If you had an old
`grafana_data` volume created before this UID existed, remove the volume once
or delete duplicate “Prometheus” datasources in Grafana so only the
provisioned one remains.

#### Hetzner deployment

For a simple VPS deployment, you can run the same compose file on the
server.

- If your app runs **on the host** (not in Docker), Prometheus needs to
  reach the app’s `/metrics` endpoint. Replace the `host.docker.internal`
  target in `monitoring/prometheus/prometheus.yml` with `127.0.0.1:3000`
  and set up Prometheus in `host` network mode, or put the app into
  Docker as a service on the same network.
- Grafana’s datasource is `http://prometheus:9090` (Docker DNS). The
  monitoring compose puts Grafana and Prometheus on a dedicated
  `monitoring-internal` bridge so that name always resolves. If you still
  see `lookup prometheus ... no such host`, recreate the stack:
  `docker compose -f docker-compose.monitoring.yml down && docker compose -f docker-compose.monitoring.yml up -d`
  and ensure you are not running a standalone Grafana container with
  that URL while Prometheus runs elsewhere.
- Restrict access to Grafana/Prometheus (firewall / reverse proxy / VPN).

---

## Notes

* Database migrations are managed with Prisma.
* JWT configuration is environment-based.
* E2E tests run against a real PostgreSQL instance.

---

## Project status

This project is currently developed as part of a bachelor's degree program.

The codebase is proprietary. Any commercial use or redistribution requires
explicit permission from the authors.

## License

This project is proprietary software.

All rights reserved.  
Unauthorized copying, distribution, or modification is prohibited.
