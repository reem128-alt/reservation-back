# Docker Compose Guide

## Overview

This project includes Docker Compose configurations for easy deployment and local development.

## Files

- `docker-compose.yml` - Development/local setup with all services
- `docker-compose.prod.yml` - Production setup using pre-built Docker Hub image
- `nginx.conf` - Nginx reverse proxy configuration

## Prerequisites

- Docker Desktop installed
- `.env` file configured with all required variables

## Quick Start

### Development Mode

Build and run all services:

```bash
docker-compose up -d
```

View logs:

```bash
docker-compose logs -f app
```

Stop services:

```bash
docker-compose down
```

### Production Mode

Using pre-built image from Docker Hub:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Services

### 1. App (NestJS API)
- **Port:** 5000
- **Container:** reservation-api
- **Health Check:** http://localhost:5000/health

### 2. Redis
- **Port:** 6379
- **Container:** reservation-redis
- **Purpose:** Caching and event handling

### 3. Nginx (Optional)
- **Ports:** 80 (HTTP), 443 (HTTPS)
- **Container:** reservation-nginx
- **Purpose:** Reverse proxy with rate limiting

To enable Nginx:

```bash
docker-compose --profile with-nginx up -d
```

## Common Commands

### Build and Start
```bash
# Build images
docker-compose build

# Start in background
docker-compose up -d

# Start with logs
docker-compose up
```

### View Status
```bash
# List running containers
docker-compose ps

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f app
docker-compose logs -f redis
```

### Stop and Clean
```bash
# Stop services
docker-compose stop

# Stop and remove containers
docker-compose down

# Remove containers and volumes
docker-compose down -v

# Remove everything including images
docker-compose down -v --rmi all
```

### Restart Services
```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart app
```

### Execute Commands
```bash
# Access app container shell
docker-compose exec app sh

# Run Prisma migrations
docker-compose exec app npx prisma migrate deploy

# Run database seed
docker-compose exec app npm run db:seed

# Check Redis
docker-compose exec redis redis-cli ping
```

## Environment Variables

Create a `.env` file with these variables:

```env
# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Security
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
NODE_TLS_REJECT_UNAUTHORIZED=0

# Application
APP_URL=http://localhost:5000
NODE_ENV=production

# Email
MAILERSEND_API_KEY=mlsn.xxx
MAILERSEND_FROM_EMAIL=noreply@yourdomain.com
EMAIL_FROM_NAME=Reservation Platform

# Payment
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Cloudinary (optional)
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret

# Redis (for production)
REDIS_PASSWORD=your-redis-password
```

## Deployment Scenarios

### Local Development
```bash
docker-compose up -d
```
Access: http://localhost:5000

### Production (with Nginx)
```bash
docker-compose --profile with-nginx up -d
```
Access: http://localhost (port 80)

### Production (from Docker Hub)
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Monitoring

### Check Health
```bash
# App health
curl http://localhost:5000/health

# Redis health
docker-compose exec redis redis-cli ping
```

### View Resource Usage
```bash
docker stats
```

### View Container Details
```bash
docker-compose ps
docker inspect reservation-api
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs app

# Rebuild
docker-compose build --no-cache app
docker-compose up -d
```

### Database connection issues
```bash
# Verify DATABASE_URL in .env
# Check if Supabase is accessible
docker-compose exec app sh
ping aws-0-eu-west-1.pooler.supabase.com
```

### Redis connection issues
```bash
# Check Redis is running
docker-compose ps redis

# Test Redis connection
docker-compose exec redis redis-cli ping
```

### Port already in use
```bash
# Find process using port 5000
# Windows
netstat -ano | findstr :5000

# Stop the process or change port in docker-compose.yml
```

## Scaling

Run multiple app instances:

```bash
docker-compose up -d --scale app=3
```

Note: You'll need a load balancer (Nginx) for this to work properly.

## Backup

### Backup Redis data
```bash
docker-compose exec redis redis-cli SAVE
docker cp reservation-redis:/data/dump.rdb ./backup/
```

## Updates

### Update app code
```bash
# Rebuild and restart
docker-compose build app
docker-compose up -d app
```

### Update from Docker Hub
```bash
# Pull latest image
docker pull reemhas/reem-image:reservation-api

# Restart with new image
docker-compose -f docker-compose.prod.yml up -d
```

## Security Best Practices

1. **Never commit `.env` file** - It's in `.gitignore`
2. **Use strong secrets** for JWT and Redis password
3. **Enable HTTPS** in production with SSL certificates
4. **Limit Redis access** with password in production
5. **Use Docker secrets** for sensitive data in production

## Production Deployment

For AWS/Cloud deployment:

```bash
# 1. SSH into your server
ssh user@your-server

# 2. Clone repository
git clone https://github.com/reem128-alt/reservation-back.git
cd reservation-back

# 3. Create .env file
nano .env
# (paste your environment variables)

# 4. Run with production compose
docker-compose -f docker-compose.prod.yml up -d

# 5. Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

## Support

For issues or questions:
- Check logs: `docker-compose logs -f`
- Restart services: `docker-compose restart`
- Rebuild: `docker-compose build --no-cache`
