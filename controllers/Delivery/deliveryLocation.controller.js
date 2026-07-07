// controllers/Delivery/deliveryLocation.controller.js
const DeliveryBoy = require("../../models/DeliveryBoy/DeliveryBoy");
const cacheService = require("../../services/cache.service");

// ✅ Update Current Location
module.exports.updateLocation = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const { latitude, longitude, accuracy, speed, heading } = req.body;

    // Validation
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required"
      });
    }

    // Validate coordinates
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({
        success: false,
        message: "Invalid latitude value (must be between -90 and 90)"
      });
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        message: "Invalid longitude value (must be between -180 and 180)"
      });
    }

    // Get delivery boy
    const deliveryBoy = await DeliveryBoy.findOne({ userId: deliveryBoyId });
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy profile not found"
      });
    }

    // Check if delivery boy is online
    if (!deliveryBoy.isOnline) {
      return res.status(403).json({
        success: false,
        message: "Location updates are only allowed when online"
      });
    }

    const locationData = {
      deliveryBoyId: deliveryBoyId,
      orderId: deliveryBoy.activeOrderId || null,
      latitude: lat,
      longitude: lng,
      location: { type: 'Point', coordinates: [lng, lat] },
      accuracy: accuracy ? parseFloat(accuracy) : null,
      speed: speed ? parseFloat(speed) : null,
      heading: heading ? parseFloat(heading) : null,
      isActive: deliveryBoy.activeOrderId ? true : false,
      updatedAt: Date.now()
    };

    // Cache the location in Redis (or in-memory fallback) for 1 hour
    await cacheService.setEx(`location:${deliveryBoyId}`, 3600, locationData);

    // Also broadcast over socket if possible, though usually the mobile app will emit location:update socket event directly.
    const io = req.app.get('io');
    if (io && deliveryBoy.activeOrderId) {
      const broadcastPayload = {
        orderId: deliveryBoy.activeOrderId.toString(),
        deliveryBoyId: deliveryBoyId.toString(),
        lat: lat,
        lng: lng,
        speed: speed ? parseFloat(speed) : null,
        heading: heading ? parseFloat(heading) : null,
        accuracy: accuracy ? parseFloat(accuracy) : null,
        timestamp: locationData.updatedAt
      };

      // Broadcast to order:${orderId} room
      io.to(`order:${deliveryBoy.activeOrderId}`).emit('delivery:live-location', broadcastPayload);

      // Also broadcast to tracking room and customer personal room
      try {
        const Order = require('../../models/Customer/Order');
        const order = await Order.findById(deliveryBoy.activeOrderId).select('orderToken orderNumber customerId').lean();
        if (order) {
          const trackingPayload = { ...broadcastPayload, orderToken: order.orderToken, orderNumber: order.orderNumber };
          if (order.orderToken) {
            io.to(`tracking_${order.orderToken}`).emit('live-location', trackingPayload);
            io.to(`tracking_${order.orderToken}`).emit('delivery:live-location', trackingPayload);
          }
          if (order.customerId) {
            io.to(order.customerId.toString()).emit('live-location', trackingPayload);
            io.to(order.customerId.toString()).emit('delivery:live-location', trackingPayload);
          }
        }
      } catch (orderErr) {
        console.error('Error broadcasting to tracking rooms:', orderErr.message);
      }
    }
    return res.status(200).json({
      success: true,
      message: "Location updated successfully",
      data: {
        latitude: lat,
        longitude: lng,
        updatedAt: locationData.updatedAt
      }
    });

  } catch (error) {
    console.error("Update location error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Get Current Location
module.exports.getCurrentLocation = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;

    const location = await cacheService.get(`location:${deliveryBoyId}`);

    if (!location) {
      return res.status(404).json({
        success: false,
        message: "Location not found in cache. Please update your location first."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Location retrieved successfully",
      data: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        speed: location.speed,
        heading: location.heading,
        isActive: location.isActive,
        orderId: location.orderId,
        updatedAt: location.updatedAt
      }
    });

  } catch (error) {
    console.error("Get current location error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};
