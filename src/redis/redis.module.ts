import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-ioredis-yet';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: async () => {
        // Skip Redis in development if not available
        const skipRedis = process.env.SKIP_REDIS === 'true' || process.env.NODE_ENV === 'development';
        
        if (skipRedis) {
          console.log('[REDIS] Skipping Redis connection - using in-memory cache');
          return {
            store: 'memory',
            ttl: 600,
          };
        }

        try {
          const store = await redisStore({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            ttl: 600,
            enableOfflineQueue: false,
            retryStrategy: () => null, // Don't retry on connection failure
          });

          console.log('[REDIS] Connected to Redis successfully');
          return {
            store: () => store,
          };
        } catch (error) {
          console.warn('[REDIS] Failed to connect to Redis, falling back to in-memory cache:', error.message);
          return {
            store: 'memory',
            ttl: 600,
          };
        }
      },
    }),
  ],
  providers: [RedisService],
  exports: [RedisService, CacheModule],
})
export class RedisModule {}
