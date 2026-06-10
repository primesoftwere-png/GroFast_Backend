// socket/orderFlowSocket.js
// 🚀 REAL-TIME ORDER FLOW - Complete Socket.IO Implementation

const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Order = require('../models/Customer/Order');
const DeliveryBoy = require('../models/DeliveryBoy/DeliveryBoy');
const DeliveryBoyLocation = require('../models/DeliveryBoy/DeliveryBoyLocation');
const Shopkeeper = require('../models/ShopKeeper/Shopkeeper');
const Shop = require('../models/ShopKeeper/Shop');

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

        console.log(`✓ Order ${orderId} status: PENDING → CONFIRMED`);

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
 * Calculate distance between two coordinates in kilometers
 */
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // Distance in km
}

module.exports = { initializeOrderFlowSocket };
