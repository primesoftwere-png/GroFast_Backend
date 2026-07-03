# 🔴 Redis Setup & Troubleshooting Guide

## ✅ What Was Fixed

### Issue
```
❌ Redis connection error: connect ECONNREFUSED 127.0.0.1:6379
⚠️ Could not connect to Redis after 3 retries. Falling back to in-memory cache.
```

### Root Cause
1. Redis URL in `.env` had quotes around it: `REDIS_URL="redis://..."`
2. Connection retry logic was too aggressive (failing too quickly)
3. No health check endpoint to verify Redis status
4. Error messages were spamming the logs

### Solution Applied
1. ✅ Removed quotes from `REDIS_URL` in `.env`
2. ✅ Improved Redis connection configuration with better retry logic
3. ✅ Added connection event handlers (connect, ready, error, close)
4. ✅ Added health check endpoint at `/health`
5. ✅ Added graceful fallback to in-memory cache if Redis fails
6. ✅ Reduced error log spam

---

## 📋 Current Configuration

### Your Redis Credentials
```
Host: redis-13464.c305.ap-south-1-1.ec2.cloud.redislabs.com
Port: 13464
Password: bVCO7Y6Cwokpw290Drg9LgEbRQbJiny9
Username: default
Region: ap-south-1 (Asia Pacific - Mumbai)
```

### .env Configuration
```env
REDIS_URL=redis://default:bVCO7Y6Cwokpw290Drg9LgEbRQbJiny9@redis-13464.c305.ap-south-1-1.ec2.cloud.redislabs.com:13464
```

**Important:** No quotes around the URL!

---

## 🧪 Testing Redis Connection

### Method 1: Use Health Check Endpoint
```bash
# Local testing
curl http://localhost:8000/health

# Production testing
curl https://your-production-domain.com/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 123.456,
  "cache": {
    "status": "connected",
    "type": "redis",
    "message": "Redis is operational",
    "redisConnected": true,
    "memoryCacheSize": 0,
    "cacheType": "Redis"
  },
  "database": "connected",
  "environment": "production"
}
```

### Method 2: Check Server Logs
When Redis connects successfully, you'll see:
```
🔄 Attempting to connect to Redis...
✅ Connected to Redis cache service
✅ Redis client is ready and operational
```

When Redis fails (fallback to memory):
```
🔄 Attempting to connect to Redis...
❌ Redis error: connect ECONNREFUSED
⚠️  Could not connect to Redis after 3 retries. Falling back to in-memory cache.
ℹ️  Using in-memory cache as fallback.
```

### Method 3: Test Programmatically
```javascript
const cacheService = require('./services/cache.service');

// Check if Redis is connected
console.log('Redis connected:', cacheService.isRedisAvailable());

// Get cache stats
console.log('Cache stats:', cacheService.getStats());

// Test health check
const health = await cacheService.healthCheck();
console.log('Health:', health);
```

---

## 🚀 Deployment Checklist

### For Production (Render/Heroku/AWS/Vercel)

1. **Set Environment Variable**
   ```bash
   REDIS_URL=redis://default:bVCO7Y6Cwokpw290Drg9LgEbRQbJiny9@redis-13464.c305.ap-south-1-1.ec2.cloud.redislabs.com:13464
   ```

2. **Verify Environment Variable is Set**
   - In Render: Settings → Environment → Add Environment Variable
   - In Heroku: Settings → Config Vars → Add
   - In AWS: Environment Variables section
   - In Vercel: Settings → Environment Variables

3. **Check Firewall/Security Rules**
   - Ensure your production server can reach `redis-13464.c305.ap-south-1-1.ec2.cloud.redislabs.com:13464`
   - Check if Redis Cloud has IP whitelist restrictions

4. **Test Connection After Deployment**
   ```bash
   curl https://your-app.com/health
   ```

5. **Monitor Logs**
   - Check for Redis connection success messages
   - Verify no ECONNREFUSED errors

---

## 🔧 Redis Cloud Configuration

### Check Your Redis Cloud Dashboard
1. Go to: https://app.redislabs.com/
2. Login with your credentials
3. Navigate to your database: `redis-13464`
4. Verify:
   - ✅ Database is active
   - ✅ No IP whitelist restrictions (or add your production IP)
   - ✅ Credentials are correct
   - ✅ Port 13464 is open

### Common Redis Cloud Issues

#### Issue: IP Restricted
**Solution:** Add your production server's IP to the allowlist
```
1. Go to Redis Cloud Dashboard
2. Click on your database
3. Navigate to Security → IP Restrictions
4. Add your production server IP or use 0.0.0.0/0 (not recommended for production)
```

#### Issue: Connection Timeout
**Solution:** Check if your hosting provider blocks outbound connections on non-standard ports
```bash
# Test connection from your server
telnet redis-13464.c305.ap-south-1-1.ec2.cloud.redislabs.com 13464
```

#### Issue: Authentication Failed
**Solution:** Verify username and password in Redis Cloud dashboard

---

## 🐛 Troubleshooting

