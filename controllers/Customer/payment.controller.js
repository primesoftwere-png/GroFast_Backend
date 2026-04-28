const instance = require("../../config/razorpay").instance;
const crypto = require("crypto");

module.exports.createPaymentIntent = async (req, res) => {
  try {
    const raw = req.body.amount;
    console.log("Raw amount from request:", raw);
    const amount = Number(typeof raw === "object" ? raw.amount : raw);
    console.log("Processed amount in rupees:", amount);

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid amount. Must be a positive number in rupees.",
      });
    }

    const paymentOrder = await instance.orders.create({
      amount: Math.round(amount * 100), // Convert rupees to paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1,
    });
    console.log(
      "Creating Razorpay order for amount (in paise):",
      Math.round(amount * 100)
    );

    res.status(200).json({
      success: true,
      data: paymentOrder,
    });
  } catch (error) {
    console.error("Failed to create payment order:", error);
    console.error(
      "Razorpay Error Details:",
      error.response ? error.response.data : error
    );

    res.status(500).json({
      success: false,
      error: "Failed to create payment order",
      message: error.message,
    });
  }
};

module.exports.getKey = async (req, res) => {
  try {
    const key = process.env.RAZORPAY_KEY_ID;
    console.log("Razorpay Key ID:", key);
    res.status(200).json({
      success: true,
      key: key,
    });
  } catch (error) {
    console.error("Failed to get Razorpay key:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get Razorpay key",
      message: error.message,
    });
  }
};

module.exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    // Verify the payment signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    console.log("Generated Signature:", typeof generatedSignature);
    console.log("Received Signature:", typeof razorpay_signature);

    if (generatedSignature === razorpay_signature) {
      console.log("Payment verified successfully");
      res.status(200).json({
        success: true,
        message: "Payment verified successfully",
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }
  } catch (error) {
    console.error("Failed to verify payment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to verify payment",
      message: error.message,
    });
  }
};
