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
