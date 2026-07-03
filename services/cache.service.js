const Redis = require('ioredis');

class CacheService {
  constructor() {
    this.redisClient = null;
    this.memoryCache = new Map();
    this.isRedisConnected = false;
    
    this.init();
  }

  init() {
    try {
      // Connect to Redis
      this.redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: 1,
        retryStrategy(times) {
          if (times > 3) {
             console.warn('⚠️ Could not connect to Redis. Falling back to in-memory cache.');
             return null; // Stop retrying
          }
          return Math.min(times * 50, 2000);
        }
      });

      this.redisClient.on('connect', () => {
        console.log('✅ Connected to Redis cache service');
        this.isRedisConnected = true;
      });

      this.redisClient.on('error', (err) => {
        // Suppress massive connection error logs if redis is simply not installed
        this.isRedisConnected = false;
      });
      
    } catch (err) {
      console.warn('⚠️ Redis initialization failed, using memory cache.');
      this.isRedisConnected = false;
    }
  }

  /**
   * Set a key with a time-to-live (TTL) in seconds
   */
  async setEx(key, ttlSeconds, value) {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    
    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.setex(key, ttlSeconds, stringValue);
        return true;
      } catch (err) {
        // Fallback silently if Redis drops
      }
    }
    
    // Fallback to In-Memory Map
    this.memoryCache.set(key, {
      value: stringValue,
      expiresAt: Date.now() + (ttlSeconds * 1000)
    });
    
    // Automatically delete from memory cache after TTL
    setTimeout(() => {
      const item = this.memoryCache.get(key);
      if (item && item.expiresAt <= Date.now()) {
        this.memoryCache.delete(key);
      }
    }, ttlSeconds * 1000);
    
    return true;
  }

  /**
   * Get a key
   */
  async get(key) {
    if (this.isRedisConnected && this.redisClient) {
      try {
        const val = await this.redisClient.get(key);
        return val ? JSON.parse(val) : null;
      } catch (err) {
        // Fallback
      }
    }
    
    // Fallback to In-Memory Map
    const item = this.memoryCache.get(key);
    if (item) {
      if (item.expiresAt > Date.now()) {
        try {
          return JSON.parse(item.value);
        } catch {
          return item.value;
        }
      } else {
        this.memoryCache.delete(key); // Expired
      }
    }
    return null;
  }

  /**
   * Delete a key
   */
  async del(key) {
    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch (err) {}
    }
    this.memoryCache.delete(key);
    return true;
  }
}

module.exports = new CacheService();
