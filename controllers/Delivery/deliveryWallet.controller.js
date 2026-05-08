// controllers/Delivery/deliveryWallet.controller.js
const DeliveryBoyWallet = require("../../models/DeliveryBoy/DeliveryBoyWallet");
const WalletTransaction = require("../../models/DeliveryBoy/WalletTransaction");
const Order = require("../../models/Customer/Order");

// ✅ Get Wallet Balance
module.exports.getWalletBalance = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;

    let wallet = await DeliveryBoyWallet.findOne({ deliveryBoyId });

    if (!wallet) {
      // Create wallet if doesn't exist
      wallet = await DeliveryBoyWallet.create({
        deliveryBoyId: deliveryBoyId,
        balance: 0,
        codLimit: 10000
      });
    }

    return res.status(200).json({
      success: true,
      message: "Wallet balance retrieved successfully",
      data: {
        balance: wallet.balance,
        codCollected: wallet.codCollected,
        codPending: wallet.codPending,
        totalEarnings: wallet.totalEarnings,
        codLimit: wallet.codLimit,
        isBlocked: wallet.isBlocked,
        blockReason: wallet.blockReason,
        isWithinLimit: wallet.isWithinLimit(),
        availableLimit: wallet.codLimit - Math.abs(wallet.balance),
        lastSettlementDate: wallet.lastSettlementDate
      }
    });

  } catch (error) {
    console.error("Get wallet balance error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Get Wallet Transactions (Ledger)
module.exports.getWalletTransactions = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const { page = 1, limit = 20, transactionType, startDate, endDate } = req.query;

    // Build query
    const query = { deliveryBoyId };

    if (transactionType) {
      const validTypes = ['credit', 'debit', 'settlement', 'penalty', 'bonus', 'refund'];
      if (!validTypes.includes(transactionType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid transaction type. Allowed: ${validTypes.join(', ')}`
        });
      }
      query.transactionType = transactionType;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const transactions = await WalletTransaction.find(query)
      .populate('orderId', 'orderNumber totalAmount paymentMethod')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalTransactions = await WalletTransaction.countDocuments(query);
    const totalPages = Math.ceil(totalTransactions / parseInt(limit));

    return res.status(200).json({
      success: true,
      message: "Wallet transactions retrieved successfully",
      data: {
        transactions: transactions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: totalPages,
          totalTransactions: totalTransactions,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error("Get wallet transactions error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Get COD Summary
module.exports.getCODSummary = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;

    // Get wallet
    const wallet = await DeliveryBoyWallet.findOne({ deliveryBoyId });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found"
      });
    }

    // Get today's COD collections
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayOrders = await Order.find({
      deliveryBoyId: deliveryBoyId,
      paymentMethod: 'cod',
      orderStatus: 'delivered',
      deliveredAt: { $gte: todayStart, $lte: todayEnd }
    });

    const todayCollected = todayOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const todayOrdersCount = todayOrders.length;

    // Get this week's COD collections
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekOrders = await Order.find({
      deliveryBoyId: deliveryBoyId,
      paymentMethod: 'cod',
      orderStatus: 'delivered',
      deliveredAt: { $gte: weekStart }
    });

    const weekCollected = weekOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    // Get this month's COD collections
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthOrders = await Order.find({
      deliveryBoyId: deliveryBoyId,
      paymentMethod: 'cod',
      orderStatus: 'delivered',
      deliveredAt: { $gte: monthStart }
    });

    const monthCollected = monthOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    return res.status(200).json({
      success: true,
      message: "COD summary retrieved successfully",
      data: {
        today: {
          collected: todayCollected,
          ordersCount: todayOrdersCount
        },
        week: {
          collected: weekCollected,
          ordersCount: weekOrders.length
        },
        month: {
          collected: monthCollected,
          ordersCount: monthOrders.length
        },
        total: {
          collected: wallet.codCollected,
          pending: wallet.codPending
        },
        wallet: {
          balance: wallet.balance,
          codLimit: wallet.codLimit,
          availableLimit: wallet.codLimit - Math.abs(wallet.balance)
        }
      }
    });

  } catch (error) {
    console.error("Get COD summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};
