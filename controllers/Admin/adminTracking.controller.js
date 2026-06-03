// controllers/Admin/adminTracking.controller.js
// 🗺️ ADMIN LIVE TRACKING APIs

const Order = require('../../models/Customer/Order');
const DeliveryBoyLocation = require('../../models/DeliveryBoy/DeliveryBoyLocation');
const DeliveryBoy = require('../../models/DeliveryBoy/DeliveryBoy');

/**
 * GET /api/admin/tracking/live-orders
 * Get all live orders with delivery boy locations
 */
module.exports.getLiveOrdersTracking = async (req, res) => {
  try {
    const liveOrders = await Order.find({
      orderStatus: { $in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] },
      deliveryBoyId: { $ne: null }
    })
      .populate('customerId', 'fullname phone')
      .populate('shopId', 'fullname phone roleDetails.admin.shopName address')
      .populate('deliveryBoyId', 'fullname phone')
      .populate('deliveryAddressId')
      .lean();

    // Get delivery boy locations
    const deliveryBoyIds = liveOrders.map(order => order.deliveryBoyId?._id).filter(Boolean);
    
    const locations = await DeliveryBoyLocation.find({
      deliveryBoyId: { $in: deliveryBoyIds },
      isActive: true
    });

    // Map locations to orders
    const ordersWithLocation = liveOrders.map(order => {
      const location = locations.find(
        loc => loc.deliveryBoyId.toString() === order.deliveryBoyId?._id.toString()
      );

      return {
        ...order,
        deliveryBoyLocation: location ? {
          lat: location.latitude,
          lng: location.longitude,
          speed: location.speed,
          heading: location.heading,
          accuracy: location.accuracy,
          updatedAt: location.updatedAt
        } : null
      };
    });

    res.json({
      success: true,
      count: ordersWithLocation.length,
      data: ordersWithLocation
    });

  } catch (error) {
    console.error('Error fetching live orders tracking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch live orders tracking',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/tracking/order/:orderId
 * Get specific order tracking details
 */
module.exports.getOrderTracking = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('customerId', 'fullname phone email')
      .populate('shopId', 'fullname phone roleDetails.admin.shopName address')
      .populate('deliveryBoyId', 'fullname phone')
      .populate('deliveryAddressId');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    let deliveryBoyLocation = null;
    if (order.deliveryBoyId) {
      const location = await DeliveryBoyLocation.findOne({
        deliveryBoyId: order.deliveryBoyId._id,
        isActive: true
      });

      if (location) {
        deliveryBoyLocation = {
          lat: location.latitude,
          lng: location.longitude,
          speed: location.speed,
          heading: location.heading,
          accuracy: location.accuracy,
          updatedAt: location.updatedAt
        };
      }
    }

    res.json({
      success: true,
      data: {
        order: order,
        deliveryBoyLocation: deliveryBoyLocation
      }
    });

  } catch (error) {
    console.error('Error fetching order tracking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order tracking',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/tracking/delivery-boys
 * Get all active delivery boys with their current locations
 */
module.exports.getAllDeliveryBoyLocations = async (req, res) => {
  try {
    const activeDeliveryBoys = await DeliveryBoy.find({ isOnline: true })
      .populate('userId', 'fullname phone email')
      .populate('activeOrderId', 'orderNumber orderStatus')
      .lean();

    const deliveryBoyIds = activeDeliveryBoys.map(db => db.userId._id);

    const locations = await DeliveryBoyLocation.find({
      deliveryBoyId: { $in: deliveryBoyIds },
      isActive: true
    });

    const deliveryBoysWithLocation = activeDeliveryBoys.map(db => {
      const location = locations.find(
        loc => loc.deliveryBoyId.toString() === db.userId._id.toString()
      );

      return {
        ...db,
        location: location ? {
          lat: location.latitude,
          lng: location.longitude,
          speed: location.speed,
          heading: location.heading,
          accuracy: location.accuracy,
          updatedAt: location.updatedAt
        } : null
      };
    });

    res.json({
      success: true,
      count: deliveryBoysWithLocation.length,
      data: deliveryBoysWithLocation
    });

  } catch (error) {
    console.error('Error fetching delivery boy locations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch delivery boy locations',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/tracking/route/:orderId
 * Get route information for an order
 */
module.exports.getOrderRoute = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('shopId', 'address roleDetails.admin.shopName')
      .populate('deliveryAddressId');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Get delivery boy current location
    let currentLocation = null;
    if (order.deliveryBoyId) {
      const location = await DeliveryBoyLocation.findOne({
        deliveryBoyId: order.deliveryBoyId,
        isActive: true
      });

      if (location) {
        currentLocation = {
          lat: location.latitude,
          lng: location.longitude
        };
      }
    }

    const routeData = {
      shopLocation: {
        address: order.shopId?.address,
        shopName: order.shopId?.roleDetails?.admin?.shopName
      },
      deliveryLocation: {
        address: order.deliveryAddressId?.addressLine1,
        city: order.deliveryAddressId?.city,
        lat: order.deliveryAddressId?.latitude,
        lng: order.deliveryAddressId?.longitude
      },
      currentLocation: currentLocation,
      orderStatus: order.orderStatus
    };

    res.json({
      success: true,
      data: routeData
    });

  } catch (error) {
    console.error('Error fetching order route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order route',
      error: error.message
    });
  }
};
