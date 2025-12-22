FROM node:20-alpine

# Set working directory
WORKDIR /app

# Build argument for DATABASE_URL (will be passed from docker-compose)
ARG DATABASE_URL

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies with retry logic and increased timeout
RUN npm ci --fetch-timeout=60000 --fetch-retries=5 || npm ci --fetch-timeout=60000 --fetch-retries=5

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN npm run build

# Expose the application port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the application
CMD ["node", "dist/src/main.js"]
