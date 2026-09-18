# Smart Food Backend

[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Deploy](https://github.com/duyaivy/smart-food-be/actions/workflows/redeploy-render-release.yml/badge.svg?branch=release)](https://github.com/duyaivy/smart-food-be/actions/workflows/redeploy-render-release.yml)

The backend service for Smart Food: a food, nutrition, smart-fridge, and IoT platform with image-based ingredient recognition and personalized meal recommendations.

## Overview

Smart Food Backend is a versioned REST API built with Express and TypeScript. It manages users, dishes, ingredients, fridges, meals, and nutrition data while coordinating several asynchronous and external systems:

- PostgreSQL stores application data through Prisma.
- Redis provides caching, IoT device status, and BullMQ-backed recommendation jobs.
- MQTT and Server-Sent Events deliver smart-device scan results in real time.
- An embedded ONNX model classifies ingredient images.
- An external recommendation service generates meal plans, with mock fallback support.
- Cloudinary stores uploaded media and Expo delivers push notifications.

The service exposes application APIs under `/v1` and a separate health endpoint at `/health`.

## Features

- JWT authentication with access-token and refresh-token rotation
- Password reset, email verification, and configurable SMTP delivery
- User profiles, body metrics, activity levels, avatars, and role-based administration
- Dish, ingredient, and category CRUD with soft deletion and incremental sync
- Personal fridge inventory, expiry priorities, and transaction history
- Atomic ingredient deduction when a meal is recorded
- Daily and weekly nutrition summaries with remaining nutritional targets
- Asynchronous meal-plan recommendations through BullMQ
- IoT device pairing, heartbeat monitoring, image scans, MQTT publishing, and SSE streaming
- Local MobileNetV3 ONNX inference for ingredient classification
- Image upload to Cloudinary with file type and size validation
- Expo push-token registration, content notifications, and receipt monitoring
- Redis caching for frequently requested data
- Structured logging, centralized errors, request validation, and security middleware
- Docker image, Prisma migrations, PM2 runtime, and Render deployment hook

## Tech Stack

| Area               | Technology                           |
| ------------------ | ------------------------------------ |
| Runtime            | Node.js 20                           |
| Language           | TypeScript 4.9                       |
| Web API            | Express 4                            |
| Database           | PostgreSQL 16, Prisma ORM            |
| Cache and jobs     | Redis 7, ioredis, BullMQ             |
| Authentication     | Passport JWT, JSON Web Token, bcrypt |
| IoT and realtime   | MQTT, Server-Sent Events             |
| Machine learning   | ONNX Runtime, MobileNetV3, Sharp     |
| Media              | Multer, Cloudinary                   |
| Notifications      | Expo Server SDK, node-cron           |
| Validation         | Joi                                  |
| API documentation  | OpenAPI 3, swagger-jsdoc, Swagger UI |
| Logging            | Winston, Morgan                      |
| Testing            | Jest, ts-jest, Supertest             |
| Runtime operations | Docker, Docker Compose, PM2          |
| Package manager    | pnpm 10.29.3                         |

## Architecture

```mermaid
flowchart LR
    Client[Mobile / Web Client] --> API[Express REST API]
    Device[Smart Food Device] -->|HTTP scan| API
    API --> Auth[Auth and validation middleware]
    Auth --> Modules[Domain controllers and services]

    Modules --> Prisma[Prisma ORM]
    Prisma --> PostgreSQL[(PostgreSQL)]

    Modules --> Redis[(Redis)]
    Redis --> BullMQ[BullMQ recommendation worker]
    BullMQ --> Recommender[Recommendation API]

    Modules --> ONNX[ONNX ingredient classifier]
    Modules --> Cloudinary[Cloudinary]
    Modules --> Expo[Expo Push Service]
    Modules --> MQTT[MQTT broker]

    MQTT --> Device
    API -->|SSE scan result| Client
```

The application is organized by HTTP and domain layers:

1. Routes compose authentication, upload, and Joi validation middleware.
2. Controllers translate HTTP requests into application calls.
3. Services own domain logic and external integrations.
4. Prisma repositories are expressed directly through the generated client.
5. Cross-cutting configuration, cache helpers, errors, and response formatting are shared centrally.

Recommendation jobs use a Redis-backed BullMQ queue and an in-process worker. IoT scan jobs use a single-concurrency in-memory queue, run ONNX inference, and publish results through both MQTT and SSE.

## Project Structure

```text
.
├── .github/workflows/       # Render deployment workflow
├── assets/                  # ONNX model, external weights, and labels
├── prisma/
│   ├── migrations/          # Versioned database migrations
│   └── schema.prisma        # Models, relations, and enums
├── scripts/                 # Installation and Git-hook helpers
├── src/
│   ├── config/              # Environment and integration configuration
│   ├── constants/           # Cache and queue constants
│   ├── controllers/         # HTTP handlers
│   ├── docs/                # Shared OpenAPI components
│   ├── middlewares/         # Auth, validation, upload, and error handling
│   ├── models/              # Interfaces and application-specific types
│   ├── routes/v1/           # Versioned API routes
│   ├── services/            # Domain services and external integrations
│   ├── utils/               # Shared utilities and calculations
│   ├── app.ts               # Express application
│   ├── client.ts            # Prisma client
│   ├── index.ts             # Bootstrap and graceful shutdown
│   └── redis.ts             # Optional Redis connection
├── docker-compose*.yml      # Base and environment-specific stacks
├── Dockerfile               # Multi-stage production image
├── entrypoint.sh            # Database wait and migration entrypoint
└── ecosystem.config.json    # PM2 runtime configuration
```

## Getting Started

### Prerequisites

- Node.js 20
- Corepack with pnpm 10.29.3
- PostgreSQL 16
- Redis 7 for caching and recommendation jobs
- An MQTT broker for IoT heartbeat and scan-result delivery
- A Cloudinary account

The ONNX model files required at startup are already tracked under `assets/`.

### Installation

```bash
git clone https://github.com/duyaivy/smart-food-be.git
cd smart-food-be
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
```

For a locally running application, change the database hosts copied from `.env.example` from `postgresdb` to `localhost`:

```dotenv
NODE_ENV=development
SERVER_URL=http://localhost:3000
CLIENT_URL=http://localhost:8081

DATABASE_URL=postgresql://postgres:secret@localhost:5432/mydb?schema=public
DIRECT_URL=postgresql://postgres:secret@localhost:5432/mydb?schema=public
REDIS_URL=redis://localhost:6379

AI_MODEL_FILE_PATH=assets/mobilenetv3_finetune.onnx
AI_MODEL_DATA_FILE_PATH=assets/mobilenetv3_finetune.onnx.data
AI_LABELS_FILE_PATH=assets/labels.json
```

Add valid Cloudinary credentials and your MQTT broker URL, then start the local PostgreSQL container:

```bash
pnpm docker:dev-db:start
pnpm db:generate
pnpm db:push
pnpm dev
```

Run Redis locally or start the Redis service from the base Compose file:

```bash
docker compose -f docker-compose.yml up -d redis
```

The server starts on `http://localhost:3000`. Check dependency readiness with:

```bash
curl http://localhost:3000/health
```

A healthy response reports PostgreSQL, Redis, and the ONNX model:

```json
{
  "ok": true,
  "db": true,
  "redis": true,
  "aiModel": true
}
```

## Environment Variables

Copy `.env.example` to `.env`, then add the variables used by the current application but not yet present in the example file.

### Core application

| Variable       | Required    | Default | Purpose                                     |
| -------------- | ----------- | ------- | ------------------------------------------- |
| `NODE_ENV`     | Yes         | —       | `development`, `test`, or `production`      |
| `PORT`         | No          | `3000`  | HTTP port                                   |
| `SERVER_URL`   | Yes         | —       | Public backend base URL                     |
| `CLIENT_URL`   | No          | —       | Frontend URL used in generated links        |
| `DATABASE_URL` | Yes         | —       | Prisma pooled/runtime PostgreSQL connection |
| `DIRECT_URL`   | Yes         | —       | Direct PostgreSQL connection for migrations |
| `REDIS_URL`    | Recommended | —       | Cache, device status, and BullMQ connection |

### Authentication and email

| Variable                                | Required         | Default | Purpose                       |
| --------------------------------------- | ---------------- | ------- | ----------------------------- |
| `JWT_SECRET`                            | Yes              | —       | JWT signing secret            |
| `JWT_ACCESS_EXPIRATION_MINUTES`         | No               | `30`    | Access-token lifetime         |
| `JWT_REFRESH_EXPIRATION_DAYS`           | No               | `30`    | Refresh-token lifetime        |
| `JWT_RESET_PASSWORD_EXPIRATION_MINUTES` | No               | `10`    | Password-reset token lifetime |
| `JWT_VERIFY_EMAIL_EXPIRATION_MINUTES`   | No               | `10`    | Verification-token lifetime   |
| `EMAIL_ENABLED`                         | No               | `false` | Enables outbound email        |
| `SMTP_HOST`                             | If email enabled | —       | SMTP hostname                 |
| `SMTP_PORT`                             | If email enabled | —       | SMTP port                     |
| `SMTP_USERNAME`                         | If email enabled | —       | SMTP username                 |
| `SMTP_PASSWORD`                         | If email enabled | —       | SMTP password                 |
| `EMAIL_FROM`                            | If email enabled | —       | Sender address                |

### Media and machine learning

| Variable                    | Required               | Default | Purpose                     |
| --------------------------- | ---------------------- | ------- | --------------------------- |
| `CLOUDINARY_CLOUD_NAME`     | Yes                    | —       | Cloudinary cloud name       |
| `CLOUDINARY_API_KEY`        | Yes                    | —       | Cloudinary API key          |
| `CLOUDINARY_API_SECRET`     | Yes                    | —       | Cloudinary API secret       |
| `CLOUDINARY_UPLOAD_PREDICT` | No                     | `false` | Upload classified IoT scans |
| `AI_MODEL_FILE_PATH`        | Operationally required | —       | ONNX model path             |
| `AI_MODEL_DATA_FILE_PATH`   | Operationally required | —       | ONNX external weights path  |
| `AI_LABELS_FILE_PATH`       | Operationally required | —       | Classification label file   |

### IoT and recommendations

| Variable                        | Required         | Default                         | Purpose                                 |
| ------------------------------- | ---------------- | ------------------------------- | --------------------------------------- |
| `MQTT_BROKER_URL`               | For IoT          | —                               | MQTT broker connection URL              |
| `MQTT_CLIENT_ID`                | No               | `smart-food-backend`            | MQTT client ID prefix                   |
| `MQTT_USERNAME`                 | Broker-dependent | —                               | MQTT username                           |
| `MQTT_PASSWORD`                 | Broker-dependent | —                               | MQTT password                           |
| `RECOMMENDATION_SYSTEM_URL`     | No               | `http://localhost:5000/predict` | External recommendation endpoint        |
| `RECOMMENDATION_API_TIMEOUT_MS` | No               | `90000`                         | Timeout for each recommendation attempt |
| `RECOMMENDATION_QUEUE_NAME`     | No               | `recommendation-jobs`           | BullMQ queue name                       |
| `USE_MOCK_DATA`                 | No               | `true`                          | Use built-in recommendation output      |
| `AXIOS_TIMEOUT_MS`              | No               | `60000`                         | Shared Axios timeout                    |

### Container operation

| Variable                | Default    | Purpose                                              |
| ----------------------- | ---------- | ---------------------------------------------------- |
| `RUN_PRISMA_MIGRATIONS` | `true`     | Run `prisma migrate deploy` during container startup |
| `DB_WAIT_MAX_TRIES`     | `60`       | Maximum database readiness attempts                  |
| `DB_WAIT_SLEEP_SECONDS` | `2`        | Delay between readiness attempts                     |
| `POSTGRES_USER`         | `postgres` | Compose PostgreSQL user                              |
| `POSTGRES_PASSWORD`     | `secret`   | Compose PostgreSQL password                          |
| `POSTGRES_DB`           | `mydb`     | Compose PostgreSQL database                          |

Never commit real secrets or production credentials.

## Docker

The production image uses four stages: base, dependency installation, TypeScript build, and a minimal PM2 runner. The entrypoint waits for PostgreSQL and applies committed Prisma migrations before starting the API.

```bash
# Build the production image
docker build -t smart-food-be .

# Start only the local PostgreSQL utility container
pnpm docker:dev-db:start

# Stop the local PostgreSQL utility container
pnpm docker:dev-db:stop
```

The repository also defines these Compose scripts:

| Command            | Compose files                        |
| ------------------ | ------------------------------------ |
| `pnpm docker:dev`  | Base stack plus development override |
| `pnpm docker:prod` | Base stack plus production override  |
| `pnpm docker:test` | Base stack plus test override        |

The base stack includes the API, PostgreSQL, and Redis. Before using the complete production stack, ensure every required application variable—especially `SERVER_URL`, Cloudinary, AI model paths, recommendation, and MQTT settings—is forwarded to the `node-app` container. The current base Compose environment lists only a subset of them.

## API Documentation

Swagger UI is mounted only when `NODE_ENV=development`:

```text
http://localhost:3000/v1/docs
```

All application routes below use the `/v1` prefix unless noted otherwise.

| Module                | Routes                                                                                                                         | Access                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| Health                | `GET /health`                                                                                                                  | Public; outside `/v1` |
| Auth                  | `POST /auth/register`, `/login`, `/logout`, `/refresh-tokens`, `/forgot-password`, `/reset-password`; `GET /auth/verify-email` | Mostly public         |
| Verification          | `POST /auth/send-verification-email`                                                                                           | Authenticated         |
| Profile               | `GET/PATCH /users/me`                                                                                                          | Authenticated         |
| Users                 | `POST/GET /users`, `GET/PATCH/DELETE /users/:userId`, `POST /users/clear-cache`                                                | Admin                 |
| Push notifications    | `POST /users/push-tokens`, `POST /users/test-notification`                                                                     | Authenticated         |
| Uploads               | `POST /uploads/media`, `POST /uploads/avatar`                                                                                  | Authenticated         |
| Dishes                | `GET /dishes`, `GET /dishes/:dishId`                                                                                           | Public                |
| Dish management       | `POST /dishes`, `PATCH/DELETE /dishes/:dishId`                                                                                 | Admin                 |
| Dish sync             | `GET /dishes/sync`                                                                                                             | Authenticated         |
| Ingredients           | `GET /ingredients`, `GET /ingredients/:ingredientId`                                                                           | Public                |
| Ingredient management | `POST /ingredients`, `PATCH/DELETE /ingredients/:ingredientId`                                                                 | Admin                 |
| Ingredient sync       | `GET /ingredients/sync`                                                                                                        | Authenticated         |
| Categories            | `GET /categories`, `GET /categories/:id`                                                                                       | Public                |
| Category management   | `POST /categories`, `PATCH/DELETE /categories/:id`                                                                             | Admin                 |
| Fridge                | `POST/GET /fridge/items`, `GET/PATCH/DELETE /fridge/items/:itemId`, `GET /fridge/transactions`                                 | Authenticated         |
| Meals                 | `POST /meals`, `GET /meals/history`, `GET /meals/history/:mealLogId`                                                           | Authenticated         |
| Nutrition             | `GET /nutrition/daily`, `/weekly`, `/daily/remaining`                                                                          | Authenticated         |
| Recommendations       | `POST/GET /recommendations`, `GET/PATCH /recommendations/:jobId`, `POST /recommendations/subs`                                 | Authenticated         |
| IoT devices           | `POST /iot/devices/pair`, `GET /iot/devices`, `GET /iot/devices/:deviceUid/status`, `DELETE /iot/devices/:deviceUid/pair`      | Authenticated         |
| IoT scan              | `POST /iot/scan`, `GET /iot/devices/:deviceUid/stream`                                                                         | Device/realtime flow  |

For backward compatibility, category routes are also mounted at `/api/categories` outside the versioned `/v1` router.

Protected endpoints accept a JWT access token:

```http
Authorization: Bearer <access-token>
```

Image endpoints accept `multipart/form-data` with a `file` field. Supported extensions are JPG, JPEG, PNG, and WebP, with a 2 MiB limit.

The route table is the authoritative overview at present. OpenAPI annotations currently cover only part of the API and should be expanded alongside future endpoint changes.

## Testing

Run static project checks with:

```bash
pnpm lint
pnpm prettier
pnpm build
```

The package contains Jest and Supertest configuration plus `test` scripts, but the current branch does not contain a committed `tests/` directory. Restore or add the automated test suite before treating `pnpm test` as a required passing check.

When tests are present, `pnpm test` starts the dedicated PostgreSQL Compose service, applies the Prisma schema, runs Jest serially, and stops the database afterward.

## CI/CD

The repository currently provides continuous deployment but not a full continuous-integration quality pipeline.

The [Render redeploy workflow](.github/workflows/redeploy-render-release.yml):

- Runs on pushes to `release` or by manual dispatch.
- Reads the `RENDER_DEPLOY_HOOK_URL` GitHub Actions secret.
- Calls the Render deploy hook.
- Cancels an older in-progress deployment when a newer release starts.

Lint, formatting, build, migration validation, and automated tests are not currently enforced by GitHub Actions.

## Deployment

The intended production path is the multi-stage Docker image:

1. Install dependencies from the frozen pnpm lockfile.
2. Generate Prisma Client and compile TypeScript.
3. Copy production dependencies, build output, Prisma files, and AI assets into the runner.
4. Wait for the database and run `prisma migrate deploy`.
5. Start `build/src/index.js` through `pm2-runtime`.

For non-container execution:

```bash
pnpm start
```

`pnpm start` rebuilds the application and starts PM2 in the foreground. Production deployments must provide PostgreSQL, Redis, MQTT, Cloudinary, model-path, JWT, and public URL configuration through a secret manager or platform environment settings.

The `release` branch triggers the Render deployment hook. Keep database migrations backward-compatible with the currently running version because the container applies them during startup.

## Contributors

- [Quoc Duy](https://github.com/duyaivy)
- [Long Dang Huu](https://github.com/DangHuuLong)
- [Antonio Lazaro](https://github.com/antonio-lazaro), Krastan Dimitrov, and Saad Abbasi for the original boilerplate foundation

See the complete [contributors graph](https://github.com/duyaivy/smart-food-be/graphs/contributors).

## License

The repository does not currently contain a standalone license file. In addition, `package.json` declares ISC while the Swagger metadata still identifies MIT. Choose one license, add its license text, and align both metadata locations before distributing the project.
