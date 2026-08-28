# -------- Stage 1: Build --------
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Required for Prisma
RUN apk add --no-cache openssl

# Copy dependency files first (better cache)
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# Install deps including Prisma CLI
RUN npm ci --include=dev

# Copy source code
COPY . .

# Set dummy DATABASE_URL for Prisma generate
# Actual DATABASE_URL is provided at runtime
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"

# Generate Prisma Client
RUN npx prisma generate

# Build NestJS app
RUN npm run build

# Remove dev dependencies
RUN npm prune --omit=dev


# -------- Stage 2: Production --------
FROM node:20-alpine

WORKDIR /usr/src/app

RUN apk add --no-cache openssl

ENV NODE_ENV=production

# Copy only what we need to run
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma.config.ts ./prisma.config.ts

USER node

EXPOSE 5000

CMD ["node", "dist/src/main"]