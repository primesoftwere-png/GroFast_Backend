// controllers/Customer/order.controller.js
// 🚀 REAL-TIME ORDER FLOW - API Controllers

const Order = require('../../models/Customer/Order');
const User = require('../../models/user.model');
const Cart = require('../../models/Customer/Cart');
const CustomerAddress = require('../../models/Customer/CustomerAddress');

/**
 * 1. CREATE ORDER (API)
 * Status: PENDING
 * Emits: new-order to shopkeeper
 */
module.exports.createOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    let { 
      shopId, 
      deliveryAddressId, 
      paymentMethod, 
      items,
      subtotal,
      deliveryCharge,
      discountAmount,
      taxAmount,
      totalAmount
    } = req.body;

    // Validation for deliveryAddressId and paymentMethod
    if (!deliveryAddressId || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: deliveryAddressId and paymentMethod are required'
      });
    }

    // If items not provided, fetch from cart
    if (!items || items.length === 0) {
      const cart = await Cart.findOne({ userId: userId }).populate('products.productId');
      
      if (!cart || !cart.products || cart.products.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cart is empty'
        });
      }

      // Extract items and calculate totals from cart
      items = cart.products.map(item => ({
        productId: item.productId._id,
        productName: item.productId.productName,
        quantity: item.quantity,
        price: item.productId.productPrice,
        totalPrice: item.quantity * item.productId.productPrice
      }));

      // Get shopId from first item's createdBy field (assuming all items are from same shop)
      if (!shopId && cart.products[0].productId.createdBy) {
        shopId = cart.products[0].productId.createdBy;
      }

      console.log('Cart data extracted:', {
        itemsCount: items.length,
        shopId: shopId,
        subtotal: items.reduce((sum, item) => sum + item.totalPrice, 0)
      });

      // Calculate totals if not provided
      if (!subtotal) {
        subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
      }
      if (!deliveryCharge) {
        deliveryCharge = 0; // Default delivery charge
      }
      if (!discountAmount) {
        discountAmount = 0;
      }
      if (!taxAmount) {
        taxAmount = cart.totalGST || 0;
      }
      if (!totalAmount) {
        totalAmount = subtotal + deliveryCharge + taxAmount - discountAmount;
      }
    }

    // Final validation
    if (!shopId || !items || items.length === 0) {
      console.error('Order creation failed - missing data:', {
        shopId: shopId,
        shopIdType: typeof shopId,
        itemsCount: items ? items.length : 0
      });
      return res.status(400).json({
        success: false,
        message: 'Unable to create order. Shop or items information missing.'
      });
    }

    // Verify shop exists
    console.log('Looking for shop with ID:', shopId);
    const shop = await User.findById(shopId);
    console.log('Shop found:', shop ? { id: shop._id, role: shop.role, name: shop.fullname } : 'null');
    
    if (!shop) {
      // If shop not found, try to find any active admin as fallback
      console.log('Shop not found, looking for fallback admin...');
      const fallbackShop = await User.findOne({ role: 'admin', accountStatus: 'active' });
      
      if (fallbackShop) {
        console.log('Using fallback shop:', fallbackShop._id);
        shopId = fallbackShop._id;
      } else {
        return res.status(404).json({
          success: false,
          message: 'Shop not found. The product creator may have been deleted.',
          debug: {
            originalShopId: shopId,
            suggestion: 'Please contact support or clear your cart and add products again.'
          }
        });
      }
    } else {
      // Verify it's a shop/admin account
      if (shop.role !== 'admin' && shop.role !== 'superadmin') {
        return res.status(400).json({
          success: false,
          message: 'Invalid shop account'
        });
      }
    }

    // Verify delivery address
    const address = await CustomerAddress.findById(deliveryAddressId);
    if (!address || address.customerId.toString() !== userId.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Delivery address not found'
      });
    }

    // Generate unique order token
    const orderToken = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Generate 4-digit OTP for pickup
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Create order
    const order = await Order.create({
      orderToken,
      customerId: userId,
      shopId,
      deliveryAddressId,
      orderStatus: 'PENDING',
      paymentMethod,
      paymentStatus: paymentMethod === 'COD' ? 'PENDING' : 'PAID',
      items,
      subtotal,
      deliveryCharge: deliveryCharge || 0,
      discountAmount: discountAmount || 0,
      taxAmount: taxAmount || 0,
      totalAmount,
      codAmount: paymentMethod === 'COD' ? totalAmount : 0,
      otp,
      otpVerified: false
    });

    // Populate order details
    const populatedOrder = await Order.findById(order._id)
      .populate('customerId', 'fullname phone email')
      .populate('shopId', 'fullname phone email shopName address')
      .populate('deliveryAddressId');

    console.log(`\n✓ ORDER CREATED: ${order.orderNumber}`);
    console.log(`Customer: ${populatedOrder.customerId.fullname}`);
    console.log(`Shop: ${populatedOrder.shopId.shopName || populatedOrder.shopId.fullname}`);
    console.log(`Total: ₹${totalAmount}`);
    console.log(`Payment: ${paymentMethod}`);

    // Emit to shopkeeper via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(shopId.toString()).emit('new-order', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderToken: order.orderToken,
        customerName: populatedOrder.customerId.fullname,
        customerPhone: populatedOrder.customerId.phone,
        deliveryAddress: populatedOrder.deliveryAddressId,
        items: order.items,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        status: 'PENDING',
        createdAt: order.createdAt
      });

      console.log(`✓ Emitted new-order to shopkeeper: ${shopId}`);
    }

    // Clear cart after order creation
    await Cart.findOneAndUpdate(
      { userId: userId },
      { products: [], totalPrice: 0, totalGST: 0 }
    );

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderToken: order.orderToken,
        status: order.orderStatus,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        estimatedDeliveryTime: '30-40 mins'
      }
    });

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
};

