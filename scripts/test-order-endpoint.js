/**
 * Order Endpoint Test Script
 * This script tests if the order endpoint is accessible
 * 
 * Usage: node scripts/test-order-endpoint.js
 */

const http = require('http');

// Configuration
const HOST = 'localhost';
const PORT = 8000;
const AUTH_TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual token

// Test data
const testData = {
  userId: '69e487abf5a353e6ac028d10',
  deliveryAddressId: '69f38f025f0fd0d92f522fd8',
  paymentMethod: 'online'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test function
function testOrderEndpoint(endpoint) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(testData);

    const options = {
      hostname: HOST,
      port: PORT,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    };

    log(`\nTesting: POST http://${HOST}:${PORT}${endpoint}`, 'cyan');
    log('Request Body:', 'blue');
    console.log(JSON.stringify(testData, null, 2));

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        log(`\nStatus Code: ${res.statusCode}`, res.statusCode === 200 || res.statusCode === 201 ? 'green' : 'red');
        log('Response Headers:', 'blue');
        console.log(JSON.stringify(res.headers, null, 2));
        
        log('\nResponse Body:', 'blue');
        try {
          const jsonData = JSON.parse(data);
          console.log(JSON.stringify(jsonData, null, 2));
        } catch (e) {
          console.log(data);
        }

        if (res.statusCode === 404) {
          log('\n❌ 404 ERROR - Endpoint not found!', 'red');
          log('Possible reasons:', 'yellow');
          log('1. Server not running on port 8000', 'yellow');
          log('2. Route not properly registered', 'yellow');
          log('3. Server needs to be restarted', 'yellow');
        } else if (res.statusCode === 401 || res.statusCode === 403) {
          log('\n⚠️  Authentication Error', 'yellow');
          log('Please update AUTH_TOKEN in this script with a valid JWT token', 'yellow');
        } else if (res.statusCode === 200 || res.statusCode === 201) {
          log('\n✅ Endpoint is working!', 'green');
        } else if (res.statusCode === 400) {
          log('\n⚠️  Bad Request - Check the error message above', 'yellow');
        }

        resolve({ statusCode: res.statusCode, data });
      });
    });

    req.on('error', (error) => {
      log(`\n❌ Connection Error: ${error.message}`, 'red');
      log('\nPossible reasons:', 'yellow');
      log('1. Server is not running', 'yellow');
      log('2. Wrong host or port', 'yellow');
      log('3. Firewall blocking connection', 'yellow');
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Test all possible endpoints
async function runTests() {
  console.clear();
  log('═══════════════════════════════════════════════════════', 'cyan');
  log('         ORDER ENDPOINT TEST SUITE', 'cyan');
  log('═══════════════════════════════════════════════════════', 'cyan');

  if (AUTH_TOKEN === 'YOUR_JWT_TOKEN_HERE') {
    log('\n⚠️  WARNING: Please set AUTH_TOKEN in this script!', 'yellow');
    log('The tests will run but may fail with 401 Unauthorized\n', 'yellow');
  }

  const endpoints = [
    '/api/order/convert-cart-to-order',
    '/api/order/cart-to-order'
  ];

  for (const endpoint of endpoints) {
    try {
      await testOrderEndpoint(endpoint);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between tests
    } catch (error) {
      // Error already logged
    }
  }

  log('\n═══════════════════════════════════════════════════════', 'cyan');
  log('         TEST SUITE COMPLETED', 'cyan');
  log('═══════════════════════════════════════════════════════', 'cyan');

  log('\nNext Steps:', 'blue');
  log('1. If you see 404 errors, restart your server', 'yellow');
  log('2. If you see 401 errors, update AUTH_TOKEN in this script', 'yellow');
  log('3. If you see 400 errors, check the error message for details', 'yellow');
  log('4. If you see 200/201, the endpoint is working correctly!', 'green');
}

// Run the tests
runTests().catch(console.error);
