const mongoose = require('mongoose');
const Order = require('../models/Customer/Order');
const Shopkeeper = require('../models/ShopKeeper/Shopkeeper');
const Shop = require('../models/ShopKeeper/Shop');
const ShopkeeperWallet = require('../models/ShopKeeper/ShopkeeperWallet');
const ShopkeeperTransaction = require('../models/ShopKeeper/ShopkeeperTransaction');
const ShopkeeperDailyIncome = require('../models/ShopKeeper/ShopkeeperDailyIncome');

const DeliveryBoyWallet = require('../models/DeliveryBoy/DeliveryBoyWallet');
const WalletTransaction = require('../models/DeliveryBoy/WalletTransaction');

const GrofastWallet = require('../models/SuperAdmin/GrofastWallet');
const Transaction = require('../models/SuperAdmin/Transaction');

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

class SettlementEngine {
  
  /**
   * Process financial settlements for a delivered order.
   * This is the single source of truth for wallet updates to ensure atomicity.
   * 
   * @param {string|ObjectId} orderId 
   * @returns {Promise<{success: boolean, message?: string, error?: string}>}
   */
  static async processDeliveredOrder(orderId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Fetch Order
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw new Error('Order not found');
      }

      // Ensure we only process if it hasn't been settled yet.
      // We will add `settlementStatus` to Order if it doesn't exist, but since it's not in schema by default, 
      // we check transaction records to prevent duplication.
      
      const existingShopTx = await ShopkeeperTransaction.findOne({
        orderId: order._id,
        type: 'ORDER_CREDIT'
      }).session(session);

      if (existingShopTx) {
        await session.abortTransaction();
        session.endSession();
        return { success: true, message: 'Already processed' };
      }

      // 2. Fetch Shopkeeper & Shop
      const shopkeeper = await Shopkeeper.findOne({ $or: [{ userId: order.shopId }, { _id: order.shopId }] }).session(session);
      if (!shopkeeper) {
        throw new Error('Shopkeeper not found');
      }

      const shop = await Shop.findOne({ shopkeeperId: shopkeeper._id }).session(session);
      
      // Global commission rate is 10% as requested by User
      const commissionRate = 10; 

      // Delivery earnings is based on distance (7 Rs/km)
      let deliveryEarnings = order.deliveryCharge || 30; // fallback
      if (order.pickupAddress && order.pickupAddress.lat && order.deliveryAddress && order.deliveryAddress.lat) {
        const dist = calculateDistance(
          order.pickupAddress.lat,
          order.pickupAddress.lng,
          order.deliveryAddress.lat,
          order.deliveryAddress.lng
        );
        if (dist > 0) {
          deliveryEarnings = Math.round(dist * 7); // 7 Rs per KM
        }
      }
      const orderAmount = order.totalAmount;
      const paymentMode = mapPaymentMode(order.paymentMethod);
      
      // Shopkeeper gets (Total - platform Commission). Note: Since delivery boy earns from deliveryCharge, 
      // and totalAmount = subtotal + deliveryCharge + tax - discount
      // the commission should strictly apply to the shopkeeper's share (subtotal) or the totalAmount as per existing logic.
      // Existing logic applied commission to totalAmount:
      const platformCommission = Math.round((orderAmount * commissionRate / 100) * 100) / 100;
      
      // But wait! Shopkeeper net amount = totalAmount - platformCommission - deliveryEarnings.
      // Because deliveryCharge is part of totalAmount but goes to delivery boy!
      // Let's ensure shopkeeper gets: totalAmount - platformCommission - deliveryEarnings
      const shopkeeperNetAmount = Math.round((orderAmount - platformCommission - deliveryEarnings) * 100) / 100;

      // ============================
      // 3. Update Shopkeeper Wallet
      // ============================
      let skWallet = await ShopkeeperWallet.findOne({ shopkeeperId: shopkeeper._id }).session(session);
      if (!skWallet) {
        skWallet = new ShopkeeperWallet({ shopkeeperId: shopkeeper._id });
      }

      const skBalanceBefore = skWallet.balance || 0;

      switch (paymentMode) {
        case 'CASH':
          skWallet.addCashEarnings(orderAmount - deliveryEarnings, platformCommission);
          break;
        case 'ONLINE':
          skWallet.addOnlineEarnings(orderAmount - deliveryEarnings, platformCommission);
          break;
        case 'WALLET':
          skWallet.addWalletEarnings(orderAmount - deliveryEarnings, platformCommission);
          break;
        default:
          skWallet.addOnlineEarnings(orderAmount - deliveryEarnings, platformCommission);
      }
      
      await skWallet.save({ session });

