// socket/orderFlowSocket.js
// 🚀 REAL-TIME ORDER FLOW - Complete Socket.IO Implementation

const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Order = require('../models/Customer/Order');
const Shopkeeper = require('../models/ShopKeeper/Shopkeeper');
const DeliveryBoy = require('../models/DeliveryBoy/DeliveryBoy');
const DeliveryBoyLocation = require('../models/DeliveryBoy/DeliveryBoyLocation');
const Notification = require('../models/Customer/Notification');

/**
 * Initialize Socket.IO for real-time order flow
 * @param {SocketIO.Server} io - Socket.IO server instance
 */
function initializeOrderFlowSocket(io) {
  
  // ==================== AUTHENTICATION MIDDLEWARE ====================
  io.use(async (socket, next) => {
    try {
      console.log('\n========================================');
      console.log('🔐 SOCKET AUTHENTICATION ATTEMPT');
      console.log('========================================');
      console.log('Socket ID:', socket.id);
      console.log('Timestamp:', new Date().toISOString());
      
      const token = socket.handshake.auth.token || 
                    socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      console.log('Token Present:', !!token);
      if (token) {
        console.log('Token Preview:', token.substring(0, 20) + '...');
      }
      
      if (!token) {
        console.log('❌ Authentication failed: No token provided');
        console.log('========================================\n');
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ Token decoded successfully');
      console.log('User ID:', decoded._id);
      
      const user = await User.findById(decoded._id).select('-password');
      
      if (!user) {
        console.log('❌ Authentication failed: User not found');
        console.log('User ID:', decoded._id);
        console.log('========================================\n');
        return next(new Error('User not found'));
      }

      // Attach user to socket
      socket.user = user;
      socket.userId = user._id.toString();
      socket.userRole = user.role;
      
      console.log('✅ AUTHENTICATION SUCCESSFUL');
      console.log('User:', user.fullname);
      console.log('Role:', user.role);
      console.log('User ID:', socket.userId);
      console.log('========================================\n');
      next();
    } catch (error) {
      console.log('========================================');
      console.log('❌ SOCKET AUTHENTICATION ERROR');
      console.log('========================================');
      console.log('Error Name:', error.name);
      console.log('Error Message:', error.message);
      console.log('Timestamp:', new Date().toISOString());
      console.log('========================================\n');
      
      // Only log unexpected errors, not authentication failures
      if (error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError') {
        console.error('Unexpected authentication error:', error);
      }
      next(new Error('Authentication failed'));
    }
  });

  // ==================== CONNECTION HANDLER ====================
  io.on('connection', (socket) => {
    console.log('\n========================================');
    console.log('🔌 NEW SOCKET CONNECTION');
    console.log('========================================');
    console.log('Socket ID:', socket.id);
    console.log('User:', socket.user.fullname);
    console.log('Role:', socket.userRole);
    console.log('User ID:', socket.userId);
    console.log('Timestamp:', new Date().toISOString());
    console.log('========================================');

    // Join user to their personal room and role-based room
    const userId = socket.userId;
    const role = socket.userRole;
    const allowedRooms = new Set([userId]);
    socket.data.allowedRooms = allowedRooms;

    // Join personal room
    socket.join(userId);
    console.log(`✅ User joined personal room: ${userId}`);
    
    // Join role-based rooms
    if (role === 'user') {
      // Customer
      socket.join('customer-room');
      console.log(`✅ Customer joined customer-room`);
      
    } else if (role === 'admin' || role === 'superadmin') {
      // Shopkeeper
      socket.join(socket.userId); // Shop-specific room
      Shopkeeper.findOne({ userId })
        .select('_id userId')
        .lean()
        .then((shopkeeper) => {
          if (!shopkeeper?._id) return;

          const shopkeeperRoom = shopkeeper._id.toString();
          allowedRooms.add(shopkeeperRoom);
          socket.join(shopkeeperRoom);
          console.log(`Shopkeeper profile room joined: ${shopkeeperRoom}`);
        })
        .catch((error) => {
          console.error('Failed to join shopkeeper profile room:', error.message);
        });
      console.log(`✅ SHOPKEEPER JOINED ROOM: ${userId}`);
      console.log(`   This shopkeeper will receive orders for shop ID: ${userId}`);
      
    } else if (role === 'deliveryBoy') {
      // Delivery Boy
      socket.join('delivery-room'); // All delivery boys room
      console.log(`✅ Delivery boy joined delivery-room`);
      
      // Mark as online
      markDeliveryBoyOnline(userId);
    }
    
    console.log('========================================\n');

    socket.on('join', async (roomId, ack) => {
      const requestedRoom = roomId?.toString();
      if (!requestedRoom) {
        if (typeof ack === 'function') ack({ success: false, message: 'Room id is required' });
        return;
      }

      if (!socket.data.allowedRooms?.has(requestedRoom)) {
        // Fallback check for shopkeeper race condition
        if (role === 'admin' || role === 'superadmin') {
          try {
            const shopkeeper = await Shopkeeper.findOne({ userId });
            if (shopkeeper && shopkeeper._id.toString() === requestedRoom) {
              socket.data.allowedRooms.add(requestedRoom);
            }
          } catch (error) {
            console.error('Error verifying shopkeeper room:', error);
          }
        }

        if (!socket.data.allowedRooms?.has(requestedRoom)) {
          console.log(`Unauthorized room join attempt by ${userId}: ${requestedRoom}`);
          socket.emit('socket-error', { message: 'Unauthorized socket room' });
          if (typeof ack === 'function') ack({ success: false, message: 'Unauthorized socket room' });
          return;
        }
      }

      // Check if already in the room
      if (socket.rooms.has(requestedRoom)) {
        if (typeof ack === 'function') ack({ success: true, room: requestedRoom });
        return;
      }

      socket.join(requestedRoom);
      console.log(`User ${userId} joined requested room: ${requestedRoom}`);
      if (typeof ack === 'function') ack({ success: true, room: requestedRoom });
    });

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

        // Find online delivery boys
        const DeliveryBoy = require('../models/DeliveryBoy/DeliveryBoy');
        const availableDeliveryBoys = await DeliveryBoy.find({
          isOnline: true,
          isAvailable: true,
          isBlocked: false
        }).limit(10);

        if (availableDeliveryBoys.length > 0) {
          availableDeliveryBoys.forEach(db => {
            if (db.userId) {
              io.to(db.userId.toString()).emit('order-available', {
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
            }
          });
          console.log(`✓ Emitted order-available to ${availableDeliveryBoys.length} delivery boys`);
        } else {
          console.log(`⚠ No online delivery boys found`);
        }

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

        // 🔔 Save persistent notification for shopkeeper (works even if shopkeeper is offline)
        try {
          const notifTitle = `🚴 Delivery Boy Assigned #${order.orderNumber}`;
          const notifBody = `Delivery partner ${deliveryBoy.userId.fullname} (${deliveryBoy.userId.phone}) has been assigned to order #${order.orderNumber}. OTP: ${order.otp}`;

          const savedNotif = await Notification.create({
            userId: order.shopId._id,
            notificationType: 'delivery',
            title: notifTitle,
            body: notifBody,
            dataJson: JSON.stringify({
              orderId: order._id,
              orderNumber: order.orderNumber,
              orderToken: order.orderToken,
              status: 'ASSIGNED',
              deliveryBoyName: deliveryBoy.userId.fullname,
              deliveryBoyPhone: deliveryBoy.userId.phone,
              vehicleType: deliveryBoy.vehicleType,
              otp: order.otp
            }),
            isRead: false
          });

          console.log(`✓ Notification saved for shopkeeper: ${order.shopId._id}`);

          io.to(order.shopId._id.toString()).emit('notification', {
            _id: savedNotif._id,
            notificationType: 'delivery',
            title: notifTitle,
            body: notifBody,
            orderId: order._id,
            orderNumber: order.orderNumber,
            status: 'ASSIGNED',
            deliveryBoyName: deliveryBoy.userId.fullname,
            deliveryBoyPhone: deliveryBoy.userId.phone,
            isRead: false,
            timestamp: new Date()
          });
          console.log(`✓ Emitted notification event to shopkeeper: ${order.shopId._id}`);
        } catch (notifError) {
          console.error(`⚠ Failed to save notification for shopkeeper:`, notifError.message);
        }

        // Notify other delivery boys that order is taken
        cancelDeliveryRequests(io, order._id, order.orderNumber);

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
      console.log('\n========================================');
      console.log('❌ SOCKET DISCONNECTED');
      console.log('========================================');
      console.log('Socket ID:', socket.id);
      console.log('User:', socket.user.fullname);
      console.log('Role:', socket.userRole);
      console.log('Timestamp:', new Date().toISOString());
      console.log('========================================\n');
      
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

// ==================== EXPORTED SOCKET HELPER FUNCTIONS ====================
// These are called from REST API controllers to emit real-time events

/**
 * Emit when a delivery boy is assigned to an order
 * Called from: deliveryOrderManagement.controller.js
 */
function emitDeliveryBoyAssigned(io, customerId, shopId, data) {
  try {
    if (customerId) {
      io.to(customerId.toString()).emit('order-status', {
        type: 'delivery_boy_assigned',
        ...data
      });
    }
    if (shopId) {
      io.to(shopId.toString()).emit('delivery-assigned', data);
    }
    console.log(`✓ Emitted delivery-assigned to customer: ${customerId}, shop: ${shopId}`);
  } catch (error) {
    console.error('Error in emitDeliveryBoyAssigned:', error);
  }
}

/**
 * Emit when order is out for delivery (picked up by delivery boy)
 * Called from: deliveryOrderManagement.controller.js
 */
function emitOrderOutForDelivery(io, customerId, data) {
  try {
    if (customerId) {
      io.to(customerId.toString()).emit('order-status', {
        type: 'out_for_delivery',
        ...data
      });
    }
    console.log(`✓ Emitted out-for-delivery to customer: ${customerId}`);
  } catch (error) {
    console.error('Error in emitOrderOutForDelivery:', error);
  }
}

/**
 * Emit when order is delivered
 * Called from: deliveryOrderManagement.controller.js
 */
function emitOrderDelivered(io, customerId, shopId, data) {
  try {
    if (customerId) {
      io.to(customerId.toString()).emit('order-status', {
        type: 'delivered',
        ...data
      });
    }
    if (shopId) {
      io.to(shopId.toString()).emit('order-delivered', data);
    }
    console.log(`✓ Emitted order-delivered to customer: ${customerId}, shop: ${shopId}`);
  } catch (error) {
    console.error('Error in emitOrderDelivered:', error);
  }
}

/**
 * Emit when order is ready for pickup
 * Called from: shopkeeperOrder.controller.js
 */
function emitOrderReady(io, customerId, deliveryBoyId, data) {
  try {
    if (customerId) {
      io.to(customerId.toString()).emit('order-status', {
        type: 'ready_for_pickup',
        ...data
      });
    }
    if (deliveryBoyId) {
      io.to(deliveryBoyId.toString()).emit('order-ready-for-pickup', data);
    }
    console.log(`✓ Emitted order-ready to customer: ${customerId}`);
  } catch (error) {
    console.error('Error in emitOrderReady:', error);
  }
}

/**
 * Emit when order is cancelled
 * Called from: shopkeeperOrder.controller.js
 */
function emitOrderCancelled(io, customerId, deliveryBoyId, data) {
  try {
    if (customerId) {
      io.to(customerId.toString()).emit('order-status', {
        type: 'cancelled',
        ...data
      });
    }
    if (deliveryBoyId) {
      io.to(deliveryBoyId.toString()).emit('order-cancelled', data);
    }
    console.log(`✓ Emitted order-cancelled to customer: ${customerId}`);
  } catch (error) {
    console.error('Error in emitOrderCancelled:', error);
  }
}

/**
 * Cancel pending delivery requests (when order is assigned)
 * Broadcasts to delivery-room that this order is no longer available
 */
function cancelDeliveryRequests(io, orderId, orderNumber) {
  try {
    io.to('delivery-room').emit('order-taken', {
      orderId,
      orderNumber,
      message: 'This order has been assigned to another delivery partner'
    });
    console.log(`✓ Broadcasted order-taken for order: ${orderId}`);
  } catch (error) {
    console.error('Error in cancelDeliveryRequests:', error);
  }
}

module.exports = { 
  initializeOrderFlowSocket,
  emitDeliveryBoyAssigned,
  emitOrderOutForDelivery,
  emitOrderDelivered,
  emitOrderReady,
  emitOrderCancelled,
  cancelDeliveryRequests
};
