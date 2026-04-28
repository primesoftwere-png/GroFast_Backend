const productModel = require("../../models/Product.model");
const CartModel = require("../../models/Customer/Cart");

// ✅ Helper: Calculate Total Price & GST
const calculateTotals = (products, cartItems) => {
  let totalPrice = 0;
  let totalGST = 0;

  products.forEach((product) => {
    const cartItem = cartItems.find(
      (item) => item.productId.toString() === product._id.toString()
    );
    if (!cartItem) return;

    const quantity = cartItem.quantity;
    const price = product.productPrice;
    const gst = (price * 18) / 100;

    totalPrice += (price + gst) * quantity;
    totalGST += gst * quantity;
  });

  return { totalPrice, totalGST };
};

// ✅ Create Cart (when checkout starts)
exports.createCart = async (req, res) => {
  try {
    const { userId, cartItems, OrderId } = req.body;

    if (!userId || !cartItems || !OrderId) {
      return res
        .status(400)
        .json({ message: "User ID, cart items, and Order ID are required" });
    }

    const products = await productModel.find({
      _id: { $in: cartItems.map((item) => item.productId) },
    });
    console.log("Products fetched for cart creation:", products);
    if (!products.length) {
      return res.status(404).json({ message: "Products not found" });
    }

    const totals = calculateTotals(products, cartItems);

    const cartData = {
      userId,
      OrderId,
      products: cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      totalPrice: totals.totalPrice,
      totalGST: totals.totalGST,
    };

    // Create cart directly
    const cart = new CartModel(cartData);
    await cart.save();
    return res.status(201).json(cart);
  } catch (error) {
    console.error("Error in createCart:", error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Add Item to Cart (Single Product)
exports.addCartItem = async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body;

    // Validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required"
      });
    }

    // Validate MongoDB ObjectId format
    if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format"
      });
    }

    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    // Validate quantity
    const qty = quantity || 1;
    if (qty < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1"
      });
    }

    // Check if product exists
    const product = await productModel.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Check if product has enough stock
    if (product.productQuantity < qty) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Only ${product.productQuantity} items available`,
        availableQuantity: product.productQuantity
      });
    }

    // Find or create cart
    let cart = await CartModel.findOne({ userId });

    if (!cart) {
      cart = new CartModel({ 
        userId, 
        products: [],
        totalPrice: 0,
        totalGST: 0
      });
    }

    // Ensure products array exists (safety check)
    if (!cart.products) {
      cart.products = [];
    }

    // Check if product already in cart
    const existingItem = cart.products.find(
      (item) => item.productId.toString() === productId.toString()
    );

    let action = '';
    if (existingItem) {
      // Check total quantity doesn't exceed stock
      const newQuantity = existingItem.quantity + qty;
      if (newQuantity > product.productQuantity) {
        return res.status(400).json({
          success: false,
          message: `Cannot add ${qty} more. Maximum available: ${product.productQuantity - existingItem.quantity}`,
          currentQuantityInCart: existingItem.quantity,
          availableQuantity: product.productQuantity
        });
      }
      existingItem.quantity = newQuantity;
      action = 'updated';
    } else {
      cart.products.push({ productId, quantity: qty });
      action = 'added';
    }

    await cart.save();

    // Populate product details for response
    await cart.populate('products.productId');
    await cart.populate('userId', 'fullname email');

    return res.status(200).json({
      success: true,
      message: `Product ${action} to cart successfully`,
      data: cart,
      summary: {
        action: action,
        productId: productId,
        quantityAdded: qty,
        totalProductsInCart: cart.products.length,
        totalItemsInCart: cart.products.reduce((sum, item) => sum + item.quantity, 0)
      }
    });

  } catch (error) {
    console.error("Error in addCartItem:", error);
    return res.status(500).json({
      success: false,
      message: "Error adding product to cart",
      error: error.message
    });
  }
};

// ✅ Add Multiple Products to Cart
exports.addMultipleCartItems = async (req, res) => {
  try {
    const { userId, products } = req.body;

    // Validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Products array is required and must contain at least one product"
      });
    }

    // Validate each product in the array
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      if (!product.productId) {
        return res.status(400).json({
          success: false,
          message: `Product at index ${i} is missing productId`
        });
      }
      if (!product.quantity || product.quantity < 1) {
        return res.status(400).json({
          success: false,
          message: `Product at index ${i} must have a quantity of at least 1`
        });
      }
    }

    // Verify all products exist in database
    const productIds = products.map(p => p.productId);
    const existingProducts = await productModel.find({
      _id: { $in: productIds }
    });

    if (existingProducts.length !== productIds.length) {
      const foundIds = existingProducts.map(p => p._id.toString());
      const missingIds = productIds.filter(id => !foundIds.includes(id.toString()));
      return res.status(404).json({
        success: false,
        message: "Some products not found",
        missingProductIds: missingIds
      });
    }

    // Find or create cart for user
    let cart = await CartModel.findOne({ userId });

    if (!cart) {
      cart = new CartModel({ 
        userId, 
        products: [],
        totalPrice: 0,
        totalGST: 0
      });
    }

    // Ensure products array exists (safety check)
    if (!cart.products) {
      cart.products = [];
    }

    // Add or update each product in the cart
    let addedCount = 0;
    let updatedCount = 0;

    products.forEach((newProduct) => {
      const existingItem = cart.products.find(
        (item) => item.productId.toString() === newProduct.productId.toString()
      );

      if (existingItem) {
        // Update quantity if product already exists
        existingItem.quantity += newProduct.quantity;
        updatedCount++;
      } else {
        // Add new product to cart
        cart.products.push({
          productId: newProduct.productId,
          quantity: newProduct.quantity
        });
        addedCount++;
      }
    });

    // Save cart
    await cart.save();

    // Populate product details for response
    await cart.populate('products.productId');
    await cart.populate('userId', 'fullname email');

    return res.status(200).json({
      success: true,
      message: `Successfully processed ${products.length} products (${addedCount} added, ${updatedCount} updated)`,
      data: cart,
      summary: {
        totalProductsInCart: cart.products.length,
        productsAdded: addedCount,
        productsUpdated: updatedCount
      }
    });

  } catch (error) {
    console.error("Error in addMultipleCartItems:", error);
    return res.status(500).json({
      success: false,
      message: "Error adding products to cart",
      error: error.message
    });
  }
};

// ✅ Remove Item from Cart (with quantity management)
exports.removeCartItem = async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body;

    // Validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required"
      });
    }

    // Validate MongoDB ObjectId format
    if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format"
      });
    }

    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    // Find cart
    const cart = await CartModel.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found"
      });
    }

    // Find product in cart
    const productIndex = cart.products.findIndex(
      (item) => item.productId.toString() === productId.toString()
    );

    if (productIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Product not found in cart"
      });
    }

    const cartItem = cart.products[productIndex];
    const currentQuantity = cartItem.quantity;
    let action = '';
    let removedQuantity = 0;

    // If quantity is provided, reduce by that amount
    if (quantity && quantity > 0) {
      if (quantity >= currentQuantity) {
        // Remove entire product if quantity to remove >= current quantity
        cart.products.splice(productIndex, 1);
        action = 'removed_completely';
        removedQuantity = currentQuantity;
      } else {
        // Reduce quantity
        cartItem.quantity -= quantity;
        action = 'quantity_reduced';
        removedQuantity = quantity;
      }
    } else {
      // No quantity specified, remove entire product
      cart.products.splice(productIndex, 1);
      action = 'removed_completely';
      removedQuantity = currentQuantity;
    }

    await cart.save();

    // Populate product details for response
    await cart.populate('products.productId');
    await cart.populate('userId', 'fullname email');

    return res.status(200).json({
      success: true,
      message: action === 'removed_completely' 
        ? 'Product removed from cart successfully' 
        : `Reduced product quantity by ${removedQuantity}`,
      data: cart,
      summary: {
        action: action,
        productId: productId,
        quantityRemoved: removedQuantity,
        remainingQuantity: action === 'quantity_reduced' ? cartItem.quantity : 0,
        totalProductsInCart: cart.products.length,
        totalItemsInCart: cart.products.reduce((sum, item) => sum + item.quantity, 0)
      }
    });

  } catch (error) {
    console.error("Error in removeCartItem:", error);
    return res.status(500).json({
      success: false,
      message: "Error removing product from cart",
      error: error.message
    });
  }
};

// ✅ Get Cart by User (for refresh / normal use)
exports.getCartByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ message: "User ID required" });
    }

    // Get cart by user directly
    const cart = await CartModel.findOne({ userId })
      .populate("products.productId")
      .populate("userId");
    return res.status(200).json(cart || { products: [] });
  } catch (error) {
    console.error("Error in getCartByUser:", error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get Cart by OrderId (after checkout)
exports.getCartByOrderId = async (req, res) => {
  try {
    const { OrderId } = req.params;
    console.log("Fetching cart for Order ID:", OrderId);

    if (!OrderId) {
      return res.status(400).json({ message: "Order ID required" });
    }

    // Get cart by order ID directly
    const cart = await CartModel.findOne({ orderId: OrderId })
      .populate("products.productId")
      .populate("userId");
    console.log("Cart fetched:", cart);
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    return res.status(200).json(cart);
  } catch (error) {
    console.error("Error in getCartByOrderId:", error);
    res.status(500).json({ message: error.message });
  }
};

// GET /api/cart/get-cart/:userId
module.exports.getCart = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    // Fetch cart without orderId directly
    const cart = await CartModel.findOne({ userId })
      .populate("products.productId")
      .populate("userId");

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    res.status(200).json(cart);
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get Cart Summary for Home Screen (Product IDs and Quantities Only)
exports.getCartSummary = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Validate MongoDB ObjectId format
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    // Find cart for user - only select necessary fields
    const cart = await CartModel.findOne({ userId })
      .select('products')
      .lean(); // Use lean() for better performance as we don't need mongoose document methods

    // If no cart exists, return empty cart
    if (!cart || !cart.products || cart.products.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Cart is empty",
        data: {
          products: [],
          totalItems: 0,
          totalProducts: 0
        }
      });
    }

    // Format response with only productId and quantity
    const cartSummary = cart.products.map(item => ({
      productId: item.productId,
      quantity: item.quantity
    }));

    // Calculate totals
    const totalItems = cart.products.reduce((sum, item) => sum + item.quantity, 0);
    const totalProducts = cart.products.length;

    return res.status(200).json({
      success: true,
      message: "Cart summary retrieved successfully",
      data: {
        products: cartSummary,
        totalItems: totalItems,
        totalProducts: totalProducts
      }
    });

  } catch (error) {
    console.error("Error in getCartSummary:", error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving cart summary",
      error: error.message
    });
  }
};

// ✅ Get Cart Products (Only ProductId and Quantity)
exports.getCartProducts = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Validate MongoDB ObjectId format
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    // Find cart for user - only select products field
    const cart = await CartModel.findOne({ userId })
      .select('products')
      .lean();

    // If no cart exists, return empty array
    if (!cart || !cart.products || cart.products.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Cart is empty",
        products: []
      });
    }

    // Return only productId and quantity
    const products = cart.products.map(item => ({
      productId: item.productId,
      quantity: item.quantity
    }));

    return res.status(200).json({
      success: true,
      message: "Cart products retrieved successfully",
      products: products
    });

  } catch (error) {
    console.error("Error in getCartProducts:", error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving cart products",
      error: error.message
    });
  }
};
