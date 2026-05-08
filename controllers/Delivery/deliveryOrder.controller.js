// controllers/Delivery/deliveryOrder.controller.js
const Order = require("../../models/Customer/Order");
const OrderItem = require("../../models/Customer/OrderItem");
const DeliveryBoy = require("../../models/DeliveryBoy/DeliveryBoy");
const DeliveryBoyWallet = require("../../models/DeliveryBoy/DeliveryBoyWallet");
const DeliveryBoyLocation = require("../../models/DeliveryBoy/DeliveryBoyLocation");
const DeliveryBoyNotification = require("../../models/DeliveryBoy/DeliveryBoyNotification");
const WalletTransaction = require("../../models/DeliveryBoy/WalletTransaction");

// ✅ Get Available Orders (Nearby, Filtered by Distance)
module.exports.getAvailableOrders = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const { latitude, longitude, radius = 10 } = req.query; // radius in km

    // Get delivery boy
    const deliveryBoy = await DeliveryBoy.findOne({ userId: deliveryBoyId });
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy profile not found"
      });
    }

    // Check if online and available
    if (!deliveryBoy.isOnline) {
      return res.status(403).json({
        success: false,
        message: "You must be online to view available orders"
      });
    }

    if (!deliveryBoy.isAvailable) {
      return res.status(403).json({
        success: false,
        message: "You are currently unavailable. Complete your active order first."
      });
    }

    // Build query for available orders
    const query = {
      orderStatus: 'confirmed',
      deliveryBoyId: null // Not yet assigned
    };

    // Get orders
    let orders = await Order.find(query)
      .populate('customerId', 'fullname phone')
      .populate('shopId', 'fullname phone')
      .populate('deliveryAddressId')
      .sort({ createdAt: -1 })
      .limit(20);

    // If location provided, filter by distance
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const maxRadius = parseFloat(radius);

      // Simple distance calculation (Haversine formula)
      orders = orders.filter(order => {
        if (!order.deliveryAddressId || !order.deliveryAddressId.latitude || !order.deliveryAddressId.longitude) {
          return true; // Include if no location data
        }

        const distance = calculateDistance(
          lat, lng,
          order.deliveryAddressId.latitude,
          order.deliveryAddressId.longitude
        );

        return distance <= maxRadius;
      });

      // Add distance to each order
      orders = orders.map(order => {
        const orderObj = order.toObject();
        if (order.deliveryAddressId && order.deliveryAddressId.latitude && order.deliveryAddressId.longitude) {
          orderObj.distance = calculateDistance(
            lat, lng,
            order.deliveryAddressId.latitude,
            order.deliveryAddressId.longitude
          );
        }
        return orderObj;
      });

      // Sort by distance
      orders.sort((a, b) => (a.distance || 999) - (b.distance || 999));
    }

    return res.status(200).json({
      success: true,
      message: "Available orders retrieved successfully",
      data: {
        orders: orders,
        count: orders.length
      }
    });

  } catch (error) {
    console.error("Get available orders error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Get Assigned Orders
module.exports.getAssignedOrders = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const { status } = req.query;

    // Build query
    const query = {
      deliveryBoyId: deliveryBoyId
    };

    // Filter by status if provided
    if (status) {
      const validStatuses = ['ready_for_pickup', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed: ${validStatuses.join(', ')}`
        });
      }
      query.orderStatus = status;
    } else {
      // Default: show active orders only
      query.orderStatus = { 
        $in: ['ready_for_pickup', 'picked_up', 'out_for_delivery'] 
      };
    }

    const orders = await Order.find(query)
      .populate('customerId', 'fullname phone')
      .populate('shopId', 'fullname phone')
      .populate('deliveryAddressId')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Assigned orders retrieved successfully",
      data: {
        orders: orders,
        count: orders.length
      }
    });

  } catch (error) {
    console.error("Get assigned orders error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Accept Order
module.exports.acceptOrder = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const { orderId } = req.body;

    // Validation
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
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

    // Check if online and available
    if (!deliveryBoy.isOnline || !deliveryBoy.isAvailable) {
      return res.status(403).json({
        success: false,
        message: "You must be online and available to accept orders"
      });
    }

    // Check if already has active order
    if (deliveryBoy.activeOrderId) {
      return res.status(403).json({
        success: false,
        message: "You already have an active order. Complete it first."
      });
    }

    // Get order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Check if order is available for assignment
    if (order.deliveryBoyId) {
      return res.status(400).json({
        success: false,
        message: "Order already assigned to another delivery boy"
      });
    }

    if (order.orderStatus !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: `Order cannot be accepted. Current status: ${order.orderStatus}`
      });
    }

    // Check wallet limit for COD orders
    if (order.paymentMethod === 'cod') {
      const wallet = await DeliveryBoyWallet.findOne({ deliveryBoyId });
      if (wallet && !wallet.canAcceptCOD(order.totalAmount)) {
        return res.status(403).json({
          success: false,
          message: `Cannot accept COD order. Would exceed COD limit. Current balance: ₹${wallet.balance}, Order amount: ₹${order.totalAmount}, Limit: ₹${wallet.codLimit}`,
          walletBalance: wallet.balance,
          orderAmount: order.totalAmount,
          codLimit: wallet.codLimit
        });
      }
    }

    // Assign order atomically
    const updatedOrder = await Order.findOneAndUpdate(
      { 
        _id: orderId,
        deliveryBoyId: null, // Ensure not already assigned
        orderStatus: 'confirmed'
      },
      {
        deliveryBoyId: deliveryBoyId,
        orderStatus: 'ready_for_pickup'
      },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(400).json({
        success: false,
        message: "Order already assigned or status changed"
      });
    }

    // Update delivery boy
    deliveryBoy.activeOrderId = orderId;
    deliveryBoy.isAvailable = false;
    deliveryBoy.totalDeliveries += 1;
    await deliveryBoy.save();

    // Create notification
    await DeliveryBoyNotification.create({
      deliveryBoyId: deliveryBoyId,
      orderId: orderId,
      title: "Order Accepted",
      message: `You have accepted order ${updatedOrder.orderNumber}`,
      type: 'order_assigned',
      priority: 'high'
    });

    // Populate order details
    const populatedOrder = await Order.findById(orderId)
      .populate('customerId', 'fullname phone')
      .populate('shopId', 'fullname phone')
      .populate('deliveryAddressId');

    return res.status(200).json({
      success: true,
      message: "Order accepted successfully",
      data: {
        order: populatedOrder
      }
    });

  } catch (error) {
    console.error("Accept order error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Reject Order
module.exports.rejectOrder = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const { orderId, reason } = req.body;

    // Validation
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    // Get order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Check if order is assigned to this delivery boy
    if (order.deliveryBoyId && order.deliveryBoyId.toString() !== deliveryBoyId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this order"
      });
    }

    // Log rejection (for analytics)
    console.log(`Delivery boy ${deliveryBoyId} rejected order ${orderId}. Reason: ${reason || 'Not specified'}`);

    return res.status(200).json({
      success: true,
      message: "Order rejected successfully"
    });

  } catch (error) {
    console.error("Reject order error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Get Order Details
module.exports.getOrderDetails = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const { orderId } = req.params;

    // Validation
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    // Get order
    const order = await Order.findById(orderId)
      .populate('customerId', 'fullname phone email')
      .populate('shopId', 'fullname phone email')
      .populate('deliveryAddressId');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Check if order is assigned to this delivery boy
    if (order.deliveryBoyId && order.deliveryBoyId.toString() !== deliveryBoyId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this order"
      });
    }

    // Get order items
    const orderItems = await OrderItem.find({ orderId: orderId })
      .populate('productId');

    return res.status(200).json({
      success: true,
      message: "Order details retrieved successfully",
      data: {
        order: order,
        items: orderItems
      }
    });

  } catch (error) {
    console.error("Get order details error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Helper function: Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}
