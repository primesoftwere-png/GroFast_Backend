const cron = require('node-cron');
const mongoose = require('mongoose');
const Order = require('../models/Customer/Order');

// Run every minute to check for expired orders
cron.schedule('* * * * *', async () => {
    try {
        // Skip if mongoose is not connected yet (readyState 1 = connected)
        if (mongoose.connection.readyState !== 1) {
            console.log('[CRON] Skipping order expiry job: Database not connected');
            return;
        }

        const now = new Date();
        const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);
        
        // 1. Expire if shopkeeper does not accept within 15 mins
        const pendingExpired = await Order.updateMany(
            { 
                orderStatus: 'PENDING',
                createdAt: { $lt: fifteenMinsAgo }
            },
            {
                $set: { 
                    orderStatus: 'EXPIRED', 
                    cancellationReason: 'Shopkeeper did not accept in 15 minutes',
                    expiredAt: now
                }
            }
        );
        
        if (pendingExpired.modifiedCount > 0) {
            console.log(`[CRON] Cancelled ${pendingExpired.modifiedCount} pending orders due to shopkeeper timeout (15m)`);
        }

        // 2. Fail if delivery boy does not accept within 15 mins of being waiting for a delivery boy
        const deliveryNotAccepted = await Order.updateMany(
            {
                orderStatus: { $in: ['CONFIRMED', 'ACCEPTED', 'READY_FOR_PICKUP', 'ASSIGNED', 'ASSIGNED_TO_DELIVERY'] },
                updatedAt: { $lt: fifteenMinsAgo }
            },
            {
                $set: {
                    orderStatus: 'EXPIRED',
                    cancellationReason: 'Delivery boy did not accept in 15 minutes',
                    expiredAt: now
                }
            }
        );

        if (deliveryNotAccepted.modifiedCount > 0) {
            console.log(`[CRON] Cancelled ${deliveryNotAccepted.modifiedCount} orders due to delivery boy not accepting in 15m`);
        }

        // 3. Fail if accepted by delivery boy but not delivered after 60 mins
        const sixtyMinsAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const deliveryNotDelivered = await Order.updateMany(
            {
                orderStatus: { $in: ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] },
                updatedAt: { $lt: sixtyMinsAgo }
            },
            {
                $set: {
                    orderStatus: 'EXPIRED',
                    cancellationReason: 'Order was picked up but not delivered in 60 minutes',
                    expiredAt: now
                }
            }
        );

        if (deliveryNotDelivered.modifiedCount > 0) {
            console.log(`[CRON] Cancelled ${deliveryNotDelivered.modifiedCount} orders due to delivery timeout (60m)`);
        }

    } catch (error) {
        console.error('[CRON] Error in order expiry job:', error);
    }
});

console.log('✓ Order expiry cron job initialized');
