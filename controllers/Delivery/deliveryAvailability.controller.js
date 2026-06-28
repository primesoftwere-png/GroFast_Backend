// controllers/Delivery/deliveryAvailability.controller.js
const DeliveryBoy = require("../../models/DeliveryBoy/DeliveryBoy");
const DeliveryBoyKYC = require("../../models/DeliveryBoy/DeliveryBoyKYC");
const DeliveryBoyWallet = require("../../models/DeliveryBoy/DeliveryBoyWallet");

// ✅ Toggle Online/Offline Status
module.exports.toggleOnlineStatus = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const { isOnline } = req.body;

    // Validation
    if (typeof isOnline !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: "isOnline must be a boolean value"
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

    // Check if blocked
    if (deliveryBoy.isBlocked) {
      const isCodBlock = deliveryBoy.blockReason && deliveryBoy.blockReason.toLowerCase().includes('cod limit exceeded');
      if (isCodBlock) {
        // Auto-unblock check
        const wallet = await DeliveryBoyWallet.findOne({ deliveryBoyId });
        if (wallet && wallet.isWithinLimit()) {
          deliveryBoy.isBlocked = false;
          deliveryBoy.blockReason = null;
          // Note: we don't await save here yet, it will be saved below when toggling online status
          
          wallet.isBlocked = false;
          wallet.blockReason = null;
          await wallet.save();

          const User = require('../../models/user.model');
          await User.findByIdAndUpdate(deliveryBoyId, {
            $set: { 'roleDetails.deliveryBoy.deliveryBoyStatus': 'active' }
          });
        } else {
          return res.status(403).json({
            success: false,
            message: `Cannot go online. Your account is blocked. Reason: ${deliveryBoy.blockReason || 'Not specified'}`,
            isBlocked: true
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          message: `Cannot go online. Your account is blocked. Reason: ${deliveryBoy.blockReason || 'Not specified'}`,
          isBlocked: true
        });
      }
    }

    // Check KYC status
    const kyc = await DeliveryBoyKYC.findOne({ deliveryBoyId });
    // if (!kyc || kyc.status !== 'approved') {
    //   return res.status(403).json({
    //     success: false,
    //     message: "Cannot go online. KYC not approved. Please complete KYC verification.",
    //     kycStatus: kyc ? kyc.status : 'not_submitted'
    //   });
    // }

    // Check wallet limit
    const wallet = await DeliveryBoyWallet.findOne({ deliveryBoyId });
    if (wallet && !wallet.isWithinLimit()) {
      return res.status(403).json({
        success: false,
        message: `Cannot go online. COD limit exceeded. Current balance: ₹${wallet.balance}, Limit: ₹${wallet.codLimit}. Please settle your dues.`,
        walletBalance: wallet.balance,
        codLimit: wallet.codLimit
      });
    }

    // Update online status
    deliveryBoy.isOnline = isOnline;
    deliveryBoy.lastActiveAt = Date.now();
    
    // If going offline, set available to false
    if (!isOnline) {
      deliveryBoy.isAvailable = false;
    } else {
      // If going online and no active order, set available to true
      if (!deliveryBoy.activeOrderId) {
        deliveryBoy.isAvailable = true;
      }
    }

    await deliveryBoy.save();

    return res.status(200).json({
      success: true,
      message: `Status updated to ${isOnline ? 'online' : 'offline'}`,
      data: {
        isOnline: deliveryBoy.isOnline,
        isAvailable: deliveryBoy.isAvailable
      }
    });

  } catch (error) {
    console.error("Toggle online status error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Get Current Status
module.exports.getCurrentStatus = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;

    const deliveryBoy = await DeliveryBoy.findOne({ userId: deliveryBoyId })
      .populate('activeOrderId');

    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy profile not found"
      });
    }

    // Get KYC status (Bypassed for testing so Delivery Boy can go online)
    const kyc = await DeliveryBoyKYC.findOne({ deliveryBoyId });
    const kycStatus = (kyc && kyc.status === 'approved') ? 'approved' : 'approved'; // Force 'approved' to bypass the UI restriction

    // Get wallet
    const wallet = await DeliveryBoyWallet.findOne({ deliveryBoyId });

    // Auto-unblock check for getCurrentStatus
    if (deliveryBoy.isBlocked && deliveryBoy.blockReason && deliveryBoy.blockReason.toLowerCase().includes('cod limit exceeded')) {
        if (wallet && wallet.isWithinLimit()) {
            deliveryBoy.isBlocked = false;
            deliveryBoy.blockReason = null;
            await deliveryBoy.save();

            wallet.isBlocked = false;
            wallet.blockReason = null;
            await wallet.save();

            const User = require('../../models/user.model');
            await User.findByIdAndUpdate(deliveryBoyId, {
               $set: { 'roleDetails.deliveryBoy.deliveryBoyStatus': 'active' }
            });
        }
    }

    return res.status(200).json({
      success: true,
      message: "Status retrieved successfully",
      data: {
        isOnline: deliveryBoy.isOnline,
        isAvailable: deliveryBoy.isAvailable,
        isBlocked: deliveryBoy.isBlocked,
        blockReason: deliveryBoy.blockReason,
        kycStatus: kycStatus,
        activeOrder: deliveryBoy.activeOrderId,
        wallet: {
          balance: wallet ? wallet.balance : 0,
          codLimit: wallet ? wallet.codLimit : 10000,
          isWithinLimit: wallet ? wallet.isWithinLimit() : true
        },
        canGoOnline: !deliveryBoy.isBlocked && 
                     kycStatus === 'approved' && 
                     (wallet ? wallet.isWithinLimit() : true)
      }
    });

  } catch (error) {
    console.error("Get current status error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};
