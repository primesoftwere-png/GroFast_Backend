/**
 * Payment API Test Script
 * Run this script to test the payment endpoints
 * 
 * Usage: node scripts/test-payment-api.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000/api';
const AUTH_TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual token

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

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Test 1: Create Payment Order (New Endpoint)
async function testCreateOrder() {
  logSection('Test 1: Create Payment Order (/create-order)');
  
  try {
    const amount = 500; // ₹500
    logInfo(`Creating order for amount: ₹${amount}`);
    
    const response = await axios.post(
      `${BASE_URL}/payment/create-order`,
      { amount },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      }
    );
    
    if (response.data.success) {
      logSuccess('Order created successfully!');
      console.log('\nResponse Data:');
      console.log(JSON.stringify(response.data, null, 2));
      
      return {
        orderId: response.data.order.id,
        amount: response.data.order.amount,
        keyId: response.data.key_id
      };
    } else {
      logError('Order creation failed');
      console.log(response.data);
      return null;
    }
  } catch (error) {
    logError('Error creating order');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
    return null;
  }
}

// Test 2: Create Payment Intent (Existing Endpoint)
async function testCreatePaymentIntent() {
  logSection('Test 2: Create Payment Intent (/create-payment-intent)');
  
  try {
    const amount = 750; // ₹750
    logInfo(`Creating payment intent for amount: ₹${amount}`);
    
    const response = await axios.post(
      `${BASE_URL}/payment/create-payment-intent`,
      { amount },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      }
    );
    
    if (response.data.success) {
      logSuccess('Payment intent created successfully!');
      console.log('\nResponse Data:');
      console.log(JSON.stringify(response.data, null, 2));
      return response.data.data;
    } else {
      logError('Payment intent creation failed');
      console.log(response.data);
      return null;
    }
  } catch (error) {
    logError('Error creating payment intent');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
    return null;
  }
}

// Test 3: Get Razorpay Key
async function testGetKey() {
  logSection('Test 3: Get Razorpay Key (/get-key)');
  
  try {
    logInfo('Fetching Razorpay key...');
    
    const response = await axios.get(
      `${BASE_URL}/payment/get-key`,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      }
    );
    
    if (response.data.success) {
      logSuccess('Razorpay key retrieved successfully!');
      console.log('\nKey ID:', response.data.key);
      return response.data.key;
    } else {
      logError('Failed to get Razorpay key');
      console.log(response.data);
      return null;
    }
  } catch (error) {
    logError('Error getting Razorpay key');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
    return null;
  }
}

// Test 4: Verify Payment (Mock Test)
async function testVerifyPayment() {
  logSection('Test 4: Verify Payment (/verify-payment)');
  
  logInfo('Note: This is a mock test with dummy data');
  logInfo('Real verification requires actual payment from Razorpay');
  
  try {
    const mockData = {
      razorpay_order_id: 'order_test123',
      razorpay_payment_id: 'pay_test123',
      razorpay_signature: 'dummy_signature_for_testing'
    };
    
    logInfo('Sending verification request...');
    
    const response = await axios.post(
      `${BASE_URL}/payment/verify-payment`,
      mockData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      }
    );
    
    if (response.data.success) {
      logSuccess('Payment verified successfully!');
      console.log(response.data);
    } else {
      log('⚠️  Verification failed (expected with mock data)', 'yellow');
      console.log(response.data);
    }
  } catch (error) {
    log('⚠️  Verification failed (expected with mock data)', 'yellow');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

// Test 5: Invalid Amount Test
async function testInvalidAmount() {
  logSection('Test 5: Invalid Amount Validation');
  
  const invalidAmounts = [0, -100, 'invalid', null, undefined];
  
  for (const amount of invalidAmounts) {
    try {
      logInfo(`Testing with invalid amount: ${amount}`);
      
      const response = await axios.post(
        `${BASE_URL}/payment/create-order`,
        { amount },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AUTH_TOKEN}`
          }
        }
      );
      
      if (!response.data.success) {
        logSuccess(`Correctly rejected invalid amount: ${amount}`);
        console.log('Error message:', response.data.error);
      }
    } catch (error) {
      if (error.response && error.response.status === 400) {
        logSuccess(`Correctly rejected invalid amount: ${amount}`);
        console.log('Error message:', error.response.data.error);
      } else {
        logError(`Unexpected error for amount: ${amount}`);
        console.log(error.message);
      }
    }
  }
}

// Test 6: Authentication Test
async function testAuthentication() {
  logSection('Test 6: Authentication Check');
  
  try {
    logInfo('Testing without authentication token...');
    
    const response = await axios.post(
      `${BASE_URL}/payment/create-order`,
      { amount: 100 },
      {
        headers: {
          'Content-Type': 'application/json'
          // No Authorization header
        }
      }
    );
    
    logError('Request succeeded without auth (security issue!)');
    console.log(response.data);
  } catch (error) {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      logSuccess('Authentication properly enforced');
      console.log('Status:', error.response.status);
      console.log('Message:', error.response.data);
    } else {
      log('⚠️  Unexpected response', 'yellow');
      console.log('Status:', error.response?.status);
      console.log('Data:', error.response?.data);
    }
  }
}

// Main test runner
async function runAllTests() {
  console.clear();
  log('\n🚀 Payment API Test Suite\n', 'cyan');
  
  // Check configuration
  if (AUTH_TOKEN === 'YOUR_JWT_TOKEN_HERE') {
    logError('Please set AUTH_TOKEN in the script before running tests!');
    log('\nHow to get AUTH_TOKEN:', 'yellow');
    log('1. Login to your application', 'yellow');
    log('2. Copy the JWT token from the login response', 'yellow');
    log('3. Replace AUTH_TOKEN in this script', 'yellow');
    process.exit(1);
  }
  
  logInfo(`Base URL: ${BASE_URL}`);
  logInfo(`Auth Token: ${AUTH_TOKEN.substring(0, 20)}...`);
  
  try {
    // Run tests
    await testCreateOrder();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testCreatePaymentIntent();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testGetKey();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testVerifyPayment();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testInvalidAmount();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testAuthentication();
    
    // Summary
    logSection('Test Summary');
    logSuccess('All tests completed!');
    log('\nNote: Some tests may fail if:', 'yellow');
    log('- Server is not running', 'yellow');
    log('- Razorpay credentials are not configured', 'yellow');
    log('- Auth token is invalid or expired', 'yellow');
    
  } catch (error) {
    logError('Test suite failed');
    console.error(error);
  }
}

// Run tests
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testCreateOrder,
  testCreatePaymentIntent,
  testGetKey,
  testVerifyPayment,
  testInvalidAmount,
  testAuthentication
};
