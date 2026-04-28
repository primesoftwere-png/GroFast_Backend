// Test Script for Cart API
// This script tests the add-item endpoint
// Usage: node scripts/test-cart-api.js

const testCartAPI = async () => {
  const baseURL = 'http://localhost:3000'; // Change to your server URL
  const token = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual token
  
  // Test data - replace with actual IDs from your database
  const testData = {
    userId: '507f1f77bcf86cd799439011', // Replace with actual user ID
    productId: '507f191e810c19729de860ea', // Replace with actual product ID
    quantity: 2
  };

  console.log('🧪 Testing Cart API: Add Item');
  console.log('📤 Request:', testData);

  try {
    const response = await fetch(`${baseURL}/api/cart/add-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(testData)
    });

    const data = await response.json();
    
    console.log('\n📥 Response Status:', response.status);
    console.log('📥 Response Data:', JSON.stringify(data, null, 2));

    if (data.success) {
      console.log('\n✅ TEST PASSED: Product added to cart successfully');
      console.log(`   - Action: ${data.summary.action}`);
      console.log(`   - Quantity Added: ${data.summary.quantityAdded}`);
      console.log(`   - Total Products in Cart: ${data.summary.totalProductsInCart}`);
      console.log(`   - Total Items in Cart: ${data.summary.totalItemsInCart}`);
    } else {
      console.log('\n❌ TEST FAILED:', data.message);
      if (data.error) {
        console.log('   Error Details:', data.error);
      }
    }

  } catch (error) {
    console.log('\n❌ REQUEST FAILED:', error.message);
  }
};

// Run test
testCartAPI();
