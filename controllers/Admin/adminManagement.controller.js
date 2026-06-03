// controllers/Admin/adminManagement.controller.js
// 👥 ADMIN MANAGEMENT APIs - Users, Shopkeepers, Delivery Boys, Categories, KYC

const User = require('../../models/user.model');
const Category = require('../../models/ProductCategory.model');
const Product = require('../../models/Product.model');
const ShopkeeperKYC = require('../../models/ShopKeeper/ShopkeeperKYC');
const DeliveryBoyKYC = require('../../models/DeliveryBoy/DeliveryBoyKYC');
const Shopkeeper = require('../../models/ShopKeeper/Shopkeeper');
const DeliveryBoy = require('../../models/DeliveryBoy/DeliveryBoy');

// ==================== CATEGORY MANAGEMENT ====================

/**
 * GET /api/admin/categories
 * Get all categories with pagination
 */
module.exports.getCategories = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }
    if (search) {
      query.categoryName = { $regex: search, $options: 'i' };
    }

    const categories = await Category.find(query)
      .populate('parentCategoryId', 'categoryName')
      .populate('createdBy', 'fullname email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const total = await Category.countDocuments(query);

    // Get product count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const productCount = await Product.countDocuments({ 
          productCategory: category._id 
        });
        return {
          ...category,
          productCount
        };
      })
    );

    res.json({
      success: true,
      data: categoriesWithCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/categories/:id
 * Get category by ID
 */
module.exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id)
      .populate('parentCategoryId', 'categoryName')
      .populate('createdBy', 'fullname email');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const productCount = await Product.countDocuments({ 
      productCategory: category._id 
    });

    res.json({
      success: true,
      data: {
        ...category.toObject(),
        productCount
      }
    });

  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category',
      error: error.message
    });
  }
};

// ==================== USER MANAGEMENT ====================

/**
 * GET /api/admin/users
 * Get all users (customers) with pagination
 */
module.exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;

    const query = { role: 'user' };
    if (status) {
      query.accountStatus = status;
    }
    if (search) {
      query.$or = [
        { fullname: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/users/:id
 * Get user by ID
 */
module.exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
  }
};

/**
 * PATCH /api/admin/users/:id/block
 * Block user
 */
module.exports.blockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { accountStatus: 'blocked' },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User blocked successfully',
      data: user
    });

  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to block user',
      error: error.message
    });
  }
};

/**
 * PATCH /api/admin/users/:id/unblock
 * Unblock user
 */
module.exports.unblockUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { accountStatus: 'active' },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User unblocked successfully',
      data: user
    });

  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unblock user',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/users/:id
 * Delete user account
 */
module.exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user', error: error.message });
  }
};

// ==================== SHOPKEEPER MANAGEMENT ====================

/**
 * GET /api/admin/shopkeepers
 * Get all shopkeepers with pagination
 */
module.exports.getShopkeepers = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;

    const query = { role: 'admin' };
    if (status) {
      query['roleDetails.shopkeeper.status'] = status;
    }
    if (search) {
      query.$or = [
        { fullname: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { 'roleDetails.admin.shopName': { $regex: search, $options: 'i' } }
      ];
    }

    const shopkeepers = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const total = await User.countDocuments(query);

    // Get additional shopkeeper details
    const shopkeepersWithDetails = await Promise.all(
      shopkeepers.map(async (shopkeeper) => {
        const shopkeeperProfile = await Shopkeeper.findOne({ 
          userId: shopkeeper._id 
        });
        
        const productCount = await Product.countDocuments({ 
          createdBy: shopkeeper._id 
        });

        return {
          ...shopkeeper,
          shopkeeperProfile,
          productCount
        };
      })
    );

    res.json({
      success: true,
      data: shopkeepersWithDetails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching shopkeepers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shopkeepers',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/shopkeepers/:id
 * Get shopkeeper by ID
 */
module.exports.getShopkeeperById = async (req, res) => {
  try {
    const { id } = req.params;

    const shopkeeper = await User.findById(id).select('-password');

    if (!shopkeeper || shopkeeper.role !== 'admin') {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper not found'
      });
    }

    const shopkeeperProfile = await Shopkeeper.findOne({ userId: id });
    const productCount = await Product.countDocuments({ createdBy: id });

    res.json({
      success: true,
      data: {
        ...shopkeeper.toObject(),
        shopkeeperProfile,
        productCount
      }
    });

  } catch (error) {
    console.error('Error fetching shopkeeper:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shopkeeper',
      error: error.message
    });
  }
};

/**
 * PATCH /api/admin/shopkeepers/:id/approve
 * Approve shopkeeper
 */