      await ShopkeeperTransaction.create([{
        shopkeeperId: shopkeeper._id,
        orderId: order._id,
        type: 'ORDER_CREDIT',
        paymentMode: paymentMode,
        amount: orderAmount - deliveryEarnings,
        platformCommission: platformCommission,
        netAmount: shopkeeperNetAmount,
        balanceBefore: skBalanceBefore,
        balanceAfter: skWallet.balance,
        description: `Income from order ${order.orderNumber} (${paymentMode})`,
        status: 'SUCCESS',
        referenceId: order.orderToken,
        metadata: {
          orderNumber: order.orderNumber,
          paymentMethod: order.paymentMethod,
          commissionRate: commissionRate,
          deliveryEarnings: deliveryEarnings
        }
      }], { session });

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
            [incomeField]: shopkeeperNetAmount,
            [countField]: 1,
            totalIncome: shopkeeperNetAmount,
            totalOrderCount: 1,
            platformCommission: platformCommission,
            netIncome: shopkeeperNetAmount
          }
        },
        { upsert: true, new: true, session }
      );

      // ============================
      // 4. Update Delivery Boy Wallet
      // ============================
      if (order.deliveryBoyId) {
        let dbWallet = await DeliveryBoyWallet.findOne({ deliveryBoyId: order.deliveryBoyId }).session(session);
        if (!dbWallet) {
          dbWallet = new DeliveryBoyWallet({ 
            deliveryBoyId: order.deliveryBoyId,
            balance: 0,
            codLimit: 10000 
          });
        }

        const dbBalanceBefore = dbWallet.balance || 0;
        
        // Add delivery earnings
        dbWallet.balance += deliveryEarnings;
        dbWallet.totalEarnings = (dbWallet.totalEarnings || 0) + deliveryEarnings;
        
        let dbBalanceAfterEarnings = dbWallet.balance;

        // Record Earnings Transaction
        await WalletTransaction.create([{
          deliveryBoyId: order.deliveryBoyId,
          orderId: order._id,
          transactionType: 'credit',
          amount: deliveryEarnings,
          balanceBefore: dbBalanceBefore,
          balanceAfter: dbBalanceAfterEarnings,
          description: `Delivery earnings for order ${order.orderNumber}`,
          paymentMethod: paymentMode.toLowerCase(),
          referenceNumber: order.orderToken,
          status: 'completed'
        }], { session });

        // If COD, deduct total order amount from delivery boy wallet (create debt)
        if (paymentMode === 'CASH') {
          dbWallet.balance -= orderAmount;
          dbWallet.codCollected = (dbWallet.codCollected || 0) + orderAmount;
          dbWallet.codPending = (dbWallet.codPending || 0) + orderAmount;
          
          await WalletTransaction.create([{
            deliveryBoyId: order.deliveryBoyId,
            orderId: order._id,
            transactionType: 'debit',
            amount: orderAmount,
            balanceBefore: dbBalanceAfterEarnings,
            balanceAfter: dbWallet.balance,
            description: `Cash collection for order ${order.orderNumber}`,
            paymentMethod: 'cod',
            referenceNumber: order.orderToken,
            status: 'completed'
          }], { session });
        }

        // Auto-block if COD limit exceeded, auto-unblock if within limits
        const DeliveryBoy = require('../models/DeliveryBoy/DeliveryBoy');
        if (Math.abs(dbWallet.balance) > (dbWallet.codLimit || 1000) && dbWallet.balance < 0) {
          dbWallet.isBlocked = true;
          dbWallet.blockReason = "COD limit exceeded. Please settle your pending amount.";
          
          const User = require('../models/user.model');
          await User.findByIdAndUpdate(
            order.deliveryBoyId, 
            { $set: { 'roleDetails.deliveryBoy.deliveryBoyStatus': 'inactive' } },
            { session }
          );

          await DeliveryBoy.findOneAndUpdate(
            { userId: order.deliveryBoyId },
            { isBlocked: true, blockReason: "COD limit exceeded. Please settle your pending amount." },
            { session }
          );
        } else {
          // Unblock if they are within limit and currently blocked for COD
          if (dbWallet.isBlocked && dbWallet.blockReason && dbWallet.blockReason.toLowerCase().includes('cod limit exceeded')) {
             dbWallet.isBlocked = false;
             dbWallet.blockReason = null;
             
             const User = require('../models/user.model');
             await User.findByIdAndUpdate(
               order.deliveryBoyId, 
               { $set: { 'roleDetails.deliveryBoy.deliveryBoyStatus': 'active' } },
               { session }
             );

             await DeliveryBoy.findOneAndUpdate(
                { userId: order.deliveryBoyId },
                { isBlocked: false, blockReason: null },
                { session }
             );
          }
        }

        await dbWallet.save({ session });
      }

      // ============================
      // 5. Update Platform Wallet (Grofast)
      // ============================
      let platformWallet = await GrofastWallet.findOne({}).session(session);
      if (!platformWallet) {
        platformWallet = new GrofastWallet({ balance: 0, totalEarnings: 0 });
      }

      platformWallet.balance += platformCommission;
      platformWallet.totalEarnings += platformCommission;
      await platformWallet.save({ session });

      await Transaction.create([{
        orderId: order._id,
        transactionType: 'commission',
        amount: platformCommission,
        status: 'success'
      }], { session });

      await session.commitTransaction();
      session.endSession();

      return { success: true, message: 'Settlement processed successfully' };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Settlement Engine Error:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = SettlementEngine;
