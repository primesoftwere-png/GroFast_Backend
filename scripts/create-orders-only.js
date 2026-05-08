// scripts/create-orders-only.js
// Create orders for existing shopkeeper

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/user.model');
const Product = require('../models/Product.model');
const Order = require('../models/Customer/Order');
const OrderItem = require('../models/Customer/OrderItem');
const CustomerAddress = require('../models/Customer/CustomerAddress');
const { v4: uuidv4 } = require('uuid');

async function createOrders() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to database:', mongoose.connection.db.databaseName);

    console.log('\n========================================');
    console.log('CREATING ORDERS FOR EXISTING SHOPKEEPER');
    console.log('========================================\n');

    // Find shopkeeper
    const shopkeeperUser = await User.findOne({ email: 'testshop@example.com' });
    if (!shopkeeperUser) {
      console.log('❌ Shopkeeper not found. Please run create-test-data.js first');
      return;
    }
    console.log('✓ Shopkeeper found:', shopkeeperUser._id);

    // Find products
    const products = await Product.find({ createdBy: shopkeeperUser._id }).limit(2);
    if (products.length === 0) {
      console.log('❌ No products found. Please run create-test-data.js first');
      return;
    }
    console.log('✓ Products found:', products.length);

    // Find or create customer
    let customerUser = await User.findOne({ email: 'testcustomer@example.com' });
    if (!customerUser) {
      console.log('Creating customer user...');
      const hashedPassword = await User.hashPassword('Test@123');
      customerUser = await User.create({
        fullname: 'Test Customer',
        email: 'testcustomer@example.com',
        phone: '7777777777',
        password: hashedPassword,
        role: 'user',
        accountStatus: 'active'
      });
      console.log('✓ Customer created:', customerUser._id);
    } else {
      console.log('✓ Customer found:', customerUser._id);
    }

    // Find or create customer address
    let customerAddress = await CustomerAddress.findOne({ customerId: customerUser._id });
    if (!customerAddress) {
      console.log('Creating customer address...');
      customerAddress = await CustomerAddress.create({
        customerId: customerUser._id,
        addressType: 'home',
        addressLine1: '456 Customer Street',
        addressLine2: 'Apartment 101',
        landmark: 'Near Test Mall',
        city: 'Test City',
        state: 'Test State',
        pincode: '123456',
        latitude: 23.0250,
        longitude: 72.5750,
        isDefault: true
      });
      console.log('✓ Customer address created:', customerAddress._id);
    } else {
      console.log('✓ Customer address found:', customerAddress._id);
    }

    // Delete existing orders for this shopkeeper
    const deletedCount = await Order.deleteMany({ shopId: shopkeeperUser._id });
    console.log(`\n✓ Deleted ${deletedCount.deletedCount} existing orders`);

    // Create new orders
    console.log('\nCreating new orders...\n');

    // Order 1 - PENDING
    const order1 = await Order.create({
      orderNumber: `ORD-${Date.now()}-${uuidv4().toUpperCase().slice(0, 6)}`,
      orderToken: uuidv4().replace(/-/g, '').toUpperCase(),
      customerId: customerUser._id,
      shopId: shopkeeperUser._id,
      deliveryAddressId: customerAddress._id,
      orderStatus: 'PENDING',
      paymentStatus: 'PENDING',
      paymentMethod: 'COD',
      subtotal: 200,
      deliveryCharge: 0,
      discountAmount: 0,
      taxAmount: 36,
      totalAmount: 236,
      codAmount: 236,
      estimatedDeliveryTime: new Date(Date.now() + 60 * 60 * 1000)
    });
    console.log('✓ Order 1 created (PENDING):', order1.orderNumber);

    if (products[0]) {
      await OrderItem.create({
        orderId: order1._id,
        productId: products[0]._id,
        productName: products[0].productName,
        quantity: 1,
        unitPrice: products[0].productPrice,
        discountAmount: 0,
        totalPrice: products[0].productPrice * 1.18
      });
    }

    // Order 2 - PENDING
    const order2 = await Order.create({
      orderNumber: `ORD-${Date.now() + 1}-${uuidv4().toUpperCase().slice(0, 6)}`,
      orderToken: uuidv4().replace(/-/g, '').toUpperCase(),
      customerId: customerUser._id,
      shopId: shopkeeperUser._id,
      deliveryAddressId: customerAddress._id,
      orderStatus: 'PENDING',
      paymentStatus: 'PENDING',
      paymentMethod: 'ONLINE',
      subtotal: 150,
      deliveryCharge: 0,
      discountAmount: 0,
      taxAmount: 27,
      totalAmount: 177,
      codAmount: 0,
      estimatedDeliveryTime: new Date(Date.now() + 60 * 60 * 1000)
    });
    console.log('✓ Order 2 created (PENDING):', order2.orderNumber);

    if (products[0]) {
      await OrderItem.create({
        orderId: order2._id,
        productId: products[0]._id,
        productName: products[0].productName,
        quantity: 1,
        unitPrice: products[0].productPrice,
        discountAmount: 0,
        totalPrice: products[0].productPrice * 1.18
      });
    }

    // Order 3 - ACCEPTED
    const order3 = await Order.create({
      orderNumber: `ORD-${Date.now() + 2}-${uuidv4().toUpperCase().slice(0, 6)}`,
      orderToken: uuidv4().replace(/-/g, '').toUpperCase(),
      customerId: customerUser._id,
      shopId: shopkeeperUser._id,
      deliveryAddressId: customerAddress._id,
      orderStatus: 'ACCEPTED',
      paymentStatus: 'PENDING',
      paymentMethod: 'COD',
      subtotal: 100,
      deliveryCharge: 0,
      discountAmount: 0,
      taxAmount: 18,
      totalAmount: 118,
      codAmount: 118,
      acceptedAt: new Date(),
      estimatedDeliveryTime: new Date(Date.now() + 60 * 60 * 1000)
    });
    console.log('✓ Order 3 created (ACCEPTED):', order3.orderNumber);

    if (products[1]) {
      await OrderItem.create({
        orderId: order3._id,
        productId: products[1]._id,
        productName: products[1].productName,
        quantity: 2,
        unitPrice: products[1].productPrice,
        discountAmount: 0,
        totalPrice: products[1].productPrice * 2 * 1.18
      });
    }

    console.log('\n========================================');
    console.log('ORDERS CREATED SUCCESSFULLY');
    console.log('========================================\n');

    console.log('TEST THE API:');
    console.log('-------------');
    console.log('1. Login as shopkeeper:');
    console.log('   POST http://localhost:8000/api/shopkeeper/auth/login');
    console.log('   Body: { "email": "testshop@example.com", "password": "Test@123" }');
    console.log('\n2. Get pending orders (use token from login):');
    console.log('   GET http://localhost:8000/api/shopkeeper/orders?status=PENDING');
    console.log('   Header: Authorization: Bearer <token>');
    console.log('\n3. Get all orders:');
    console.log('   GET http://localhost:8000/api/shopkeeper/orders');
    console.log('\nShopkeeper User ID:', shopkeeperUser._id.toString());
    console.log('Orders created: 2 PENDING, 1 ACCEPTED');
    console.log('\n========================================\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('✓ Database connection closed');
  }
}

createOrders();