/**
 * 2. VERIFY OTP (API - SECURE)
 * Status: ASSIGNED → PICKED_UP
 * Emits: order-status to customer
 */
module.exports.verifyOtp = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { otp } = req.body;
    const deliveryBoyId = req.user._id;

    // Validation
    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'OTP is required'
      });
    }

    // Get order
    const order = await Order.findById(orderId)
      .populate('customerId', 'fullname phone')
      .populate('shopId', 'fullname phone shopName');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Verify delivery boy is assigned to this order
    if (order.deliveryBoyId.toString() !== deliveryBoyId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this order'
      });
    }

    // Verify order status
    if (order.orderStatus !== 'ASSIGNED') {
      return res.status(400).json({
        success: false,
        message: `Cannot verify OTP. Current status: ${order.orderStatus}`
      });
    }

    // Verify OTP
    if (order.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // Update order status
    order.orderStatus = 'PICKED_UP';
    order.otpVerified = true;
    order.pickedUpAt = new Date();
    await order.save();

    console.log(`\n✓ OTP VERIFIED: ${order.orderNumber}`);
    console.log(`Status: ASSIGNED → PICKED_UP`);

    // Emit to customer
    const io = req.app.get('io');
    if (io) {
      io.to(order.customerId._id.toString()).emit('order-status', {
        orderId: order._id,
        status: 'PICKED_UP',
        message: 'Your order has been picked up by the delivery partner',
        timestamp: new Date()
      });

      console.log(`✓ Notified customer: ${order.customerId._id}`);
    }

    res.json({
      success: true,
      message: 'OTP verified successfully. Order picked up.',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.orderStatus,
        pickedUpAt: order.pickedUpAt
      }
    });

  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP',
      error: error.message
    });
  }
};

/**
 * 3. MARK ORDER IN TRANSIT (API)
 * Status: PICKED_UP → IN_TRANSIT
 * Emits: order-status to customer
 */