module.exports.approveShopkeeper = async (req, res) => {
  try {
    const { id } = req.params;

    const shopkeeper = await User.findById(id);

    if (!shopkeeper || shopkeeper.role !== 'admin') {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper not found'
      });
    }

    // Update shopkeeper status
    shopkeeper.roleDetails = shopkeeper.roleDetails || {};
    shopkeeper.roleDetails.shopkeeper = shopkeeper.roleDetails.shopkeeper || {};
    shopkeeper.roleDetails.shopkeeper.status = 'active';
    shopkeeper.roleDetails.shopkeeper.rejectReason = undefined;
    shopkeeper.accountStatus = 'active';

    await shopkeeper.save();

    res.json({
      success: true,
      message: 'Shopkeeper approved successfully',
      data: shopkeeper
    });

  } catch (error) {
    console.error('Error approving shopkeeper:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve shopkeeper',
      error: error.message
    });
  }
};

/**
 * PATCH /api/admin/shopkeepers/:id/reject
 * Reject shopkeeper
 */
module.exports.rejectShopkeeper = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const shopkeeper = await User.findById(id);

    if (!shopkeeper || shopkeeper.role !== 'admin') {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper not found'
      });
    }

    // Update shopkeeper status
    shopkeeper.roleDetails = shopkeeper.roleDetails || {};
    shopkeeper.roleDetails.shopkeeper = shopkeeper.roleDetails.shopkeeper || {};
    shopkeeper.roleDetails.shopkeeper.status = 'blocked';
    shopkeeper.roleDetails.shopkeeper.rejectReason = reason;
    shopkeeper.accountStatus = 'blocked';

    await shopkeeper.save();

    res.json({
      success: true,
      message: 'Shopkeeper rejected successfully',
      data: shopkeeper
    });

  } catch (error) {
    console.error('Error rejecting shopkeeper:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject shopkeeper',
      error: error.message
    });
  }
};

// ==================== DELIVERY BOY MANAGEMENT ====================

/**
 * GET /api/admin/delivery-boys
 * Get all delivery boys with pagination
 */
module.exports.getDeliveryBoys = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;

    const query = { role: 'deliveryBoy' };
    if (status) {
      query['roleDetails.deliveryBoy.deliveryBoyStatus'] = status;
    }
    if (search) {
      query.$or = [
        { fullname: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const deliveryBoys = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const total = await User.countDocuments(query);

    // Get additional delivery boy details
    const deliveryBoysWithDetails = await Promise.all(
      deliveryBoys.map(async (deliveryBoy) => {
        const deliveryBoyProfile = await DeliveryBoy.findOne({ 
          userId: deliveryBoy._id 
        });

        return {
          ...deliveryBoy,
          deliveryBoyProfile
        };
      })
    );

    res.json({
      success: true,
      data: deliveryBoysWithDetails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching delivery boys:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch delivery boys',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/delivery-boys/:id
 * Get delivery boy by ID
 */
module.exports.getDeliveryBoyById = async (req, res) => {
  try {
    const { id } = req.params;

    const deliveryBoy = await User.findById(id).select('-password');

    if (!deliveryBoy || deliveryBoy.role !== 'deliveryBoy') {
      return res.status(404).json({
        success: false,
        message: 'Delivery boy not found'
      });
    }

    const deliveryBoyProfile = await DeliveryBoy.findOne({ userId: id });

    res.json({
      success: true,
      data: {
        ...deliveryBoy.toObject(),
        deliveryBoyProfile
      }
    });

  } catch (error) {
    console.error('Error fetching delivery boy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch delivery boy',
      error: error.message
    });
  }
};

/**
 * PATCH /api/admin/delivery-boys/:id/approve
 * Approve delivery boy
 */
module.exports.approveDeliveryBoy = async (req, res) => {
  try {
    const { id } = req.params;

    const deliveryBoy = await User.findById(id);

    if (!deliveryBoy || deliveryBoy.role !== 'deliveryBoy') {
      return res.status(404).json({
        success: false,
        message: 'Delivery boy not found'
      });
    }

    // Update delivery boy status
    deliveryBoy.roleDetails = deliveryBoy.roleDetails || {};
    deliveryBoy.roleDetails.deliveryBoy = deliveryBoy.roleDetails.deliveryBoy || {};
    deliveryBoy.roleDetails.deliveryBoy.deliveryBoyStatus = 'active';
    deliveryBoy.accountStatus = 'active';

    await deliveryBoy.save();

    res.json({
      success: true,
      message: 'Delivery boy approved successfully',
      data: deliveryBoy
    });

  } catch (error) {
    console.error('Error approving delivery boy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve delivery boy',
      error: error.message
    });
  }
};

/**
 * PATCH /api/admin/delivery-boys/:id/reject
 * Reject delivery boy
 */
module.exports.rejectDeliveryBoy = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const deliveryBoy = await User.findById(id);

    if (!deliveryBoy || deliveryBoy.role !== 'deliveryBoy') {
      return res.status(404).json({
        success: false,
        message: 'Delivery boy not found'
      });
    }

    // Update delivery boy status
    deliveryBoy.roleDetails = deliveryBoy.roleDetails || {};
    deliveryBoy.roleDetails.deliveryBoy = deliveryBoy.roleDetails.deliveryBoy || {};
    deliveryBoy.roleDetails.deliveryBoy.deliveryBoyStatus = 'inactive';
    deliveryBoy.accountStatus = 'blocked';

    await deliveryBoy.save();

    res.json({
      success: true,
      message: 'Delivery boy rejected successfully',
      data: deliveryBoy
    });

  } catch (error) {
    console.error('Error rejecting delivery boy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject delivery boy',
      error: error.message
    });
  }
};

