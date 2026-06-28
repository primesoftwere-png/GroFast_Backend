// controllers/Delivery/deliveryOrderManagement.controller.js
// Delivery Boy Order Management APIs

const Order = require('../../models/Customer/Order');
const OrderItem = require('../../models/Customer/OrderItem');
const DeliveryBoy = require('../../models/DeliveryBoy/DeliveryBoy');
const DeliveryBoyWallet = require('../../models/DeliveryBoy/DeliveryBoyWallet');
const WalletTransaction = require('../../models/DeliveryBoy/WalletTransaction');
const Shopkeeper = require('../../models/ShopKeeper/Shopkeeper');
const Shop = require('../../models/ShopKeeper/Shop');
const DeliveryBoyNotification = require('../../models/DeliveryBoy/DeliveryBoyNotification');
const { 
  emitDeliveryBoyAssigned,
  emitOrderOutForDelivery,
  emitOrderDelivered,
  cancelDeliveryRequests
} = require('../../socket/orderFlowSocket');
const SettlementEngine = require('../../services/SettlementEngine');

// ✅ Accept Delivery Request
module.exports.acceptDeliveryRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId } = req.body;  // Accept via orderId (not orderToken)

    console.log('========================================');
    console.log('ACCEPT DELIVERY REQUEST - DEBUG INFO');
    console.log('========================================');
    console.log('Delivery Boy userId:', userId);
    console.log('Order ID:', orderId);

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    // Get delivery boy profile
    const deliveryBoy = await DeliveryBoy.findOne({ userId });
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: 'Delivery boy profile not found'
      });
    }

    // Check if delivery boy is available
    if (!deliveryBoy.isAvailable || !deliveryBoy.isOnline) {
      return res.status(400).json({
        success: false,
        message: 'You must be online and available to accept orders'
      });
    }

    // Atomically assign the order (prevent race condition)
    const order = await Order.findOneAndUpdate(
      { 
        _id: orderId, 
        deliveryBoyId: null,
        orderStatus: 'CONFIRMED'   // Shopkeeper has accepted (PENDING → CONFIRMED)
      },
      {
        deliveryBoyId: userId,
        deliveryBoyAssignedAt: new Date(),
        orderStatus: 'ASSIGNED_TO_DELIVERY'
      },
      { new: true }
    )
      .populate('customerId', 'fullname phone')
      .populate('shopId', 'fullname phone shopName')
      .populate('deliveryAddressId');

    if (!order) {
      // Check why it failed
      const existingOrder = await Order.findById(orderId);
      if (!existingOrder) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      if (existingOrder.deliveryBoyId) {
        return res.status(400).json({ success: false, message: 'Order already assigned to another delivery partner' });
      }
      return res.status(400).json({ 
        success: false, 
        message: `Cannot accept order. Current status: ${existingOrder.orderStatus}` 
      });
    }

    // Mark delivery boy as busy
    deliveryBoy.isAvailable = false;
    deliveryBoy.activeOrderId = orderId;
    deliveryBoy.totalDeliveries = (deliveryBoy.totalDeliveries || 0) + 1;
    await deliveryBoy.save();

    console.log('✓ Order assigned to delivery boy successfully');
    console.log('========================================');

    // ========== SOCKET.IO EMIT ==========
    const io = global.io || (req.app && req.app.get('io'));
    
    if (io) {
      const deliveryBoyData = {
        id: userId.toString(),
        name: deliveryBoy.fullName || req.user.fullname,
        phone: deliveryBoy.phoneNumber || req.user.phone,
        vehicleType: deliveryBoy.vehicleType,
        vehicleNumber: deliveryBoy.vehicleNumber
      };

      // Notify customer
      emitDeliveryBoyAssigned(
        io,
        order.customerId?._id?.toString() || order.customerId?.toString(),
        order.shopId?._id?.toString() || order.shopId?.toString(),
        {
          orderId: order._id,
          orderNumber: order.orderNumber,
          orderStatus: 'ASSIGNED_TO_DELIVERY',
          deliveryBoy: deliveryBoyData,
          estimatedPickupTime: '10-15 minutes',
          message: 'A delivery partner has been assigned to your order'
        }
      );

      // Notify ALL delivery boys that this order is taken
      cancelDeliveryRequests(io, order._id, order.orderNumber);

      console.log('✓ Socket events emitted: delivery assigned + order taken broadcast');
    }
    // ====================================

    // Create notification for delivery boy
    try {
      await DeliveryBoyNotification.create({
        deliveryBoyId: userId,
        orderId: order._id,
        title: 'Order Accepted',
        message: `You accepted order ${order.orderNumber}. Head to the shop for pickup.`,
        type: 'order_assigned',
        priority: 'high'
      });
    } catch (notifErr) {
      console.warn('Failed to create notification:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Order accepted successfully! Head to the shop for pickup.',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        pickupOTPRequired: true,
        shop: {
          name: order.shopId?.shopName || order.shopId?.fullname,
          phone: order.shopId?.phone
        },
        customer: {
          name: order.customerId?.fullname,
          phone: order.customerId?.phone
        },
        deliveryAddress: order.deliveryAddressId
      }
    });

  } catch (error) {
    console.error('Accept delivery request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ Pickup Order (Verify Pickup OTP)
module.exports.pickupOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId, pickupOTP } = req.body;  // Use orderId instead of orderToken

    console.log('========================================');
    console.log('PICKUP ORDER - DEBUG INFO');
    console.log('========================================');
    console.log('Delivery Boy userId:', userId);
    console.log('Order ID:', orderId);
    console.log('Pickup OTP:', pickupOTP);

    if (!orderId || !pickupOTP) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and pickup OTP are required'
      });
    }

    // Get delivery boy profile
    const deliveryBoy = await DeliveryBoy.findOne({ userId });
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: 'Delivery boy profile not found'
      });
    }

    // Find order by ID and assigned delivery boy
    const order = await Order.findOne({ 
      _id: orderId,
      deliveryBoyId: userId
    })
      .populate('customerId', 'fullname phone')
      .populate('shopId', 'fullname phone')
      .populate('deliveryAddressId');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or not assigned to you'
      });
    }

    // Check order status (allow both ASSIGNED_TO_DELIVERY and READY_FOR_PICKUP)
    if (!['ASSIGNED_TO_DELIVERY', 'READY_FOR_PICKUP'].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot pickup order. Current status: ${order.orderStatus}`
      });
    }

    // Verify pickup OTP
    if (!order.pickupOTP || !order.pickupOTP.code) {
      return res.status(400).json({
        success: false,
        message: 'Pickup OTP not generated for this order'
      });
    }

    if (String(order.pickupOTP.code) !== String(pickupOTP)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pickup OTP'
      });
    }

    // Check if OTP is expired
    if (new Date() > new Date(order.pickupOTP.expiresAt)) {
      return res.status(400).json({
        success: false,
        message: 'Pickup OTP has expired'
      });
    }

    // Generate delivery OTP (for customer)
    const deliveryOTPCode = Math.floor(100000 + Math.random() * 900000).toString();
    const deliveryOTPExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours validity

    // Update order status
    order.orderStatus = 'OUT_FOR_DELIVERY';
    order.pickedUpAt = Date.now();
    order.pickupOTP.verified = true;
    order.deliveryOTP = {
      code: deliveryOTPCode,
      expiresAt: deliveryOTPExpiry,
      verified: false
    };
    await order.save();

    console.log('✓ Order picked up successfully');
    console.log('Delivery OTP:', deliveryOTPCode);
    console.log('========================================');

    // ========== SOCKET.IO EMIT ==========
    const io = global.io || (req.app && req.app.get('io'));
    
    if (io) {
      // Emit to customer
      emitOrderOutForDelivery(io, order.customerId.toString(), {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderToken: order.orderToken,
        orderStatus: 'OUT_FOR_DELIVERY',
        deliveryBoy: {
          name: deliveryBoy.fullName,
          phone: deliveryBoy.phoneNumber,
          vehicleType: deliveryBoy.vehicleType,
          vehicleNumber: deliveryBoy.vehicleNumber,
          currentLocation: deliveryBoy.currentLocation
        },
        estimatedDeliveryTime: '15 minutes',
        message: 'Your order is on the way!',
        deliveryOTP: {
          code: deliveryOTPCode,
          message: 'Share this OTP with delivery boy to confirm delivery'
        }
      });

      console.log('✓ Order out for delivery events emitted via Socket.IO');
    }
    // ====================================

    return res.status(200).json({
      success: true,
      message: 'Order picked up successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderToken: order.orderToken,
        orderStatus: order.orderStatus,
        pickedUpAt: order.pickedUpAt,
        deliveryOTP: {
          code: deliveryOTPCode,
          expiresAt: deliveryOTPExpiry,
          message: 'Customer will share this OTP with you to confirm delivery'
        },
        deliveryLocation: {
          address: order.deliveryAddress?.address,
          lat: order.deliveryAddress?.lat,
          lng: order.deliveryAddress?.lng
        },
        customer: {
          name: order.customerId?.fullname,
          phone: order.customerId?.phone
        }
      }
    });

  } catch (error) {
    console.error('Pickup order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ Complete Delivery (Verify Delivery OTP)
module.exports.completeDelivery = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId, deliveryOTP } = req.body;  // Use orderId instead of orderToken

    console.log('========================================');
    console.log('COMPLETE DELIVERY - DEBUG INFO');
    console.log('========================================');
    console.log('Delivery Boy userId:', userId);
    console.log('Order ID:', orderId);
    console.log('Delivery OTP:', deliveryOTP);

    if (!orderId || !deliveryOTP) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and delivery OTP are required'
      });
    }

    // Get delivery boy profile
    const deliveryBoy = await DeliveryBoy.findOne({ userId });
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: 'Delivery boy profile not found'
      });
    }

    // Find order by ID and assigned delivery boy
    const order = await Order.findOne({ 
      _id: orderId,
      deliveryBoyId: userId
    })
      .populate('customerId', 'fullname phone')
      .populate('shopId', 'fullname phone')
      .populate('deliveryAddressId');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or not assigned to you'
      });
    }

    // Check order status
    if (order.orderStatus !== 'OUT_FOR_DELIVERY') {
      return res.status(400).json({
        success: false,
        message: `Cannot complete delivery. Current status: ${order.orderStatus}`
      });
    }

    // Verify delivery OTP
    if (!order.deliveryOTP || !order.deliveryOTP.code) {
      return res.status(400).json({
        success: false,
        message: 'Delivery OTP not generated for this order'
      });
    }

    if (String(order.deliveryOTP.code) !== String(deliveryOTP)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid delivery OTP'
      });
    }

    // Check if OTP is expired
    if (new Date() > new Date(order.deliveryOTP.expiresAt)) {
      return res.status(400).json({
        success: false,
        message: 'Delivery OTP has expired'
      });
    }

    // Update order status
    order.orderStatus = 'DELIVERED';
    order.deliveredAt = Date.now();
    order.deliveryOTP.verified = true;
    order.paymentStatus = order.paymentMethod === 'COD' ? 'PAID' : order.paymentStatus;
    await order.save();

    // Mark delivery boy as available again
    deliveryBoy.isAvailable = true;
    await deliveryBoy.save();

    // Call Centralized Settlement Engine
    const settlementResult = await SettlementEngine.processDeliveredOrder(order._id);
    if (!settlementResult.success) {
      console.warn("Settlement Engine Warning:", settlementResult.error || settlementResult.message);
    }

    // Check if delivery boy got blocked due to COD limits
    const updatedWallet = await DeliveryBoyWallet.findOne({ deliveryBoyId: userId });
    if (updatedWallet && updatedWallet.isBlocked) {
      // Notify delivery boy about block
      const DeliveryBoyNotification = require('../../models/DeliveryBoy/DeliveryBoyNotification');
      await DeliveryBoyNotification.create({
        deliveryBoyId: deliveryBoy._id,
        title: "Account Blocked",
        message: `Your account has been blocked due to COD limit exceeded. Current balance: ₹${updatedWallet.balance}. Please settle your dues immediately.`,
        type: 'account_blocked',
        priority: 'urgent'
      });
    }

    console.log('✓ Delivery completed successfully');
    if (order.paymentMethod === 'cod' || order.paymentMethod === 'COD') {
      console.log('COD Collected:', order.totalAmount);
    }
    console.log('========================================');

    // ========== SOCKET.IO EMIT ==========
    const io = global.io || (req.app && req.app.get('io'));
    
    if (io) {
      // Emit to customer and shopkeeper
      emitOrderDelivered(io, order.customerId.toString(), order.shopId.toString(), {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderToken: order.orderToken,
        orderStatus: 'DELIVERED',
        deliveredAt: order.deliveredAt,
        message: 'Your order has been delivered successfully!',
        deliveryBoy: {
          name: deliveryBoy.fullName,
          phone: deliveryBoy.phoneNumber
        }
      });

      console.log('✓ Order delivered events emitted via Socket.IO');
    }
    // ====================================

    return res.status(200).json({
      success: true,
      message: 'Delivery completed successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderToken: order.orderToken,
        orderStatus: order.orderStatus,
        deliveredAt: order.deliveredAt,
        earnings: order.deliveryCharge || 0,
        walletBalance: updatedWallet ? updatedWallet.balance : 0
      }
    });

  } catch (error) {
    console.error('Complete delivery error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ Get Assigned Orders
module.exports.getAssignedOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status } = req.query;

    const deliveryBoy = await DeliveryBoy.findOne({ userId });
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: 'Delivery boy profile not found'
      });
    }

    // Build query
    const query = { deliveryBoyId: userId };
    
    if (status) {
      const validStatuses = ['ASSIGNED_TO_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED'];
      if (validStatuses.includes(status.toUpperCase())) {
        query.orderStatus = status.toUpperCase();
      }
    } else {
      // Default: Show active orders only
      query.orderStatus = { $in: ['ASSIGNED_TO_DELIVERY', 'OUT_FOR_DELIVERY'] };
    }

    // Get orders
    const orders = await Order.find(query)
      .populate('customerId', 'fullname phone')
      .populate('shopId', 'fullname phone')
      .populate('deliveryAddressId')
      .sort({ createdAt: -1 });

    // Get order items
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await OrderItem.find({ orderId: order._id })
          .populate('productId', 'productName productImage productPrice');
        
        const orderObj = order.toObject();
        
        // Include relevant OTPs based on status
        if (orderObj.orderStatus === 'ASSIGNED_TO_DELIVERY' && orderObj.pickupOTP) {
          orderObj.pickupOTP = {
            message: 'Get this OTP from shopkeeper to pickup order'
          };
        }
        
        if (orderObj.orderStatus === 'OUT_FOR_DELIVERY' && orderObj.deliveryOTP) {
          orderObj.deliveryOTP = {
            message: 'Get this OTP from customer to complete delivery'
          };
        }
        
        return {
          ...orderObj,
          items: items
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: 'Assigned orders retrieved successfully',
      data: {
        orders: ordersWithItems,
        count: ordersWithItems.length
      }
    });

  } catch (error) {
    console.error('Get assigned orders error:', error);
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

    const deliveryBoy = await DeliveryBoy.findOne({ userId });
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: 'Delivery boy profile not found'
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      deliveryBoyId: userId
    })
      .populate('customerId', 'fullname phone')
      .populate('shopId', 'fullname phone')
      .populate('deliveryAddressId');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or not assigned to you'
      });
    }

    // Fetch Shop details to get latitude and longitude
    let shopDetails = null;
    if (order.shopId && order.shopId._id) {
      const shopkeeper = await Shopkeeper.findOne({ userId: order.shopId._id });
      if (shopkeeper) {
        shopDetails = await Shop.findOne({ shopkeeperId: shopkeeper._id });
      }
    }

    // Get order items
    const items = await OrderItem.find({ orderId: order._id })
      .populate('productId', 'productName productImage productPrice productDescription');
      
    // Convert order to object to append shop details
    const orderObj = order.toObject();
    if (shopDetails) {
      orderObj.shopDetails = {
        latitude: shopDetails.latitude,
        longitude: shopDetails.longitude,
        shopAddress: shopDetails.shopAddress,
        shopName: shopDetails.shopName
      };
    }

    return res.status(200).json({
      success: true,
      message: 'Order details retrieved successfully',
      data: {
        order: orderObj,
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
