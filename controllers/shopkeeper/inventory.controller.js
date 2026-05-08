// controllers/shopkeeper/inventory.controller.js
const Product = require('../../models/Product.model');
const Shopkeeper = require('../../models/ShopKeeper/Shopkeeper');
const Shop = require('../../models/ShopKeeper/Shop');
const InventoryLog = require('../../models/ShopKeeper/InventoryLog');

// ✅ Get Inventory (All Products)
module.exports.getInventory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { search, category, inStock, page = 1, limit = 50 } = req.query;

    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper profile not found'
      });
    }

    // Build query
    const query = { createdBy: userId };

    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { productCode: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      query.productCategory = category;
    }

    if (inStock === 'true') {
      query.productQuantity = { $gt: 0 };
    } else if (inStock === 'false') {
      query.productQuantity = { $lte: 0 };
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const products = await Product.find(query)
      .populate('productCategory', 'categoryName')
      .sort({ productName: 1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Product.countDocuments(query);

    // Calculate inventory stats
    const totalProducts = await Product.countDocuments({ createdBy: userId });
    const outOfStock = await Product.countDocuments({ createdBy: userId, productQuantity: { $lte: 0 } });
    const lowStock = await Product.countDocuments({ createdBy: userId, productQuantity: { $gt: 0, $lte: 10 } });

    return res.status(200).json({
      success: true,
      message: 'Inventory retrieved successfully',
      data: {
        products: products,
        stats: {
          totalProducts: totalProducts,
          outOfStock: outOfStock,
          lowStock: lowStock,
          inStock: totalProducts - outOfStock
        },
        pagination: {
          currentPage: pageNum,
          limit: limitNum,
          total: total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });

  } catch (error) {
    console.error('Get inventory error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ Update Product Stock
module.exports.updateStock = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;
    const { quantity, action, reason } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }

    if (!action || !['add', 'remove', 'set'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be one of: add, remove, set'
      });
    }

    const product = await Product.findOne({
      _id: productId,
      createdBy: userId
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const oldQuantity = product.productQuantity;
    let newQuantity = oldQuantity;

    if (action === 'add') {
      newQuantity = oldQuantity + quantity;
    } else if (action === 'remove') {
      newQuantity = Math.max(0, oldQuantity - quantity);
    } else if (action === 'set') {
      newQuantity = quantity;
    }

    product.productQuantity = newQuantity;
    await product.save();

    // Log inventory change
    await InventoryLog.create({
      productId: product._id,
      shopkeeperId: userId,
      action: action,
      quantityBefore: oldQuantity,
      quantityAfter: newQuantity,
      quantityChanged: Math.abs(newQuantity - oldQuantity),
      reason: reason || `Stock ${action}`,
      performedBy: userId
    });

    return res.status(200).json({
      success: true,
      message: 'Stock updated successfully',
      data: {
        product: product,
        oldQuantity: oldQuantity,
        newQuantity: newQuantity
      }
    });

  } catch (error) {
    console.error('Update stock error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ Get Low Stock Products
module.exports.getLowStockProducts = async (req, res) => {
  try {
    const userId = req.user._id;
    const { threshold = 10 } = req.query;

    const products = await Product.find({
      createdBy: userId,
      productQuantity: { $gt: 0, $lte: parseInt(threshold) }
    })
      .populate('productCategory', 'categoryName')
      .sort({ productQuantity: 1 });

    return res.status(200).json({
      success: true,
      message: 'Low stock products retrieved successfully',
      data: {
        products: products,
        count: products.length,
        threshold: parseInt(threshold)
      }
    });

  } catch (error) {
    console.error('Get low stock error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ Get Out of Stock Products
module.exports.getOutOfStockProducts = async (req, res) => {
  try {
    const userId = req.user._id;

    const products = await Product.find({
      createdBy: userId,
      productQuantity: { $lte: 0 }
    })
      .populate('productCategory', 'categoryName')
      .sort({ productName: 1 });

    return res.status(200).json({
      success: true,
      message: 'Out of stock products retrieved successfully',
      data: {
        products: products,
        count: products.length
      }
    });

  } catch (error) {
    console.error('Get out of stock error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ Get Inventory Logs
module.exports.getInventoryLogs = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, page = 1, limit = 50 } = req.query;

    const query = { shopkeeperId: userId };
    if (productId) {
      query.productId = productId;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const logs = await InventoryLog.find(query)
      .populate('productId', 'productName productCode')
      .populate('performedBy', 'fullname email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await InventoryLog.countDocuments(query);

    return res.status(200).json({
      success: true,
      message: 'Inventory logs retrieved successfully',
      data: {
        logs: logs,
        pagination: {
          currentPage: pageNum,
          limit: limitNum,
          total: total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });

  } catch (error) {
    console.error('Get inventory logs error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ Bulk Update Stock
module.exports.bulkUpdateStock = async (req, res) => {
  try {
    const userId = req.user._id;
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Updates array is required'
      });
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        const { productId, quantity, action } = update;

        const product = await Product.findOne({
          _id: productId,
          createdBy: userId
        });

        if (!product) {
          errors.push({ productId, error: 'Product not found' });
          continue;
        }

        const oldQuantity = product.productQuantity;
        let newQuantity = oldQuantity;

        if (action === 'add') {
          newQuantity = oldQuantity + quantity;
        } else if (action === 'remove') {
          newQuantity = Math.max(0, oldQuantity - quantity);
        } else if (action === 'set') {
          newQuantity = quantity;
        }

        product.productQuantity = newQuantity;
        await product.save();

        // Log change
        await InventoryLog.create({
          productId: product._id,
          shopkeeperId: userId,
          action: action,
          quantityBefore: oldQuantity,
          quantityAfter: newQuantity,
          quantityChanged: Math.abs(newQuantity - oldQuantity),
          reason: 'Bulk update',
          performedBy: userId
        });

        results.push({
          productId: product._id,
          productName: product.productName,
          oldQuantity: oldQuantity,
          newQuantity: newQuantity,
          success: true
        });

      } catch (err) {
        errors.push({ productId: update.productId, error: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Bulk stock update completed',
      data: {
        successful: results,
        failed: errors,
        totalProcessed: updates.length,
        successCount: results.length,
        errorCount: errors.length
      }
    });

  } catch (error) {
    console.error('Bulk update stock error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
