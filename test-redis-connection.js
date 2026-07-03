#!/usr/bin/env node

/**
 * Redis Connection Test Script
 * 
 * Usage:
 *   node test-redis-connection.js
 * 
 * This script tests the Redis connection and provides detailed diagnostics
 */

require('dotenv').config();
const Redis = require('ioredis');

console.log('\n🔍 Redis Connection Test\n');
console.log('='.repeat(50));

// Check if REDIS_URL is set
console.log('\n1️⃣  Checking environment variable...');
if (!process.env.REDIS_URL) {
  console.error('❌ REDIS_URL not found in environment variables');
  console.log('   Please set REDIS_URL in your .env file');
  process.exit(1);
}

let redisUrl = process.env.REDIS_URL;

// Check for quotes
if (redisUrl.startsWith('"') && redisUrl.endsWith('"')) {
  console.log('⚠️  Found quotes around REDIS_URL - removing them');
  redisUrl = redisUrl.slice(1, -1);
}

console.log('✅ REDIS_URL found');
console.log(`   URL: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`); // Hide password

// Parse Redis URL
console.log('\n2️⃣  Parsing Redis URL...');
try {
  const url = new URL(redisUrl);
  console.log('✅ URL is valid');
  console.log(`   Protocol: ${url.protocol}`);
  console.log(`   Host: ${url.hostname}`);
  console.log(`   Port: ${url.port}`);
  console.log(`   Username: ${url.username || '(none)'}`);
  console.log(`   Password: ${url.password ? '****' : '(none)'}`);
} catch (err) {
  console.error('❌ Invalid URL format:', err.message);
  process.exit(1);
}

// Test connection
console.log('\n3️⃣  Testing Redis connection...');
console.log('   Connecting...');

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
  retryStrategy(times) {
    if (times > 3) {
      return null;
    }
    return Math.min(times * 1000, 3000);
  }
});

let isConnected = false;
let connectionError = null;

redis.on('connect', () => {
  console.log('✅ Connection established');
});

redis.on('ready', async () => {
  console.log('✅ Redis client is ready');
  isConnected = true;
  
  // Run tests
  console.log('\n4️⃣  Running connection tests...');
  
  try {
    // Test 1: PING
    console.log('\n   Test 1: PING command');
    const pingResponse = await redis.ping();
    console.log(`   ✅ PING response: ${pingResponse}`);
    
    // Test 2: SET
    console.log('\n   Test 2: SET command');
    await redis.set('test:connection', 'success', 'EX', 60);
    console.log('   ✅ SET command successful');
    
    // Test 3: GET
    console.log('\n   Test 3: GET command');
    const value = await redis.get('test:connection');
    console.log(`   ✅ GET command successful: ${value}`);
    
    // Test 4: DELETE
    console.log('\n   Test 4: DEL command');
    await redis.del('test:connection');
    console.log('   ✅ DEL command successful');
    
    // Test 5: Server INFO
    console.log('\n   Test 5: Server INFO');
    const info = await redis.info('server');
    const redisVersion = info.match(/redis_version:([^\r\n]+)/);
    if (redisVersion) {
      console.log(`   ✅ Redis version: ${redisVersion[1]}`);
    }
    
    // Success summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ ALL TESTS PASSED!');
    console.log('='.repeat(50));
    console.log('\n🎉 Redis connection is working perfectly!\n');
    console.log('Your application will use Redis for caching.');
    console.log('Location tracking data will persist across restarts.\n');
    
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    console.log('\nRedis is connected but some operations failed.');
    console.log('Check Redis Cloud permissions and database status.\n');
  } finally {
    redis.disconnect();
    process.exit(0);
  }
});

redis.on('error', (err) => {
  connectionError = err;
  console.error(`❌ Redis error: ${err.message}`);
  
  if (err.message.includes('ECONNREFUSED')) {
    console.log('\n⚠️  Connection refused. Possible causes:');
    console.log('   1. Redis Cloud database is not running');
    console.log('   2. Firewall blocking the connection');
    console.log('   3. IP address not whitelisted in Redis Cloud');
    console.log('   4. Wrong host or port in REDIS_URL');
  } else if (err.message.includes('ETIMEDOUT')) {
    console.log('\n⚠️  Connection timeout. Possible causes:');
    console.log('   1. Network issues');
    console.log('   2. Redis Cloud service is slow');
    console.log('   3. Firewall blocking outbound connections');
  } else if (err.message.includes('ENOTFOUND')) {
    console.log('\n⚠️  Host not found. Possible causes:');
    console.log('   1. Wrong hostname in REDIS_URL');
    console.log('   2. DNS resolution issues');
  } else if (err.message.includes('WRONGPASS') || err.message.includes('NOAUTH')) {
    console.log('\n⚠️  Authentication error. Possible causes:');
    console.log('   1. Wrong password in REDIS_URL');
    console.log('   2. Redis requires authentication but password not provided');
  }
});

redis.on('close', () => {
  if (!isConnected) {
    console.log('\n' + '='.repeat(50));
    console.log('❌ CONNECTION FAILED');
    console.log('='.repeat(50));
    console.log('\n⚠️  Your application will use in-memory cache as fallback.');
    console.log('   This is OK for development but not ideal for production.\n');
    console.log('📋 Next steps:');
    console.log('   1. Check Redis Cloud dashboard: https://app.redislabs.com/');
    console.log('   2. Verify database is active and running');
    console.log('   3. Check IP whitelist settings');
    console.log('   4. Verify REDIS_URL is correct in .env file\n');
    
    if (connectionError) {
      console.log('💡 Error details:', connectionError.message);
    }
    
    redis.disconnect();
    process.exit(1);
  }
});

// Timeout after 15 seconds
setTimeout(() => {
  if (!isConnected) {
    console.error('\n⏱️  Connection timeout after 15 seconds');
    console.log('   The Redis server is not responding.\n');
    redis.disconnect();
    process.exit(1);
  }
}, 15000);
