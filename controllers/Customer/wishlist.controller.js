const Wishlist = require("../../models/Customer/Wishlist");
const Product = require("../../models/Product.model");

// ✅ Add to Wishlist
exports.addToWishlist = async (req, res) => {
  try {
    const { customerId, productId } = req.body;

    if (!customerId || !productId) {
      return res.status(400).json({ success: false, message: "customerId and productId are required" });
    }

    // Check if product exists
    const productExists = await Product.findById(productId);
    if (!productExists) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Check if already in wishlist
    const existingWishlist = await Wishlist.findOne({ customerId, productId });
    if (existingWishlist) {
      return res.status(400).json({ success: false, message: "Product already in wishlist" });
    }

    const newWishlistItem = new Wishlist({
      customerId,
      productId,
    });

    await newWishlistItem.save();

    return res.status(201).json({
      success: true,
      message: "Product added to wishlist successfully",
      data: newWishlistItem,
    });
  } catch (error) {
    console.error("Error in addToWishlist:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

// ✅ Remove from Wishlist
exports.removeFromWishlist = async (req, res) => {
  try {
    const { customerId, productId } = req.body;

    if (!customerId || !productId) {
      return res.status(400).json({ success: false, message: "customerId and productId are required" });
    }

    const deletedItem = await Wishlist.findOneAndDelete({ customerId, productId });

    if (!deletedItem) {
      return res.status(404).json({ success: false, message: "Product not found in wishlist" });
    }

    return res.status(200).json({
      success: true,
      message: "Product removed from wishlist successfully",
    });
  } catch (error) {
    console.error("Error in removeFromWishlist:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

// ✅ Get Wishlist by Customer
exports.getWishlist = async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({ success: false, message: "customerId is required" });
    }

    const wishlistItems = await Wishlist.find({ customerId }).populate("productId");

    return res.status(200).json({
      success: true,
      message: "Wishlist retrieved successfully",
      data: wishlistItems,
    });
  } catch (error) {
    console.error("Error in getWishlist:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};
