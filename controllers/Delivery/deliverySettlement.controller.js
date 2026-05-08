// controllers/Delivery/deliverySettlement.controller.js
const { v4: uuidv4 } = require('uuid');
const Settlement = require("../../models/DeliveryBoy/Settlement");
const DeliveryBoyWallet = require("../../models/DeliveryBoy/DeliveryBoyWallet");
const WalletTransaction = require("../../models/DeliveryBoy/WalletTransaction");
const DeliveryBoyNotification = require("../../models/DeliveryBoy/DeliveryBoyNotification");

// ✅ Request Settlement
module.exports.requestSettlement = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const { amount, paymentMethod, referenceNumber, proofImage, remarks } = req.body;

    // Validation
    if (!amount) {
      return res.status(400).json({
        success: false,
        message: "Settlement amount is required"
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required"
      });
    }

    const validPaymentMethods = ['cash', 'upi', 'bank_transfer'];
    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment method. Allowed: ${validPaymentMethods.join(', ')}`
      });
    }

    const settlementAmount = parseFloat(amount);
    if (isNaN(settlementAmount) || settlementAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid settlement amount"
      });
    }

    // Get wallet
    const wallet = await DeliveryBoyWallet.findOne({ deliveryBoyId });
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found"
      });
    }

    // Check if there's pending COD to settle
    if (wallet.balance >= 0) {
      return res.status(400).json({
        success: false,
        message: "No pending COD amount to settle",
        currentBalance: wallet.balance
      });
    }

    // Check if settlement amount exceeds pending amount
    const pendingAmount = Math.abs(wallet.balance);
    if (settlementAmount > pendingAmount) {
      return res.status(400).json({
        success: false,
        message: `Settlement amount cannot exceed pending amount. Pending: ₹${pendingAmount}`,
        pendingAmount: pendingAmount
      });
    }

    // Generate settlement number
    const settlementNumber = `STL-${Date.now()}-${uuidv4().toUpperCase().slice(0, 6)}`;

    // Create settlement request
    const settlement = await Settlement.create({
      deliveryBoyId: deliveryBoyId,
      settlementNumber: settlementNumber,
      amount: settlementAmount,
      paymentMethod: paymentMethod,
      referenceNumber: referenceNumber || null,
      proofImage: proofImage || null,
      remarks: remarks || null,
      status: 'pending'
    });

    // Create notification
    await DeliveryBoyNotification.create({
      deliveryBoyId: deliveryBoyId,
      title: "Settlement Request Submitted",
      message: `Your settlement request of ₹${settlementAmount} has been submitted for approval`,
      type: 'payment_received',
      priority: 'normal'
    });

    return res.status(201).json({
      success: true,
      message: "Settlement request submitted successfully. Awaiting admin approval.",
      data: {
        settlement: settlement,
        pendingAmount: pendingAmount,
        remainingAmount: pendingAmount - settlementAmount
      }
    });

  } catch (error) {
    console.error("Request settlement error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Get Settlement History
module.exports.getSettlementHistory = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const { page = 1, limit = 20, status } = req.query;

    // Build query
    const query = { deliveryBoyId };

    if (status) {
      const validStatuses = ['pending', 'approved', 'rejected'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed: ${validStatuses.join(', ')}`
        });
      }
      query.status = status;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const settlements = await Settlement.find(query)
      .populate('approvedBy', 'fullname email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalSettlements = await Settlement.countDocuments(query);
    const totalPages = Math.ceil(totalSettlements / parseInt(limit));

    // Calculate totals
    const totalApproved = await Settlement.aggregate([
      { $match: { deliveryBoyId: deliveryBoyId, status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalPending = await Settlement.aggregate([
      { $match: { deliveryBoyId: deliveryBoyId, status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    return res.status(200).json({
      success: true,
      message: "Settlement history retrieved successfully",
      data: {
        settlements: settlements,
        summary: {
          totalApproved: totalApproved.length > 0 ? totalApproved[0].total : 0,
          totalPending: totalPending.length > 0 ? totalPending[0].total : 0
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages: totalPages,
          totalSettlements: totalSettlements,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error("Get settlement history error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Get Settlement Details
module.exports.getSettlementDetails = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const { settlementId } = req.params;

    if (!settlementId) {
      return res.status(400).json({
        success: false,
        message: "Settlement ID is required"
      });
    }

    const settlement = await Settlement.findById(settlementId)
      .populate('approvedBy', 'fullname email');

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: "Settlement not found"
      });
    }

    // Check if settlement belongs to this delivery boy
    if (settlement.deliveryBoyId.toString() !== deliveryBoyId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this settlement"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Settlement details retrieved successfully",
      data: {
        settlement: settlement
      }
    });

  } catch (error) {
    console.error("Get settlement details error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};
