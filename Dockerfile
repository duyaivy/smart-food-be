FROM node:20-bullseye-slim AS base

WORKDIR /usr/src/node-app

ENV NODE_ENV=production

RUN corepack enable

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*


FROM base AS deps

COPY package.json pnpm-lock.yaml ./
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile


FROM deps AS build

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN pnpm prisma generate
RUN pnpm build


FROM base AS prod-deps

COPY package.json pnpm-lock.yaml ./
COPY scripts ./scripts

COPY prisma ./prisma

RUN pnpm install --frozen-lockfile --prod

# Ensure Prisma Client is generated inside the production node_modules
RUN pnpm prisma generate


FROM base AS runner

ENV NODE_ENV=production

COPY --from=prod-deps /usr/src/node-app/node_modules ./node_modules
COPY --from=build /usr/src/node-app/build ./build
COPY --from=build /usr/src/node-app/prisma ./prisma

COPY ecosystem.config.json ./ecosystem.config.json

COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh && chown -R node:node /usr/src/node-app

USER node

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["./node_modules/.bin/pm2-runtime", "start", "ecosystem.config.json"]
