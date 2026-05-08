/**
 * Cart Checker Script
 * This script checks if a user has items in their cart
 * 
 * Usage: node scripts/check-cart.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Cart = require('../models/Customer/Cart');
const Product = require('../models/Product.model');
const User = require('../models/Auth/User');

// Configuration
const USER_ID = '69e487abf5a353e6ac028d10'; // Replace with your user ID

// Colors for console
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

async function checkCart() {
  try {
    console.log('\n' + '='.repeat(60));
    log('         CART CHECKER SCRIPT', 'cyan');
    console.log('='.repeat(60) + '\n');

    // Connect to MongoDB
    log('Connecting to MongoDB...', 'blue');
    await mongoose.connect(process.env.MONGODB_URI);
    log('✅ Connected to MongoDB', 'green');

    // Check if user exists
    log(`\n🔍 Checking if user exists: ${USER_ID}`, 'blue');
    const user = await User.findById(USER_ID);
    
    if (!user) {
      log(`❌ User not found with ID: ${USER_ID}`, 'red');
      log('Please update USER_ID in this script with a valid user ID', 'yellow');
      process.exit(1);
    }
    
    log(`✅ User found: ${user.fullname} (${user.email})`, 'green');

    // Find cart
    log(`\n🔍 Looking for cart with userId: ${USER_ID}`, 'blue');
    const cart = await Cart.findOne({ userId: USER_ID });
    
    if (!cart) {
      log('❌ No cart found for this user', 'red');
      log('\nPossible reasons:', 'yellow');
      log('1. User has never added items to cart', 'yellow');
      log('2. Cart was deleted', 'yellow');
      log('3. Wrong user ID', 'yellow');
      
      // Check all carts
      log('\n📋 Checking all carts in database...', 'blue');
      const allCarts = await Cart.find({}).limit(5);
      log(`Found ${allCarts.length} carts (showing first 5):`, 'blue');
      allCarts.forEach((c, i) => {
        console.log(`  ${i + 1}. Cart ID: ${c._id}, User ID: ${c.userId}, Products: ${c.products.length}`);
      });
      
      process.exit(1);
    }

    log('✅ Cart found!', 'green');
    console.log('\n📦 Cart Details:');
    console.log('─'.repeat(60));
    console.log(`Cart ID: ${cart._id}`);
    console.log(`User ID: ${cart.userId}`);
    console.log(`Products Count: ${cart.products.length}`);
    console.log(`Total Price: ₹${cart.totalPrice}`);
    console.log(`Total GST: ₹${cart.totalGST}`);
    console.log(`Order ID: ${cart.OrderId || 'None'}`);
    console.log('─'.repeat(60));

    if (cart.products.length === 0) {
      log('\n⚠️  Cart is empty (no products)', 'yellow');
      log('Add products to cart before creating order', 'yellow');
      process.exit(1);
    }

    // Populate products
    log('\n🔍 Fetching product details...', 'blue');
    const populatedCart = await Cart.findOne({ userId: USER_ID }).populate('products.productId');
    
    console.log('\n📦 Cart Products:');
    console.log('─'.repeat(60));
    
    populatedCart.products.forEach((item, index) => {
      console.log(`\n${index + 1}. Product:`);
      if (item.productId) {
        console.log(`   Name: ${item.productId.productName}`);
        console.log(`   Price: ₹${item.productId.productPrice}`);
        console.log(`   Quantity in Cart: ${item.quantity}`);
        console.log(`   Available Stock: ${item.productId.productQuantity}`);
        console.log(`   Product ID: ${item.productId._id}`);
      } else {
        log(`   ❌ Product not found (may have been deleted)`, 'red');
        console.log(`   Product ID: ${item.productId}`);
      }
    });
    
    console.log('─'.repeat(60));

    // Check for issues
    log('\n🔍 Checking for potential issues...', 'blue');
    let hasIssues = false;

    populatedCart.products.forEach((item, index) => {
      if (!item.productId) {
        log(`❌ Product ${index + 1}: Product not found (deleted?)`, 'red');
        hasIssues = true;
      } else if (item.productId.productQuantity < item.quantity) {
        log(`⚠️  Product ${index + 1}: Insufficient stock (Available: ${item.productId.productQuantity}, Requested: ${item.quantity})`, 'yellow');
        hasIssues = true;
      }
    });

    if (!hasIssues) {
      log('✅ No issues found! Cart is ready for order creation', 'green');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    log('SUMMARY', 'cyan');
    console.log('='.repeat(60));
    log(`✅ User exists: ${user.fullname}`, 'green');
    log(`✅ Cart exists: ${cart._id}`, 'green');
    log(`✅ Products in cart: ${cart.products.length}`, 'green');
    
    if (hasIssues) {
      log('⚠️  Issues found (see above)', 'yellow');
    } else {
      log('✅ Ready to create order!', 'green');
    }
    console.log('='.repeat(60) + '\n');

    // Test query
    log('🧪 Testing the exact query used in order controller...', 'blue');
    const testCart = await Cart.findOne({ userId: USER_ID }).populate('products.productId');
    
    if (testCart && testCart.products && testCart.products.length > 0) {
      log('✅ Query works! Cart will be found by order controller', 'green');
    } else {
      log('❌ Query failed! This is why order creation fails', 'red');
    }

  } catch (error) {
    log('\n❌ Error:', 'red');
    console.error(error);
  } finally {
    await mongoose.connection.close();
    log('\n✅ Database connection closed', 'green');
  }
}

// Run the checker
checkCart();
