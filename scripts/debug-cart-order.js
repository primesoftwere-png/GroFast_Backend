// Script to debug cart and order creation issues
require('dotenv').config();
const mongoose = require('mongoose');
const Cart = require('../models/Customer/Cart');
const User = require('../models/user.model');
const Product = require('../models/Product.model');

const userId = '69e487abf5a353e6ac028d10'; // Your user ID from the request

async function debugCartOrder() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to database\n');

    // 1. Check if user exists
    console.log('=== CHECKING USER ===');
    const user = await User.findById(userId);
    if (user) {
      console.log('✅ User found:', {
        id: user._id,
        name: user.fullname,
        email: user.email,
        role: user.role
      });
    } else {
      console.log('❌ User not found');
      process.exit(1);
    }

    // 2. Check cart
    console.log('\n=== CHECKING CART ===');
    const cart = await Cart.findOne({ userId: userId });
    if (!cart) {
      console.log('❌ Cart not found for user');
      process.exit(1);
    }
    
    console.log('✅ Cart found:', {
      cartId: cart._id,
      productsCount: cart.products.length,
      totalPrice: cart.totalPrice,
      totalGST: cart.totalGST
    });

    if (cart.products.length === 0) {
      console.log('❌ Cart is empty');
      process.exit(1);
    }

    // 3. Check cart products with population
    console.log('\n=== CHECKING CART PRODUCTS ===');
    const populatedCart = await Cart.findOne({ userId: userId }).populate('products.productId');
    
    for (let i = 0; i < populatedCart.products.length; i++) {
      const item = populatedCart.products[i];
      console.log(`\nProduct ${i + 1}:`);
      
      if (!item.productId) {
        console.log('  ❌ Product not found (deleted or invalid reference)');
        continue;
      }
      
      console.log('  Product ID:', item.productId._id);
      console.log('  Product Name:', item.productId.productName);
      console.log('  Product Price:', item.productId.productPrice);
      console.log('  Quantity:', item.quantity);
      console.log('  Created By (Shop ID):', item.productId.createdBy);
      
      // Check if shop exists
      const shop = await User.findById(item.productId.createdBy);
      if (shop) {
        console.log('  ✅ Shop found:', {
          id: shop._id,
          name: shop.fullname,
          role: shop.role,
          shopName: shop.roleDetails?.admin?.shopName
        });
      } else {
        console.log('  ❌ Shop not found for this product!');
      }
    }

    // 4. Summary
    console.log('\n=== SUMMARY ===');
    const firstProduct = populatedCart.products[0];
    if (firstProduct && firstProduct.productId) {
      const shopId = firstProduct.productId.createdBy;
      console.log('Shop ID that would be used:', shopId);
      
      const shop = await User.findById(shopId);
      if (shop) {
        console.log('✅ Order can be created with this shop');
      } else {
        console.log('❌ Order CANNOT be created - shop does not exist');
        console.log('   This product was created by a user that no longer exists');
        console.log('   You need to either:');
        console.log('   1. Remove this product from cart');
        console.log('   2. Update the product\'s createdBy field to a valid shop');
      }
    }

    console.log('\n✅ Debug complete');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

debugCartOrder();
