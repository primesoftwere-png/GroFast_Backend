// controllers/shopkeeper/income.controller.js
const Order = require('../../models/Customer/Order');
const Shopkeeper = require('../../models/ShopKeeper/Shopkeeper');
const Shop = require('../../models/ShopKeeper/Shop');
const ShopkeeperWallet = require('../../models/ShopKeeper/ShopkeeperWallet');
const ShopkeeperTransaction = require('../../models/ShopKeeper/ShopkeeperTransaction');
const ShopkeeperDailyIncome = require('../../models/ShopKeeper/ShopkeeperDailyIncome');

// ==================== HELPER FUNCTIONS ====================

/**
 * Get shopkeeper profile from userId
 */
async function getShopkeeperProfile(userId) {
  const shopkeeper = await Shopkeeper.findOne({ userId });
  if (!shopkeeper) {
    return { error: 'Shopkeeper profile not found', status: 404 };
  }
  return { shopkeeper };
}

/**
 * Get or create wallet for a shopkeeper
 */
async function getOrCreateWallet(shopkeeperId) {
  let wallet = await ShopkeeperWallet.findOne({ shopkeeperId });
  if (!wallet) {
    wallet = await ShopkeeperWallet.create({ shopkeeperId });
  }
  return wallet;
}

/**
 * Get the start of today in UTC
 */
function getStartOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Map paymentMethod from Order to paymentMode for transactions
 */
function mapPaymentMode(paymentMethod) {
  const mapping = {
    'COD': 'CASH',
    'ONLINE': 'ONLINE',
    'WALLET': 'WALLET'
  };
  return mapping[paymentMethod] || 'ONLINE';
}

// ==================== API CONTROLLERS ====================

// Internal function to process order income (called automatically on DELIVERED)
module.exports.processOrderIncomeInternal = async (orderId) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) return { success: false, message: 'Order not found' };

    // Get shopkeeper via shopId which is userId or shopkeeperId
    const shopkeeper = await Shopkeeper.findOne({ $or: [{ userId: order.shopId }, { _id: order.shopId }] });
    if (!shopkeeper) return { success: false, message: 'Shopkeeper not found' };

    const shop = await Shop.findOne({ shopkeeperId: shopkeeper._id });
    const commissionRate = shop ? (shop.commissionRate || 10) : 10;

    const existingTransaction = await ShopkeeperTransaction.findOne({
      orderId: order._id,
      shopkeeperId: shopkeeper._id,
      type: 'ORDER_CREDIT'
    });

    if (existingTransaction) return { success: true, message: 'Already processed' };

    const orderAmount = order.totalAmount;
    const platformCommission = Math.round((orderAmount * commissionRate / 100) * 100) / 100;
    const netAmount = Math.round((orderAmount - platformCommission) * 100) / 100;

    const wallet = await getOrCreateWallet(shopkeeper._id);
    const balanceBefore = wallet.balance;
    const paymentMode = mapPaymentMode(order.paymentMethod);

    switch (paymentMode) {
      case 'CASH':
        wallet.addCashEarnings(orderAmount, platformCommission);
        break;
      case 'ONLINE':
        wallet.addOnlineEarnings(orderAmount, platformCommission);
        break;
      case 'WALLET':
        wallet.addWalletEarnings(orderAmount, platformCommission);
        break;
      default:
        wallet.addOnlineEarnings(orderAmount, platformCommission);
    }
    await wallet.save();

    await ShopkeeperTransaction.create({
      shopkeeperId: shopkeeper._id,
      orderId: order._id,
      type: 'ORDER_CREDIT',
      paymentMode: paymentMode,
      amount: orderAmount,
      platformCommission: platformCommission,
      netAmount: netAmount,
      balanceBefore: balanceBefore,
      balanceAfter: wallet.balance,
      description: `Income from order ${order.orderNumber} (${paymentMode})`,
      status: 'SUCCESS',
      referenceId: order.orderToken,
      metadata: {
        orderNumber: order.orderNumber,
        paymentMethod: order.paymentMethod,
        commissionRate: commissionRate
      }
    });

    const today = getStartOfDay();
    const incomeField = paymentMode === 'CASH' ? 'cashIncome' 
                      : paymentMode === 'WALLET' ? 'walletIncome' 
                      : 'onlineIncome';
    const countField = paymentMode === 'CASH' ? 'cashOrderCount' 
                     : paymentMode === 'WALLET' ? 'walletOrderCount' 
                     : 'onlineOrderCount';

    await ShopkeeperDailyIncome.findOneAndUpdate(
      { shopkeeperId: shopkeeper._id, date: today },
      {
        $inc: {
          [incomeField]: netAmount,
          [countField]: 1,
          totalIncome: netAmount,
          totalOrderCount: 1,
          platformCommission: platformCommission,
          netIncome: netAmount
        }
      },
      { upsert: true, new: true }
    );

    return { success: true };
  } catch (error) {
    console.error('Error processing internal order income:', error);
    return { success: false, error: error.message };
  }
};

