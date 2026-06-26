const Coupon = require("../../models/Customer/Coupon");

exports.validateCoupon = async (req, res) => {
  try {
    const { couponCode, orderAmount } = req.body;

    if (!couponCode) {
      return res.status(400).json({ success: false, message: "Coupon code is required" });
    }

    const coupon = await Coupon.findOne({ couponCode: couponCode.toUpperCase(), status: 'active' });
    
    if (!coupon) {
      return res.status(404).json({ success: false, message: "Invalid or inactive coupon code" });
    }

    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      return res.status(400).json({ success: false, message: "Coupon is expired or not yet valid" });
    }

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return res.status(400).json({ success: false, message: "Coupon usage limit has been reached" });
    }

    if (orderAmount < coupon.minOrderAmount) {
      return res.status(400).json({ success: false, message: `Minimum order amount of ₹${coupon.minOrderAmount} is required` });
    }

    let discountAmount = 0;
    if (coupon.couponType === 'percentage') {
      discountAmount = (orderAmount * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
        discountAmount = coupon.maxDiscountAmount;
      }
    } else {
      discountAmount = coupon.discountValue;
    }

    return res.status(200).json({ 
      success: true, 
      message: "Coupon applied successfully",
      data: {
        discountAmount,
        couponCode: coupon.couponCode,
        offerName: coupon.offerName
      }
    });

  } catch (error) {
    console.error("Validate Coupon Error:", error);
    return res.status(500).json({ success: false, message: "Server error validating coupon" });
  }
};
