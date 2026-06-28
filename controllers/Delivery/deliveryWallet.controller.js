// controllers/Delivery/deliveryWallet.controller.js
const DeliveryBoyWallet = require("../../models/DeliveryBoy/DeliveryBoyWallet");
const WalletTransaction = require("../../models/DeliveryBoy/WalletTransaction");
const Order = require("../../models/Customer/Order");

// Helper function: Calculate distance between two coordinates
function toRad(value) {
  return value * Math.PI / 180;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Radius of Earth in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 100) / 100;
}

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
        codLimit: 1000
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
        availableLimit: wallet.codLimit + wallet.balance,
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

// ✅ Get Comprehensive Income Dashboard
module.exports.getIncomeDashboard = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const { startDate, endDate } = req.query;

    // Get wallet
    let wallet = await DeliveryBoyWallet.findOne({ deliveryBoyId });

    if (!wallet) {
      wallet = await DeliveryBoyWallet.create({
        deliveryBoyId: deliveryBoyId,
        balance: 0,
        codLimit: 1000
      });
    }

    // Determine period
    let start = new Date();
    start.setHours(0, 0, 0, 0);
    let end = new Date();
    end.setHours(23, 59, 59, 999);

    if (startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    }

    const periodTransactions = await WalletTransaction.find({
      deliveryBoyId: deliveryBoyId,
      createdAt: { $gte: start, $lte: end },
      status: 'completed'
    });

    let periodCodCollected = 0;
    let periodEarnings = 0;
    
    periodTransactions.forEach(tx => {
      // Exclude 'wallet' (simulated added balance) from earnings calculation
      if (tx.transactionType === 'credit' && tx.paymentMethod !== 'wallet') {
        periodEarnings += tx.amount;
      }
      if (tx.transactionType === 'debit' && tx.paymentMethod === 'cod') {
        periodCodCollected += tx.amount;
      }
    });

    // Get latest settlement
    const Settlement = require("../../models/DeliveryBoy/Settlement");
    const latestSettlement = await Settlement.findOne({ deliveryBoyId })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Income dashboard retrieved successfully",
      data: {
        cashFlow: {
          todayCollected: periodCodCollected, // keeping the key name for frontend compatibility, but it represents period
          totalCodCollected: wallet.codCollected,
          pendingCodToSettle: wallet.codPending
        },
        onlineFlow: {
          todayEarnings: periodEarnings, // keeping the key name for frontend compatibility, but it represents period
          totalEarnings: wallet.totalEarnings
        },
        wallet: {
          balance: wallet.balance,
          codLimit: wallet.codLimit,
          availableCodLimit: wallet.codLimit - Math.abs(wallet.balance),
          isBlocked: wallet.isBlocked,
          blockReason: wallet.blockReason
        },
        settlement: latestSettlement ? {
          status: latestSettlement.status,
          amount: latestSettlement.amount,
          date: latestSettlement.createdAt,
          settlementNumber: latestSettlement.settlementNumber
        } : null
      }
    });

  } catch (error) {
    console.error("Get income dashboard error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Get Delivery Boy Income Only (Pure Income)
module.exports.getIncome = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const { startDate, endDate } = req.query;

    let wallet = await DeliveryBoyWallet.findOne({ deliveryBoyId });
    if (!wallet) {
      wallet = await DeliveryBoyWallet.create({
        deliveryBoyId: deliveryBoyId,
        balance: 0,
        codLimit: 1000
      });
    }

    // Determine period
    let start = new Date();
    start.setHours(0, 0, 0, 0);
    let end = new Date();
    end.setHours(23, 59, 59, 999);

    if (startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    }

    // Total earnings from wallet directly
    let totalEarnings = wallet.totalEarnings || 0;

    // Get period delivered orders for earnings (distance wise pay)
    const periodDeliveredOrders = await Order.find({
      deliveryBoyId: deliveryBoyId,
      orderStatus: 'DELIVERED',
      updatedAt: { $gte: start, $lte: end }
    });

    let periodEarnings = 0;
    periodDeliveredOrders.forEach(order => {
      let earned = order.deliveryCharge || 30; // default fallback
      if (order.pickupAddress && order.pickupAddress.lat && order.deliveryAddress && order.deliveryAddress.lat) {
        const dist = calculateDistance(
          order.pickupAddress.lat,
          order.pickupAddress.lng,
          order.deliveryAddress.lat,
          order.deliveryAddress.lng
        );
        if (dist > 0) {
          earned = Math.round(dist * 7); // 7 Rs per KM
        }
      }
      periodEarnings += earned;
    });
    
    // COD metrics
    const periodCodTx = await WalletTransaction.find({
      deliveryBoyId: deliveryBoyId,
      transactionType: 'debit',
      paymentMethod: 'cod',
      createdAt: { $gte: start, $lte: end },
      status: 'completed'
    });
    
    let periodCodCollected = 0;
    periodCodTx.forEach(tx => periodCodCollected += tx.amount);

    return res.status(200).json({
      success: true,
      message: "Income retrieved successfully",
      data: {
        cashFlow: {
          periodCollected: periodCodCollected,
          totalCodCollected: wallet.codCollected,
          pendingCodToSettle: wallet.codPending
        },
        onlineFlow: {
          periodEarnings: periodEarnings,
          totalEarnings: totalEarnings
        }
      }
    });

  } catch (error) {
    console.error("Get income error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};


// ✅ Add Balance to Wallet (Simulated)
module.exports.addBalance = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid amount to add"
      });
    }

    let wallet = await DeliveryBoyWallet.findOne({ deliveryBoyId });
    if (!wallet) {
      wallet = await DeliveryBoyWallet.create({
        deliveryBoyId: deliveryBoyId,
        balance: 0,
        codLimit: 1000
      });
    }

    const balanceBefore = wallet.balance;
    const addAmount = Number(amount);
    
    wallet.balance += addAmount;
    
    await wallet.save();

    // Create a transaction record
    await WalletTransaction.create({
      deliveryBoyId: deliveryBoyId,
      transactionType: 'credit',
      amount: addAmount,
      balanceBefore: balanceBefore,
      balanceAfter: wallet.balance,
      description: description || "Wallet balance added (Simulated)",
      paymentMethod: 'wallet',
      status: 'completed'
    });

    return res.status(200).json({
      success: true,
      message: "Balance added successfully",
      data: {
        balance: wallet.balance
      }
    });

  } catch (error) {
    console.error("Add balance error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};