// ==================== KYC MANAGEMENT ====================

/**
 * GET /api/admin/kyc/shopkeepers
 * Get all shopkeeper KYC requests with pagination
 */
module.exports.getShopkeeperKYC = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }

    const kycRequests = await ShopkeeperKYC.find(query)
      .populate('shopkeeperId', 'fullname email phone roleDetails')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const total = await ShopkeeperKYC.countDocuments(query);

    res.json({
      success: true,
      data: kycRequests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching shopkeeper KYC:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shopkeeper KYC requests',
      error: error.message
    });
  }
};

/**
 * PATCH /api/admin/kyc/shopkeepers/:id/approve
 * Approve shopkeeper KYC
 */
module.exports.approveShopkeeperKYC = async (req, res) => {
  try {
    const { id } = req.params;

    const kyc = await ShopkeeperKYC.findByIdAndUpdate(
      id,
      { 
        status: 'approved',
        verifiedAt: new Date()
      },
      { new: true }
    ).populate('shopkeeperId', 'fullname email phone');

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: 'KYC request not found'
      });
    }

    res.json({
      success: true,
      message: 'Shopkeeper KYC approved successfully',
      data: kyc
    });

  } catch (error) {
    console.error('Error approving shopkeeper KYC:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve shopkeeper KYC',
      error: error.message
    });
  }
};

/**
 * PATCH /api/admin/kyc/shopkeepers/:id/reject
 * Reject shopkeeper KYC
 */
module.exports.rejectShopkeeperKYC = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const kyc = await ShopkeeperKYC.findByIdAndUpdate(
      id,
      { 
        status: 'rejected',
        rejectionReason: reason,
        verifiedAt: new Date()
      },
      { new: true }
    ).populate('shopkeeperId', 'fullname email phone');

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: 'KYC request not found'
      });
    }

    res.json({
      success: true,
      message: 'Shopkeeper KYC rejected successfully',
      data: kyc
    });

  } catch (error) {
    console.error('Error rejecting shopkeeper KYC:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject shopkeeper KYC',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/kyc/delivery-boys
 * Get all delivery boy KYC requests with pagination
 */
module.exports.getDeliveryBoyKYC = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }

    const kycRequests = await DeliveryBoyKYC.find(query)
      .populate('deliveryBoyId', 'fullname email phone roleDetails')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const total = await DeliveryBoyKYC.countDocuments(query);

    res.json({
      success: true,
      data: kycRequests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching delivery boy KYC:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch delivery boy KYC requests',
      error: error.message
    });
  }
};

/**
 * PATCH /api/admin/kyc/delivery-boys/:id/approve
 * Approve delivery boy KYC
 */
module.exports.approveDeliveryBoyKYC = async (req, res) => {
  try {
    const { id } = req.params;

    const kyc = await DeliveryBoyKYC.findByIdAndUpdate(
      id,
      { 
        status: 'approved',
        verifiedAt: new Date()
      },
      { new: true }
    ).populate('deliveryBoyId', 'fullname email phone');

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: 'KYC request not found'
      });
    }

    res.json({
      success: true,
      message: 'Delivery boy KYC approved successfully',
      data: kyc
    });

  } catch (error) {
    console.error('Error approving delivery boy KYC:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve delivery boy KYC',
      error: error.message
    });
  }
};

/**
 * PATCH /api/admin/kyc/delivery-boys/:id/reject
 * Reject delivery boy KYC
 */
module.exports.rejectDeliveryBoyKYC = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const kyc = await DeliveryBoyKYC.findByIdAndUpdate(
      id,
      { 
        status: 'rejected',
        rejectionReason: reason,
        verifiedAt: new Date()
      },
      { new: true }
    ).populate('deliveryBoyId', 'fullname email phone');

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: 'KYC request not found'
      });
    }

    res.json({
      success: true,
      message: 'Delivery boy KYC rejected successfully',
      data: kyc
    });

  } catch (error) {
    console.error('Error rejecting delivery boy KYC:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject delivery boy KYC',
      error: error.message
    });
  }
};
