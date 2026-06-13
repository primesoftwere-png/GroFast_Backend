// socket/orderFlowSocket.js
// 🚀 REAL-TIME ORDER FLOW - Complete Socket.IO Implementation

const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Order = require('../models/Customer/Order');
const DeliveryBoy = require('../models/DeliveryBoy/DeliveryBoy');
const DeliveryBoyLocation = require('../models/DeliveryBoy/DeliveryBoyLocation');

/**
 * Initialize Socket.IO for real-time order flow
 * @param {SocketIO.Server} io - Socket.IO server instance
 */
function initializeOrderFlowSocket(io) {
  
  // ==================== AUTHENTICATION MIDDLEWARE ====================
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || 
                    socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded._id).select('-password');
      
      if (!user) {
        return next(new Error('User not found'));
      }

      // Attach user to socket
      socket.user = user;
      socket.userId = user._id.toString();
      socket.userRole = user.role;
      
      console.log(`✓ Socket authenticated: ${user.fullname} (${user.role})`);
      next();
    } catch (error) {
      console.error('Socket authentication error:', error.message);
      next(new Error('Authentication failed'));
    }
  });

  // ==================== CONNECTION HANDLER ====================
  io.on('connection', (socket) => {
    console.log('========================================');
    console.log('🔌 NEW SOCKET CONNECTION');
    console.log('Socket ID:', socket.id);
    console.log('User:', socket.user.fullname);
    console.log('Role:', socket.userRole);
    console.log('========================================');

    // Join user to their personal room and role-based room
    const userId = socket.userId;
    const role = socket.userRole;

    // Join personal room
    socket.join(userId);
    
    // Join role-based rooms
    if (role === 'user') {
      // Customer
      socket.join('customer-room');
      console.log(`✓ Customer joined: ${userId}`);
      
    } else if (role === 'admin') {
      // Shopkeeper
      socket.join(socket.userId); // Shop-specific room
      console.log(`✓ Shopkeeper joined: ${userId}`);
      
    } else if (role === 'deliveryBoy') {
      // Delivery Boy
      socket.join('delivery-room'); // All delivery boys room
      console.log(`✓ Delivery boy joined delivery-room: ${userId}`);
      
      // Mark as online
      markDeliveryBoyOnline(userId);
    }

    // ==================== SHOPKEEPER EVENTS ====================
    
    /**
     * Shopkeeper accepts order
     * Status: PENDING → CONFIRMED
     * Emits to: Delivery boys (order-available), Customer (order-status)
     */
    socket.on('order-accept', async ({ orderId }) => {
      try {
        console.log(`\n📦 SHOPKEEPER ACCEPT ORDER: ${orderId}`);
        
        const order = await Order.findById(orderId)
          .populate('customerId', 'fullname phone')
          .populate('shopId', 'fullname phone shopName');
        
        if (!order) {
          socket.emit('error', { message: 'Order not found' });
          return;
        }

        // Verify shopkeeper owns this order
        if (order.shopId._id.toString() !== userId) {
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        // Update order status
        order.orderStatus = 'CONFIRMED';
        order.acceptedAt = new Date();
        await order.save();

        console.log(`✓ Order ${orderId} status: PENDING → CONFIRMED`);

        // Emit to all delivery boys
        io.to('delivery-room').emit('order-available', {
          orderId: order._id,
          orderNumber: order.orderNumber,
          shopId: order.shopId._id,
          shopName: order.shopId.shopName || order.shopId.fullname,
          shopPhone: order.shopId.phone,
          customerName: order.customerId.fullname,
          totalAmount: order.totalAmount,
          deliveryCharge: order.deliveryCharge,
          paymentMethod: order.paymentMethod,
          status: 'CONFIRMED',
          createdAt: order.createdAt
        });

        console.log(`✓ Emitted order-available to delivery-room`);

        // Notify customer
        io.to(order.customerId._id.toString()).emit('order-status', {
          orderId: order._id,
          status: 'CONFIRMED',
          message: 'Your order has been confirmed by the shop',
          timestamp: new Date()
        });

        console.log(`✓ Notified customer: ${order.customerId._id}`);

        // Confirm to shopkeeper
        socket.emit('order-accept-success', {
          orderId: order._id,
          status: 'CONFIRMED',
          message: 'Order confirmed successfully'
        });

      } catch (error) {
        console.error('Error in order-accept:', error);
        socket.emit('error', { message: 'Failed to accept order' });
      }
    });

    // ==================== DELIVERY BOY EVENTS ====================
    
    /**
     * Delivery boy accepts order
     * Status: CONFIRMED → ASSIGNED
     * Emits to: Customer (order-status), Shopkeeper (delivery-assigned)
     */
    socket.on('delivery-accept', async ({ orderId, deliveryBoyId }) => {
      try {
        console.log(`\n🛵 DELIVERY BOY ACCEPT ORDER: ${orderId}`);
        
        // Use socket userId if deliveryBoyId not provided
        const dbId = deliveryBoyId || userId;
        
        const order = await Order.findById(orderId)
          .populate('customerId', 'fullname phone')
          .populate('shopId', 'fullname phone shopName');
        
        if (!order) {
          socket.emit('error', { message: 'Order not found' });
          return;
        }

        // Check if already assigned
        if (order.deliveryBoyId) {
          socket.emit('error', { message: 'Order already assigned to another delivery boy' });
          return;
        }

        // Check if order is in correct status
        if (order.orderStatus !== 'CONFIRMED') {
          socket.emit('error', { message: `Order cannot be accepted. Current status: ${order.orderStatus}` });
          return;
        }

        // Get delivery boy details
        const deliveryBoy = await DeliveryBoy.findOne({ userId: dbId })
          .populate('userId', 'fullname phone');
        
        if (!deliveryBoy) {
          socket.emit('error', { message: 'Delivery boy profile not found' });
          return;
        }

        // Check if delivery boy is available
        if (!deliveryBoy.isOnline || !deliveryBoy.isAvailable) {
          socket.emit('error', { message: 'You must be online and available to accept orders' });
          return;
        }

        // Assign order atomically
        const updatedOrder = await Order.findOneAndUpdate(
          { 
            _id: orderId,
            deliveryBoyId: null,
            orderStatus: 'CONFIRMED'
          },
          {
            deliveryBoyId: dbId,
            orderStatus: 'ASSIGNED',
            deliveryBoyAssignedAt: new Date()
          },
          { new: true }
        );

        if (!updatedOrder) {
          socket.emit('error', { message: 'Order already assigned or status changed' });
          return;
        }

        // Update delivery boy
        deliveryBoy.activeOrderId = orderId;
        deliveryBoy.isAvailable = false;
        await deliveryBoy.save();

        console.log(`✓ Order ${orderId} status: CONFIRMED → ASSIGNED`);
        console.log(`✓ Assigned to: ${deliveryBoy.userId.fullname}`);

        // Notify customer
        io.to(order.customerId._id.toString()).emit('order-status', {
          orderId: order._id,
          status: 'ASSIGNED',
          message: 'Delivery partner assigned',
          deliveryBoy: {
            name: deliveryBoy.userId.fullname,
            phone: deliveryBoy.userId.phone,
            vehicleType: deliveryBoy.vehicleType
          },
          timestamp: new Date()
        });

        // Notify shopkeeper
        io.to(order.shopId._id.toString()).emit('delivery-assigned', {
          orderId: order._id,
          deliveryBoy: {
            id: deliveryBoy.userId._id,
            name: deliveryBoy.userId.fullname,
            phone: deliveryBoy.userId.phone,
            vehicleType: deliveryBoy.vehicleType
          },
          otp: order.otp, // Send OTP to shopkeeper
          timestamp: new Date()
        });

        // Confirm to delivery boy
        socket.emit('delivery-accept-success', {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: 'ASSIGNED',
          otp: order.otp,
          shopDetails: {
            name: order.shopId.shopName || order.shopId.fullname,
            phone: order.shopId.phone,
            address: order.shopId.address
          },
          message: 'Order assigned successfully. Proceed to shop for pickup.'
        });

        console.log(`✓ Order assigned successfully`);

      } catch (error) {
        console.error('Error in delivery-accept:', error);
        socket.emit('error', { message: 'Failed to accept order' });
      }
    });

    /**
     * Live location updates from delivery boy
     * Emits to: Customer (live-location)
     */
    socket.on('location-update', async ({ orderId, lat, lng, speed, heading, accuracy }) => {
      try {
        // Validate coordinates
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
          return;
        }

        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);

        // Save location to database
        await DeliveryBoyLocation.findOneAndUpdate(
          { deliveryBoyId: userId },
          {
            deliveryBoyId: userId,
            orderId: orderId,
            latitude: latitude,
            longitude: longitude,
            accuracy: accuracy ? parseFloat(accuracy) : null,
            speed: speed ? parseFloat(speed) : null,
            heading: heading ? parseFloat(heading) : null,
            isActive: true,
            updatedAt: new Date()
          },
          { upsert: true, new: true }
        );

        // Get order to find customer
        const order = await Order.findById(orderId);
        if (order && order.customerId) {
          // Emit live location to customer
          io.to(order.customerId.toString()).emit('live-location', {
            orderId: orderId,
            lat: latitude,
            lng: longitude,
            speed: speed,
            heading: heading,
            accuracy: accuracy,
            timestamp: new Date()
          });
        }

      } catch (error) {
        console.error('Error in location-update:', error);
      }
    });

    /**
     * Delivery boy goes online
     */
    socket.on('go-online', async () => {
      try {
        if (role !== 'deliveryBoy') return;

        await DeliveryBoy.findOneAndUpdate(
          { userId: userId },
          { isOnline: true, isAvailable: true, lastOnlineAt: new Date() }
        );

        socket.emit('online-status', { isOnline: true, isAvailable: true });
        console.log(`✓ Delivery boy ${userId} is now ONLINE`);

      } catch (error) {
        console.error('Error in go-online:', error);
      }
    });

    /**
     * Delivery boy goes offline
     */
    socket.on('go-offline', async () => {
      try {
        if (role !== 'deliveryBoy') return;

        await DeliveryBoy.findOneAndUpdate(
          { userId: userId },
          { isOnline: false, isAvailable: false, lastOfflineAt: new Date() }
        );

        socket.emit('online-status', { isOnline: false, isAvailable: false });
        console.log(`✓ Delivery boy ${userId} is now OFFLINE`);

      } catch (error) {
        console.error('Error in go-offline:', error);
      }
    });

    // ==================== DISCONNECT HANDLER ====================
    
    socket.on('disconnect', async () => {
      console.log(`❌ Socket disconnected: ${socket.id} (${socket.user.fullname})`);
      
      // Mark delivery boy as offline
      if (role === 'deliveryBoy') {
        await markDeliveryBoyOffline(userId);
      }
    });

  });

  // Store io instance globally for use in API routes
  global.io = io;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Mark delivery boy as online
 */
