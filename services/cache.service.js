const Redis = require('ioredis');
require('dotenv').config(); // Ensure env vars are loaded

class CacheService {
  constructor() {
    this.redisClient = null;
    this.memoryCache = new Map();
    this.isRedisConnected = false;
    
    this.init();
  }

  init() {
    // Skip Redis if no REDIS_URL is configured
    if (!process.env.REDIS_URL) {
      console.log('ℹ️  No REDIS_URL configured. Using in-memory cache only.');
      return;
    }

    try {
      // Connect to Redis (strip any accidental quotes from the env var)
      let redisUrl = process.env.REDIS_URL;
      if (redisUrl && redisUrl.startsWith('"') && redisUrl.endsWith('"')) {
        redisUrl = redisUrl.slice(1, -1);
      }
      
      console.log('🔄 Attempting to connect to Redis...');
      
      this.redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        connectTimeout: 10000, // 10 seconds timeout
        lazyConnect: false, // Connect immediately
        retryStrategy(times) {
          if (times > 3) {
             console.warn('⚠️  Could not connect to Redis after 3 retries. Falling back to in-memory cache.');
             return null; // Stop retrying
          }
          const delay = Math.min(times * 1000, 3000);
          console.log(`🔄 Redis retry attempt ${times} in ${delay}ms...`);
          return delay;
        },
        reconnectOnError(err) {
          // Reconnect on READONLY errors
          if (err.message.includes('READONLY')) {
            return true;
          }
          return false;
        }
      });

      this.redisClient.on('connect', () => {
        console.log('✅ Connected to Redis cache service');
        this.isRedisConnected = true;
      });

      this.redisClient.on('ready', () => {
        console.log('✅ Redis client is ready and operational');
        this.isRedisConnected = true;
      });

      this.redisClient.on('error', (err) => {
        // Only log connection errors once to avoid spam
        if (this.isRedisConnected || err.message.includes('ECONNREFUSED')) {
          console.error('❌ Redis error:', err.message);
        }
        this.isRedisConnected = false;
      });

      this.redisClient.on('close', () => {
        if (this.isRedisConnected) {
          console.log('⚠️  Redis connection closed');
        }
        this.isRedisConnected = false;
      });

      this.redisClient.on('reconnecting', () => {
        console.log('🔄 Reconnecting to Redis...');
      });

      this.redisClient.on('end', () => {
        this.isRedisConnected = false;
      });
      
    } catch (err) {
      console.error('❌ Redis initialization failed:', err.message);
      console.log('⚠️  Using in-memory cache as fallback.');
      this.isRedisConnected = false;
      this.redisClient = null;
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

  /**
   * Check if Redis is connected
   */
  isRedisAvailable() {
    return this.isRedisConnected && this.redisClient !== null;
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      redisConnected: this.isRedisConnected,
      memoryCacheSize: this.memoryCache.size,
      cacheType: this.isRedisConnected ? 'Redis' : 'In-Memory'
    };
  }

  /**
   * Health check - test Redis connection
   */
  async healthCheck() {
    if (!this.redisClient || !this.isRedisConnected) {
      return {
        status: 'disconnected',
        type: 'memory',
        message: 'Using in-memory cache'
      };
    }

    try {
      await this.redisClient.ping();
      return {
        status: 'connected',
        type: 'redis',
        message: 'Redis is operational'
      };
    } catch (err) {
      return {
        status: 'error',
        type: 'memory',
        message: err.message
      };
    }
  }

  /**
   * Gracefully close Redis connection
   */
  async close() {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
        console.log('✅ Redis connection closed gracefully');
      } catch (err) {
        console.error('Error closing Redis connection:', err.message);
      }
    }
    this.memoryCache.clear();
  }
}

module.exports = new CacheService();
