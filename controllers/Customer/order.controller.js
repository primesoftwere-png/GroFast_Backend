// controllers/Customer/order.controller.js
// 🚀 REAL-TIME ORDER FLOW - API Controllers

const Order = require('../../models/Customer/Order');
const OrderItem = require('../../models/Customer/OrderItem');
const User = require('../../models/user.model');
const Cart = require('../../models/Customer/Cart');
const CustomerAddress = require('../../models/Customer/CustomerAddress');
const Notification = require('../../models/Customer/Notification');
const Shopkeeper = require('../../models/ShopKeeper/Shopkeeper');

async function resolveShopkeeperTarget(shopId) {
  let shopUser = await User.findById(shopId);
  let shopkeeperProfile = null;

  if (!shopUser) {
    shopkeeperProfile = await Shopkeeper.findById(shopId).select('_id userId');
    if (shopkeeperProfile?.userId) {
      shopUser = await User.findById(shopkeeperProfile.userId);
    }
  }

  if (!shopUser) {
    return null;
  }

  if (!shopkeeperProfile) {
    shopkeeperProfile = await Shopkeeper.findOne({ userId: shopUser._id }).select('_id userId');
  }

  const roomIds = [
    shopUser._id.toString(),
    shopkeeperProfile?._id?.toString()
  ].filter(Boolean);

  return {
    user: shopUser,
    profile: shopkeeperProfile,
    userId: shopUser._id,
    roomIds: [...new Set(roomIds)]
  };
}

