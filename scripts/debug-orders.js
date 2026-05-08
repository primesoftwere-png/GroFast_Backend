// scripts/debug-orders.js
// Debug script to check orders in database

const mongoose = require('mongoose');
require('dotenv').config();

const Order = require('../models/Customer/Order');
const User = require('../models/user.model');
const Shopkeeper = require('../models/ShopKeeper/Shopkeeper');
const Shop = require('../models/ShopKeeper/Shop');

async function debugOrders() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/Grofast');
    console.log('✓ Connected to database');

    console.log('\n========================================');
    console.log('ORDERS DEBUG INFORMATION');
    console.log('========================================\n');

    // Get all orders
    const allOrders = await Order.find({}).limit(10);
    console.log(`Total orders in database: ${await Order.countDocuments({})}`);
    console.log(`Showing first 10 orders:\n`);

    for (const order of allOrders) {
      console.log('---');
      console.log('Order ID:', order._id);
      console.log('Order Number:', order.orderNumber);
      console.log('Order Status:', order.orderStatus);
      console.log('Shop ID (from order):', order.shopId);
      console.log('Shop ID type:', typeof order.shopId);
      console.log('Customer ID:', order.customerId);
      console.log('Total Amount:', order.totalAmount);
      console.log('Created At:', order.createdAt);

      // Try to find the shopkeeper user
      const shopUser = await User.findById(order.shopId);
      if (shopUser) {
        console.log('✓ Shop User found:', shopUser.fullname, '(', shopUser.email, ')');
        console.log('  User role:', shopUser.role);
        
        // Find shopkeeper profile
        const shopkeeper = await Shopkeeper.findOne({ userId: order.shopId });
        if (shopkeeper) {
          console.log('✓ Shopkeeper profile found:', shopkeeper._id);
          
          // Find shop
          const shop = await Shop.findOne({ shopkeeperId: shopkeeper._id });
          if (shop) {
            console.log('✓ Shop found:', shop.shopName);
          } else {
            console.log('✗ Shop NOT found for shopkeeper');
          }
        } else {
          console.log('✗ Shopkeeper profile NOT found for userId:', order.shopId);
        }
      } else {
        console.log('✗ Shop User NOT found for shopId:', order.shopId);
      }
    }

    console.log('\n========================================');
    console.log('SHOPKEEPERS DEBUG INFORMATION');
    console.log('========================================\n');

    // Get all shopkeepers
    const shopkeepers = await Shopkeeper.find({}).limit(5);
    console.log(`Total shopkeepers: ${await Shopkeeper.countDocuments({})}`);
    console.log(`Showing first 5 shopkeepers:\n`);

    for (const shopkeeper of shopkeepers) {
      console.log('---');
      console.log('Shopkeeper ID:', shopkeeper._id);
      console.log('User ID:', shopkeeper.userId);
      console.log('Shop Name:', shopkeeper.shopName);
      console.log('Owner Name:', shopkeeper.ownerName);

      // Find user
      const user = await User.findById(shopkeeper.userId);
      if (user) {
        console.log('✓ User found:', user.fullname, '(', user.email, ')');
      } else {
        console.log('✗ User NOT found');
      }

      // Find shop
      const shop = await Shop.findOne({ shopkeeperId: shopkeeper._id });
      if (shop) {
        console.log('✓ Shop found:', shop.shopName);
      } else {
        console.log('✗ Shop NOT found');
      }

      // Check orders for this shopkeeper
      const ordersCount = await Order.countDocuments({ shopId: shopkeeper.userId });
      console.log(`Orders for this shopkeeper: ${ordersCount}`);
      
      const pendingCount = await Order.countDocuments({ 
        shopId: shopkeeper.userId, 
        orderStatus: 'PENDING' 
      });
      console.log(`Pending orders: ${pendingCount}`);
    }

    console.log('\n========================================');
    console.log('ORDER STATUS BREAKDOWN');
    console.log('========================================\n');

    const statuses = ['PENDING', 'ACCEPTED', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
    for (const status of statuses) {
      const count = await Order.countDocuments({ orderStatus: status });
      console.log(`${status}: ${count}`);
    }

    console.log('\n========================================\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('✓ Database connection closed');
  }
}

debugOrders();