async function markDeliveryBoyOnline(userId) {
  try {
    await DeliveryBoy.findOneAndUpdate(
      { userId: userId },
      { 
        isOnline: true, 
        lastOnlineAt: new Date() 
      }
    );
    console.log(`✓ Delivery boy ${userId} marked as online`);
  } catch (error) {
    console.error('Error marking delivery boy online:', error);
  }
}

/**
 * Mark delivery boy as offline
 */
async function markDeliveryBoyOffline(userId) {
  try {
    await DeliveryBoy.findOneAndUpdate(
      { userId: userId },
      { 
        isOnline: false,
        isAvailable: false,
        lastOfflineAt: new Date() 
      }
    );
    console.log(`✓ Delivery boy ${userId} marked as offline`);
  } catch (error) {
    console.error('Error marking delivery boy offline:', error);
  }
}

/**
 * Emit order accepted status to customer
 */
function emitOrderAcceptedToCustomer(io, customerId, data) {
  if (io && customerId) {
    io.to(customerId.toString()).emit('order-status', data);
  }
}

/**
 * Emit delivery request to nearby delivery boys
 */
function emitDeliveryRequestToNearbyDeliveryBoys(io, deliveryBoyIds, data) {
  if (io && deliveryBoyIds && deliveryBoyIds.length > 0) {
    deliveryBoyIds.forEach(id => {
      io.to(id.toString()).emit('delivery-request', data);
    });
  }
}

