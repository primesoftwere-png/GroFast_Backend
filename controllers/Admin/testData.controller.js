// controllers/Admin/testData.controller.js
// Helper controller to create test orders for testing

const Order = require('../../models/Customer/Order');
const OrderItem = require('../../models/Customer/OrderItem');
const Product = require('../../models/Product.model');
const CustomerAddress = require('../../models/Customer/CustomerAddress');
const User = require('../../models/user.model');
const { v4: uuidv4 } = require('uuid');

// ✅ Create Test Orders for a Shopkeeper
module.exports.createTestOrders = async (req, res) => {
  try {
    const { shopkeeperEmail, customerEmail } = req.body;

    if (!shopkeeperEmail) {
      return res.status(400).json({
        success: false,
        message: 'Shopkeeper email is required'
      });
    }

    // Find shopkeeper
    const shopkeeper = await User.findOne({ email: shopkeeperEmail, role: 'admin' });
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper not found with email: ' + shopkeeperEmail
      });
    }

    // Find or create customer
    let customer;
    if (customerEmail) {
      customer = await User.findOne({ email: customerEmail });
    }
    
    if (!customer) {
      // Create a test customer
      const hashedPassword = await User.hashPassword('Test@123');
      customer = await User.create({
        fullname: 'Test Customer',
        email: customerEmail || 'testcustomer' + Date.now() + '@example.com',
        phone: '7777' + Math.floor(Math.random() * 1000000),
        password: hashedPassword,
        role: 'user',
        accountStatus: 'active'
      });
    }

    // Find or create customer address
    let customerAddress = await CustomerAddress.findOne({ customerId: customer._id });
    if (!customerAddress) {
      customerAddress = await CustomerAddress.create({
        customerId: customer._id,
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
    }

    // Find products created by this shopkeeper
    const products = await Product.find({ createdBy: shopkeeper._id }).limit(2);
    if (products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No products found for this shopkeeper. Please create products first.'
      });
    }

    // Create 3 test orders
    const createdOrders = [];

    // Order 1 - PENDING
    const order1 = await Order.create({
      orderNumber: `ORD-${Date.now()}-${uuidv4().toUpperCase().slice(0, 6)}`,
      orderToken: uuidv4().replace(/-/g, '').toUpperCase(),
      customerId: customer._id,
      shopId: shopkeeper._id, // This is the shopkeeper's User._id
      deliveryAddressId: customerAddress._id,
      orderStatus: 'PENDING',
      paymentStatus: 'PENDING',
      paymentMethod: 'COD',
      subtotal: products[0].productPrice,
      deliveryCharge: 0,
      discountAmount: 0,
      taxAmount: Math.round(products[0].productPrice * 0.18),
      totalAmount: Math.round(products[0].productPrice * 1.18),
      codAmount: Math.round(products[0].productPrice * 1.18),
      estimatedDeliveryTime: new Date(Date.now() + 60 * 60 * 1000)
    });

    await OrderItem.create({
      orderId: order1._id,
      productId: products[0]._id,
      productName: products[0].productName,
      quantity: 1,
      unitPrice: products[0].productPrice,
      discountAmount: 0,
      totalPrice: Math.round(products[0].productPrice * 1.18)
    });

    createdOrders.push(order1);

    // Order 2 - PENDING
    const order2 = await Order.create({
      orderNumber: `ORD-${Date.now() + 1}-${uuidv4().toUpperCase().slice(0, 6)}`,
      orderToken: uuidv4().replace(/-/g, '').toUpperCase(),
      customerId: customer._id,
      shopId: shopkeeper._id,
      deliveryAddressId: customerAddress._id,
      orderStatus: 'PENDING',
      paymentStatus: 'PENDING',
      paymentMethod: 'ONLINE',
      subtotal: products[0].productPrice * 2,
      deliveryCharge: 0,
      discountAmount: 0,
      taxAmount: Math.round(products[0].productPrice * 2 * 0.18),
      totalAmount: Math.round(products[0].productPrice * 2 * 1.18),
      codAmount: 0,
      estimatedDeliveryTime: new Date(Date.now() + 60 * 60 * 1000)
    });

    await OrderItem.create({
      orderId: order2._id,
      productId: products[0]._id,
      productName: products[0].productName,
      quantity: 2,
      unitPrice: products[0].productPrice,
      discountAmount: 0,
      totalPrice: Math.round(products[0].productPrice * 2 * 1.18)
    });

    createdOrders.push(order2);

    // Order 3 - ACCEPTED
    if (products.length > 1) {
      const order3 = await Order.create({
        orderNumber: `ORD-${Date.now() + 2}-${uuidv4().toUpperCase().slice(0, 6)}`,
        orderToken: uuidv4().replace(/-/g, '').toUpperCase(),
        customerId: customer._id,
        shopId: shopkeeper._id,
        deliveryAddressId: customerAddress._id,
        orderStatus: 'ACCEPTED',
        paymentStatus: 'PENDING',
        paymentMethod: 'COD',
        subtotal: products[1].productPrice,
        deliveryCharge: 0,
        discountAmount: 0,
        taxAmount: Math.round(products[1].productPrice * 0.18),
        totalAmount: Math.round(products[1].productPrice * 1.18),
        codAmount: Math.round(products[1].productPrice * 1.18),
        acceptedAt: new Date(),
        estimatedDeliveryTime: new Date(Date.now() + 60 * 60 * 1000)
      });

      await OrderItem.create({
        orderId: order3._id,
        productId: products[1]._id,
        productName: products[1].productName,
        quantity: 1,
        unitPrice: products[1].productPrice,
        discountAmount: 0,
        totalPrice: Math.round(products[1].productPrice * 1.18)
      });

      createdOrders.push(order3);
    }

    return res.status(201).json({
      success: true,
      message: 'Test orders created successfully',
      data: {
        ordersCreated: createdOrders.length,
        shopkeeper: {
          id: shopkeeper._id,
          email: shopkeeper.email,
          name: shopkeeper.fullname
        },
        customer: {
          id: customer._id,
          email: customer.email,
          name: customer.fullname
        },
        orders: createdOrders.map(o => ({
          orderId: o._id,
          orderNumber: o.orderNumber,
          status: o.orderStatus,
          totalAmount: o.totalAmount
        })),
        testInstructions: {
          step1: 'Login as shopkeeper',
          loginEndpoint: 'POST /api/shopkeeper/auth/login',
          loginBody: {
            email: shopkeeper.email,
            password: 'Your shopkeeper password'
          },
          step2: 'Get pending orders',
          ordersEndpoint: 'GET /api/shopkeeper/orders?status=PENDING',
          note: 'Use the token from login in Authorization header'
        }
      }
    });

  } catch (error) {
    console.error('Create test orders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