// ✅ 1. Record Order Income (called when order is delivered)
module.exports.recordOrderIncome = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'orderId is required'
      });
    }

    // Get shopkeeper profile
    const profileResult = await getShopkeeperProfile(userId);
    if (profileResult.error) {
      return res.status(profileResult.status).json({
        success: false,
        message: profileResult.error
      });
    }
    const { shopkeeper } = profileResult;

    // Get shop for commission rate
    const shop = await Shop.findOne({ shopkeeperId: shopkeeper._id });
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    // Get the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Verify order belongs to this shopkeeper
    if (order.shopId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Order does not belong to this shopkeeper'
      });
    }

    // Check if income already recorded for this order
    const existingTransaction = await ShopkeeperTransaction.findOne({
      orderId: order._id,
      shopkeeperId: shopkeeper._id,
      type: 'ORDER_CREDIT'
    });

    if (existingTransaction) {
      return res.status(400).json({
        success: false,
        message: 'Income already recorded for this order',
        data: { transactionId: existingTransaction._id }
      });
    }

    // Calculate commission
    const commissionRate = shop.commissionRate || 10; // Default 10%
    const orderAmount = order.totalAmount;
    const platformCommission = Math.round((orderAmount * commissionRate / 100) * 100) / 100;
    const netAmount = Math.round((orderAmount - platformCommission) * 100) / 100;

    // Get or create wallet
    const wallet = await getOrCreateWallet(shopkeeper._id);
    const balanceBefore = wallet.balance;

    // Determine payment mode
    const paymentMode = mapPaymentMode(order.paymentMethod);

    // Add earnings to wallet based on payment mode
    switch (paymentMode) {
      case 'CASH':
        wallet.addCashEarnings(orderAmount, platformCommission);
        break;
      case 'ONLINE':
        wallet.addOnlineEarnings(orderAmount, platformCommission);
        break;
      case 'WALLET':
        wallet.addWalletEarnings(orderAmount, platformCommission);
        break;
      default:
        wallet.addOnlineEarnings(orderAmount, platformCommission);
    }

    await wallet.save();

    // Create transaction record
    const transaction = await ShopkeeperTransaction.create({
      shopkeeperId: shopkeeper._id,
      orderId: order._id,
      type: 'ORDER_CREDIT',
      paymentMode: paymentMode,
      amount: orderAmount,
      platformCommission: platformCommission,
      netAmount: netAmount,
      balanceBefore: balanceBefore,
      balanceAfter: wallet.balance,
      description: `Income from order ${order.orderNumber} (${paymentMode})`,
      status: 'SUCCESS',
      referenceId: order.orderToken,
      metadata: {
        orderNumber: order.orderNumber,
        paymentMethod: order.paymentMethod,
        commissionRate: commissionRate
      }
    });

    // Update daily income (upsert for today)
    const today = getStartOfDay();
    const incomeField = paymentMode === 'CASH' ? 'cashIncome' 
                      : paymentMode === 'WALLET' ? 'walletIncome' 
                      : 'onlineIncome';
    const countField = paymentMode === 'CASH' ? 'cashOrderCount' 
                     : paymentMode === 'WALLET' ? 'walletOrderCount' 
                     : 'onlineOrderCount';

    await ShopkeeperDailyIncome.findOneAndUpdate(
      { shopkeeperId: shopkeeper._id, date: today },
      {
        $inc: {
          [incomeField]: netAmount,
          [countField]: 1,
          totalIncome: netAmount,
          totalOrderCount: 1,
          platformCommission: platformCommission,
          netIncome: netAmount
        }
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Order income recorded successfully',
      data: {
        transaction: {
          transactionId: transaction._id,
          orderId: order._id,
          orderNumber: order.orderNumber,
          paymentMode: paymentMode,
          orderAmount: orderAmount,
          platformCommission: platformCommission,
          netAmount: netAmount,
          commissionRate: commissionRate
        },
        wallet: {
          balanceBefore: balanceBefore,
          balanceAfter: wallet.balance,
          totalEarnings: wallet.totalEarnings
        }
      }
    });

  } catch (error) {
    console.error('Record order income error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ 2. Get Income Overview (Dashboard)
module.exports.getIncomeOverview = async (req, res) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate } = req.query;

    const profileResult = await getShopkeeperProfile(userId);
    if (profileResult.error) {
      return res.status(profileResult.status).json({
        success: false,
        message: profileResult.error
      });
    }
    const { shopkeeper } = profileResult;

    const wallet = await getOrCreateWallet(shopkeeper._id);

    // Today's income
    const today = getStartOfDay();
    const todayIncome = await ShopkeeperDailyIncome.findOne({
      shopkeeperId: shopkeeper._id,
      date: today
    });

    // This week's income (Monday to now)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
    weekStart.setHours(0, 0, 0, 0);

    const weeklyIncome = await ShopkeeperDailyIncome.aggregate([
      {
        $match: {
          shopkeeperId: shopkeeper._id,
          date: { $gte: weekStart }
        }
      },
      {
        $group: {
          _id: null,
          totalIncome: { $sum: '$totalIncome' },
          cashIncome: { $sum: '$cashIncome' },
          onlineIncome: { $sum: '$onlineIncome' },
          walletIncome: { $sum: '$walletIncome' },
          totalOrders: { $sum: '$totalOrderCount' },
          platformCommission: { $sum: '$platformCommission' },
          netIncome: { $sum: '$netIncome' }
        }
      }
    ]);

    // This month's income
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthlyIncome = await ShopkeeperDailyIncome.aggregate([
      {
        $match: {
          shopkeeperId: shopkeeper._id,
          date: { $gte: monthStart }
        }
      },
      {
        $group: {
          _id: null,
          totalIncome: { $sum: '$totalIncome' },
          cashIncome: { $sum: '$cashIncome' },
          onlineIncome: { $sum: '$onlineIncome' },
          walletIncome: { $sum: '$walletIncome' },
          totalOrders: { $sum: '$totalOrderCount' },
          platformCommission: { $sum: '$platformCommission' },
          netIncome: { $sum: '$netIncome' }
        }
      }
    ]);

    // Custom period income
    let customPeriodIncome = null;
    if (startDate && endDate) {
      const cStart = new Date(startDate);
      cStart.setHours(0, 0, 0, 0);
      const cEnd = new Date(endDate);
      cEnd.setHours(23, 59, 59, 999);

      const customIncome = await ShopkeeperDailyIncome.aggregate([
        {
          $match: {
            shopkeeperId: shopkeeper._id,
            date: { $gte: cStart, $lte: cEnd }
          }
        },
        {
          $group: {
            _id: null,
            totalIncome: { $sum: '$totalIncome' },
            cashIncome: { $sum: '$cashIncome' },
            onlineIncome: { $sum: '$onlineIncome' },
            walletIncome: { $sum: '$walletIncome' },
            totalOrders: { $sum: '$totalOrderCount' },
            platformCommission: { $sum: '$platformCommission' },
            netIncome: { $sum: '$netIncome' }
          }
        }
      ]);
      customPeriodIncome = customIncome[0] || {
        totalIncome: 0, cashIncome: 0, onlineIncome: 0, walletIncome: 0,
        totalOrders: 0, platformCommission: 0, netIncome: 0
      };
    }

    return res.status(200).json({
      success: true,
      message: 'Income overview retrieved successfully',
      data: {
        wallet: {
          balance: wallet.balance,
          cashBalance: wallet.cashBalance,
          onlineBalance: wallet.onlineBalance,
          walletBalance: wallet.walletBalance,
          totalEarnings: wallet.totalEarnings,
          totalPlatformCommission: wallet.totalPlatformCommission,
          totalSettled: wallet.totalSettled,
          totalWithdrawn: wallet.totalWithdrawn,
          currency: wallet.currency
        },
        today: {
          totalIncome: todayIncome?.totalIncome || 0,
          cashIncome: todayIncome?.cashIncome || 0,
          onlineIncome: todayIncome?.onlineIncome || 0,
          walletIncome: todayIncome?.walletIncome || 0,
          totalOrders: todayIncome?.totalOrderCount || 0,
          platformCommission: todayIncome?.platformCommission || 0,
          netIncome: todayIncome?.netIncome || 0,
          averageOrderValue: todayIncome?.averageOrderValue || 0
        },
        thisWeek: weeklyIncome[0] || {
          totalIncome: 0, cashIncome: 0, onlineIncome: 0, walletIncome: 0,
          totalOrders: 0, platformCommission: 0, netIncome: 0
        },
        thisMonth: monthlyIncome[0] || {
          totalIncome: 0, cashIncome: 0, onlineIncome: 0, walletIncome: 0,
          totalOrders: 0, platformCommission: 0, netIncome: 0
        },
        customPeriod: customPeriodIncome,
        allTime: {
          totalEarnings: wallet.totalEarnings,
          totalCashEarnings: wallet.totalCashEarnings,
          totalOnlineEarnings: wallet.totalOnlineEarnings,
          totalWalletEarnings: wallet.totalWalletEarnings,
          totalPlatformCommission: wallet.totalPlatformCommission
        }
      }
    });

  } catch (error) {
    console.error('Get income overview error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ 3. Get Daily Income (for charts)
module.exports.getDailyIncome = async (req, res) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate } = req.query;

    const profileResult = await getShopkeeperProfile(userId);
    if (profileResult.error) {
      return res.status(profileResult.status).json({
        success: false,
        message: profileResult.error
      });
    }
    const { shopkeeper } = profileResult;

    // Default: last 30 days
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);
    
    const start = startDate ? new Date(startDate) : new Date();
    if (!startDate) {
      start.setDate(start.getDate() - 30);
    }
    start.setHours(0, 0, 0, 0);

    const dailyIncome = await ShopkeeperDailyIncome.find({
      shopkeeperId: shopkeeper._id,
      date: { $gte: start, $lte: end }
    })
    .sort({ date: 1 })
    .lean();

    // Calculate totals for the period
    const periodTotals = dailyIncome.reduce((acc, day) => {
      acc.totalIncome += day.totalIncome || 0;
      acc.cashIncome += day.cashIncome || 0;
      acc.onlineIncome += day.onlineIncome || 0;
      acc.walletIncome += day.walletIncome || 0;
      acc.totalOrders += day.totalOrderCount || 0;
      acc.platformCommission += day.platformCommission || 0;
      acc.netIncome += day.netIncome || 0;
      return acc;
    }, {
      totalIncome: 0, cashIncome: 0, onlineIncome: 0, walletIncome: 0,
      totalOrders: 0, platformCommission: 0, netIncome: 0
    });

    return res.status(200).json({
      success: true,
      message: 'Daily income retrieved successfully',
      data: {
        period: {
          from: start,
          to: end,
          days: dailyIncome.length
        },
        totals: periodTotals,
        dailyBreakdown: dailyIncome.map(day => ({
          date: day.date,
          totalIncome: day.totalIncome,
          cashIncome: day.cashIncome,
          onlineIncome: day.onlineIncome,
          walletIncome: day.walletIncome,
          totalOrders: day.totalOrderCount,
          cashOrders: day.cashOrderCount,
          onlineOrders: day.onlineOrderCount,
          walletOrders: day.walletOrderCount,
          platformCommission: day.platformCommission,
          netIncome: day.netIncome,
          averageOrderValue: day.averageOrderValue
        }))
      }
    });

  } catch (error) {
    console.error('Get daily income error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ 4. Get Income by Payment Mode
module.exports.getIncomeByPaymentMode = async (req, res) => {
  try {
    const userId = req.user._id;
    const { period = 'month' } = req.query; // day, week, month, all

    const profileResult = await getShopkeeperProfile(userId);
    if (profileResult.error) {
      return res.status(profileResult.status).json({
        success: false,
        message: profileResult.error
      });
    }
    const { shopkeeper } = profileResult;

    // Calculate date range based on period
    let startDate = new Date();
    switch (period) {
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - startDate.getDay() + 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'all':
        startDate = new Date(0); // All time
        break;
      default:
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
    }

    const incomeByMode = await ShopkeeperTransaction.aggregate([
      {
        $match: {
          shopkeeperId: shopkeeper._id,
          type: 'ORDER_CREDIT',
          status: 'SUCCESS',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$paymentMode',
          totalAmount: { $sum: '$amount' },
          totalCommission: { $sum: '$platformCommission' },
          totalNetAmount: { $sum: '$netAmount' },
          transactionCount: { $sum: 1 },
          averageAmount: { $avg: '$amount' }
        }
      },
      {
        $sort: { totalNetAmount: -1 }
      }
    ]);

    // Calculate overall totals
    const overallTotals = incomeByMode.reduce((acc, mode) => {
      acc.totalAmount += mode.totalAmount;
      acc.totalCommission += mode.totalCommission;
      acc.totalNetAmount += mode.totalNetAmount;
      acc.totalTransactions += mode.transactionCount;
      return acc;
    }, { totalAmount: 0, totalCommission: 0, totalNetAmount: 0, totalTransactions: 0 });

    return res.status(200).json({
      success: true,
      message: 'Income by payment mode retrieved successfully',
      data: {
        period: period,
        startDate: startDate,
        overallTotals: overallTotals,
        byPaymentMode: incomeByMode.map(mode => ({
          paymentMode: mode._id,
          totalAmount: Math.round(mode.totalAmount * 100) / 100,
          totalCommission: Math.round(mode.totalCommission * 100) / 100,
          totalNetAmount: Math.round(mode.totalNetAmount * 100) / 100,
          transactionCount: mode.transactionCount,
          averageAmount: Math.round(mode.averageAmount * 100) / 100,
          percentage: overallTotals.totalNetAmount > 0
            ? Math.round((mode.totalNetAmount / overallTotals.totalNetAmount) * 10000) / 100
            : 0
        }))
      }
    });

  } catch (error) {
    console.error('Get income by payment mode error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ 5. Get Transaction History (Paginated Ledger)
module.exports.getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      page = 1,
      limit = 20,
      type,          // ORDER_CREDIT, SETTLEMENT_DEBIT, etc.
      paymentMode,   // CASH, ONLINE, WALLET
      startDate,
      endDate,
      status         // SUCCESS, PENDING, FAILED
    } = req.query;

    const profileResult = await getShopkeeperProfile(userId);
    if (profileResult.error) {
      return res.status(profileResult.status).json({
        success: false,
        message: profileResult.error
      });
    }
    const { shopkeeper } = profileResult;

    // Build query
    const query = { shopkeeperId: shopkeeper._id };

    if (type) {
      const validTypes = ['ORDER_CREDIT', 'SETTLEMENT_DEBIT', 'PAYOUT_DEBIT', 'REFUND_DEBIT', 'ADJUSTMENT_CREDIT', 'ADJUSTMENT_DEBIT'];
      if (validTypes.includes(type.toUpperCase())) {
        query.type = type.toUpperCase();
      }
    }

    if (paymentMode) {
      const validModes = ['CASH', 'ONLINE', 'WALLET'];
      if (validModes.includes(paymentMode.toUpperCase())) {
        query.paymentMode = paymentMode.toUpperCase();
      }
    }

    if (status) {
      const validStatuses = ['SUCCESS', 'PENDING', 'FAILED'];
      if (validStatuses.includes(status.toUpperCase())) {
        query.status = status.toUpperCase();
      }
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get transactions
    const transactions = await ShopkeeperTransaction.find(query)
      .populate('orderId', 'orderNumber orderToken paymentMethod totalAmount')
      .populate('settlementId', 'settlementNumber status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Total count
    const total = await ShopkeeperTransaction.countDocuments(query);

    // Summary for the filtered results
    const summary = await ShopkeeperTransaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalCredits: {
            $sum: {
              $cond: [{ $in: ['$type', ['ORDER_CREDIT', 'ADJUSTMENT_CREDIT']] }, '$netAmount', 0]
            }
          },
          totalDebits: {
            $sum: {
              $cond: [{ $in: ['$type', ['SETTLEMENT_DEBIT', 'PAYOUT_DEBIT', 'REFUND_DEBIT', 'ADJUSTMENT_DEBIT']] }, '$amount', 0]
            }
          }
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      message: 'Transaction history retrieved successfully',
      data: {
        transactions: transactions,
        pagination: {
          currentPage: pageNum,
          limit: limitNum,
          total: total,
          totalPages: Math.ceil(total / limitNum)
        },
        summary: summary[0] || { totalCredits: 0, totalDebits: 0 }
      }
    });

  } catch (error) {
    console.error('Get transaction history error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ 6. Get Transaction Detail
module.exports.getTransactionDetail = async (req, res) => {
  try {
    const userId = req.user._id;
    const { transactionId } = req.params;

    const profileResult = await getShopkeeperProfile(userId);
    if (profileResult.error) {
      return res.status(profileResult.status).json({
        success: false,
        message: profileResult.error
      });
    }
    const { shopkeeper } = profileResult;

    const transaction = await ShopkeeperTransaction.findOne({
      _id: transactionId,
      shopkeeperId: shopkeeper._id
    })
    .populate('orderId', 'orderNumber orderToken paymentMethod totalAmount orderStatus customerId deliveredAt')
    .populate('settlementId', 'settlementNumber type status amount netAmount completedAt')
    .lean();

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Transaction detail retrieved successfully',
      data: {
        transaction: transaction
      }
    });

  } catch (error) {
    console.error('Get transaction detail error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