const DeliveryBoyLocation = require('../../models/DeliveryBoy/DeliveryBoyLocation');

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

    // Ensure payment method is uppercase to match Mongoose enum ('COD', 'ONLINE', 'WALLET')
    paymentMethod = paymentMethod.toUpperCase();

    let ordersToCreate = [];

    // If items not provided, fetch from cart
    if (!items || items.length === 0) {
      const cart = await Cart.findOne({ userId: userId }).populate('products.productId');
      
      if (!cart || !cart.products || cart.products.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cart is empty'
        });
      }

      // Filter out products that no longer exist in the database
      const validProducts = cart.products.filter(item => item && item.productId);
      
      if (validProducts.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'All products in your cart are no longer available. Please clear your cart and try again.'
        });
      }

      // Group items by shopId
      const itemsByShop = {};
      for (const item of validProducts) {
        const productShopId = item.productId.createdBy.toString();
        if (!itemsByShop[productShopId]) {
          itemsByShop[productShopId] = {
            shopId: productShopId,
            items: [],
            subtotal: 0,
            taxAmount: 0
          };
        }
        
        const itemTotal = item.quantity * item.productId.productPrice;
        itemsByShop[productShopId].items.push({
          productId: item.productId._id,
          productName: item.productId.productName,
          quantity: item.quantity,
          price: item.productId.productPrice,
          totalPrice: itemTotal
        });
        
        itemsByShop[productShopId].subtotal += itemTotal;
        itemsByShop[productShopId].taxAmount += (itemTotal * 18) / 100; // Standard 18% GST used in cart
      }

      // Build order payloads for each shop
      for (const [sId, shopData] of Object.entries(itemsByShop)) {
        ordersToCreate.push({
          shopId: sId,
          items: shopData.items,
          subtotal: shopData.subtotal,
          taxAmount: shopData.taxAmount,
          deliveryCharge: deliveryCharge || 0, 
          discountAmount: 0, 
          totalAmount: shopData.subtotal + (deliveryCharge || 0) + shopData.taxAmount
        });
      }
    } else {
      // Direct single shop order (e.g. Buy Now)
      if (!shopId) {
        return res.status(400).json({
          success: false,
          message: 'Unable to create order. Shop information missing.'
        });
      }
      ordersToCreate.push({
        shopId: shopId,
        items: items,
        subtotal: subtotal || items.reduce((sum, item) => sum + item.totalPrice, 0),
        taxAmount: taxAmount || 0,
        deliveryCharge: deliveryCharge || 0,
        discountAmount: discountAmount || 0,
        totalAmount: totalAmount || (subtotal || items.reduce((sum, item) => sum + item.totalPrice, 0)) + (deliveryCharge || 0) + (taxAmount || 0) - (discountAmount || 0)
      });
    }

    // Verify delivery address
    let address = null;
    try {
      if (deliveryAddressId.match(/^[0-9a-fA-F]{24}$/)) {
        address = await CustomerAddress.findById(deliveryAddressId);
      }
    } catch (err) {
      console.error('Invalid deliveryAddressId format');
    }

    if (!address || address.customerId.toString() !== userId.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Delivery address not found or does not belong to you'
      });
    }

    const createdOrders = [];
    const io = req.app.get('io');

    // Create an order for each shop
    for (let orderData of ordersToCreate) {
      // Verify shop exists
      const shopTarget = await resolveShopkeeperTarget(orderData.shopId);
      const shop = shopTarget?.user;
      if (!shop || (shop.role !== 'admin' && shop.role !== 'superadmin')) {
        console.warn(`Invalid or missing shop ${orderData.shopId}, skipping order for these items.`);
        continue;
      }
      const normalizedShopId = shopTarget.userId;

      // Generate unique order tokens and OTPs
      const orderToken = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const otp = Math.floor(1000 + Math.random() * 9000).toString();

      // Create order
      const order = await Order.create({
        orderToken,
        customerId: userId,
        shopId: normalizedShopId,
        deliveryAddressId,
        orderStatus: 'PENDING',
        paymentMethod,
        paymentStatus: paymentMethod === 'COD' ? 'PENDING' : 'PAID',
        items: orderData.items,
        subtotal: orderData.subtotal,
        deliveryCharge: orderData.deliveryCharge,
        discountAmount: orderData.discountAmount,
        taxAmount: orderData.taxAmount,
        totalAmount: orderData.totalAmount,
        codAmount: paymentMethod === 'COD' ? orderData.totalAmount : 0,
        otp,
        otpVerified: false
      });

      if (order.items && order.items.length > 0) {
        try {
          await OrderItem.insertMany(
            order.items.map((item) => {
              const unitPrice = item.price ?? item.unitPrice ?? item.productPrice ?? 0;
              const quantity = item.quantity || 1;

              return {
                orderId: order._id,
                productId: item.productId,
                productName: item.productName,
                quantity,
                unitPrice,
                discountAmount: 0,
                totalPrice: item.totalPrice ?? unitPrice * quantity
              };
            })
          );
        } catch (itemError) {
          console.error(`Failed to sync order items for order ${order._id}:`, itemError.message);
        }
      }

      // Populate order details for socket emission
      const populatedOrder = await Order.findById(order._id)
        .populate('customerId', 'fullname phone email')
        .populate('shopId', 'fullname phone email shopName address')
        .populate('deliveryAddressId');

      console.log(`\n✓ ORDER CREATED: ${order.orderNumber}`);
      console.log(`Customer: ${populatedOrder.customerId.fullname}`);
      console.log(`Shop: ${populatedOrder.shopId.shopName || populatedOrder.shopId.fullname}`);
      console.log(`Total: ₹${order.totalAmount}`);

      // Get populated items to match getOrders structure for frontend
      let formattedItems = [];
      try {
        const orderItems = await OrderItem.find({ orderId: order._id })
          .populate('productId', 'productName productImage productPrice');
          
        if (orderItems && orderItems.length > 0) {
          formattedItems = orderItems;
        } else {
          formattedItems = (order.items || []).map((item) => ({
            _id: item._id,
            orderId: order._id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.price,
            totalPrice: item.totalPrice
          }));
        }
      } catch (err) {
        console.error('Error fetching order items for socket payload:', err.message);
        formattedItems = order.items || [];
      }

      // Emit to shopkeeper via Socket.IO
      if (io) {
        const orderEventPayload = {
          ...populatedOrder.toObject(),
          items: formattedItems
        };
        
        shopTarget.roomIds.forEach(roomId => {
          io.to(roomId).emit('new-order', orderEventPayload);
          io.to(roomId).emit('receiveOrderRequest', orderEventPayload);
        });
        
        console.log(`\n========================================`);
        console.log(`🚀 SOCKET.IO EMISSION DETAILS`);
        console.log(`========================================`);
        console.log(`Event: 'new-order' and 'receiveOrderRequest'`);
        console.log(`Target Shop ID (Original): ${orderData.shopId}`);
        console.log(`Target Socket Rooms (Shopkeeper IDs):`, shopTarget.roomIds);
        console.log(`Order ID: ${order._id}`);
        console.log(`========================================\n`);
      }

      // 🔔 Save persistent notification for shopkeeper in database
      try {
        const itemsSummary = order.items.map(i => `${i.productName} x${i.quantity}`).join(', ');
        const notificationTitle = `🛒 New Order #${order.orderNumber}`;
        const notificationBody = `New order from ${populatedOrder.customerId.fullname} - ${itemsSummary} | Total: ₹${order.totalAmount} | Payment: ${order.paymentMethod}`;

        const savedNotification = await Notification.create({
          userId: normalizedShopId,
          notificationType: 'order',
          title: notificationTitle,
          body: notificationBody,
          dataJson: JSON.stringify({
            orderId: order._id,
            orderNumber: order.orderNumber,
            orderToken: order.orderToken,
            customerName: populatedOrder.customerId.fullname,
            customerPhone: populatedOrder.customerId.phone,
            totalAmount: order.totalAmount,
            paymentMethod: order.paymentMethod,
            itemsCount: order.items.length,
            status: 'PENDING'
          }),
          isRead: false
        });

        console.log(`✓ Notification saved for shopkeeper: ${orderData.shopId}`);

        // Emit real-time notification event to shopkeeper's notification panel
        if (io) {
          io.to(shopTarget.roomIds).emit('notification', {
            _id: savedNotification._id,
            notificationType: 'order',
            title: notificationTitle,
            body: notificationBody,
            orderId: order._id,
            orderNumber: order.orderNumber,
            orderToken: order.orderToken,
            customerName: populatedOrder.customerId.fullname,
            totalAmount: order.totalAmount,
            paymentMethod: order.paymentMethod,
            isRead: false,
            timestamp: new Date()
          });
          console.log(`✓ Emitted notification event to shopkeeper: ${orderData.shopId}`);
        }
      } catch (notifError) {
        // Don't fail the order creation if notification saving fails
        console.error(`⚠ Failed to save notification for shopkeeper ${orderData.shopId}:`, notifError.message);
      }

      createdOrders.push(order);
    }

    if (createdOrders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Could not create any valid orders from the items provided.'
      });
    }

    // Clear cart after order creation (if we were converting cart)
    if (!items || items.length === 0) {
      await Cart.findOneAndUpdate(
        { userId: userId },
        { products: [], totalPrice: 0, totalGST: 0 }
      );
    }

    // Return response containing the first order's essential info to maintain frontend compatibility,
    // plus the full array of created orders if the frontend wants to handle multiple.
    res.status(201).json({
      success: true,
      message: createdOrders.length > 1 ? `Successfully split cart into ${createdOrders.length} separate orders for different shops.` : 'Order created successfully',
      data: {
        orderId: createdOrders[0]._id,
        orderNumber: createdOrders[0].orderNumber,
        orderToken: createdOrders[0].orderToken,
        status: createdOrders[0].orderStatus,
        totalAmount: createdOrders.reduce((sum, o) => sum + o.totalAmount, 0),
        paymentMethod: createdOrders[0].paymentMethod,
        estimatedDeliveryTime: '30-40 mins',
        orders: createdOrders.map(o => ({
          orderId: o._id,
          orderNumber: o.orderNumber,
          shopId: o.shopId,
          totalAmount: o.totalAmount
        }))
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

    // 🔔 Save persistent notification for shopkeeper (works even if shopkeeper is offline)
    try {
      const notifTitle = `📦 Order Picked Up #${order.orderNumber}`;
      const notifBody = `Order #${order.orderNumber} has been picked up by the delivery partner. Customer: ${order.customerId.fullname} | Total: ₹${order.totalAmount}`;

      const savedNotif = await Notification.create({
        userId: order.shopId._id,
        notificationType: 'order',
        title: notifTitle,
        body: notifBody,
        dataJson: JSON.stringify({
          orderId: order._id,
          orderNumber: order.orderNumber,
          orderToken: order.orderToken,
          status: 'PICKED_UP',
          customerName: order.customerId.fullname,
          totalAmount: order.totalAmount,
          pickedUpAt: order.pickedUpAt
        }),
        isRead: false
      });

      console.log(`✓ Notification saved for shopkeeper: ${order.shopId._id}`);

      if (io) {
        io.to(order.shopId._id.toString()).emit('notification', {
          _id: savedNotif._id,
          notificationType: 'order',
          title: notifTitle,
          body: notifBody,
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: 'PICKED_UP',
          isRead: false,
          timestamp: new Date()
        });
        console.log(`✓ Emitted notification event to shopkeeper: ${order.shopId._id}`);
      }
    } catch (notifError) {
      console.error(`⚠ Failed to save notification for shopkeeper:`, notifError.message);
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

    // 🔔 Save persistent notification for shopkeeper (works even if shopkeeper is offline)
    try {
      const notifTitle = `🚚 Order In Transit #${order.orderNumber}`;
      const notifBody = `Order #${order.orderNumber} is now in transit to the customer. Customer: ${order.customerId.fullname} | Total: ₹${order.totalAmount}`;

      const savedNotif = await Notification.create({
        userId: order.shopId,
        notificationType: 'delivery',
        title: notifTitle,
        body: notifBody,
        dataJson: JSON.stringify({
          orderId: order._id,
          orderNumber: order.orderNumber,
          orderToken: order.orderToken,
          status: 'IN_TRANSIT',
          customerName: order.customerId.fullname,
          totalAmount: order.totalAmount
        }),
        isRead: false
      });

      console.log(`✓ Notification saved for shopkeeper: ${order.shopId}`);

      if (io) {
        io.to(order.shopId.toString()).emit('notification', {
          _id: savedNotif._id,
          notificationType: 'delivery',
          title: notifTitle,
          body: notifBody,
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: 'IN_TRANSIT',
          isRead: false,
          timestamp: new Date()
        });
        console.log(`✓ Emitted notification event to shopkeeper: ${order.shopId}`);
      }
    } catch (notifError) {
      console.error(`⚠ Failed to save notification for shopkeeper:`, notifError.message);
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

    // 🔔 Save persistent notification for shopkeeper (works even if shopkeeper is offline)
    try {
      const notifTitle = `✅ Order Delivered #${order.orderNumber}`;
      const notifBody = `Order #${order.orderNumber} has been delivered successfully! Customer: ${order.customerId.fullname} | Total: ₹${order.totalAmount} | Payment: ${order.paymentMethod}`;

      const savedNotif = await Notification.create({
        userId: order.shopId._id,
        notificationType: 'order',
        title: notifTitle,
        body: notifBody,
        dataJson: JSON.stringify({
          orderId: order._id,
          orderNumber: order.orderNumber,
          orderToken: order.orderToken,
          status: 'DELIVERED',
          customerName: order.customerId.fullname,
          totalAmount: order.totalAmount,
          paymentMethod: order.paymentMethod,
          deliveredAt: order.deliveredAt
        }),
        isRead: false
      });

      console.log(`✓ Notification saved for shopkeeper: ${order.shopId._id}`);

      if (io) {
        io.to(order.shopId._id.toString()).emit('notification', {
          _id: savedNotif._id,
          notificationType: 'order',
          title: notifTitle,
          body: notifBody,
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: 'DELIVERED',
          totalAmount: order.totalAmount,
          isRead: false,
          timestamp: new Date()
        });
        console.log(`✓ Emitted notification event to shopkeeper: ${order.shopId._id}`);
      }
    } catch (notifError) {
      console.error(`⚠ Failed to save notification for shopkeeper:`, notifError.message);
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
 * Get order by token
 */
module.exports.getOrderByToken = async (req, res) => {
  try {
    const { orderToken } = req.params;

    const order = await Order.findOne({ orderToken })
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

    res.json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Error getting order by token:', error);
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

/**
 * Track Delivery Boy Location
 */
module.exports.trackDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Verify access
    if (order.customerId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to track this order'
      });
    }

    // Check if order is in a state where it has a delivery boy
    const validStatuses = ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'];
    if (!validStatuses.includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Tracking not available for order status: ${order.orderStatus}`
      });
    }

    if (!order.deliveryBoyId) {
      return res.status(404).json({
        success: false,
        message: 'Delivery boy not assigned yet'
      });
    }

    const location = await DeliveryBoyLocation.findOne({ deliveryBoyId: order.deliveryBoyId });

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Delivery boy location not found'
      });
    }

    res.json({
      success: true,
      data: {
        orderId: order._id,
        orderStatus: order.orderStatus,
        deliveryBoyId: order.deliveryBoyId,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          speed: location.speed,
          heading: location.heading,
          accuracy: location.accuracy,
          updatedAt: location.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('Error tracking delivery:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track delivery',
      error: error.message
    });
  }
};
