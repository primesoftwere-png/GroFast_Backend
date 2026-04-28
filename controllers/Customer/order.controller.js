const Order = require("../../models/Customer/Order");
const OrderItem = require("../../models/Customer/OrderItem");
const Cart = require("../../models/Customer/Cart");
const Product = require("../../models/Product.model");
const { v4: uuidv4 } = require('uuid');

// ✅ Convert Cart to Order with Auto-Generated Order Number
module.exports.convertCartToOrder = async (req, res) => {
  try {
    const { 
      userId, 
      deliveryAddressId, 
      paymentMethod
    } = req.body;

    // Validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    if (!deliveryAddressId) {
      return res.status(400).json({
        success: false,
        message: "Delivery address ID is required"
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required"
      });
    }

    if (!['cod', 'online', 'wallet'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method. Must be 'cod', 'online', or 'wallet'"
      });
    }

    // Find user's cart
    const cart = await Cart.findOne({ userId }).populate('products.productId');

    if (!cart || !cart.products || cart.products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty. Cannot create order."
      });
    }

    // Get shopId from the first product's creator
    const firstProduct = cart.products[0].productId;
    if (!firstProduct || !firstProduct.createdBy) {
      return res.status(400).json({
        success: false,
        message: "Unable to determine shop from cart products"
      });
    }
    const shopId = firstProduct.createdBy;

    // Validate all products exist and have sufficient stock
    let subtotal = 0;
    let taxAmount = 0;
    const orderItems = [];

    for (const cartItem of cart.products) {
      const product = cartItem.productId;

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found in cart`
        });
      }

      // Check stock availability
      if (product.productQuantity < cartItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.productName}. Available: ${product.productQuantity}, Requested: ${cartItem.quantity}`
        });
      }

      // Calculate prices
      const unitPrice = product.productPrice;
      const gst = (unitPrice * 18) / 100; // 18% GST
      const totalPrice = (unitPrice + gst) * cartItem.quantity;

      subtotal += unitPrice * cartItem.quantity;
      taxAmount += gst * cartItem.quantity;

      // Prepare order item data
      orderItems.push({
        productId: product._id,
        productName: product.productName,
        quantity: cartItem.quantity,
        unitPrice: unitPrice,
        discountAmount: 0,
        totalPrice: totalPrice
      });
    }

    // Generate unique order number
    const orderNumber = `ORD-${Date.now()}-${uuidv4().toUpperCase().slice(0, 6)}`;

    // Calculate final amounts (no delivery charge or discount)
    const deliveryCharge = 0;
    const discountAmount = 0;
    const totalAmount = subtotal + taxAmount + deliveryCharge - discountAmount;

    // Create order
    const newOrder = new Order({
      orderNumber: orderNumber,
      customerId: userId,
      shopId: shopId,
      deliveryAddressId: deliveryAddressId,
      orderStatus: 'pending',
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'pending',
      paymentMethod: paymentMethod,
      subtotal: subtotal,
      deliveryCharge: deliveryCharge,
      discountAmount: discountAmount,
      taxAmount: taxAmount,
      totalAmount: totalAmount,
      specialInstructions: '',
      estimatedDeliveryTime: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
    });

    await newOrder.save();

    // Create order items
    const createdOrderItems = [];
    for (const item of orderItems) {
      const orderItem = new OrderItem({
        orderId: newOrder._id,
        ...item
      });
      await orderItem.save();
      createdOrderItems.push(orderItem);

      // Update product stock
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { productQuantity: -item.quantity } }
      );
    }

    // Clear the cart after successful order creation
    cart.products = [];
    cart.totalPrice = 0;
    cart.totalGST = 0;
    await cart.save();

    // Populate order details for response
    const populatedOrder = await Order.findById(newOrder._id)
      .populate('customerId', 'fullname email phone')
      .populate('shopId', 'fullname email')
      .populate('deliveryAddressId');

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        order: populatedOrder,
        orderItems: createdOrderItems,
        orderNumber: orderNumber
      }
    });

  } catch (error) {
    console.error("Error in convertCartToOrder:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create order from cart",
      error: error.message
    });
  }
};

module.exports.placeOrder = async (req, res) => {
  try {
    const { userId, products, amount, razorpay_order_id, razorpay_payment_id } = req.body;

    const newOrder = new Order({
      user: userId,
      products,
      amount,
      razorpay_order_id,
      razorpay_payment_id,
      status: "confirmed",
    });
    await newOrder.save();

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order: newOrder,
    });
  } catch (error) {
    console.error("Order placement failed:", error);
    res.status(500).json({
      success: false,
      message: "Order placement failed",
      error: error.message,
    });
  }
};

module.exports.getOrderById = async (req, res) => {
  try {
    const { placeOrderId } = req.params;
    if (!placeOrderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }
    
    // Get order by ID directly
    const order = await Order.findById(placeOrderId)
      .populate("user")
      .populate({
        path: "products.productId",
        populate: {
          path: "createdBy",
          model: "User",
        }
      });
    
    console.log("Order:", order);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Failed to fetch order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      error: error.message,
    });
  }
};