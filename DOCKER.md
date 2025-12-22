# Docker Setup Guide

## Prerequisites
- Docker installed on your system
- Docker Compose installed

## Files Created
- **Dockerfile**: Multi-stage build for optimized production image
- **.dockerignore**: Excludes unnecessary files from Docker context
- **docker-compose.yml**: Orchestrates app and PostgreSQL database

## Quick Start

### 1. Build and Run with Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 2. Build Docker Image Only

```bash
# Build the image
docker build -t reservation-app .

# Run the container
docker run -p 3000:3000 --env-file .env reservation-app
```

## Environment Variables

Create a `.env` file in the root directory with:

```env
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/reservation
JWT_SECRET=your-jwt-secret
STRIPE_SECRET_KEY=your-stripe-key
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your-email@example.com
EMAIL_PASSWORD=your-email-password
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=reservation
```

## Database Migrations

Run migrations after starting the containers:

```bash
# Access the app container
docker exec -it reservation-app sh

# Run migrations
npx prisma migrate deploy

# Seed the database (optional)
npx prisma db seed
```

## Useful Commands

```bash
# Rebuild containers
docker-compose up -d --build

# View container logs
docker-compose logs -f app

# Access app container shell
docker exec -it reservation-app sh

# Access database
docker exec -it reservation-db psql -U postgres -d reservation

# Remove all containers and volumes
docker-compose down -v
```

## Production Deployment

For production, consider:
1. Use proper secrets management (not .env files)
2. Set up proper database backups
3. Configure health checks
4. Use a reverse proxy (nginx/traefik)
5. Enable SSL/TLS certificates
6. Set resource limits in docker-compose.yml
