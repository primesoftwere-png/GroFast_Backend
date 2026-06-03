// Script to test getting order by order number
require('dotenv').config();
const axios = require('axios');

const API_BASE_URL = 'http://localhost:8000/api';
const ORDER_NUMBER = 'ORD-1778355458726-HMA3WQ50E'; // Replace with your order number

// You need to get this token by logging in first
// Use the login API: POST /api/user/login with email and password
const JWT_TOKEN = 'YOUR_JWT_TOKEN_HERE';

async function testGetOrderByNumber() {
  try {
    console.log('Testing GET order by order number...');
    console.log('Order Number:', ORDER_NUMBER);
    console.log('URL:', `${API_BASE_URL}/order/recent/${ORDER_NUMBER}`);
    
    const response = await axios.get(
      `${API_BASE_URL}/order/recent/${ORDER_NUMBER}`,
      {
        headers: {
          'Authorization': `Bearer ${JWT_TOKEN}`
        }
      }
    );

    console.log('\n✅ SUCCESS!');
    console.log('Order Details:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('\n❌ ERROR!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Message:', error.response.data);
      
      if (error.response.status === 401) {
        console.error('\n⚠️  Authentication Error!');
        console.error('You need to:');
        console.error('1. Login first using POST /api/user/login');
        console.error('2. Copy the JWT token from the response');
        console.error('3. Replace JWT_TOKEN in this script with your token');
      }
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Helper function to login and get token
async function loginAndGetToken(email, password) {
  try {
    console.log('Logging in...');
    const response = await axios.post(`${API_BASE_URL}/user/login`, {
      email: email,
      password: password
    });

    if (response.data.success) {
      console.log('✅ Login successful!');
      console.log('Token:', response.data.data.token);
      return response.data.data.token;
    }
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return null;
  }
}

// Example: Login first, then get order
async function loginAndGetOrder() {
  // Replace with your credentials
  const email = 'customer@example.com';
  const password = 'password123';
  
  const token = await loginAndGetToken(email, password);
  
  if (token) {
    console.log('\nNow fetching order...');
    const response = await axios.get(
      `${API_BASE_URL}/order/recent/${ORDER_NUMBER}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('✅ Order Details:', JSON.stringify(response.data, null, 2));
  }
}

// Run the test
console.log('='.repeat(60));
console.log('TEST: Get Order by Order Number');
console.log('='.repeat(60));

// Option 1: Use existing token
// testGetOrderByNumber();

// Option 2: Login first, then get order (recommended)
// Uncomment and add your credentials:
// loginAndGetOrder();

console.log('\n⚠️  Please uncomment one of the test functions above and run again');
