// Script to test SuperAdmin login
require('dotenv').config();
const axios = require('axios');

const API_BASE_URL = 'http://localhost:8000/api';

/**
 * Test SuperAdmin Login
 */
async function testAdminLogin() {
  try {
    console.log('='.repeat(60));
    console.log('TESTING SUPERADMIN LOGIN');
    console.log('='.repeat(60));

    // Login credentials
    const credentials = {
      email: process.env.SEED_SUPERADMIN_EMAIL || 'superadmin@gmail.com',
      password: process.env.SEED_SUPERADMIN_PASSWORD || 'superadmin123'
    };

    console.log('\n📧 Email:', credentials.email);
    console.log('🔑 Password:', credentials.password);
    console.log('\n🔄 Sending login request...\n');

    const response = await axios.post(
      `${API_BASE_URL}/admin/login`,
      credentials,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.success) {
      console.log('✅ LOGIN SUCCESSFUL!\n');
      console.log('User Details:');
      console.log('  Name:', response.data.data.user.fullname);
      console.log('  Email:', response.data.data.user.email);
      console.log('  Phone:', response.data.data.user.phone);
      console.log('  Role:', response.data.data.user.role);
      console.log('  Status:', response.data.data.user.accountStatus);
      console.log('\n🎫 JWT Token:');
      console.log(response.data.data.token);
      console.log('\n💡 Use this token in Authorization header:');
      console.log(`Authorization: Bearer ${response.data.data.token}`);
      
      // Save token to file for easy access
      const fs = require('fs');
      fs.writeFileSync('.admin-token.txt', response.data.data.token);
      console.log('\n✅ Token saved to .admin-token.txt');

      return response.data.data.token;
    }

  } catch (error) {
    console.error('\n❌ LOGIN FAILED!\n');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Message:', error.response.data.message);
      console.error('Details:', error.response.data);
      
      if (error.response.status === 403) {
        console.error('\n⚠️  Access Denied!');
        console.error('Make sure you are using SuperAdmin credentials.');
        console.error('Regular admin/shopkeeper accounts cannot access admin dashboard.');
      }
    } else {
      console.error('Error:', error.message);
    }
    return null;
  }
}

/**
 * Test Dashboard API with token
 */
async function testDashboardAPI(token) {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('TESTING DASHBOARD API');
    console.log('='.repeat(60));

    const response = await axios.get(
      `${API_BASE_URL}/admin/dashboard`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (response.data.success) {
      console.log('\n✅ DASHBOARD DATA RETRIEVED!\n');
      console.log('Orders:', JSON.stringify(response.data.data.orders, null, 2));
      console.log('Revenue:', JSON.stringify(response.data.data.revenue, null, 2));
      console.log('Users:', JSON.stringify(response.data.data.users, null, 2));
      console.log('Shopkeepers:', JSON.stringify(response.data.data.shopkeepers, null, 2));
      console.log('Delivery Boys:', JSON.stringify(response.data.data.deliveryBoys, null, 2));
    }

  } catch (error) {
    console.error('\n❌ DASHBOARD API FAILED!\n');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Message:', error.response.data.message);
    } else {
      console.error('Error:', error.message);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const token = await testAdminLogin();
  
  if (token) {
    await testDashboardAPI(token);
  }

  console.log('\n' + '='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60) + '\n');
}

// Run the test
main();
