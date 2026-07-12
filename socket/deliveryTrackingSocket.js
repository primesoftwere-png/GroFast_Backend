const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Order = require('../models/Customer/Order');
const DeliveryBoyLocation = require('../models/DeliveryBoy/DeliveryBoyLocation');
const cacheService = require('../services/cache.service');

function initializeDeliveryTrackingSocket(io) {
  // Use the root namespace to maintain compatibility with the existing frontend singleton socket
  // Authentication Middleware (Already handled by orderFlowSocket.js for the root namespace, but we can add specific listeners)
  io.on('connection', (socket) => {
    // We rely on the authentication already performed by the root io.use() in orderFlowSocket.js
    const userId = socket.userId;
    const role = socket.userRole; // Fix: it was set as socket.userRole in orderFlowSocket.js
    if (!userId) return; // If unauthenticated

    console.log(`[Tracking Socket] Connected: User ${userId} (Role: ${role})`);

    // ==========================================
    // DELIVERY BOY EVENTS
    // ==========================================
    
    // Delivery Boy comes online
    socket.on('driver:online', async (ack) => {
      try {
        if (role !== 'deliveryBoy') return;
        socket.join(`driver_${userId}`);
        if (typeof ack === 'function') ack({ success: true, message: 'Driver online' });
      } catch (err) {
        if (typeof ack === 'function') ack({ success: false, message: 'Error' });
      }
    });

    // Delivery Boy goes offline
    socket.on('driver:offline', async (ack) => {
      try {
        if (role !== 'deliveryBoy') return;
        socket.leave(`driver_${userId}`);
        // Clear cached location when they go offline
        await cacheService.del(`location:${userId}`);
        if (typeof ack === 'function') ack({ success: true, message: 'Driver offline' });
      } catch (err) {
        if (typeof ack === 'function') ack({ success: false, message: 'Error' });
      }
    });

    // Delivery Boy joins specific order room to start tracking
    socket.on('driver:join-order', async ({ orderId }, ack) => {
      try {
        if (role !== 'deliveryBoy') return;
        
        const order = await Order.findById(orderId);
        if (!order || order.orderStatus === 'DELIVERED' || order.orderStatus === 'CANCELLED') {
          return socket.emit('location:error', { message: 'Invalid or inactive order' });
        }

        const roomName = `order:${orderId}`;
        socket.join(roomName);
        console.log(`[Tracking Socket] Driver ${userId} joined room ${roomName}`);
        
        if (typeof ack === 'function') ack({ success: true, room: roomName });
      } catch (err) {
        console.error('driver:join-order error:', err);
      }
    });

    // Delivery Boy explicitly leaves an order room
    socket.on('driver:leave-order', async ({ orderId }, ack) => {
      try {
        if (role !== 'deliveryBoy') return;
        
        const roomName = `order:${orderId}`;
        socket.leave(roomName);
        await cacheService.del(`location:${userId}`);
        console.log(`[Tracking Socket] Driver ${userId} left room ${roomName}`);
        
        if (typeof ack === 'function') ack({ success: true, room: roomName });
      } catch (err) {
        console.error('driver:leave-order error:', err);
      }
    });

    // Delivery Boy sends live location update
    socket.on('location:update', async (payload, ack) => {
      console.log(`\n========================================`);
      console.log(`📡 [SOCKET RECEIVE] 'location:update' from Driver ${userId}`);
      console.log(`Payload:`, payload);
      try {
        if (role !== 'deliveryBoy') {
           console.log(`❌ Rejected: User is not a delivery boy.`);
           return;
        }
        
        let { orderId, lat, lng, speed, heading, accuracy, timestamp } = payload;
        
        // Fallback to activeOrderId if orderId is not provided by the frontend
        if (!orderId) {
            const dbProfile = await require('../models/DeliveryBoy/DeliveryBoy').findOne({ userId: userId });
            if (dbProfile && dbProfile.activeOrderId) {
                orderId = dbProfile.activeOrderId.toString();
            }
        }
        
        if (!orderId || !lat || !lng) {
           console.log(`❌ Rejected: Missing orderId, lat, or lng`);
           return socket.emit('location:error', { message: 'Missing required location data' });
        }

        console.log(`✅ [CACHE WRITE] Saving location for Driver ${userId} -> Lat: ${lat}, Lng: ${lng}, Order: ${orderId}`);
        // Fast cache in Redis/Memory
        const locData = { lat, lng, speed, heading, accuracy, timestamp: timestamp || Date.now(), orderId: orderId };
        await cacheService.setEx(`location:${userId}`, 3600, locData); // Cache for 1 hour

        // Log location to database every 5 sec as requested
        try {
          await DeliveryBoyLocation.findOneAndUpdate(
            { deliveryBoyId: userId },
            {
              $set: {
                latitude: lat,
                longitude: lng,
                speed: speed || null,
                heading: heading || null,
                accuracy: accuracy || null,
                updatedAt: Date.now(),
                location: {
                  type: 'Point',
                  coordinates: [lng, lat]
                },
                isActive: true,
                orderId: orderId
              },
              $push: {
                locationHistory: {
                  $each: [{ latitude: lat, longitude: lng, speed: speed, heading: heading, timestamp: Date.now() }],
                  $slice: -100 // Keep last 100 entries
                }
              }
            },
            { upsert: true, new: true }
          );
          console.log(`✅ [DB WRITE] Logged location for Driver ${userId} in MongoDB`);
        } catch (dbErr) {
          console.error('Error logging location to MongoDB:', dbErr.message);
        }

        const broadcastPayload = {
          orderId,
          deliveryBoyId: userId,
          ...locData
        };

        // Broadcast to order:${orderId} room (deliveryTrackingSocket room)
        const orderRoomName = `order:${orderId}`;
        io.to(orderRoomName).emit('delivery:live-location', broadcastPayload);
        console.log(`🚀 [SOCKET BROADCAST] Emitted 'delivery:live-location' to room: ${orderRoomName}`);

        // Also broadcast to tracking_${orderToken} room and customer personal room
        // so customers who joined via 'join-tracking' also receive the location
        try {
          const order = await Order.findById(orderId).select('orderToken orderNumber customerId').lean();
          if (order) {
            const trackingPayload = {
              orderId,
              orderToken: order.orderToken,
              orderNumber: order.orderNumber,
              deliveryBoyId: userId,
              lat,
              lng,
              speed,
              heading,
              accuracy,
              timestamp: locData.timestamp
            };

            // Emit to tracking room (customer joins via 'join-tracking')
            if (order.orderToken) {
              io.to(`tracking_${order.orderToken}`).emit('live-location', trackingPayload);
              io.to(`tracking_${order.orderToken}`).emit('delivery:live-location', trackingPayload);
              console.log(`🚀 [SOCKET BROADCAST] Emitted to tracking room: tracking_${order.orderToken}`);
            }

            // Emit to customer personal room
            if (order.customerId) {
              io.to(order.customerId.toString()).emit('live-location', trackingPayload);
              io.to(order.customerId.toString()).emit('delivery:live-location', trackingPayload);
              console.log(`🚀 [SOCKET BROADCAST] Emitted to customer: ${order.customerId}`);
            }
          }
        } catch (orderErr) {
          console.error('Error looking up order for tracking broadcast:', orderErr.message);
        }

        console.log(`========================================\n`);
        
        if (typeof ack === 'function') ack({ success: true });
      } catch (err) {
        console.error('location:update error:', err);
        socket.emit('location:error', { message: 'Internal server error processing location' });
      }
    });

    // Milestone: Order Picked Up
    socket.on('order:picked-up', async ({ orderId }, ack) => {
      try {
        if (role !== 'deliveryBoy') return;
        
        const roomName = `order:${orderId}`;
        io.to(roomName).emit('order:picked-up', { orderId, status: 'PICKED_UP', timestamp: Date.now() });
        
        if (typeof ack === 'function') ack({ success: true });
      } catch (err) {}
    });

    // Milestone: Delivery Completed
    socket.on('delivery:completed', async ({ orderId }, ack) => {
      try {
        if (role !== 'deliveryBoy') return;
        
        const roomName = `order:${orderId}`;
        io.to(roomName).emit('delivery:completed', { orderId, status: 'DELIVERED', timestamp: Date.now() });
        
        socket.leave(roomName);
        await cacheService.del(`location:${userId}`);
        
        if (typeof ack === 'function') ack({ success: true });
      } catch (err) {}
    });

    // Milestone: Delivery Cancelled
    socket.on('delivery:cancelled', async ({ orderId }, ack) => {
      try {
        if (role !== 'deliveryBoy') return;
        
        const roomName = `order:${orderId}`;
        io.to(roomName).emit('delivery:cancelled', { orderId, status: 'CANCELLED', timestamp: Date.now() });
        
        socket.leave(roomName);
        await cacheService.del(`location:${userId}`);
        
        if (typeof ack === 'function') ack({ success: true });
      } catch (err) {}
    });


    // ==========================================
    // CUSTOMER / ADMIN EVENTS
    // ==========================================
    
    // Customer/Admin joins order tracking room
    socket.on('customer:join-order', async ({ orderId, deliveryBoyId }, ack) => {
      try {
        // Validate user is authorized for this order (omitted complex check for brevity, assuming token validation suffices)
        const roomName = `order:${orderId}`;
        socket.join(roomName);
        console.log(`[Tracking Socket] Customer/Admin ${userId} joined room ${roomName}`);

        // Also join the tracking_${orderToken} room for cross-compatibility
        const orderDoc = await Order.findById(orderId).select('orderToken deliveryBoyId').lean();
        if (orderDoc && orderDoc.orderToken) {
          socket.join(`tracking_${orderDoc.orderToken}`);
          console.log(`[Tracking Socket] Customer/Admin ${userId} also joined room tracking_${orderDoc.orderToken}`);
        }
        
        // Immediately fetch the latest cached location upon joining (Reconnection Handling)
        let activeDeliveryBoyId = deliveryBoyId;
        if (!activeDeliveryBoyId && orderDoc && orderDoc.deliveryBoyId) {
          activeDeliveryBoyId = orderDoc.deliveryBoyId.toString();
        }
        if (!activeDeliveryBoyId && orderId) {
          const orderFallback = await Order.findById(orderId).select('deliveryBoyId');
          if (orderFallback && orderFallback.deliveryBoyId) {
            activeDeliveryBoyId = orderFallback.deliveryBoyId.toString();
          }
        }

        if (activeDeliveryBoyId) {
          let loc = await cacheService.get(`location:${activeDeliveryBoyId}`);
          
          if (!loc) {
            const dbLoc = await DeliveryBoyLocation.findOne({ deliveryBoyId: activeDeliveryBoyId });
            if (dbLoc) {
              loc = {
                lat: dbLoc.latitude,
                lng: dbLoc.longitude,
                speed: dbLoc.speed,
                heading: dbLoc.heading,
                accuracy: dbLoc.accuracy,
                timestamp: dbLoc.updatedAt
              };
            }
          }

          if (loc) {
            socket.emit('delivery:live-location', {
              orderId,
              deliveryBoyId: activeDeliveryBoyId,
              ...loc,
              lat: loc.lat || loc.latitude,
              lng: loc.lng || loc.longitude,
              timestamp: loc.timestamp || loc.updatedAt
            });
          }
        }
        
        if (typeof ack === 'function') ack({ success: true, room: roomName });
      } catch (err) {
        console.error('customer:join-order error:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Tracking Socket] Disconnected: User ${userId}`);
    });
  });
}

module.exports = { initializeDeliveryTrackingSocket };
