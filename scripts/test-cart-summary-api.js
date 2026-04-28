/**
 * Test script for Cart Summary API
 * This endpoint is designed for home screen to show cart products with only productId and quantity
 * 
 * Usage: node scripts/test-cart-summary-api.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000/api';
const TEST_USER_ID = '507f1f77bcf86cd799439011'; // Replace with actual user ID from your database

// Test function
async function testCartSummaryAPI() {
  console.log('🧪 Testing Cart Summary API for Home Screen\n');
  console.log('=' .repeat(60));

  try {
    // Test 1: Get cart summary
    console.log('\n📋 Test 1: Get Cart Summary');
    console.log('-'.repeat(60));
    
    const response = await axios.get(
      `${BASE_URL}/cart/summary/${TEST_USER_ID}`,
      {
        headers: {
          'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE' // Replace with actual token
        }
      }
    );

    console.log('✅ Status:', response.status);
    console.log('✅ Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      const { products, totalItems, totalProducts } = response.data.data;
      console.log('\n📊 Cart Summary:');
      console.log(`   - Total Products: ${totalProducts}`);
      console.log(`   - Total Items: ${totalItems}`);
      console.log(`   - Products in Cart:`);
      
      if (products.length > 0) {
        products.forEach((item, index) => {
          console.log(`     ${index + 1}. Product ID: ${item.productId}, Quantity: ${item.quantity}`);
        });
      } else {
        console.log('     (Cart is empty)');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test completed\n');
}

// Test with invalid user ID
async function testInvalidUserId() {
  console.log('\n📋 Test 2: Invalid User ID');
  console.log('-'.repeat(60));

  try {
    const response = await axios.get(
      `${BASE_URL}/cart/summary/invalid-id`,
      {
        headers: {
          'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE'
        }
      }
    );
    console.log('Response:', response.data);
  } catch (error) {
    console.log('✅ Expected error caught:');
    console.log('   Status:', error.response?.status);
    console.log('   Message:', error.response?.data?.message);
  }
}

// Run tests
async function runAllTests() {
  console.log('\n🚀 Starting Cart Summary API Tests\n');
  
  await testCartSummaryAPI();
  await testInvalidUserId();
  
  console.log('\n✨ All tests completed!\n');
}

// Execute
runAllTests();
