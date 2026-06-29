const Order = require('../../models/Customer/Order');
const DeliveryReview = require('../../models/Customer/DeliveryReview');
const Product = require('../../models/Product.model');
const mongoose = require('mongoose');

module.exports.submitReview = async (req, res) => {
    try {
        const { orderToken } = req.params;
        const { deliveryBoyReview, productReviews } = req.body;
        const customerId = req.user._id;

        // Find the order using orderToken
        const order = await Order.findOne({ orderToken, customerId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found or you do not have permission to review this order' });
        }

        // Only allow reviews for delivered orders
        if (order.orderStatus !== 'DELIVERED') {
            return res.status(400).json({ success: false, message: 'You can only review delivered orders' });
        }

        const reviewResults = {
            deliveryReview: null,
            productReviews: []
        };

        // 1. Process Delivery Boy Review
        if (deliveryBoyReview && order.deliveryBoyId) {
            const { rating, reviewText } = deliveryBoyReview;
            
            if (rating && rating >= 1 && rating <= 5) {
                // Check if already reviewed
                let delReview = await DeliveryReview.findOne({ orderId: order._id, customerId, deliveryBoyId: order.deliveryBoyId });
                
                if (delReview) {
                    delReview.rating = rating;
                    delReview.reviewText = reviewText;
                    await delReview.save();
                } else {
                    delReview = new DeliveryReview({
                        orderId: order._id,
                        customerId,
                        deliveryBoyId: order.deliveryBoyId,
                        rating,
                        reviewText
                    });
                    await delReview.save();
                }
                reviewResults.deliveryReview = delReview;
            }
        }

        // 2. Process Product Reviews
        if (productReviews && Array.isArray(productReviews)) {
            for (const review of productReviews) {
                const { productId, rating, reviewText } = review;
                
                if (!mongoose.Types.ObjectId.isValid(productId) || !rating || rating < 1 || rating > 5) {
                    continue; // Skip invalid reviews
                }
                
                // Verify the product was actually in this order
                const itemInOrder = order.items.find(item => item.productId.toString() === productId);
                if (!itemInOrder) continue; // Skip products not in this order

                const product = await Product.findById(productId);
                if (product) {
                    // Check if user already reviewed this product
                    const existingReviewIndex = product.productReviews.findIndex(
                        (pr) => pr.userId && pr.userId.toString() === customerId.toString()
                    );

                    if (existingReviewIndex !== -1) {
                        product.productReviews[existingReviewIndex].rating = rating;
                        product.productReviews[existingReviewIndex].reviewText = reviewText;
                    } else {
                        product.productReviews.push({
                            userId: customerId,
                            rating,
                            reviewText
                        });
                    }

                    // Recalculate average rating
                    const totalReviews = product.productReviews.length;
                    const sumRatings = product.productReviews.reduce((sum, pr) => sum + pr.rating, 0);
                    product.productRating = totalReviews > 0 ? (sumRatings / totalReviews) : 0;
                    
                    await product.save();
                    
                    reviewResults.productReviews.push({
                        productId,
                        rating,
                        reviewText
                    });
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Reviews submitted successfully',
            data: reviewResults
        });

    } catch (error) {
        console.error('Error submitting review:', error);
        return res.status(500).json({ success: false, message: 'Failed to submit reviews', error: error.message });
    }
};
