// socket/orderFlowSocket.js
// 🚀 REAL-TIME ORDER FLOW - Complete Socket.IO Implementation

const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Order = require('../models/Customer/Order');
const Shopkeeper = require('../models/ShopKeeper/Shopkeeper');
const DeliveryBoy = require('../models/DeliveryBoy/DeliveryBoy');
const DeliveryBoyLocation = require('../models/DeliveryBoy/DeliveryBoyLocation');
const Shop = require('../models/ShopKeeper/Shop');
const Notification = require('../models/Customer/Notification');
const DeliveryBoyNotification = require('../models/DeliveryBoy/DeliveryBoyNotification');

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

    // ==================== TRACKING EVENTS ====================
    
    /**
     * Customer joins a specific order tracking room
     */
    socket.on('join-tracking', async (orderToken, ack) => {
      try {
        console.log(`\n🔍 JOIN TRACKING ROOM: ${orderToken}`);
        if (!orderToken) {
          if (typeof ack === 'function') ack({ success: false, message: 'Order token required' });
          return;
        }

        const roomName = `tracking_${orderToken}`;
        socket.join(roomName);
        console.log(`✅ User ${socket.userId} joined tracking room: ${roomName}`);
        
        // Fetch current order status and delivery boy location
        const order = await Order.findOne({ orderToken })
          .populate('deliveryBoyId'); // references User profile usually

        if (order) {
          // Emit initial status
          socket.emit('tracking-status', {
            orderId: order._id,
            orderToken: order.orderToken,
            orderNumber: order.orderNumber,
            status: order.orderStatus
          });

          // Fetch location if assigned
          if (order.deliveryBoyId) {
            const dbUserId = order.deliveryBoyId._id || order.deliveryBoyId;
            const loc = await DeliveryBoyLocation.findOne({ deliveryBoyId: dbUserId });
            if (loc) {
              socket.emit('live-location', {
                orderId: order._id,
                orderToken: order.orderToken,
                orderNumber: order.orderNumber,
                lat: loc.latitude,
                lng: loc.longitude,
                heading: loc.heading,
                speed: loc.speed,
                timestamp: loc.updatedAt
              });
            }
          }
        }

        if (typeof ack === 'function') ack({ success: true, room: roomName });
      } catch (error) {
        console.error('Error joining tracking room:', error);
        if (typeof ack === 'function') ack({ success: false, message: 'Server error' });
      }
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

        // Update order status and perfectly generate OTP
        const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit perfectly generated OTP
        order.orderStatus = 'CONFIRMED';
        order.acceptedAt = new Date();
        
        // Save both OTP formats for perfect backward/forward compatibility
        order.otp = generatedOTP;
        order.pickupOTP = {
          code: generatedOTP,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          verified: false
        };
        
        await order.save();

        console.log(`✓ Order ${orderId} status: PENDING → SHOP_ACCEPTED`);

        // Get shop location perfectly
        let shopLat = 0, shopLng = 0;
        const shopkeeperProfile = await Shopkeeper.findOne({ userId: order.shopId._id });
        if (shopkeeperProfile) {
          const shopProfile = await Shop.findOne({ shopkeeperId: shopkeeperProfile._id });
          if (shopProfile && shopProfile.location && shopProfile.location.coordinates) {
            shopLng = shopProfile.location.coordinates[0];
            shopLat = shopProfile.location.coordinates[1];
          }
        }

        // Find available delivery boys
        const availableBoys = await DeliveryBoy.find({
          isOnline: true,
          isAvailable: true,
          isBlocked: false
        });

        const maxDistanceKm = 5; // 5 kilometers radius
        let notifiedCount = 0;

        for (const boy of availableBoys) {
          // Get their latest location from database
          const loc = await DeliveryBoyLocation.findOne({ deliveryBoyId: boy.userId });
          if (loc && loc.latitude && loc.longitude && shopLat && shopLng) {
            const distance = getDistanceFromLatLonInKm(shopLat, shopLng, loc.latitude, loc.longitude);
            if (distance <= maxDistanceKm) {
              // Emit ONLY to this nearest delivery boy
              io.to(boy.userId.toString()).emit('order-available', {
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
                distance: distance.toFixed(1) + ' km',
                createdAt: order.createdAt
              });
              notifiedCount++;
            }
          }
        }

        // Fallback: If no nearby boys found within radius, broadcast to all available boys
        if (notifiedCount === 0) {
          console.log(`⚠ No nearby delivery boys found within ${maxDistanceKm}km. Broadcasting to all.`);
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
        }

        console.log(`✓ Emitted order-available to ${notifiedCount > 0 ? notifiedCount + ' nearest delivery boys' : 'all delivery boys (fallback)'}`);

        // Notify customer
        io.to(order.customerId._id.toString()).emit('order-status', {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: 'SHOP_ACCEPTED',
          message: 'Your order has been confirmed by the shop',
          timestamp: new Date()
        });

        // Notify tracking room
        io.to(`tracking_${order.orderToken}`).emit('order-status', {
          orderId: order._id,
          orderToken: order.orderToken,
          orderNumber: order.orderNumber,
          status: 'SHOP_ACCEPTED',
          message: 'Your order has been confirmed by the shop',
          timestamp: new Date()
        });

        console.log(`✓ Notified customer: ${order.customerId._id}`);

        // Confirm to shopkeeper
        socket.emit('order-accept-success', {
          orderId: order._id,
          status: 'SHOP_ACCEPTED',
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
        const validStatuses = ['CONFIRMED', 'ACCEPTED', 'READY_FOR_PICKUP', 'SHOP_ACCEPTED'];
        if (!validStatuses.includes(order.orderStatus)) {
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
            orderStatus: { $in: ['CONFIRMED', 'ACCEPTED', 'READY_FOR_PICKUP', 'SHOP_ACCEPTED'] }
          },
          {
            deliveryBoyId: dbId,
            orderStatus: 'ASSIGNED_TO_DELIVERY',
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
          orderNumber: order.orderNumber,
          status: 'ASSIGNED_TO_DELIVERY',
          message: 'Delivery partner assigned',
          deliveryBoy: {
            name: deliveryBoy.userId.fullname,
            phone: deliveryBoy.userId.phone,
            vehicleType: deliveryBoy.vehicleType
          },
          timestamp: new Date()
        });

        // Notify tracking room
        io.to(`tracking_${order.orderToken}`).emit('order-status', {
          orderId: order._id,
          orderToken: order.orderToken,
          orderNumber: order.orderNumber,
          status: 'ASSIGNED_TO_DELIVERY',
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
          status: 'ASSIGNED_TO_DELIVERY',
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
              status: 'ASSIGNED_TO_DELIVERY',
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
            status: 'ASSIGNED_TO_DELIVERY',
            deliveryBoyName: deliveryBoy.userId.fullname,
            deliveryBoyPhone: deliveryBoy.userId.phone,
            isRead: false,
            timestamp: new Date()
          });
          console.log(`✓ Emitted notification event to shopkeeper: ${order.shopId._id}`);
          
          // 🔔 Save persistent notification for delivery boy
          const dbNotifTitle = `✅ Order Assigned #${order.orderNumber}`;
          const dbNotifBody = `You have successfully accepted order #${order.orderNumber}. Please proceed to the shop for pickup.`;

          const savedDbNotif = await DeliveryBoyNotification.create({
            deliveryBoyId: deliveryBoy.userId._id,
            orderId: order._id,
            title: dbNotifTitle,
            message: dbNotifBody,
            type: 'order_assigned',
            priority: 'high'
          });

          io.to(deliveryBoy.userId._id.toString()).emit('notification', {
            _id: savedDbNotif._id,
            notificationType: 'delivery',
            title: dbNotifTitle,
            body: dbNotifBody,
            orderId: order._id,
            orderNumber: order.orderNumber,
            status: 'ASSIGNED_TO_DELIVERY',
            isRead: false,
            timestamp: new Date()
          });
          console.log(`✓ Notification saved for delivery boy: ${deliveryBoy.userId._id}`);

        } catch (notifError) {
          console.error(`⚠ Failed to save notifications:`, notifError.message);
        }

        // Notify other delivery boys that order is taken
        cancelDeliveryRequests(io, { orderId: order._id, orderNumber: order.orderNumber, reason: 'Order taken by another delivery partner' });

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
            $set: {
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
            $push: {
              locationHistory: {
                latitude: latitude,
                longitude: longitude,
                speed: speed ? parseFloat(speed) : null,
                heading: heading ? parseFloat(heading) : null,
                timestamp: new Date()
              }
            }
          },
          { upsert: true, new: true }
        );

        // Get order to find customer
        const order = await Order.findById(orderId);
        if (order && order.customerId) {
          // Emit live location to customer
          io.to(order.customerId.toString()).emit('live-location', {
            orderId: orderId,
            orderNumber: order.orderNumber,
            lat: latitude,
            lng: longitude,
            speed: speed,
            heading: heading,
            accuracy: accuracy,
            timestamp: new Date()
          });

          // Emit to tracking room
          io.to(`tracking_${order.orderToken}`).emit('live-location', {
            orderId: orderId,
            orderToken: order.orderToken,
            orderNumber: order.orderNumber,
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
      console.log(`❌ Socket disconnected: ${socket.id} (${socket.user?.fullname || 'Unknown'})`);
      
      // Mark delivery boy as offline
      if (role === 'deliveryBoy') {
        await markDeliveryBoyOffline(userId);
      }
    });

  });

  // Store io instance globally for use in API routes
  global.io = io;

  // ==================== BACKGROUND POLLING FOR TRACKING ROOMS ====================
  // Every 10 seconds, broadcast latest location and status to all active tracking rooms
  setInterval(async () => {
    try {
      if (!io || !io.sockets || !io.sockets.adapter || !io.sockets.adapter.rooms) return;
      
      const rooms = io.sockets.adapter.rooms;
      for (const [roomName, clients] of rooms.entries()) {
        if (roomName.startsWith('tracking_') && clients.size > 0) {
          const orderToken = roomName.replace('tracking_', '');
          
          const order = await Order.findOne({ orderToken }).populate('deliveryBoyId');
          if (order) {
            // Emit latest status to this active room
            io.to(roomName).emit('tracking-status', {
              orderId: order._id,
              orderToken: order.orderToken,
              orderNumber: order.orderNumber,
              status: order.orderStatus
            });

            // Fetch and emit latest location if delivery boy is assigned
            if (order.deliveryBoyId) {
              const dbUserId = order.deliveryBoyId._id || order.deliveryBoyId;
              const loc = await DeliveryBoyLocation.findOne({ deliveryBoyId: dbUserId });
              if (loc) {
                io.to(roomName).emit('live-location', {
                  orderId: order._id,
                  orderToken: order.orderToken,
                  orderNumber: order.orderNumber,
                  lat: loc.latitude,
                  lng: loc.longitude,
                  heading: loc.heading,
                  speed: loc.speed,
                  timestamp: loc.updatedAt
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in 10-second tracking interval:', error.message);
    }
  }, 10000);
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate distance between two coordinates in km using Haversine formula
 */
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI/180); 
  const dLon = (lon2 - lon1) * (Math.PI/180); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // Distance in km
}

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
    if (data && data.orderToken) {
      io.to(`tracking_${data.orderToken}`).emit('order-status', data);
    }
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
    if (data && data.orderToken) {
      const trackingData = { ...data };
      if (trackingData.orderStatus) trackingData.orderStatus = 'CONFIRMED';
      if (trackingData.status) trackingData.status = 'CONFIRMED';
      io.to(`tracking_${data.orderToken}`).emit('order-status', trackingData);
    }
  }
}

/**
 * Emit order cancelled to customer and delivery boy
 */
function emitOrderCancelled(io, customerId, deliveryBoyId, data) {
  if (io) {
    if (customerId) io.to(customerId.toString()).emit('order-status', data);
    if (deliveryBoyId) io.to(deliveryBoyId.toString()).emit('order-cancelled', data);
    if (data && data.orderToken) {
      io.to(`tracking_${data.orderToken}`).emit('order-status', data);
    }
  }
}

/**
 * Emit delivery boy assigned to customer and shopkeeper
 */
function emitDeliveryBoyAssigned(io, customerId, shopId, data) {
  if (io) {
    if (customerId) io.to(customerId.toString()).emit('delivery-assigned', data);
    if (shopId) io.to(shopId.toString()).emit('delivery-assigned', data);
    if (data && data.orderToken) {
      const trackingData = { ...data };
      if (trackingData.orderStatus) trackingData.orderStatus = 'CONFIRMED';
      if (trackingData.status) trackingData.status = 'CONFIRMED';
      io.to(`tracking_${data.orderToken}`).emit('delivery-assigned', trackingData);
      io.to(`tracking_${data.orderToken}`).emit('order-status', trackingData);
    }
  }
}

/**
 * Emit order out for delivery to customer
 */
function emitOrderOutForDelivery(io, customerId, data) {
  if (io && customerId) {
    io.to(customerId.toString()).emit('order-out-for-delivery', data);
    if (data && data.orderToken) {
      io.to(`tracking_${data.orderToken}`).emit('order-out-for-delivery', data);
      io.to(`tracking_${data.orderToken}`).emit('order-status', data);
    }
  }
}

/**
 * Emit order delivered to customer and shopkeeper
 */
function emitOrderDelivered(io, customerId, shopId, data) {
  if (io) {
    if (customerId) io.to(customerId.toString()).emit('order-delivered', data);
    if (shopId) io.to(shopId.toString()).emit('order-delivered', data);
    if (data && data.orderToken) {
      io.to(`tracking_${data.orderToken}`).emit('order-delivered', data);
      io.to(`tracking_${data.orderToken}`).emit('order-status', data);
    }
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
