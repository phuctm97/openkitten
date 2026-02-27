FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
COPY packages/bot/package.json ./packages/bot/
RUN bun install --frozen-lockfile

# Copy source
COPY tsconfig.json ./
COPY packages/bot/ ./packages/bot/

# Run
WORKDIR /app/packages/bot
CMD ["bun", "run", "lib/index.ts"]
