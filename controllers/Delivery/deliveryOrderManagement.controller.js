// controllers/Delivery/deliveryOrderManagement.controller.js
// Delivery Boy Order Management APIs

const Order = require('../../models/Customer/Order');
const OrderItem = require('../../models/Customer/OrderItem');
const DeliveryBoy = require('../../models/DeliveryBoy/DeliveryBoy');
const DeliveryBoyWallet = require('../../models/DeliveryBoy/DeliveryBoyWallet');
const WalletTransaction = require('../../models/DeliveryBoy/WalletTransaction');
const Shop = require('../../models/ShopKeeper/Shop');
const { 
  emitDeliveryBoyAssigned,
  emitOrderOutForDelivery,
  emitOrderDelivered,
  cancelDeliveryRequests
} = require('../../socket/orderFlowSocket');

// ✅ Accept Delivery Request
module.exports.acceptDeliveryRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderToken } = req.body;

    console.log('========================================');
    console.log('ACCEPT DELIVERY REQUEST - DEBUG INFO');
    console.log('========================================');
    console.log('Delivery Boy userId:', userId);
    console.log('Order token:', orderToken);

    if (!orderToken) {
      return res.status(400).json({
        success: false,
        message: 'Order token is required'
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

    // Find order by token
    const order = await Order.findOne({ orderToken: orderToken })
      .populate('customerId', 'fullname phone')
      .populate('shopId', 'fullname phone')
      .populate('deliveryAddressId');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order is in correct status
    if (!['ACCEPTED', 'READY_FOR_PICKUP'].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot accept order. Current status: ${order.orderStatus}`
      });
    }

    // Check if order is already assigned
    if (order.deliveryBoyId) {
      return res.status(400).json({
        success: false,
        message: 'Order is already assigned to another delivery partner'
      });
    }

    // Assign delivery boy to order
    order.deliveryBoyId = userId;
    order.deliveryBoyAssignedAt = Date.now();
    order.orderStatus = 'ASSIGNED_TO_DELIVERY';
    await order.save();

    // Mark delivery boy as busy
    deliveryBoy.isAvailable = false;
    await deliveryBoy.save();

    console.log('✓ Order assigned to delivery boy successfully');
    console.log('========================================');

    // ========== SOCKET.IO EMIT ==========
    const io = global.io || (req.app && req.app.get('io'));
    
    if (io) {
      // Emit to customer and shopkeeper
      emitDeliveryBoyAssigned(io, order.customerId.toString(), order.shopId.toString(), {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderToken: order.orderToken,
        orderStatus: 'ASSIGNED_TO_DELIVERY',
        deliveryBoy: {
          id: userId.toString(),
          name: deliveryBoy.fullName,
          phone: deliveryBoy.phoneNumber,
          vehicleType: deliveryBoy.vehicleType,
          vehicleNumber: deliveryBoy.vehicleNumber,
          currentLocation: deliveryBoy.currentLocation
        },
        estimatedPickupTime: '10 minutes'
      });

      // Cancel other pending delivery requests
      // TODO: Track delivery requests in DeliveryRequest model
      console.log('✓ Delivery boy assigned events emitted via Socket.IO');
    }
    // ====================================

    return res.status(200).json({
      success: true,
      message: 'Delivery request accepted successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderToken: order.orderToken,
        orderStatus: order.orderStatus,
        pickupLocation: {
          address: order.pickupAddress?.address,
          lat: order.pickupAddress?.lat,
          lng: order.pickupAddress?.lng
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
    const { orderToken, pickupOTP } = req.body;

    console.log('========================================');
    console.log('PICKUP ORDER - DEBUG INFO');
    console.log('========================================');
    console.log('Delivery Boy userId:', userId);
    console.log('Order token:', orderToken);
    console.log('Pickup OTP:', pickupOTP);

    if (!orderToken || !pickupOTP) {
      return res.status(400).json({
        success: false,
        message: 'Order token and pickup OTP are required'
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

    // Find order by token and assigned delivery boy
    const order = await Order.findOne({ 
      orderToken: orderToken,
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
    if (order.orderStatus !== 'ASSIGNED_TO_DELIVERY' && order.orderStatus !== 'READY_FOR_PICKUP') {
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

    if (order.pickupOTP.code !== pickupOTP) {
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
    const { orderToken, deliveryOTP } = req.body;

    console.log('========================================');
    console.log('COMPLETE DELIVERY - DEBUG INFO');
    console.log('========================================');
    console.log('Delivery Boy userId:', userId);
    console.log('Order token:', orderToken);
    console.log('Delivery OTP:', deliveryOTP);

    if (!orderToken || !deliveryOTP) {
      return res.status(400).json({
        success: false,
        message: 'Order token and delivery OTP are required'
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

    // Find order by token and assigned delivery boy
    const order = await Order.findOne({ 
      orderToken: orderToken,
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

    if (order.deliveryOTP.code !== deliveryOTP) {
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

    // Update delivery boy wallet (add earnings and handle COD)
    const deliveryEarnings = 50; // Calculate based on distance and order value
    let wallet = await DeliveryBoyWallet.findOne({ deliveryBoyId: deliveryBoy._id });
    
    if (!wallet) {
      wallet = await DeliveryBoyWallet.create({
        deliveryBoyId: deliveryBoy._id,
        balance: 0,
        codLimit: 10000
      });
    }

    // 1. Process Delivery Earnings
    const balanceBeforeEarnings = wallet.balance;
    wallet.balance += deliveryEarnings;
    wallet.totalEarnings += deliveryEarnings;
    const balanceAfterEarnings = wallet.balance;
    await wallet.save();

    // Create earnings transaction
    await WalletTransaction.create({
      deliveryBoyId: deliveryBoy._id,
      orderId: order._id,
      transactionType: 'credit',
      amount: deliveryEarnings,
      balanceBefore: balanceBeforeEarnings,
      balanceAfter: balanceAfterEarnings,
      description: `Delivery earnings for order ${order.orderNumber}`,
      paymentMethod: null,
      status: 'completed'
    });

    // 2. Process COD if applicable
    if (order.paymentMethod === 'cod' || order.paymentMethod === 'COD') {
      const balanceBeforeCOD = wallet.balance;
      wallet.balance -= order.totalAmount; // Negative balance (debt to admin)
      wallet.codCollected += order.totalAmount;
      wallet.codPending += order.totalAmount;
      const balanceAfterCOD = wallet.balance;
      await wallet.save();

      // Create COD debit transaction
      await WalletTransaction.create({
        deliveryBoyId: deliveryBoy._id,
        orderId: order._id,
        transactionType: 'debit',
        amount: order.totalAmount,
        balanceBefore: balanceBeforeCOD,
        balanceAfter: balanceAfterCOD,
        description: `COD collected for order ${order.orderNumber}`,
        paymentMethod: 'cod',
        status: 'completed'
      });

      // Check if wallet exceeds limit
      if (!wallet.isWithinLimit()) {
        wallet.isBlocked = true;
        wallet.blockReason = 'COD limit exceeded. Please settle your dues.';
        await wallet.save();

        // Block delivery boy from receiving new orders
        deliveryBoy.isBlocked = true;
        deliveryBoy.blockReason = 'COD limit exceeded';
        deliveryBoy.isOnline = false;
        deliveryBoy.isAvailable = false;
        await deliveryBoy.save();

        // Create notification
        const DeliveryBoyNotification = require('../../models/DeliveryBoy/DeliveryBoyNotification');
        await DeliveryBoyNotification.create({
          deliveryBoyId: deliveryBoy._id,
          title: "Account Blocked",
          message: `Your account has been blocked due to COD limit exceeded. Current balance: ₹${wallet.balance}. Please settle your dues immediately.`,
          type: 'account_blocked',
          priority: 'urgent'
        });
      }
    }

    console.log('✓ Delivery completed successfully');
    console.log('Earnings added:', deliveryEarnings);
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
        earnings: deliveryEarnings,
        walletBalance: wallet.balance
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

    // Get order items
    const items = await OrderItem.find({ orderId: order._id })
      .populate('productId', 'productName productImage productPrice productDescription');

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
