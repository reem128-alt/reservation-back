import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class RedisService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async setOtp(email: string, otp: string, ttl: number = 600): Promise<void> {
    const key = `otp:${email}`;
    await this.cacheManager.set(key, otp, ttl * 1000);
  }

  async getOtp(email: string): Promise<string | null> {
    const key = `otp:${email}`;
    const otp = await this.cacheManager.get<string>(key);
    return otp || null;
  }

  async deleteOtp(email: string): Promise<void> {
    const key = `otp:${email}`;
    await this.cacheManager.del(key);
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttl ? ttl * 1000 : undefined);
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.cacheManager.get<T>(key);
    return value || null;
  }

  async delete(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }
}
