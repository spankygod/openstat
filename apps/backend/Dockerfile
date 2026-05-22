FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/ingestion/package.json packages/ingestion/package.json
COPY packages/schemas/package.json packages/schemas/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json

RUN pnpm install --frozen-lockfile

ENV NODE_ENV=production

COPY apps/backend apps/backend
COPY packages/auth packages/auth
COPY packages/db packages/db
COPY packages/ingestion packages/ingestion
COPY packages/schemas packages/schemas
COPY packages/eslint-config packages/eslint-config
COPY packages/typescript-config packages/typescript-config

EXPOSE 4000

CMD ["pnpm", "--filter", "backend", "start"]
