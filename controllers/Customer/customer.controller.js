const productModel = require("../../models/Product.model");
const userModel = require("../../models/user.model");
const Category = require("../../models/ProductCategory.model");
const OrderItem = require("../../models/Customer/OrderItem");
const Order = require("../../models/Customer/Order");
const CustomerAddress = require("../../models/Customer/CustomerAddress");
const User = require("../../models/Auth/User");

// ✅ Get all products with optional category filter
module.exports.getAllProducts = async (req, res) => {
  try {
    const { page, limit, search, category } = req.query;

    // Get all products with pagination
    let pageNum = parseInt(page) || 1;
    let limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    let query = {};

    // Add search filter
    if (search) {
      query.productName = { $regex: search, $options: "i" };
    }

    // Add category filter by category name (case-insensitive exact match)
    if (category === "most_seller_product") {
      const deliveredOrders = await Order.find({
        orderStatus: { $regex: /^delivered$/i },
      }).select("_id");
      const deliveredOrderIds = deliveredOrders.map((order) => order._id);

      const bestsellersAgg = await OrderItem.aggregate([
        {
          $match: {
            orderId: { $in: deliveredOrderIds },
            productId: { $ne: null },
          },
        },
        { $group: { _id: "$productId", totalSold: { $sum: "$quantity" } } },
        { $sort: { totalSold: -1 } },
      ]);

      const bestsellerProductIds = bestsellersAgg.map((item) => item._id);

      if (bestsellerProductIds.length > 0) {
        query._id = { $in: bestsellerProductIds };
      }

      const totalDocs = await productModel.countDocuments(query);
      const totalPages = Math.ceil(totalDocs / limitNum);

      const matchingProducts = await productModel.find(query).select("_id");
      const matchingProductIds = matchingProducts.map((p) => p._id.toString());

      const sortedMatchingIds = bestsellerProductIds.filter((id) =>
        matchingProductIds.includes(id.toString()),
      );

      const paginatedIds = sortedMatchingIds.slice(skip, skip + limitNum);

      const productsUnsorted = await productModel
        .find({ _id: { $in: paginatedIds } })
        .populate("productCategory")
        .populate({ path: "createdBy", select: "fullname email role" });

      const products = paginatedIds
        .map((id) =>
          productsUnsorted.find((p) => p._id.toString() === id.toString()),
        )
        .filter(Boolean);

      return res.status(200).json({
        success: true,
        pagination: { page: pageNum, limit: limitNum, totalDocs, totalPages },
        data: products,
      });
    } else if (category) {
      const categoryDoc = await Category.findOne({
        categoryName: {
          $regex: new RegExp(
            `^${category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            "i",
          ),
        },
        status: "active",
      });

      if (categoryDoc) {
        query.productCategory = categoryDoc._id;
      } else {
        // If category not found, return empty result
        return res.status(200).json({
          success: true,
          pagination: {
            page: pageNum,
            limit: limitNum,
            totalDocs: 0,
            totalPages: 0,
          },
          data: [],
          message: `No products found for category: ${category}`,
        });
      }
    }

    const totalDocs = await productModel.countDocuments(query);
    const totalPages = Math.ceil(totalDocs / limitNum);

    const products = await productModel
      .find(query)
      .populate("productCategory")
      .populate({
        path: "createdBy",
        select: "fullname email role",
      })
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 }); // Sort by newest first

    const result = {
      success: true,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalDocs,
        totalPages,
      },
      data: products,
    };

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching products",
      error: error.message,
    });
  }
};

// ✅ Get bestseller products (most sold products)
module.exports.getBestsellerProducts = async (req, res) => {
  try {
    const { limit } = req.query;
    const limitNum = parseInt(limit) || 10;

    // Aggregate order items to find most sold products
    // Only consider delivered orders
    const deliveredOrders = await Order.find({
      orderStatus: { $regex: /^delivered$/i },
    }).select("_id");

    const deliveredOrderIds = deliveredOrders.map((order) => order._id);

    // Aggregate products by total quantity sold
    const bestsellers = await OrderItem.aggregate([
      {
        $match: {
          orderId: { $in: deliveredOrderIds },
          productId: { $ne: null }, // Only include items with valid product references
        },
      },
      {
        $group: {
          _id: "$productId",
          totalQuantitySold: { $sum: "$quantity" },
          totalRevenue: { $sum: "$totalPrice" },
          orderCount: { $sum: 1 },
        },
      },
      {
        $sort: { totalQuantitySold: -1 },
      },
      {
        $limit: limitNum,
      },
    ]);

    // Get product details for bestsellers
    const productIds = bestsellers.map((item) => item._id);
    const products = await productModel
      .find({ _id: { $in: productIds } })
      .populate("productCategory")
      .populate({
        path: "createdBy",
        select: "fullname email role",
      });

    // Merge product details with sales data
    const result = bestsellers
      .map((bestseller) => {
        const product = products.find(
          (p) => p._id.toString() === bestseller._id.toString(),
        );
        return {
          ...product?.toObject(),
          salesData: {
            totalQuantitySold: bestseller.totalQuantitySold,
            totalRevenue: bestseller.totalRevenue,
            orderCount: bestseller.orderCount,
          },
        };
      })
      .filter((item) => item._id); // Filter out any null products

    res.status(200).json({
      success: true,
      data: result,
      count: result.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching bestseller products",
      error: error.message,
    });
  }
};

module.exports.getProfileById = async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await userModel.findById(id).select("-password");
    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }
    res.status(200).json(profile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get product by ID
module.exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const product = await productModel
      .findById(id)
      .populate("productCategory", "categoryName categoryDescription")
      .populate({
        path: "createdBy",
        select: "fullname email role",
      });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching product",
      error: error.message,
    });
  }
};

// ✅ Get all active categories
module.exports.getAllCategories = async (req, res) => {
  try {
    const { page, limit, search, parentOnly } = req.query;

    // Build query
    let query = { status: "active" };

    // Filter by search term
    if (search) {
      query.categoryName = { $regex: search, $options: "i" };
    }

    // Filter for parent categories only (top-level categories)
    if (parentOnly === "true") {
      query.parentCategoryId = null;
    }

    // If pagination is requested
    if (page || limit) {
      let pageNum = parseInt(page) || 1;
      let limitNum = parseInt(limit) || 20;
      const skip = (pageNum - 1) * limitNum;

      const totalDocs = await Category.countDocuments(query);
      const totalPages = Math.ceil(totalDocs / limitNum);

      const categories = await Category.find(query)
        .populate("parentCategoryId", "categoryName")
        .populate("createdBy", "fullname email")
        .skip(skip)
        .limit(limitNum)
        .sort({ categoryName: 1 });

      return res.status(200).json({
        success: true,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalDocs,
          totalPages,
        },
        data: categories,
      });
    }

    // Without pagination - return all categories
    const categories = await Category.find(query)
      .populate("parentCategoryId", "categoryName")
      .populate("createdBy", "fullname email")
      .sort({ categoryName: 1 });

    res.status(200).json({
      success: true,
      data: categories,
      count: categories.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching categories",
      error: error.message,
    });
  }
};

// ✅ Get category by ID with products count
module.exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

<<<<<<< HEAD
    const category = await Category.findOne({ _id: id, status: "active" })
      .populate("parentCategoryId", "categoryName")
      .populate("createdBy", "fullname email");
=======
    // Validate MongoDB ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format"
      });
    }

    const category = await Category
      .findOne({ _id: id, status: 'active' })
      .populate('parentCategoryId', 'categoryName')
      .populate('createdBy', 'fullname email');
>>>>>>> 3376a5fbad1ef12cf69908f7142dc268ce605e3b

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Count products in this category
    const productCount = await productModel.countDocuments({
      productCategory: id,
    });

    res.status(200).json({
      success: true,
      data: {
        ...category.toObject(),
        productCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ✅ Get categories with product counts (for category browsing)
module.exports.getCategoriesWithProductCount = async (req, res) => {
  try {
    const { parentOnly } = req.query;

    let query = { status: "active" };

    // Filter for parent categories only
    if (parentOnly === "true") {
      query.parentCategoryId = null;
    }

    const categories = await Category.find(query)
      .populate("parentCategoryId", "categoryName")
      .sort({ categoryName: 1 });

    // Get product count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const productCount = await productModel.countDocuments({
          productCategory: category._id,
        });

        return {
          ...category.toObject(),
          productCount,
        };
      }),
    );

    res.status(200).json({
      success: true,
      data: categoriesWithCount,
      count: categoriesWithCount.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching categories with product count",
      error: error.message,
    });
  }
};

<<<<<<< HEAD
// ✅ Get perfectly separated categories (parents with nested children)
module.exports.getStructuredCategories = async (req, res) => {
  try {
    // Fetch all active categories
    const categories = await Category.find({ status: "active" })
      .sort({ categoryName: 1 })
      .lean();

    // Get product count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const productCount = await productModel.countDocuments({
          productCategory: category._id,
        });
        return {
          ...category,
          productCount,
        };
      }),
    );

    // Perfectly separate parents and children
    const parents = categoriesWithCount.filter(
      (c) => c.categoryType === "parent" || !c.parentCategoryId,
    );
    const children = categoriesWithCount.filter(
      (c) => c.categoryType === "child" || !!c.parentCategoryId,
    );

    // Map children into their respective parents to form an array
    const structuredCategories = parents.map((parent) => {
      const parentChildren = children.filter(
        (child) =>
          child.parentCategoryId &&
          child.parentCategoryId.toString() === parent._id.toString(),
      );

      return {
        ...parent,
        children: parentChildren,
      };
=======
// ✅ Get structured categories (parents and nested children)
module.exports.getStructuredCategories = async (req, res) => {
  try {
    const categories = await Category.find({ status: 'active' }).sort({ categoryName: 1 }).lean();

    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat._id.toString()] = { ...cat, subCategories: [] };
    });

    const structuredData = [];

    categories.forEach(cat => {
      const mappedCat = categoryMap[cat._id.toString()];
      if (cat.parentCategoryId) {
        const parentId = cat.parentCategoryId.toString();
        if (categoryMap[parentId]) {
          categoryMap[parentId].subCategories.push(mappedCat);
        } else {
          structuredData.push(mappedCat);
        }
      } else {
        structuredData.push(mappedCat);
      }
>>>>>>> 3376a5fbad1ef12cf69908f7142dc268ce605e3b
    });

    res.status(200).json({
      success: true,
<<<<<<< HEAD
      message: "Categories fetched successfully",
      data: structuredCategories,
=======
      data: structuredData,
      count: structuredData.length
>>>>>>> 3376a5fbad1ef12cf69908f7142dc268ce605e3b
    });
  } catch (error) {
    res.status(500).json({
      success: false,
<<<<<<< HEAD
      message: "Error fetching categories",
=======
      message: "Error fetching structured categories",
>>>>>>> 3376a5fbad1ef12cf69908f7142dc268ce605e3b
      error: error.message,
    });
  }
};

// ==================== ADDRESS MANAGEMENT APIs ====================

// ✅ Add New Address for User
module.exports.addAddress = async (req, res) => {
  try {
    const {
      userId,
      addressType,
      addressLine1,
      addressLine2,
      landmark,
      city,
      state,
      pincode,
      latitude,
      longitude,
      lan,
      lng,
      isDefault,
    } = req.body;

    // Validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    if (!addressLine1 || !city || !state || !pincode) {
      return res.status(400).json({
        success: false,
        message: "Address Line 1, City, State, and Pincode are required",
      });
    }

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // If this is set as default, unset other default addresses
    if (isDefault === true) {
      await CustomerAddress.updateMany(
        { customerId: userId },
        { $set: { isDefault: false } },
      );
    }

    // If this is the first address, make it default automatically
    const existingAddressCount = await CustomerAddress.countDocuments({
      customerId: userId,
    });
    const shouldBeDefault =
      existingAddressCount === 0 ? true : isDefault || false;

    // Create new address
    const newAddress = new CustomerAddress({
      customerId: userId,
      addressType: addressType || "home",
      addressLine1,
      addressLine2: addressLine2 || "",
      landmark: landmark || "",
      city,
      state,
      pincode,
      latitude: latitude || null,
      longitude: longitude || null,
      lan: lan || null,
      lng: lng || null,
      isDefault: shouldBeDefault,
    });

    await newAddress.save();

    return res.status(201).json({
      success: true,
      message: "Address added successfully",
      data: newAddress,
    });
  } catch (error) {
    console.error("Error in addAddress:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add address",
      error: error.message,
    });
  }
};

// ✅ Get All Addresses for User
module.exports.getUserAddresses = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Validate MongoDB ObjectId format
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    // Get all addresses for user
    const addresses = await CustomerAddress.find({ customerId: userId }).sort({
      isDefault: -1,
      createdAt: -1,
    }); // Default address first, then by creation date

    return res.status(200).json({
      success: true,
      message: "Addresses retrieved successfully",
      data: addresses,
      count: addresses.length,
    });
  } catch (error) {
    console.error("Error in getUserAddresses:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve addresses",
      error: error.message,
    });
  }
};

// ✅ Get Single Address by ID
module.exports.getAddressById = async (req, res) => {
  try {
    const { addressId } = req.params;

    // Validation
    if (!addressId) {
      return res.status(400).json({
        success: false,
        message: "Address ID is required",
      });
    }

    // Validate MongoDB ObjectId format
    if (!addressId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID format",
      });
    }

    const address = await CustomerAddress.findById(addressId);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Address retrieved successfully",
      data: address,
    });
  } catch (error) {
    console.error("Error in getAddressById:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve address",
      error: error.message,
    });
  }
};

// ✅ Update Address
module.exports.updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const {
      addressType,
      addressLine1,
      addressLine2,
      landmark,
      city,
      state,
      pincode,
      latitude,
      longitude,
      lan,
      lng,
      isDefault,
    } = req.body;

    // Validation
    if (!addressId) {
      return res.status(400).json({
        success: false,
        message: "Address ID is required",
      });
    }

    // Validate MongoDB ObjectId format
    if (!addressId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID format",
      });
    }

    // Find existing address
    const address = await CustomerAddress.findById(addressId);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // If setting as default, unset other default addresses for this user
    if (isDefault === true) {
      await CustomerAddress.updateMany(
        { customerId: address.customerId, _id: { $ne: addressId } },
        { $set: { isDefault: false } },
      );
    }

    // Update fields
    if (addressType) address.addressType = addressType;
    if (addressLine1) address.addressLine1 = addressLine1;
    if (addressLine2 !== undefined) address.addressLine2 = addressLine2;
    if (landmark !== undefined) address.landmark = landmark;
    if (city) address.city = city;
    if (state) address.state = state;
    if (pincode) address.pincode = pincode;
    if (latitude !== undefined) address.latitude = latitude;
    if (longitude !== undefined) address.longitude = longitude;
    if (lan !== undefined) address.lan = lan;
    if (lng !== undefined) address.lng = lng;
    if (isDefault !== undefined) address.isDefault = isDefault;

    address.updatedAt = Date.now();
    await address.save();

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data: address,
    });
  } catch (error) {
    console.error("Error in updateAddress:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update address",
      error: error.message,
    });
  }
};

// ✅ Delete Address
module.exports.deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;

    // Validation
    if (!addressId) {
      return res.status(400).json({
        success: false,
        message: "Address ID is required",
      });
    }

    // Validate MongoDB ObjectId format
    if (!addressId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID format",
      });
    }

    const address = await CustomerAddress.findById(addressId);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const wasDefault = address.isDefault;
    const customerId = address.customerId;

    // Delete the address
    await CustomerAddress.findByIdAndDelete(addressId);

    // If deleted address was default, set another address as default
    if (wasDefault) {
      const remainingAddresses = await CustomerAddress.find({
        customerId,
      }).sort({ createdAt: -1 });
      if (remainingAddresses.length > 0) {
        remainingAddresses[0].isDefault = true;
        await remainingAddresses[0].save();
      }
    }

    return res.status(200).json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteAddress:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete address",
      error: error.message,
    });
  }
};

// ✅ Set Address as Default
module.exports.setDefaultAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const { userId } = req.body;

    // Validation
    if (!addressId) {
      return res.status(400).json({
        success: false,
        message: "Address ID is required",
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Validate MongoDB ObjectId format
    if (!addressId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID format",
      });
    }

    // Find the address
    const address = await CustomerAddress.findById(addressId);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // Verify address belongs to user
    if (address.customerId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Address does not belong to this user",
      });
    }

    // Unset all default addresses for this user
    await CustomerAddress.updateMany(
      { customerId: userId },
      { $set: { isDefault: false } },
    );

    // Set this address as default
    address.isDefault = true;
    address.updatedAt = Date.now();
    await address.save();

    return res.status(200).json({
      success: true,
      message: "Default address updated successfully",
      data: address,
    });
  } catch (error) {
    console.error("Error in setDefaultAddress:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to set default address",
      error: error.message,
    });
  }
};

// ✅ Get Default Address for User
module.exports.getDefaultAddress = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Validate MongoDB ObjectId format
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    // Find default address
    const defaultAddress = await CustomerAddress.findOne({
      customerId: userId,
      isDefault: true,
    });

    if (!defaultAddress) {
      return res.status(404).json({
        success: false,
        message: "No default address found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Default address retrieved successfully",
      data: defaultAddress,
    });
  } catch (error) {
    console.error("Error in getDefaultAddress:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve default address",
      error: error.message,
    });
  }
};
