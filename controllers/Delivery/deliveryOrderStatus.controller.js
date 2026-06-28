// controllers/Delivery/deliveryOrderStatus.controller.js
const Order = require("../../models/Customer/Order");
const DeliveryBoy = require("../../models/DeliveryBoy/DeliveryBoy");
const DeliveryBoyWallet = require("../../models/DeliveryBoy/DeliveryBoyWallet");
const WalletTransaction = require("../../models/DeliveryBoy/WalletTransaction");
const OrderOTP = require("../../models/DeliveryBoy/OrderOTP");
const DeliveryBoyNotification = require("../../models/DeliveryBoy/DeliveryBoyNotification");
const SettlementEngine = require("../../services/SettlementEngine");

// ✅ Mark Order as Picked Up (with OTP verification)
module.exports.markOrderPickedUp = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const { orderId, pickupOTP } = req.body;

    // Validation
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    if (!pickupOTP) {
      return res.status(400).json({
        success: false,
        message: "Pickup OTP is required"
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

    // Check if assigned to this delivery boy
    if (!order.deliveryBoyId || order.deliveryBoyId.toString() !== deliveryBoyId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this order"
      });
    }

    // Check current status - can verify if it's waiting for OTP or recently reached store
    const validPrevStatuses = ['DELIVERY_ASSIGNED', 'DELIVERY_REACHED_STORE', 'WAITING_PICKUP_OTP'];
    if (!validPrevStatuses.includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition. Current status: ${order.orderStatus}`
      });
    }

    // Verify pickup OTP (Shopkeeper receives order.otp via socket)
    let isOtpValid = false;
    
    if (order.otp && order.otp === pickupOTP.trim()) {
      isOtpValid = true;
    } else {
      // Fallback: check OrderOTP collection just in case
      const otpRecord = await OrderOTP.findOne({
        orderId: orderId,
        otpType: 'pickup',
        isVerified: false
      });
      
      if (otpRecord && !otpRecord.isExpired() && !otpRecord.isMaxAttemptsReached() && otpRecord.otp === pickupOTP.trim()) {
        isOtpValid = true;
        otpRecord.isVerified = true;
        otpRecord.verifiedAt = Date.now();
        otpRecord.verifiedBy = deliveryBoyId;
        await otpRecord.save();
      } else if (otpRecord && otpRecord.otp !== pickupOTP.trim()) {
        otpRecord.attempts += 1;
        await otpRecord.save();
      }
    }

    if (!isOtpValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid pickup OTP"
      });
    }

    // Update order status
    order.otpVerified = true;
    order.orderStatus = 'ORDER_PICKED_UP';
    order.pickedUpAt = Date.now();
    await order.save();

    // Create notification
    await DeliveryBoyNotification.create({
      deliveryBoyId: deliveryBoyId,
      orderId: orderId,
      title: "Order Picked Up",
      message: `Order ${order.orderNumber} has been picked up from shop`,
      type: 'order_assigned',
      priority: 'normal'
    });

    return res.status(200).json({
      success: true,
      message: "Order marked as picked up successfully",
      data: {
        order: order
      }
    });

  } catch (error) {
    console.error("Mark order picked up error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Start Delivery (OUT_FOR_DELIVERY)
module.exports.startDelivery = async (req, res) => {
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

    // Get order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Check if assigned to this delivery boy
    if (!order.deliveryBoyId || order.deliveryBoyId.toString() !== deliveryBoyId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this order"
      });
    }

    // Check current status
    if (order.orderStatus !== 'ORDER_PICKED_UP') {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition. Current status: ${order.orderStatus}. Order must be picked up first.`
      });
    }

    // Update order status
    order.orderStatus = 'OUT_FOR_DELIVERY';
    await order.save();

    // Create notification
    await DeliveryBoyNotification.create({
      deliveryBoyId: deliveryBoyId,
      orderId: orderId,
      title: "Delivery Started",
      message: `You are now delivering order ${order.orderNumber}`,
      type: 'order_assigned',
      priority: 'normal'
    });

    return res.status(200).json({
      success: true,
      message: "Delivery started successfully",
      data: {
        order: order
      }
    });

  } catch (error) {
    console.error("Start delivery error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Complete Delivery (DELIVERED with OTP verification)
module.exports.completeDelivery = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const { orderId, deliveryOTP } = req.body;

    // Validation
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    if (!deliveryOTP) {
      return res.status(400).json({
        success: false,
        message: "Delivery OTP is required"
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

    // Check if assigned to this delivery boy
    if (!order.deliveryBoyId || order.deliveryBoyId.toString() !== deliveryBoyId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this order"
      });
    }

    // Check current status
    const validDeliveryStatuses = ['OUT_FOR_DELIVERY', 'DELIVERY_REACHED_CUSTOMER', 'WAITING_DELIVERY_OTP'];
    if (!validDeliveryStatuses.includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition. Current status: ${order.orderStatus}. Order must be out for delivery or reached customer.`
      });
    }

    // Verify delivery OTP
    let isOtpValid = false;

    // 1. Check order.deliveryOTP.code if it exists
    if (order.deliveryOTP && order.deliveryOTP.code === deliveryOTP.trim()) {
      isOtpValid = true;
      order.deliveryOTP.verified = true;
    } else {
      // 2. Fallback to OrderOTP collection
      const otpRecord = await OrderOTP.findOne({
        orderId: orderId,
        otpType: 'delivery',
        isVerified: false
      });

      if (otpRecord && !otpRecord.isExpired() && !otpRecord.isMaxAttemptsReached() && otpRecord.otp === deliveryOTP.trim()) {
        isOtpValid = true;
        otpRecord.isVerified = true;
        otpRecord.verifiedAt = Date.now();
        otpRecord.verifiedBy = deliveryBoyId;
        await otpRecord.save();
      } else if (otpRecord && otpRecord.otp !== deliveryOTP.trim()) {
        otpRecord.attempts += 1;
        await otpRecord.save();
      }
    }

    if (!isOtpValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid delivery OTP"
      });
    }

    // Update order status
    order.orderStatus = 'DELIVERED';
    order.deliveredAt = Date.now();
    
    // Update payment status for COD
    if (order.paymentMethod === 'cod') {
      order.paymentStatus = 'paid';
    }
    
    await order.save();

    // Update delivery boy
    const deliveryBoy = await DeliveryBoy.findOne({ userId: deliveryBoyId });
    if (deliveryBoy) {
      deliveryBoy.completedDeliveries += 1;
      deliveryBoy.activeOrderId = null;
      deliveryBoy.isAvailable = true; // Make available for new orders
      await deliveryBoy.save();
    }

    // Call Centralized Settlement Engine
    const settlementResult = await SettlementEngine.processDeliveredOrder(order._id);
    if (!settlementResult.success) {
      console.warn("Settlement Engine Warning:", settlementResult.error || settlementResult.message);
    }

    // Create notification
    await DeliveryBoyNotification.create({
      deliveryBoyId: deliveryBoyId,
      orderId: orderId,
      title: "Delivery Completed",
      message: `Order ${order.orderNumber} delivered successfully`,
      type: 'order_assigned',
      priority: 'normal'
    });

    return res.status(200).json({
      success: true,
      message: "Delivery completed successfully",
      data: {
        order: order
      }
    });

  } catch (error) {
    console.error("Complete delivery error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Generate Pickup OTP (for testing/admin)
module.exports.generatePickupOTP = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Create OTP record
    const otpRecord = await OrderOTP.create({
      orderId: orderId,
      otpType: 'pickup',
      otp: otp,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    });

    return res.status(201).json({
      success: true,
      message: "Pickup OTP generated successfully",
      data: {
        otp: otp,
        expiresAt: otpRecord.expiresAt
      }
    });

  } catch (error) {
    console.error("Generate pickup OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Generate Delivery OTP (for testing/admin)
module.exports.generateDeliveryOTP = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Create OTP record
    const otpRecord = await OrderOTP.create({
      orderId: orderId,
      otpType: 'delivery',
      otp: otp,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    });

    return res.status(201).json({
      success: true,
      message: "Delivery OTP generated successfully",
      data: {
        otp: otp,
        expiresAt: otpRecord.expiresAt
      }
    });

  } catch (error) {
    console.error("Generate delivery OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};