/**
 * Emit order ready for pickup to customer and delivery boy
 */
function emitOrderReady(io, customerId, deliveryBoyId, data) {
  if (io) {
    if (customerId) io.to(customerId.toString()).emit('order-status', data);
    if (deliveryBoyId) io.to(deliveryBoyId.toString()).emit('order-ready', data);
  }
}

/**
 * Emit order cancelled to customer and delivery boy
 */
function emitOrderCancelled(io, customerId, deliveryBoyId, data) {
  if (io) {
    if (customerId) io.to(customerId.toString()).emit('order-status', data);
    if (deliveryBoyId) io.to(deliveryBoyId.toString()).emit('order-cancelled', data);
  }
}

/**
 * Emit delivery boy assigned to customer and shopkeeper
 */
function emitDeliveryBoyAssigned(io, customerId, shopId, data) {
  if (io) {
    if (customerId) io.to(customerId.toString()).emit('delivery-assigned', data);
    if (shopId) io.to(shopId.toString()).emit('delivery-assigned', data);
  }
}

/**
 * Emit order out for delivery to customer
 */
function emitOrderOutForDelivery(io, customerId, data) {
  if (io && customerId) {
    io.to(customerId.toString()).emit('order-out-for-delivery', data);
  }
}

/**
 * Emit order delivered to customer and shopkeeper
 */
function emitOrderDelivered(io, customerId, shopId, data) {
  if (io) {
    if (customerId) io.to(customerId.toString()).emit('order-delivered', data);
    if (shopId) io.to(shopId.toString()).emit('order-delivered', data);
  }
}

/**
 * Cancel delivery requests to other delivery boys
 */
function cancelDeliveryRequests(io, data) {
  if (io) {
    io.to('delivery-room').emit('delivery-request-cancelled', data);
  }
}

module.exports = { 
  initializeOrderFlowSocket,
  emitOrderAcceptedToCustomer,
  emitDeliveryRequestToNearbyDeliveryBoys,
  emitOrderReady,
  emitOrderCancelled,
  emitDeliveryBoyAssigned,
  emitOrderOutForDelivery,
  emitOrderDelivered,
  cancelDeliveryRequests
};
