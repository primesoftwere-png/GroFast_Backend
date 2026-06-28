// controllers/SuperAdmin/paymentSettlement.controller.js
const Order = require('../../models/Customer/Order');
const ShopkeeperWallet = require('../../models/ShopKeeper/ShopkeeperWallet');
const DeliveryBoyWallet = require('../../models/DeliveryBoy/DeliveryBoyWallet');
const GrofastWallet = require('../../models/SuperAdmin/GrofastWallet');

exports.settleOrderPayment = async (req, res) => {
  try {
    const { orderId, grofastFee } = req.body;
    
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.paymentStatus === 'PAID') {
      return res.status(400).json({ success: false, message: 'Payment is already settled for this order' });
    }

    const platformFee = Number(grofastFee) || 20; // Default platform fee if not provided
    const deliveryFee = order.deliveryCharge || 30; // Using delivery charge from order
    const shopkeeperAmount = order.totalAmount - deliveryFee - platformFee;

    if (shopkeeperAmount < 0) {
      return res.status(400).json({ success: false, message: 'Invalid split amounts, shopkeeper amount is negative' });
    }

    // 1. Get or Create Wallets
    let shopkeeperWallet = await ShopkeeperWallet.findOne({ shopkeeperId: order.shopId });
    if (!shopkeeperWallet) {
      shopkeeperWallet = new ShopkeeperWallet({ shopkeeperId: order.shopId });
    }

    let grofastWallet = await GrofastWallet.findOne({});
    if (!grofastWallet) {
      grofastWallet = new GrofastWallet({});
    }

    let deliveryBoyWallet = null;
    if (order.deliveryBoyId) {
      deliveryBoyWallet = await DeliveryBoyWallet.findOne({ deliveryBoyId: order.deliveryBoyId });
      if (!deliveryBoyWallet) {
        deliveryBoyWallet = new DeliveryBoyWallet({ deliveryBoyId: order.deliveryBoyId, codLimit: 1000 });
      }
    }

    // 2. Perform the split based on payment method
    if (order.paymentMethod === 'COD') {
      // For COD: Delivery boy collected the cash
      // Platform gets platformFee
      grofastWallet.balance += platformFee;
      grofastWallet.totalEarnings += platformFee;
      
      // Shopkeeper gets shopkeeperAmount
      // We will add it as cash earnings since it's COD
      if (typeof shopkeeperWallet.addCashEarnings === 'function') {
        shopkeeperWallet.addCashEarnings(shopkeeperAmount + platformFee, platformFee);
      } else {
        shopkeeperWallet.balance += shopkeeperAmount;
        shopkeeperWallet.totalEarnings += shopkeeperAmount;
      }

      // Delivery Boy gets deliveryFee, but he holds the full cash
      if (deliveryBoyWallet) {
        deliveryBoyWallet.codCollected += order.totalAmount;
        // The net change to his wallet: he keeps deliveryFee, owes the rest
        // Balance might be his payable amount to platform, so we subtract what he owes
        const amountOwed = order.totalAmount - deliveryFee;
        deliveryBoyWallet.balance -= amountOwed;
        deliveryBoyWallet.totalEarnings += deliveryFee;
      }

    } else if (order.paymentMethod === 'ONLINE') {
      // For ONLINE: Platform collected the money directly
      // Platform keeps platformFee
      grofastWallet.balance += platformFee;
      grofastWallet.totalEarnings += platformFee;

      // Shopkeeper gets shopkeeperAmount
      if (typeof shopkeeperWallet.addOnlineEarnings === 'function') {
        shopkeeperWallet.addOnlineEarnings(shopkeeperAmount + platformFee, platformFee);
      } else {
        shopkeeperWallet.balance += shopkeeperAmount;
        shopkeeperWallet.totalEarnings += shopkeeperAmount;
      }

      // Delivery Boy gets deliveryFee (Platform owes him)
      if (deliveryBoyWallet) {
        deliveryBoyWallet.balance += deliveryFee;
        deliveryBoyWallet.totalEarnings += deliveryFee;
      }
    } else {
      return res.status(400).json({ success: false, message: 'Invalid payment method for settlement' });
    }

    // 3. Save all wallets
    await shopkeeperWallet.save();
    await grofastWallet.save();
    if (deliveryBoyWallet) {
      await deliveryBoyWallet.save();
    }

    // 4. Update Order Status
    order.paymentStatus = 'PAID';
    await order.save();

    res.status(200).json({
      success: true,
      message: 'Payment settlement completed successfully',
      data: {
        orderId: order._id,
        totalAmount: order.totalAmount,
        split: {
          deliveryBoyFee: deliveryFee,
          platformFee: platformFee,
          shopkeeperAmount: shopkeeperAmount
        }
      }
    });

  } catch (error) {
    console.error('Settlement Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

exports.approveDeliveryBoySettlement = async (req, res) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const adminId = req.user._id;
    const { settlementId, action, rejectionReason } = req.body;
    
    if (!settlementId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action or missing settlement ID' });
    }

    const Settlement = require('../../models/DeliveryBoy/Settlement');
    const DeliveryBoyNotification = require('../../models/DeliveryBoy/DeliveryBoyNotification');
    const WalletTransaction = require('../../models/DeliveryBoy/WalletTransaction');
    const DeliveryBoy = require('../../models/DeliveryBoy/DeliveryBoy');

    const settlement = await Settlement.findById(settlementId).session(session);
    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement request not found' });
    }

    if (settlement.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Settlement is already ${settlement.status}` });
    }

    if (action === 'reject') {
      settlement.status = 'rejected';
      settlement.rejectionReason = rejectionReason || 'Rejected by Admin';
      await settlement.save({ session });

      await DeliveryBoyNotification.create([{
        deliveryBoyId: settlement.deliveryBoyId,
        title: "Settlement Rejected",
        message: `Your settlement request of ₹${settlement.amount} was rejected. Reason: ${settlement.rejectionReason}`,
        type: 'payment_received',
        priority: 'high'
      }], { session });

    } else if (action === 'approve') {
      settlement.status = 'approved';
      settlement.approvedBy = adminId;
      settlement.approvedAt = new Date();
      await settlement.save({ session });

      // Find Wallet
      let wallet = await DeliveryBoyWallet.findOne({ deliveryBoyId: settlement.deliveryBoyId }).session(session);
      if (!wallet) {
        throw new Error('Delivery Boy wallet not found');
      }

      const balanceBefore = wallet.balance;
      // Balance is negative if they owe money for COD. So we ADD to balance to clear the debt.
      wallet.balance += settlement.amount; 
      
      // We reduce the codPending amount since they paid it
      wallet.codPending = (wallet.codPending || 0) - settlement.amount;
      
      // If the limit issue is resolved, unblock the user automatically
      if (wallet.isBlocked && wallet.balance > -wallet.codLimit) {
        wallet.isBlocked = false;
        wallet.blockReason = null;
        
        // Also unblock their main profile
        await DeliveryBoy.findOneAndUpdate(
          { userId: settlement.deliveryBoyId },
          { isBlocked: false, blockReason: null },
          { session }
        );
      }
      
      await wallet.save({ session });

      // Add money to Platform Wallet (Admin physically received cash or bank transfer from DBoy)
      let grofastWallet = await GrofastWallet.findOne({}).session(session);
      if (!grofastWallet) {
        grofastWallet = new GrofastWallet({});
      }
      grofastWallet.balance += settlement.amount; // The cash reaches the platform
      await grofastWallet.save({ session });

      // Create Wallet Transaction
      await WalletTransaction.create([{
        deliveryBoyId: settlement.deliveryBoyId,
        transactionType: 'credit', // Credit back their wallet to offset COD debt
        amount: settlement.amount,
        balanceBefore: balanceBefore,
        balanceAfter: wallet.balance,
        description: `COD Settlement Approved (${settlement.settlementNumber})`,
        paymentMethod: settlement.paymentMethod,
        status: 'completed'
      }], { session });

      // Create Notification
      await DeliveryBoyNotification.create([{
        deliveryBoyId: settlement.deliveryBoyId,
        title: "Settlement Approved",
        message: `Your settlement request of ₹${settlement.amount} has been approved. Your COD dues are updated.`,
        type: 'payment_received',
        priority: 'high'
      }], { session });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: `Settlement successfully ${action}d`
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Delivery Boy Settlement Admin Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};
