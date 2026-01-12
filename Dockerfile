# Multi-stage Dockerfile for NestJS Reservation backend
# Stage 1: build & generate Prisma client
FROM node:20-alpine AS builder

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
ENV NODE_ENV=development

# Install system dependencies required by Prisma & Nest builds
RUN sed -i 's/dl-cdn.alpinelinux.org/dl-5.alpinelinux.org/g' /etc/apk/repositories \
  && apk update \
  && apk add --no-cache openssl

WORKDIR /usr/src/app

# Copy package descriptors and Prisma schema first to leverage layer caching
COPY package.json package-lock.json ./
COPY prisma ./prisma

# Install all dependencies (force dev deps for build & Prisma CLI)
RUN npm ci --include=dev

# Copy the rest of the source code
COPY . .

# Generate Prisma client and compile the NestJS application
RUN npx prisma generate \
  && npm run build

# Remove dev dependencies to keep the runtime image small
RUN npm prune --omit=dev

# Stage 2: runtime image
FROM node:20-alpine AS production
RUN apk add --no-cache openssl

ENV NODE_ENV=production
WORKDIR /usr/src/app

# Copy compiled app and production dependencies from builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules 
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/dist ./dist

USER node
EXPOSE 5000
CMD ["node", "dist/src/main"]
