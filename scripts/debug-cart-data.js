// Debug script to check cart data structure
require('dotenv').config();
const mongoose = require('mongoose');
const Cart = require('../models/Customer/Cart');
const Product = require('../models/Product.model');
const User = require('../models/user.model');

const userId = '69e487abf5a353e6ac028d10'; // Your user ID

async function debugCart() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find cart
    const cart = await Cart.findOne({ userId: userId });
    console.log('📦 Cart found:', cart ? 'Yes' : 'No');
    
    if (cart) {
      console.log('\n📊 Cart Data:');
      console.log('- User ID:', cart.userId);
      console.log('- Products count:', cart.products?.length || 0);
      console.log('- Total Price:', cart.totalPrice);
      console.log('- Total GST:', cart.totalGST);
      
      if (cart.products && cart.products.length > 0) {
        console.log('\n🛍️ Products in cart:');
        for (let i = 0; i < cart.products.length; i++) {
          const item = cart.products[i];
          console.log(`\nProduct ${i + 1}:`);
          console.log('- Product ID:', item.productId);
          console.log('- Quantity:', item.quantity);
        }
      }
    }

    // Now populate and check
    console.log('\n\n🔍 Checking with populate...');
    const populatedCart = await Cart.findOne({ userId: userId }).populate('products.productId');
    
    if (populatedCart && populatedCart.products && populatedCart.products.length > 0) {
      console.log('\n✅ Populated cart products:');
      for (let i = 0; i < populatedCart.products.length; i++) {
        const item = populatedCart.products[i];
        console.log(`\nProduct ${i + 1}:`);
        console.log('- Product ID:', item.productId?._id);
        console.log('- Product Name:', item.productId?.productName);
        console.log('- Product Price:', item.productId?.productPrice);
        console.log('- Created By (Shop ID):', item.productId?.createdBy);
        console.log('- Quantity:', item.quantity);
      }
      
      // Check if createdBy exists
      const firstProduct = populatedCart.products[0].productId;
      if (firstProduct && firstProduct.createdBy) {
        console.log('\n✅ Shop ID found:', firstProduct.createdBy);
        
        // Try to find the shop
        const User = require('../models/user.model');
        const shop = await User.findById(firstProduct.createdBy);
        console.log('\n🏪 Shop Details:');
        if (shop) {
          console.log('- Shop ID:', shop._id);
          console.log('- Shop Name:', shop.fullname);
          console.log('- Shop Role:', shop.role);
          console.log('- Shop Email:', shop.email);
        } else {
          console.log('❌ Shop not found in database!');
        }
      } else {
        console.log('\n❌ No createdBy field in product!');
      }
    }

    await mongoose.connection.close();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugCart();