module.exports.markInTransit = async (req, res) => {
  try {
    const { orderId } = req.params;
    const deliveryBoyId = req.user._id;

    const order = await Order.findById(orderId)
      .populate('customerId', 'fullname phone');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Verify delivery boy
    if (order.deliveryBoyId.toString() !== deliveryBoyId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Verify status
    if (order.orderStatus !== 'PICKED_UP') {
      return res.status(400).json({
        success: false,
        message: `Cannot mark in transit. Current status: ${order.orderStatus}`
      });
    }

    // Update status
    order.orderStatus = 'IN_TRANSIT';
    order.inTransitAt = new Date();
    await order.save();

    console.log(`\n✓ ORDER IN TRANSIT: ${order.orderNumber}`);

    // Emit to customer
    const io = req.app.get('io');
    if (io) {
      io.to(order.customerId._id.toString()).emit('order-status', {
        orderId: order._id,
        status: 'IN_TRANSIT',
        message: 'Your order is on the way!',
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Order marked as in transit',
      data: {
        orderId: order._id,
        status: order.orderStatus
      }
    });

  } catch (error) {
    console.error('Error marking in transit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update status',
      error: error.message
    });
  }
};

/**
 * 4. MARK ORDER DELIVERED (API)
 * Status: IN_TRANSIT → DELIVERED
 * Emits: order-status to customer and shopkeeper
 */
module.exports.markDelivered = async (req, res) => {
  try {
    const { orderId } = req.params;
    const deliveryBoyId = req.user._id;

    const order = await Order.findById(orderId)
      .populate('customerId', 'fullname phone')
      .populate('shopId', 'fullname phone shopName');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Verify delivery boy
    if (order.deliveryBoyId.toString() !== deliveryBoyId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Verify status
    if (order.orderStatus !== 'IN_TRANSIT') {
      return res.status(400).json({
        success: false,
        message: `Cannot mark delivered. Current status: ${order.orderStatus}`
      });
    }

    // Update status
    order.orderStatus = 'DELIVERED';
    order.deliveredAt = new Date();
    order.paymentStatus = 'PAID';
    await order.save();

    console.log(`\n✓ ORDER DELIVERED: ${order.orderNumber}`);

    // Update delivery boy
    const DeliveryBoy = require('../../models/DeliveryBoy/DeliveryBoy');
    await DeliveryBoy.findOneAndUpdate(
      { userId: deliveryBoyId },
      { 
        activeOrderId: null,
        isAvailable: true,
        $inc: { totalDeliveries: 1 }
      }
    );

    // Emit to customer and shopkeeper
    const io = req.app.get('io');
    if (io) {
      // Notify customer
      io.to(order.customerId._id.toString()).emit('order-status', {
        orderId: order._id,
        status: 'DELIVERED',
        message: 'Your order has been delivered successfully!',
        timestamp: new Date()
      });

      // Notify shopkeeper
      io.to(order.shopId._id.toString()).emit('order-status', {
        orderId: order._id,
        status: 'DELIVERED',
        message: 'Order delivered successfully',
        timestamp: new Date()
      });

      console.log(`✓ Notified customer and shopkeeper`);
    }

    res.json({
      success: true,
      message: 'Order delivered successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.orderStatus,
        deliveredAt: order.deliveredAt
      }
    });

  } catch (error) {
    console.error('Error marking delivered:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark delivered',
      error: error.message
    });
  }
};

/**
 * Get order details
 */
module.exports.getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    const order = await Order.findById(orderId)
      .populate('customerId', 'fullname phone email')
      .populate('shopId', 'fullname phone email shopName address')
      .populate('deliveryBoyId', 'fullname phone')
      .populate('deliveryAddressId');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Verify access
    const isCustomer = order.customerId._id.toString() === userId.toString();
    const isShop = order.shopId._id.toString() === userId.toString();
    const isDeliveryBoy = order.deliveryBoyId && order.deliveryBoyId._id.toString() === userId.toString();

    if (!isCustomer && !isShop && !isDeliveryBoy) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    res.json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Error getting order details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get order details',
      error: error.message
    });
  }
};

/**
 * Get all orders for customer
 */
module.exports.getCustomerOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, page = 1, limit = 10 } = req.query;

    const query = { customerId: userId };
    if (status) {
      query.orderStatus = status;
    }

    const orders = await Order.find(query)
      .populate('shopId', 'fullname shopName phone')
      .populate('deliveryBoyId', 'fullname phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Order.countDocuments(query);

    res.json({
      success: true,
      data: orders,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });

  } catch (error) {
    console.error('Error getting customer orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get orders',
      error: error.message
    });
  }
};