### Problem: Still seeing ECONNREFUSED

**Possible Causes:**
1. Environment variable not loaded
2. Redis Cloud IP restrictions
3. Hosting provider firewall
4. Wrong Redis URL

**Debug Steps:**
```javascript
// Add this temporarily to index.js
console.log('REDIS_URL:', process.env.REDIS_URL);
console.log('REDIS_URL type:', typeof process.env.REDIS_URL);
console.log('REDIS_URL length:', process.env.REDIS_URL?.length);
```

### Problem: "Using in-memory cache as fallback"

**This is actually OKAY!** The app will still work, but:
- ❌ Location tracking data won't persist across server restarts
- ❌ No shared cache across multiple server instances
- ✅ App continues to function normally

**To fix permanently:**
1. Verify Redis URL is correct
2. Check Redis Cloud dashboard shows database is active
3. Test connection from your production server
4. Check firewall/security rules

### Problem: Redis connects locally but not in production

**Common Causes:**
1. Environment variable not set in production
2. Production server IP not whitelisted in Redis Cloud
3. Hosting provider blocks outbound Redis connections

**Solution:**
```bash
# 1. Verify env var in production
echo $REDIS_URL

# 2. Test connection from production server
nc -zv redis-13464.c305.ap-south-1-1.ec2.cloud.redislabs.com 13464

# 3. Check Redis Cloud allowlist
# Go to Redis Cloud Dashboard → Security → IP Restrictions
```

---

## 📊 Monitoring Redis

### Check Cache Status
```bash
# Via health endpoint
curl https://your-app.com/health | jq '.cache'
```

### Monitor in Application
The cache service now provides:
- `isRedisAvailable()` - Check if Redis is connected
- `getStats()` - Get current cache statistics
- `healthCheck()` - Test Redis connection

### Server Logs to Watch
```
✅ Connected to Redis cache service  → Good!
✅ Redis client is ready              → Good!
❌ Redis error: ...                   → Check connection
⚠️  Using in-memory cache             → Redis failed, using fallback
```

---

## 🔄 Cache Behavior

### With Redis (Preferred)
```
✅ Data persists across server restarts
✅ Shared cache across multiple instances
✅ Fast location lookups
✅ 1-hour TTL on location data
✅ Production-ready
```

### With In-Memory Fallback
```
⚠️  Data lost on server restart
⚠️  Each server instance has its own cache
⚠️  Still works, but not ideal for production
✅ Automatic TTL cleanup
✅ No external dependencies
```

---

## 🎯 Best Practices

1. **Always use Redis in production**
   - In-memory cache is only for development/emergency fallback

2. **Monitor Redis connection**
   - Set up health check monitoring
   - Alert on Redis failures

3. **Set appropriate TTLs**
   - Location data: 1 hour (3600 seconds)
   - Session data: 24 hours (86400 seconds)
   - Temporary data: 5 minutes (300 seconds)

4. **Handle failures gracefully**
   - App continues working even if Redis fails
   - Automatic fallback to in-memory cache
   - Clear error logging

---

## 📚 Additional Resources

### Redis Cloud Documentation
- Dashboard: https://app.redislabs.com/
- Docs: https://docs.redis.com/latest/rc/

### ioredis Documentation
- GitHub: https://github.com/luin/ioredis
- API Docs: https://redis.github.io/ioredis/

### Testing Tools
- Redis CLI: `redis-cli -h redis-13464.c305.ap-south-1-1.ec2.cloud.redislabs.com -p 13464 -a bVCO7Y6Cwokpw290Drg9LgEbRQbJiny9`
- Redis Desktop Manager: https://resp.app/
- RedisInsight: https://redis.com/redis-enterprise/redis-insight/

---

## ✅ Verification Checklist

After deployment, verify:
- [ ] No ECONNREFUSED errors in logs
- [ ] `/health` endpoint shows `"type": "redis"`
- [ ] Location tracking data persists
- [ ] Server logs show "✅ Redis client is ready"
- [ ] Multiple server instances share cache (if using clustering)

---

## 🆘 Still Having Issues?

If Redis still won't connect:

1. **Check Redis Cloud Status**
   - Visit Redis Cloud dashboard
   - Verify database is running

2. **Test Direct Connection**
   ```bash
   redis-cli -h redis-13464.c305.ap-south-1-1.ec2.cloud.redislabs.com -p 13464 -a bVCO7Y6Cwokpw290Drg9LgEbRQbJiny9 PING
   ```
   Expected: `PONG`

3. **Verify from Production Server**
   ```bash
   # SSH into your production server
   telnet redis-13464.c305.ap-south-1-1.ec2.cloud.redislabs.com 13464
   ```

4. **Check Logs Carefully**
   - Look for the exact error message
   - Check if environment variable is loaded

5. **Temporary Workaround**
   - The app works fine with in-memory cache
   - Fix Redis connection at your convenience
   - No user-facing impact

---

**Good luck! 🚀**

If you see "✅ Redis client is ready" in your logs, you're all set!
