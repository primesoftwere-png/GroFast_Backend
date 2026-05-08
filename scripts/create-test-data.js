// scripts/create-test-data.js
// Create test data for testing shopkeeper orders

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/user.model');
const Shopkeeper = require('../models/ShopKeeper/Shopkeeper');
const Shop = require('../models/ShopKeeper/Shop');
const Product = require('../models/Product.model');
const ProductCategory = require('../models/ProductCategory.model');
const Order = require('../models/Customer/Order');
const OrderItem = require('../models/Customer/OrderItem');
const CustomerAddress = require('../models/Customer/CustomerAddress');
const { v4: uuidv4 } = require('uuid');

async function createTestData() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to database');
    console.log('Database:', mongoose.connection.db.databaseName);

    console.log('\n========================================');
    console.log('CREATING TEST DATA');
    console.log('========================================\n');

    // 1. Create Shopkeeper User
    console.log('1. Creating shopkeeper user...');
    const hashedPassword = await User.hashPassword('Test@123');
    
    const shopkeeperUser = await User.create({
      fullname: 'Test Shopkeeper',
      email: 'testshop@example.com',
      phone: '8888888888',
      password: hashedPassword,
      role: 'admin',
      accountStatus: 'active',
      roleDetails: {
        shopkeeper: {
          status: 'active'
        }
      }
    });
    console.log('✓ Shopkeeper user created:', shopkeeperUser._id);

    // 2. Create Shopkeeper Profile
    console.log('\n2. Creating shopkeeper profile...');
    const shopkeeper = await Shopkeeper.create({
      userId: shopkeeperUser._id,
      shopName: 'Test Grocery Store',
      ownerName: 'Test Shopkeeper',
      shopImage: 'https://via.placeholder.com/300',
      licenseNumber: 'LIC123456',
      gstNumber: '22AAAAA0000A1Z5'
    });
    console.log('✓ Shopkeeper profile created:', shopkeeper._id);

    // 3. Create Shop
    console.log('\n3. Creating shop...');
    const shop = await Shop.create({
      shopkeeperId: shopkeeper._id,
      shopName: 'Test Grocery Store',
      shopAddress: '123 Test Street, Test City',
      city: 'Test City',
      state: 'Test State',
      pincode: '123456',
      latitude: 23.0225,
      longitude: 72.5714,
      businessType: 'grocery',
      openingTime: '09:00',
      closingTime: '21:00',
      isOpen: true,
      shopImage: 'https://via.placeholder.com/300',
      shopBanner: 'https://via.placeholder.com/800x200',
      commissionRate: 10,
      status: 'ACTIVE',
      isVerified: true
    });
    console.log('✓ Shop created:', shop._id);

    // 4. Create Product Category
    console.log('\n4. Creating product category...');
    const category = await ProductCategory.create({
      categoryName: 'Fruits & Vegetables',
      categoryImage: 'https://via.placeholder.com/200',
      status: 'active',
      createdBy: shopkeeperUser._id
    });
    console.log('✓ Category created:', category._id);

    // 5. Create Products
    console.log('\n5. Creating products...');
    const products = [];
    
    const product1 = await Product.create({
      productName: 'Fresh Apples',
      productDescription: 'Fresh red apples',
      productPrice: 150,
      productQuantity: 100,
      productImage: 'https://via.placeholder.com/200',
      productCategory: category._id,
      productUnit: 'kg',
      productCode: 'PROD001',
      createdBy: shopkeeperUser._id
    });
    products.push(product1);
    console.log('✓ Product 1 created:', product1._id, '-', product1.productName);

    const product2 = await Product.create({
      productName: 'Fresh Bananas',
      productDescription: 'Fresh yellow bananas',
      productPrice: 50,
      productQuantity: 200,
      productImage: 'https://via.placeholder.com/200',
      productCategory: category._id,
      productUnit: 'dozen',
      productCode: 'PROD002',
      createdBy: shopkeeperUser._id
    });
    products.push(product2);
    console.log('✓ Product 2 created:', product2._id, '-', product2.productName);

    // 6. Create Customer User
    console.log('\n6. Creating customer user...');
    const customerUser = await User.create({
      fullname: 'Test Customer',
      email: 'testcustomer@example.com',
      phone: '7777777777',
      password: hashedPassword,
      role: 'user',
      accountStatus: 'active'
    });
    console.log('✓ Customer user created:', customerUser._id);

    // 7. Create Customer Address
    console.log('\n7. Creating customer address...');
    const customerAddress = await CustomerAddress.create({
      userId: customerUser._id,
      addressType: 'home',
      fullAddress: '456 Customer Street, Test City',
      city: 'Test City',
      state: 'Test State',
      pincode: '123456',
      latitude: 23.0250,
      longitude: 72.5750,
      isDefault: true
    });
    console.log('✓ Customer address created:', customerAddress._id);

    // 8. Create Orders
    console.log('\n8. Creating orders...');
    
    // Order 1 - PENDING
    const order1 = await Order.create({
      orderNumber: `ORD-${Date.now()}-${uuidv4().toUpperCase().slice(0, 6)}`,
      orderToken: uuidv4().replace(/-/g, '').toUpperCase(),
      customerId: customerUser._id,
      shopId: shopkeeperUser._id, // This is the key - shopId should be the shopkeeper's User._id
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
    console.log('✓ Order 1 created (PENDING):', order1._id, '-', order1.orderNumber);

    // Create order items for order 1
    await OrderItem.create({
      orderId: order1._id,
      productId: product1._id,
      productName: product1.productName,
      quantity: 1,
      unitPrice: 150,
      discountAmount: 0,
      totalPrice: 177 // 150 + 18% GST
    });

    await OrderItem.create({
      orderId: order1._id,
      productId: product2._id,
      productName: product2.productName,
      quantity: 1,
      unitPrice: 50,
      discountAmount: 0,
      totalPrice: 59 // 50 + 18% GST
    });
    console.log('  ✓ Order items created for order 1');

    // Order 2 - PENDING
    const order2 = await Order.create({
      orderNumber: `ORD-${Date.now()}-${uuidv4().toUpperCase().slice(0, 6)}`,
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
    console.log('✓ Order 2 created (PENDING):', order2._id, '-', order2.orderNumber);

    await OrderItem.create({
      orderId: order2._id,
      productId: product1._id,
      productName: product1.productName,
      quantity: 1,
      unitPrice: 150,
      discountAmount: 0,
      totalPrice: 177
    });
    console.log('  ✓ Order items created for order 2');

    // Order 3 - ACCEPTED
    const order3 = await Order.create({
      orderNumber: `ORD-${Date.now()}-${uuidv4().toUpperCase().slice(0, 6)}`,
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
    console.log('✓ Order 3 created (ACCEPTED):', order3._id, '-', order3.orderNumber);

    await OrderItem.create({
      orderId: order3._id,
      productId: product2._id,
      productName: product2.productName,
      quantity: 2,
      unitPrice: 50,
      discountAmount: 0,
      totalPrice: 118
    });
    console.log('  ✓ Order items created for order 3');

    console.log('\n========================================');
    console.log('TEST DATA CREATED SUCCESSFULLY');
    console.log('========================================\n');

    console.log('CREDENTIALS FOR TESTING:');
    console.log('------------------------');
    console.log('Shopkeeper Login:');
    console.log('  Email: testshop@example.com');
    console.log('  Password: Test@123');
    console.log('  User ID:', shopkeeperUser._id.toString());
    console.log('\nCustomer Login:');
    console.log('  Email: testcustomer@example.com');
    console.log('  Password: Test@123');
    console.log('  User ID:', customerUser._id.toString());
    console.log('\nOrders Created:');
    console.log('  - 2 PENDING orders');
    console.log('  - 1 ACCEPTED order');
    console.log('\nTest API:');
    console.log('  POST http://localhost:8000/api/shopkeeper/auth/login');
    console.log('  Body: { "email": "testshop@example.com", "password": "Test@123" }');
    console.log('\n  Then use the token to call:');
    console.log('  GET http://localhost:8000/api/shopkeeper/orders?status=PENDING');
    console.log('\n========================================\n');

  } catch (error) {
    console.error('Error creating test data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('✓ Database connection closed');
  }
}

createTestData();
