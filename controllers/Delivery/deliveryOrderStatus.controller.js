// controllers/Delivery/deliveryOrderStatus.controller.js
const Order = require("../../models/Customer/Order");
const DeliveryBoy = require("../../models/DeliveryBoy/DeliveryBoy");
const DeliveryBoyWallet = require("../../models/DeliveryBoy/DeliveryBoyWallet");
const WalletTransaction = require("../../models/DeliveryBoy/WalletTransaction");
const OrderOTP = require("../../models/DeliveryBoy/OrderOTP");
const DeliveryBoyNotification = require("../../models/DeliveryBoy/DeliveryBoyNotification");

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

    // Check current status
    if (order.orderStatus !== 'ready_for_pickup') {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition. Current status: ${order.orderStatus}`
      });
    }

    // Verify pickup OTP
    const otpRecord = await OrderOTP.findOne({
      orderId: orderId,
      otpType: 'pickup',
      isVerified: false
    });

    if (!otpRecord) {
      return res.status(404).json({
        success: false,
        message: "Pickup OTP not found or already verified"
      });
    }

    // Check if OTP expired
    if (otpRecord.isExpired()) {
      return res.status(400).json({
        success: false,
        message: "Pickup OTP has expired. Please request a new one."
      });
    }

    // Check max attempts
    if (otpRecord.isMaxAttemptsReached()) {
      return res.status(400).json({
        success: false,
        message: "Maximum OTP attempts reached. Please contact support."
      });
    }

    // Verify OTP
    if (otpRecord.otp !== pickupOTP.trim()) {
      otpRecord.attempts += 1;
      await otpRecord.save();

      return res.status(400).json({
        success: false,
        message: `Invalid pickup OTP. Attempts remaining: ${otpRecord.maxAttempts - otpRecord.attempts}`
      });
    }

    // Mark OTP as verified
    otpRecord.isVerified = true;
    otpRecord.verifiedAt = Date.now();
    otpRecord.verifiedBy = deliveryBoyId;
    await otpRecord.save();

    // Update order status
    order.orderStatus = 'picked_up';
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
    if (order.orderStatus !== 'picked_up') {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition. Current status: ${order.orderStatus}. Order must be picked up first.`
      });
    }

    // Update order status
    order.orderStatus = 'out_for_delivery';
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
    if (order.orderStatus !== 'out_for_delivery') {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition. Current status: ${order.orderStatus}. Order must be out for delivery.`
      });
    }

    // Verify delivery OTP
    const otpRecord = await OrderOTP.findOne({
      orderId: orderId,
      otpType: 'delivery',
      isVerified: false
    });

    if (!otpRecord) {
      return res.status(404).json({
        success: false,
        message: "Delivery OTP not found or already verified"
      });
    }

    // Check if OTP expired
    if (otpRecord.isExpired()) {
      return res.status(400).json({
        success: false,
        message: "Delivery OTP has expired. Please request a new one."
      });
    }

    // Check max attempts
    if (otpRecord.isMaxAttemptsReached()) {
      return res.status(400).json({
        success: false,
        message: "Maximum OTP attempts reached. Please contact support."
      });
    }

    // Verify OTP
    if (otpRecord.otp !== deliveryOTP.trim()) {
      otpRecord.attempts += 1;
      await otpRecord.save();

      return res.status(400).json({
        success: false,
        message: `Invalid delivery OTP. Attempts remaining: ${otpRecord.maxAttempts - otpRecord.attempts}`
      });
    }

    // Mark OTP as verified
    otpRecord.isVerified = true;
    otpRecord.verifiedAt = Date.now();
    otpRecord.verifiedBy = deliveryBoyId;
    await otpRecord.save();

    // Update order status
    order.orderStatus = 'delivered';
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

    // Update wallet for COD orders
    if (order.paymentMethod === 'cod') {
      let wallet = await DeliveryBoyWallet.findOne({ deliveryBoyId });
      if (!wallet) {
        wallet = await DeliveryBoyWallet.create({
          deliveryBoyId: deliveryBoyId,
          balance: 0,
          codLimit: 10000
        });
      }

      const balanceBefore = wallet.balance;
      wallet.balance -= order.totalAmount; // Negative balance (debt)
      wallet.codCollected += order.totalAmount;
      wallet.codPending += order.totalAmount;
      const balanceAfter = wallet.balance;
      await wallet.save();

      // Record transaction
      await WalletTransaction.create({
        deliveryBoyId: deliveryBoyId,
        orderId: orderId,
        transactionType: 'debit',
        amount: order.totalAmount,
        balanceBefore: balanceBefore,
        balanceAfter: balanceAfter,
        description: `COD collected for order ${order.orderNumber}`,
        paymentMethod: 'cod',
        status: 'completed'
      });

      // Check if wallet exceeds limit
      if (!wallet.isWithinLimit()) {
        wallet.isBlocked = true;
        wallet.blockReason = 'COD limit exceeded. Please settle your dues.';
        await wallet.save();

        // Block delivery boy
        if (deliveryBoy) {
          deliveryBoy.isBlocked = true;
          deliveryBoy.blockReason = 'COD limit exceeded';
          deliveryBoy.isOnline = false;
          deliveryBoy.isAvailable = false;
          await deliveryBoy.save();
        }

        // Create notification
        await DeliveryBoyNotification.create({
          deliveryBoyId: deliveryBoyId,
          title: "Account Blocked",
          message: `Your account has been blocked due to COD limit exceeded. Current balance: ₹${wallet.balance}. Please settle your dues immediately.`,
          type: 'account_blocked',
          priority: 'urgent'
        });
      }
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
