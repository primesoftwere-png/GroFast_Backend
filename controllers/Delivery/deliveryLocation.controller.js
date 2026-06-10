// controllers/Delivery/deliveryLocation.controller.js
const DeliveryBoy = require("../../models/DeliveryBoy/DeliveryBoy");
const DeliveryBoyLocation = require("../../models/DeliveryBoy/DeliveryBoyLocation");

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

    // Update or create location record
    let location = await DeliveryBoyLocation.findOne({ deliveryBoyId });

    const locationData = {
      deliveryBoyId: deliveryBoyId,
      orderId: deliveryBoy.activeOrderId || null,
      latitude: lat,
      longitude: lng,
      accuracy: accuracy ? parseFloat(accuracy) : null,
      speed: speed ? parseFloat(speed) : null,
      heading: heading ? parseFloat(heading) : null,
      isActive: deliveryBoy.activeOrderId ? true : false,
      updatedAt: Date.now()
    };

    const historyEntry = {
      latitude: lat,
      longitude: lng,
      speed: speed ? parseFloat(speed) : null,
      heading: heading ? parseFloat(heading) : null,
      timestamp: Date.now()
    };

    if (location) {
      // Update existing location
      location = await DeliveryBoyLocation.findOneAndUpdate(
        { deliveryBoyId },
        { 
          $set: locationData,
          $push: { locationHistory: historyEntry }
        },
        { new: true }
      );
    } else {
      // Create new location record
      location = await DeliveryBoyLocation.create({
        ...locationData,
        locationHistory: [historyEntry]
      });
    }

    return res.status(200).json({
      success: true,
      message: "Location updated successfully",
      data: {
        latitude: location.latitude,
        longitude: location.longitude,
        updatedAt: location.updatedAt
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

    const location = await DeliveryBoyLocation.findOne({ deliveryBoyId });

    if (!location) {
      return res.status(404).json({
        success: false,
        message: "Location not found. Please update your location first."
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
