// controllers/shopkeeper/settlement.controller.js
const Shopkeeper = require('../../models/ShopKeeper/Shopkeeper');
const Shop = require('../../models/ShopKeeper/Shop');
const ShopkeeperWallet = require('../../models/ShopKeeper/ShopkeeperWallet');
const ShopkeeperBankDetails = require('../../models/ShopKeeper/ShopkeeperBankDetails');
const ShopkeeperSettlement = require('../../models/ShopKeeper/ShopkeeperSettlement');
const ShopkeeperTransaction = require('../../models/ShopKeeper/ShopkeeperTransaction');

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

// ==================== API CONTROLLERS ====================

// ✅ 1. Request Settlement (Bank/UPI Payout)
module.exports.requestSettlement = async (req, res) => {
  try {
    const userId = req.user._id;
    const { amount, type = 'BANK_TRANSFER', remarks } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid settlement amount is required'
      });
    }

    // Validate type
    const validTypes = ['BANK_TRANSFER', 'UPI_TRANSFER', 'CASH_COLLECTION'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid settlement type. Allowed: ${validTypes.join(', ')}`
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

    // Get wallet
    const wallet = await getOrCreateWallet(shopkeeper._id);

    // Check minimum payout amount
    const minimumAmount = wallet.minimumPayoutAmount || 100;
    if (amount < minimumAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum settlement amount is ₹${minimumAmount}`,
        data: { minimumAmount }
      });
    }

    // Check balance
    if (!wallet.canWithdraw(amount)) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₹${wallet.balance}`,
        data: { availableBalance: wallet.balance }
      });
    }

    // Check if wallet is active
    if (!wallet.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Wallet is currently inactive. Please contact support.'
      });
    }

    // Check for any pending settlements
    const pendingSettlement = await ShopkeeperSettlement.findOne({
      shopkeeperId: shopkeeper._id,
      status: { $in: ['PENDING', 'PROCESSING'] }
    });

    if (pendingSettlement) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending/processing settlement. Please wait for it to complete or cancel it.',
        data: {
          pendingSettlementId: pendingSettlement._id,
          settlementNumber: pendingSettlement.settlementNumber,
          amount: pendingSettlement.amount,
          status: pendingSettlement.status
        }
      });
    }

    // For bank/UPI transfers, verify bank details
    if (type === 'BANK_TRANSFER' || type === 'UPI_TRANSFER') {
      const bankDetails = await ShopkeeperBankDetails.findOne({ shopkeeperId: shopkeeper._id });
      
      if (!bankDetails) {
        return res.status(400).json({
          success: false,
          message: 'Bank details not found. Please add your bank details first.'
        });
      }

      if (!bankDetails.isVerified) {
        return res.status(400).json({
          success: false,
          message: 'Bank details not verified. Please verify your bank details first.'
        });
      }

      if (type === 'UPI_TRANSFER' && !bankDetails.upiId) {
        return res.status(400).json({
          success: false,
          message: 'UPI ID not found in your bank details. Please add your UPI ID first.'
        });
      }

      // Generate settlement number
      const settlementNumber = await ShopkeeperSettlement.generateSettlementNumber();

      // Record balance before settlement
      const balanceBefore = wallet.balance;

      // Process settlement on wallet
      wallet.processSettlement(amount);
      await wallet.save();

      // Create settlement record
      const settlement = await ShopkeeperSettlement.create({
        shopkeeperId: shopkeeper._id,
        settlementNumber: settlementNumber,
        type: type,
        amount: amount,
        platformFee: 0, // No additional fee on settlement
        netAmount: amount,
        status: 'PENDING',
        bankDetails: {
          accountHolderName: bankDetails.accountHolderName,
          bankAccountNumber: bankDetails.bankAccountNumber,
          ifscCode: bankDetails.ifscCode,
          bankName: bankDetails.bankName,
          upiId: bankDetails.upiId
        },
        settlementPeriod: {
          from: wallet.lastPayoutAt || wallet.createdAt,
          to: new Date()
        },
        remarks: remarks || null,
        requestedAt: new Date()
      });

      // Create transaction record
      await ShopkeeperTransaction.create({
        shopkeeperId: shopkeeper._id,
        settlementId: settlement._id,
        type: 'SETTLEMENT_DEBIT',
        paymentMode: type === 'UPI_TRANSFER' ? 'ONLINE' : 'ONLINE',
        amount: amount,
        platformCommission: 0,
        netAmount: amount,
        balanceBefore: balanceBefore,
        balanceAfter: wallet.balance,
        description: `Settlement ${settlementNumber} - ${type === 'UPI_TRANSFER' ? 'UPI' : 'Bank'} transfer`,
        status: 'PENDING',
        referenceId: settlementNumber
      });

      return res.status(200).json({
        success: true,
        message: 'Settlement request submitted successfully. Amount will be transferred within 2-3 business days.',
        data: {
          settlement: {
            settlementId: settlement._id,
            settlementNumber: settlement.settlementNumber,
            type: settlement.type,
            amount: settlement.amount,
            netAmount: settlement.netAmount,
            status: settlement.status,
            requestedAt: settlement.requestedAt,
            bankDetails: {
              accountHolderName: bankDetails.accountHolderName,
              bankAccountNumber: bankDetails.bankAccountNumber.slice(-4).padStart(bankDetails.bankAccountNumber.length, '*'),
              ifscCode: bankDetails.ifscCode,
              bankName: bankDetails.bankName,
              upiId: type === 'UPI_TRANSFER' ? bankDetails.upiId : undefined
            }
          },
          wallet: {
            previousBalance: balanceBefore,
            currentBalance: wallet.balance,
            totalSettled: wallet.totalSettled
          }
        }
      });
    }

    // For CASH_COLLECTION type
    const settlementNumber = await ShopkeeperSettlement.generateSettlementNumber();
    const balanceBefore = wallet.balance;

    wallet.processSettlement(amount);
    await wallet.save();

    const settlement = await ShopkeeperSettlement.create({
      shopkeeperId: shopkeeper._id,
      settlementNumber: settlementNumber,
      type: 'CASH_COLLECTION',
      amount: amount,
      platformFee: 0,
      netAmount: amount,
      status: 'PENDING',
      settlementPeriod: {
        from: wallet.lastPayoutAt || wallet.createdAt,
        to: new Date()
      },
      remarks: remarks || 'Cash collection settlement',
      requestedAt: new Date()
    });

    await ShopkeeperTransaction.create({
      shopkeeperId: shopkeeper._id,
      settlementId: settlement._id,
      type: 'SETTLEMENT_DEBIT',
      paymentMode: 'CASH',
      amount: amount,
      platformCommission: 0,
      netAmount: amount,
      balanceBefore: balanceBefore,
      balanceAfter: wallet.balance,
      description: `Settlement ${settlementNumber} - Cash collection`,
      status: 'PENDING',
      referenceId: settlementNumber
    });

    return res.status(200).json({
      success: true,
      message: 'Cash collection settlement request submitted successfully.',
      data: {
        settlement: {
          settlementId: settlement._id,
          settlementNumber: settlement.settlementNumber,
          type: settlement.type,
          amount: settlement.amount,
          status: settlement.status,
          requestedAt: settlement.requestedAt
        },
        wallet: {
          previousBalance: balanceBefore,
          currentBalance: wallet.balance,
          totalSettled: wallet.totalSettled
        }
      }
    });

  } catch (error) {
    console.error('Request settlement error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ 2. Get Settlements List (Paginated)
module.exports.getSettlements = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      page = 1,
      limit = 20,
      status,     // PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED
      type,       // BANK_TRANSFER, UPI_TRANSFER, CASH_COLLECTION
      startDate,
      endDate
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

    if (status) {
      const validStatuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'];
      if (validStatuses.includes(status.toUpperCase())) {
        query.status = status.toUpperCase();
      }
    }

    if (type) {
      const validTypes = ['BANK_TRANSFER', 'UPI_TRANSFER', 'CASH_COLLECTION'];
      if (validTypes.includes(type.toUpperCase())) {
        query.type = type.toUpperCase();
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

    // Get settlements
    const settlements = await ShopkeeperSettlement.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Mask bank account numbers in response
    const maskedSettlements = settlements.map(s => {
      if (s.bankDetails && s.bankDetails.bankAccountNumber) {
        s.bankDetails.bankAccountNumber = s.bankDetails.bankAccountNumber
          .slice(-4)
          .padStart(s.bankDetails.bankAccountNumber.length, '*');
      }
      return s;
    });

    // Total count
    const total = await ShopkeeperSettlement.countDocuments(query);

    return res.status(200).json({
      success: true,
      message: 'Settlements retrieved successfully',
      data: {
        settlements: maskedSettlements,
        pagination: {
          currentPage: pageNum,
          limit: limitNum,
          total: total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });

  } catch (error) {
    console.error('Get settlements error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ 3. Get Settlement Detail
module.exports.getSettlementDetail = async (req, res) => {
  try {
    const userId = req.user._id;
    const { settlementId } = req.params;

    const profileResult = await getShopkeeperProfile(userId);
    if (profileResult.error) {
      return res.status(profileResult.status).json({
        success: false,
        message: profileResult.error
      });
    }
    const { shopkeeper } = profileResult;

    const settlement = await ShopkeeperSettlement.findOne({
      _id: settlementId,
      shopkeeperId: shopkeeper._id
    }).lean();

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Settlement not found'
      });
    }

    // Mask bank account number
    if (settlement.bankDetails && settlement.bankDetails.bankAccountNumber) {
      settlement.bankDetails.bankAccountNumber = settlement.bankDetails.bankAccountNumber
        .slice(-4)
        .padStart(settlement.bankDetails.bankAccountNumber.length, '*');
    }

    // Get linked transactions
    const transactions = await ShopkeeperTransaction.find({
      settlementId: settlement._id
    })
    .sort({ createdAt: -1 })
    .lean();

    return res.status(200).json({
      success: true,
      message: 'Settlement detail retrieved successfully',
      data: {
        settlement: settlement,
        transactions: transactions
      }
    });

  } catch (error) {
    console.error('Get settlement detail error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ 4. Get Settlement Summary
module.exports.getSettlementSummary = async (req, res) => {
  try {
    const userId = req.user._id;

    const profileResult = await getShopkeeperProfile(userId);
    if (profileResult.error) {
      return res.status(profileResult.status).json({
        success: false,
        message: profileResult.error
      });
    }
    const { shopkeeper } = profileResult;

    // Overall settlement stats
    const overallStats = await ShopkeeperSettlement.aggregate([
      { $match: { shopkeeperId: shopkeeper._id } },
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: '$netAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // This month's settlements
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthlyStats = await ShopkeeperSettlement.aggregate([
      {
        $match: {
          shopkeeperId: shopkeeper._id,
          createdAt: { $gte: monthStart }
        }
      },
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: '$netAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Format stats
    const formatStats = (stats) => {
      const result = {
        total: { amount: 0, count: 0 },
        pending: { amount: 0, count: 0 },
        processing: { amount: 0, count: 0 },
        completed: { amount: 0, count: 0 },
        failed: { amount: 0, count: 0 },
        cancelled: { amount: 0, count: 0 }
      };

      stats.forEach(s => {
        const key = s._id.toLowerCase();
        result[key] = {
          amount: Math.round(s.totalAmount * 100) / 100,
          count: s.count
        };
        result.total.amount += s.totalAmount;
        result.total.count += s.count;
      });

      result.total.amount = Math.round(result.total.amount * 100) / 100;
      return result;
    };

    // Get wallet info
    const wallet = await getOrCreateWallet(shopkeeper._id);

    // Get last settlement
    const lastSettlement = await ShopkeeperSettlement.findOne({
      shopkeeperId: shopkeeper._id,
      status: 'COMPLETED'
    })
    .sort({ completedAt: -1 })
    .lean();

    return res.status(200).json({
      success: true,
      message: 'Settlement summary retrieved successfully',
      data: {
        wallet: {
          availableBalance: wallet.balance,
          totalSettled: wallet.totalSettled,
          minimumPayoutAmount: wallet.minimumPayoutAmount,
          currency: wallet.currency
        },
        overall: formatStats(overallStats),
        thisMonth: formatStats(monthlyStats),
        lastSettlement: lastSettlement ? {
          settlementNumber: lastSettlement.settlementNumber,
          amount: lastSettlement.netAmount,
          type: lastSettlement.type,
          completedAt: lastSettlement.completedAt
        } : null
      }
    });

  } catch (error) {
    console.error('Get settlement summary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ 5. Cancel Settlement
module.exports.cancelSettlement = async (req, res) => {
  try {
    const userId = req.user._id;
    const { settlementId } = req.params;
    const { reason } = req.body;

    const profileResult = await getShopkeeperProfile(userId);
    if (profileResult.error) {
      return res.status(profileResult.status).json({
        success: false,
        message: profileResult.error
      });
    }
    const { shopkeeper } = profileResult;

    // Find settlement
    const settlement = await ShopkeeperSettlement.findOne({
      _id: settlementId,
      shopkeeperId: shopkeeper._id
    });

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Settlement not found'
      });
    }

    // Can only cancel PENDING settlements
    if (settlement.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel settlement. Current status: ${settlement.status}. Only PENDING settlements can be cancelled.`
      });
    }

    // Get wallet and reverse the settlement
    const wallet = await getOrCreateWallet(shopkeeper._id);
    const balanceBefore = wallet.balance;

    wallet.reverseSettlement(settlement.amount);
    await wallet.save();

    // Update settlement status
    settlement.status = 'CANCELLED';
    settlement.cancelledAt = new Date();
    settlement.remarks = reason || 'Cancelled by shopkeeper';
    await settlement.save();

    // Create reversal transaction
    await ShopkeeperTransaction.create({
      shopkeeperId: shopkeeper._id,
      settlementId: settlement._id,
      type: 'ADJUSTMENT_CREDIT',
      paymentMode: settlement.type === 'CASH_COLLECTION' ? 'CASH' : 'ONLINE',
      amount: settlement.amount,
      platformCommission: 0,
      netAmount: settlement.amount,
      balanceBefore: balanceBefore,
      balanceAfter: wallet.balance,
      description: `Settlement ${settlement.settlementNumber} cancelled - funds returned`,
      status: 'SUCCESS',
      referenceId: settlement.settlementNumber
    });

    // Update the original settlement debit transaction status
    await ShopkeeperTransaction.updateOne(
      {
        settlementId: settlement._id,
        type: 'SETTLEMENT_DEBIT'
      },
      { status: 'FAILED' }
    );

    return res.status(200).json({
      success: true,
      message: 'Settlement cancelled successfully. Funds have been returned to your wallet.',
      data: {
        settlement: {
          settlementId: settlement._id,
          settlementNumber: settlement.settlementNumber,
          amount: settlement.amount,
          status: settlement.status,
          cancelledAt: settlement.cancelledAt,
          reason: settlement.remarks
        },
        wallet: {
          previousBalance: balanceBefore,
          currentBalance: wallet.balance
        }
      }
    });

  } catch (error) {
    console.error('Cancel settlement error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
