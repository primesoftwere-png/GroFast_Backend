// controllers/shopkeeper/shopkeeperOrder.controller.js
const Order = require('../../models/Customer/Order');
const OrderItem = require('../../models/Customer/OrderItem');
const Shopkeeper = require('../../models/ShopKeeper/Shopkeeper');
const Shop = require('../../models/ShopKeeper/Shop');
const ShopkeeperWallet = require('../../models/ShopKeeper/ShopkeeperWallet');
const DeliveryBoy = require('../../models/DeliveryBoy/DeliveryBoy');
const Notification = require('../../models/Customer/Notification');

const getOrderItemsForResponse = async (order) => {
  const orderItems = await OrderItem.find({ orderId: order._id })
    .populate('productId', 'productName productImage productPrice');

  if (orderItems.length > 0) {
    return orderItems;
  }

  return (order.items || []).map((item) => ({
    _id: item._id,
    orderId: order._id,
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.price,
    totalPrice: item.totalPrice
  }));
};

// ✅ Get All Orders for Shopkeeper
module.exports.getOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, page = 1, limit = 20, shopId } = req.query;

    console.log('========================================');
    console.log('SHOPKEEPER GET ORDERS - DEBUG INFO');
    console.log('========================================');
    console.log('Logged in userId:', userId);
    console.log('Requested status:', status);
    console.log('Requested shopId param:', shopId);

    // Get shopkeeper profile
    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper profile not found'
      });
    }

    // Determine which shopId to use for query
    let queryShopId = shopId || userId; // Use provided shopId or default to logged-in userId
    
    console.log('Using shopId for query:', queryShopId);

    // Build query - check multiple possible shopId values
    const query = {
      $or: [
        { shopId: queryShopId },           // Exact match
        { shopId: userId },                // User._id
        { shopId: shopkeeper._id },        // Shopkeeper._id
        { shopId: shopkeeper.userId }      // Shopkeeper.userId
      ]
    };
    
    if (status) {
      const validStatuses = ['PENDING', 'CONFIRMED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];
      if (validStatuses.includes(status.toUpperCase())) {
        query.orderStatus = status.toUpperCase();
      }
    }

    console.log('Query being used:', JSON.stringify(query));

    // Check if any orders exist for this shopId
    const allOrdersCount = await Order.countDocuments({
      $or: [
        { shopId: queryShopId },
        { shopId: userId },
        { shopId: shopkeeper._id },
        { shopId: shopkeeper.userId }
      ]
    });
    console.log('Total orders for shopId (any status):', allOrdersCount);

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get orders
    const orders = await Order.find(query)
      .populate('customerId', 'fullname phone email')
      .populate('deliveryAddressId')
      .populate('deliveryBoyId', 'fullname phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    console.log('Orders found:', orders.length);

    // Get order items for each order and include pickup OTP
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await getOrderItemsForResponse(order);

        const orderObj = order.toObject();
        
        // Include pickup OTP in response if it exists
        if (orderObj.pickupOTP && orderObj.pickupOTP.code) {
          orderObj.pickupOTP = {
            code: orderObj.pickupOTP.code,
            expiresAt: orderObj.pickupOTP.expiresAt,
            verified: orderObj.pickupOTP.verified,
            message: 'Share this OTP with the delivery boy for order pickup'
          };
        }
        
        // Include delivery OTP in response if it exists
        if (orderObj.deliveryOTP && orderObj.deliveryOTP.code) {
          orderObj.deliveryOTP = {
            code: orderObj.deliveryOTP.code,
            expiresAt: orderObj.deliveryOTP.expiresAt,
            verified: orderObj.deliveryOTP.verified,
            message: 'Customer will share this OTP with delivery boy for order delivery'
          };
        }
        
        return {
          ...orderObj,
          items: items
        };
      })
    );

    // Get total count
    const total = await Order.countDocuments(query);

    console.log('========================================');

    return res.status(200).json({
      success: true,
      message: 'Orders retrieved successfully',
      data: {
        orders: ordersWithItems,
        pagination: {
          currentPage: pageNum,
          limit: limitNum,
          total: total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });

  } catch (error) {
    console.error('Get orders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ Get Pending Orders (New Orders)
module.exports.getPendingOrders = async (req, res) => {
  try {
    const userId = req.user._id;

    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper profile not found'
      });
    }

    const shop = await Shop.findOne({ shopkeeperId: shopkeeper._id });
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    // shopId in Order model references User._id (shopkeeper's userId)
    const orders = await Order.find({
      $or: [
        { shopId: userId },
        { shopId: shopkeeper._id },
        { shopId: shopkeeper.userId }
      ],
      orderStatus: 'PENDING'
    })
      .populate('customerId', 'fullname phone email')
      .populate('deliveryAddressId')
      .sort({ createdAt: -1 });

    // Get order items
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await getOrderItemsForResponse(order);
        return {
          ...order.toObject(),
          items: items
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: 'Pending orders retrieved successfully',
      data: {
        orders: ordersWithItems,
        count: ordersWithItems.length
      }
    });

  } catch (error) {
    console.error('Get pending orders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ Get Order Details
module.exports.getOrderDetails = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId } = req.params;

    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper profile not found'
      });
    }

    const shop = await Shop.findOne({ shopkeeperId: shopkeeper._id });
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    // shopId in Order model references User._id (shopkeeper's userId)
    const order = await Order.findOne({
      _id: orderId,
      $or: [
        { shopId: userId },
        { shopId: shopkeeper._id },
        { shopId: shopkeeper.userId }
      ]
    })
      .populate('customerId', 'fullname phone email')
      .populate('deliveryAddressId')
      .populate('deliveryBoyId', 'fullname phone');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Get order items
    const items = await getOrderItemsForResponse(order);

    return res.status(200).json({
      success: true,
      message: 'Order details retrieved successfully',
      data: {
        order: order,
        items: items
      }
    });

  } catch (error) {
    console.error('Get order details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ Accept Order
module.exports.acceptOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderToken } = req.body;

    console.log('========================================');
    console.log('ACCEPT ORDER - DEBUG INFO');
    console.log('========================================');
    console.log('Logged in userId:', userId);
    console.log('Order token:', orderToken);

    if (!orderToken) {
      return res.status(400).json({
        success: false,
        message: 'Order token is required'
      });
    }

    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      console.log('❌ Shopkeeper profile not found');
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper profile not found'
      });
    }
    console.log('✓ Shopkeeper found:', shopkeeper._id);

    const shop = await Shop.findOne({ shopkeeperId: shopkeeper._id });
    if (!shop) {
      console.log('❌ Shop not found');
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }
    console.log('✓ Shop found:', shop._id);

    // First, check if order exists with this token
    const orderByToken = await Order.findOne({ orderToken: orderToken });
    console.log('Order found by token:', orderByToken ? 'Yes' : 'No');
    if (orderByToken) {
      console.log('Order shopId:', orderByToken.shopId);
      console.log('Logged in userId:', userId);
      console.log('Shopkeeper._id:', shopkeeper._id);
    }

    // Try to find order by orderToken with multiple possible shopId values
    let order = await Order.findOne({
      orderToken: orderToken,
      $or: [
        { shopId: userId },                    // Order created with User._id
        { shopId: shopkeeper._id },            // Order created with Shopkeeper._id
        { shopId: shopkeeper.userId }          // Order created with Shopkeeper.userId
      ]
    });

    // If still not found, check if the order belongs to any products created by this user
    if (!order && orderByToken) {
      const orderItems = await OrderItem.find({ orderId: orderByToken._id });
      if (orderItems.length > 0) {
        const productIds = orderItems.map(item => item.productId);
        const Product = require('../../models/Product.model');
        const products = await Product.find({ 
          _id: { $in: productIds },
          createdBy: userId 
        });
        
        console.log('Products in order:', productIds.length);
        console.log('Products owned by this shopkeeper:', products.length);
        
        // If all products belong to this shopkeeper, allow access
        if (products.length === productIds.length && products.length > 0) {
          order = orderByToken;
          console.log('✓ Order verified through product ownership');
        }
      }
    }

    if (!order) {
      console.log('❌ Order not found with matching shopId');
      console.log('========================================');
      
      return res.status(404).json({
        success: false,
        message: 'Order not found or does not belong to this shopkeeper',
        debug: {
          orderToken: orderToken,
          userId: userId.toString(),
          shopkeeperId: shopkeeper._id.toString(),
          orderExists: !!orderByToken,
          orderShopId: orderByToken ? orderByToken.shopId.toString() : null,
          hint: 'The order shopId does not match your userId or shopkeeper ID.'
        }
      });
    }

    console.log('✓ Order found:', order._id);
    console.log('Order status:', order.orderStatus);

    if (order.orderStatus !== 'PENDING') {
      console.log('❌ Cannot accept - wrong status');
      console.log('Current status:', order.orderStatus);
      console.log('========================================');
      return res.status(400).json({
        success: false,
        message: `Cannot accept order. Current status: ${order.orderStatus}`,
        hint: order.orderStatus === 'CONFIRMED' ? 'This order has already been accepted' : `Order must be in PENDING status to accept. Current status: ${order.orderStatus}`
      });
    }

    // Generate pickup OTP (6-digit code)
    const pickupOTPCode = Math.floor(100000 + Math.random() * 900000).toString();
    const pickupOTPExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours validity

    // Update order status and set pickup OTP
    order.orderStatus = 'CONFIRMED';
    order.acceptedAt = Date.now();
    order.pickupOTP = {
      code: pickupOTPCode,
      expiresAt: pickupOTPExpiry,
      verified: false
    };
    await order.save();

    console.log('✓ Order accepted successfully');
    console.log('Pickup OTP:', pickupOTPCode);
    console.log('========================================');

    // ========== SOCKET.IO EMIT ==========
    // Get io instance from app
    const io = global.io || (req.app && req.app.get('io'));
    
    if (io) {
      // Emit to customer that order was accepted
      io.to(order.customerId.toString()).emit('order-status', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderToken: order.orderToken,
        orderStatus: 'CONFIRMED',
        acceptedAt: order.acceptedAt,
        message: 'Your order has been accepted by the shopkeeper'
      });

      console.log(`✓ Notified customer: ${order.customerId}`);

      // Find nearby delivery boys and send delivery requests
      try {
        const nearbyDeliveryBoys = await findNearbyDeliveryBoys(
          shop.location?.coordinates[1] || 0, // lat
          shop.location?.coordinates[0] || 0, // lng
          5 // radius in km
        );

        if (nearbyDeliveryBoys.length > 0) {
          // Emit to each nearby delivery boy
          nearbyDeliveryBoys.forEach(db => {
            if (db.userId) {
              io.to(db.userId.toString()).emit('order-available', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                orderToken: order.orderToken,
                pickupLocation: {
                  shopName: shop.shopName,
                  address: shop.address,
                  lat: shop.location?.coordinates[1] || 0,
                  lng: shop.location?.coordinates[0] || 0
                },
                deliveryLocation: {
                  address: order.deliveryAddress?.address || 'Customer Address',
                  lat: order.deliveryAddress?.lat || 0,
                  lng: order.deliveryAddress?.lng || 0
                },
                distance: '2.5 km', // Calculate actual distance
                estimatedEarnings: 50, // Calculate based on distance
                expiresIn: 60 // 60 seconds to accept
              });
            }
          });

          console.log(`✓ Delivery requests sent to ${nearbyDeliveryBoys.length} nearby delivery boys`);
        } else {
          console.log('⚠ No nearby delivery boys found');
        }
      } catch (error) {
        console.error('Error finding nearby delivery boys:', error);
      }
    }
    // ====================================

    // 🔔 Save persistent notification for customer (works even if customer is offline)
    try {
      const notifTitle = `✅ Order Confirmed #${order.orderNumber}`;
      const notifBody = `Your order #${order.orderNumber} has been confirmed by the shopkeeper! A delivery partner will be assigned soon.`;

      const savedNotif = await Notification.create({
        userId: order.customerId,
        notificationType: 'order',
        title: notifTitle,
        body: notifBody,
        dataJson: JSON.stringify({
          orderId: order._id,
          orderNumber: order.orderNumber,
          orderToken: order.orderToken,
          status: 'CONFIRMED',
          acceptedAt: order.acceptedAt
        }),
        isRead: false
      });

      console.log(`✓ Notification saved for customer: ${order.customerId}`);

      if (io) {
        io.to(order.customerId.toString()).emit('notification', {
          _id: savedNotif._id,
          notificationType: 'order',
          title: notifTitle,
          body: notifBody,
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: 'CONFIRMED',
          isRead: false,
          timestamp: new Date()
        });
        console.log(`✓ Emitted notification event to customer: ${order.customerId}`);
      }
    } catch (notifError) {
      console.error(`⚠ Failed to save notification for customer:`, notifError.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Order accepted successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderToken: order.orderToken,
        orderStatus: order.orderStatus,
        acceptedAt: order.acceptedAt,
        pickupOTP: {
          code: pickupOTPCode,
          expiresAt: pickupOTPExpiry,
          message: 'Share this OTP with the delivery boy for order pickup'
        }
      }
    });

  } catch (error) {
    console.error('Accept order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ Mark Order Ready for Pickup
module.exports.markReadyForPickup = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderToken } = req.body;

    if (!orderToken) {
      return res.status(400).json({
        success: false,
        message: 'Order token is required'
      });
    }

    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper profile not found'
      });
    }

    const shop = await Shop.findOne({ shopkeeperId: shopkeeper._id });
    
    // Find order by orderToken and shopId
    const order = await Order.findOne({
      orderToken: orderToken,
      $or: [
        { shopId: userId },
        { shopId: shopkeeper._id },
        { shopId: shopkeeper.userId }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or does not belong to this shopkeeper'
      });
    }

    if (order.orderStatus !== 'CONFIRMED') {
      return res.status(400).json({
        success: false,
        message: `Cannot mark ready. Current status: ${order.orderStatus}`
      });
    }

    order.orderStatus = 'READY_FOR_PICKUP';
    order.readyForPickupAt = Date.now();
    await order.save();

    // ========== SOCKET.IO EMIT ==========
    const io = global.io || (req.app && req.app.get('io'));
    
    if (io) {
      io.to(order.customerId.toString()).emit('order-status', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderToken: order.orderToken,
        orderStatus: 'READY_FOR_PICKUP',
        message: 'Your order is ready for pickup by delivery partner',
        pickupOTP: order.pickupOTP
      });
      
      if (order.deliveryBoyId) {
        io.to(order.deliveryBoyId.toString()).emit('order-status', {
          orderId: order._id,
          orderNumber: order.orderNumber,
          orderToken: order.orderToken,
          orderStatus: 'READY_FOR_PICKUP',
          message: 'Order is ready for pickup at the shop'
        });
      }
      
      console.log('✓ Order ready events emitted via Socket.IO');
    }
    // ====================================

    return res.status(200).json({
      success: true,
      message: 'Order marked as ready for pickup',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderToken: order.orderToken,
        orderStatus: order.orderStatus,
        pickupOTP: order.pickupOTP ? {
          code: order.pickupOTP.code,
          expiresAt: order.pickupOTP.expiresAt,
          message: 'Share this OTP with the delivery boy for order pickup'
        } : null
      }
    });

  } catch (error) {
    console.error('Mark ready error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ Cancel Order
module.exports.cancelOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderToken, reason } = req.body;

    if (!orderToken) {
      return res.status(400).json({
        success: false,
        message: 'Order token is required'
      });
    }

    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper profile not found'
      });
    }

    const shop = await Shop.findOne({ shopkeeperId: shopkeeper._id });
    
    // Find order by orderToken and shopId
    const order = await Order.findOne({
      orderToken: orderToken,
      $or: [
        { shopId: userId },
        { shopId: shopkeeper._id },
        { shopId: shopkeeper.userId }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or does not belong to this shopkeeper'
      });
    }

    if (['DELIVERED', 'CANCELLED'].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order. Current status: ${order.orderStatus}`
      });
    }

    order.orderStatus = 'CANCELLED';
    order.cancelReason = reason || 'Cancelled by shopkeeper';
    order.cancelledAt = Date.now();
    await order.save();

    // ========== SOCKET.IO EMIT ==========
    const io = global.io || (req.app && req.app.get('io'));
    
    if (io) {
      io.to(order.customerId.toString()).emit('order-status', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderToken: order.orderToken,
        orderStatus: 'CANCELLED',
        cancelReason: order.cancelReason,
        cancelledAt: order.cancelledAt,
        message: 'Your order has been cancelled by the shopkeeper'
      });
      
      if (order.deliveryBoyId) {
        io.to(order.deliveryBoyId.toString()).emit('order-status', {
          orderId: order._id,
          orderNumber: order.orderNumber,
          orderToken: order.orderToken,
          orderStatus: 'CANCELLED',
          message: 'Order has been cancelled by the shopkeeper'
        });
      }
      
      console.log('✓ Order cancelled events emitted via Socket.IO');
    }
    // ====================================

    // 🔔 Save persistent notification for customer (works even if customer is offline)
    try {
      const notifTitle = `❌ Order Cancelled #${order.orderNumber}`;
      const notifBody = `Your order #${order.orderNumber} has been cancelled by the shopkeeper. Reason: ${order.cancelReason}`;

      const savedNotif = await Notification.create({
        userId: order.customerId,
        notificationType: 'order',
        title: notifTitle,
        body: notifBody,
        dataJson: JSON.stringify({
          orderId: order._id,
          orderNumber: order.orderNumber,
          orderToken: order.orderToken,
          status: 'CANCELLED',
          cancelReason: order.cancelReason,
          cancelledAt: order.cancelledAt
        }),
        isRead: false
      });

      console.log(`✓ Notification saved for customer: ${order.customerId}`);

      if (io) {
        io.to(order.customerId.toString()).emit('notification', {
          _id: savedNotif._id,
          notificationType: 'order',
          title: notifTitle,
          body: notifBody,
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: 'CANCELLED',
          cancelReason: order.cancelReason,
          isRead: false,
          timestamp: new Date()
        });
        console.log(`✓ Emitted notification event to customer: ${order.customerId}`);
      }
    } catch (notifError) {
      console.error(`⚠ Failed to save notification for customer:`, notifError.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderToken: order.orderToken,
        orderStatus: order.orderStatus,
        cancelReason: order.cancelReason,
        cancelledAt: order.cancelledAt
      }
    });

  } catch (error) {
    console.error('Cancel order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ Get Order Statistics
module.exports.getOrderStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper profile not found'
      });
    }

    const shop = await Shop.findOne({ shopkeeperId: shopkeeper._id });
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    // shopId in Order model references User._id (shopkeeper's userId)
    const shopIdQuery = {
      $or: [
        { shopId: userId },
        { shopId: shopkeeper._id },
        { shopId: shopkeeper.userId }
      ]
    };

    // Get counts by status
    const pending = await Order.countDocuments({ ...shopIdQuery, orderStatus: 'PENDING' });
    const confirmed = await Order.countDocuments({ ...shopIdQuery, orderStatus: 'CONFIRMED' });
    const assigned = await Order.countDocuments({ ...shopIdQuery, orderStatus: 'ASSIGNED' });
    const pickedUp = await Order.countDocuments({ ...shopIdQuery, orderStatus: 'PICKED_UP' });
    const inTransit = await Order.countDocuments({ ...shopIdQuery, orderStatus: 'IN_TRANSIT' });
    const delivered = await Order.countDocuments({ ...shopIdQuery, orderStatus: 'DELIVERED' });
    const cancelled = await Order.countDocuments({ ...shopIdQuery, orderStatus: 'CANCELLED' });

    // Get total revenue (delivered orders)
    const revenueResult = await Order.aggregate([
      { $match: { ...shopIdQuery, orderStatus: 'DELIVERED' } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenue = revenueResult[0]?.totalRevenue || 0;

    // Get today's orders
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayOrders = await Order.countDocuments({
      ...shopIdQuery,
      createdAt: { $gte: todayStart }
    });

    return res.status(200).json({
      success: true,
      message: 'Order statistics retrieved successfully',
      data: {
        orderCounts: {
          pending: pending,
          confirmed: confirmed,
          assigned: assigned,
          pickedUp: pickedUp,
          inTransit: inTransit,
          delivered: delivered,
          cancelled: cancelled,
          total: pending + confirmed + assigned + pickedUp + inTransit + delivered + cancelled
        },
        revenue: {
          total: totalRevenue,
          currency: 'INR'
        },
        today: {
          orders: todayOrders
        }
      }
    });

  } catch (error) {
    console.error('Get order stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


// ==================== HELPER FUNCTIONS ====================

/**
 * Find nearby delivery boys within a radius
 * @param {Number} lat - Latitude
 * @param {Number} lng - Longitude
 * @param {Number} radiusKm - Radius in kilometers (default: 5km)
 * @returns {Array} - Array of nearby delivery boys
 */
async function findNearbyDeliveryBoys(lat, lng, radiusKm = 5) {
  try {
    // Convert radius from kilometers to meters
    const radiusMeters = radiusKm * 1000;

    // We do not have currentLocation in DeliveryBoy schema, 
    // so we skip the geospatial query and just return online delivery boys.
    // In a production app, we would query the DeliveryBoyLocation model.
    const nearbyDeliveryBoys = await DeliveryBoy.find({
      isOnline: true,
      isAvailable: true,
      isBlocked: false
    }).limit(10);

    return nearbyDeliveryBoys;
  } catch (error) {
    console.error('Error finding nearby delivery boys:', error);
    
    // Fallback: Return all available delivery boys if geospatial query fails
    try {
      const availableDeliveryBoys = await DeliveryBoy.find({
        isOnline: true,
        isAvailable: true,
        isBlocked: false
      }).limit(10);
      
      return availableDeliveryBoys;
    } catch (fallbackError) {
      console.error('Fallback query also failed:', fallbackError);
      return [];
    }
  }
}
