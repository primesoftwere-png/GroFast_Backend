// controllers/Admin/adminKYC.controller.js
const DeliveryBoyKYC = require("../../models/DeliveryBoy/DeliveryBoyKYC");
const ShopkeeperKYC = require("../../models/ShopKeeper/ShopkeeperKYC");
const DeliveryBoy = require("../../models/DeliveryBoy/DeliveryBoy");
const User = require("../../models/user.model");

// ==================== DELIVERY BOY KYC MANAGEMENT ====================

// ✅ Get All Pending Delivery Boy KYCs
module.exports.getPendingDeliveryBoyKYCs = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const kycs = await DeliveryBoyKYC.find({ status: 'pending' })
      .populate('deliveryBoyId', 'fullname email phone')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await DeliveryBoyKYC.countDocuments({ status: 'pending' });

    return res.status(200).json({
      success: true,
      message: "Pending delivery boy KYCs retrieved successfully",
      data: {
        kycs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error("Get pending delivery boy KYCs error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Get All Delivery Boy KYCs (with filters)
module.exports.getAllDeliveryBoyKYCs = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      filter.status = status;
    }

    const kycs = await DeliveryBoyKYC.find(filter)
      .populate('deliveryBoyId', 'fullname email phone')
      .populate('verifiedBy', 'fullname email')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await DeliveryBoyKYC.countDocuments(filter);

    return res.status(200).json({
      success: true,
      message: "Delivery boy KYCs retrieved successfully",
      data: {
        kycs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error("Get all delivery boy KYCs error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Get Single Delivery Boy KYC Details
module.exports.getDeliveryBoyKYCDetails = async (req, res) => {
  try {
    const { kycId } = req.params;

    const kyc = await DeliveryBoyKYC.findById(kycId)
      .populate('deliveryBoyId', 'fullname email phone')
      .populate('verifiedBy', 'fullname email');

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "KYC not found"
      });
    }

    // Get delivery boy details
    const deliveryBoy = await DeliveryBoy.findOne({ userId: kyc.deliveryBoyId._id });

    return res.status(200).json({
      success: true,
      message: "KYC details retrieved successfully",
      data: {
        kyc,
        deliveryBoy
      }
    });

  } catch (error) {
    console.error("Get delivery boy KYC details error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Approve Delivery Boy KYC
module.exports.approveDeliveryBoyKYC = async (req, res) => {
  try {
    const { kycId } = req.params;
    const adminId = req.user._id;

    const kyc = await DeliveryBoyKYC.findById(kycId);

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "KYC not found"
      });
    }

    if (kyc.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: "KYC is already approved"
      });
    }

    // Update KYC status
    kyc.status = 'approved';
    kyc.rejectionReason = null;
    kyc.verifiedBy = adminId;
    kyc.verifiedAt = Date.now();
    await kyc.save();

    // Update delivery boy isKYCVerified status
    await DeliveryBoy.findOneAndUpdate(
      { userId: kyc.deliveryBoyId },
      { isKYCVerified: true }
    );

    return res.status(200).json({
      success: true,
      message: "Delivery boy KYC approved successfully",
      data: {
        kycId: kyc._id,
        status: kyc.status,
        verifiedAt: kyc.verifiedAt
      }
    });

  } catch (error) {
    console.error("Approve delivery boy KYC error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Reject Delivery Boy KYC
module.exports.rejectDeliveryBoyKYC = async (req, res) => {
  try {
    const { kycId } = req.params;
    const { rejectionReason } = req.body;
    const adminId = req.user._id;

    if (!rejectionReason || rejectionReason.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required"
      });
    }

    const kyc = await DeliveryBoyKYC.findById(kycId);

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "KYC not found"
      });
    }

    // Update KYC status
    kyc.status = 'rejected';
    kyc.rejectionReason = rejectionReason.trim();
    kyc.verifiedBy = adminId;
    kyc.verifiedAt = Date.now();
    await kyc.save();

    // Update delivery boy isKYCVerified status
    await DeliveryBoy.findOneAndUpdate(
      { userId: kyc.deliveryBoyId },
      { isKYCVerified: false }
    );

    return res.status(200).json({
      success: true,
      message: "Delivery boy KYC rejected",
      data: {
        kycId: kyc._id,
        status: kyc.status,
        rejectionReason: kyc.rejectionReason,
        verifiedAt: kyc.verifiedAt
      }
    });

  } catch (error) {
    console.error("Reject delivery boy KYC error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ==================== SHOPKEEPER KYC MANAGEMENT ====================

// ✅ Get All Pending Shopkeeper KYCs
module.exports.getPendingShopkeeperKYCs = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const kycs = await ShopkeeperKYC.find({ kycStatus: 'PENDING' })
      .populate({
        path: 'shopkeeperId',
        populate: {
          path: 'userId',
          select: 'fullname email phone'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ShopkeeperKYC.countDocuments({ kycStatus: 'PENDING' });

    return res.status(200).json({
      success: true,
      message: "Pending shopkeeper KYCs retrieved successfully",
      data: {
        kycs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error("Get pending shopkeeper KYCs error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Get All Shopkeeper KYCs (with filters)
module.exports.getAllShopkeeperKYCs = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status.toUpperCase())) {
      filter.kycStatus = status.toUpperCase();
    }

    const kycs = await ShopkeeperKYC.find(filter)
      .populate({
        path: 'shopkeeperId',
        populate: {
          path: 'userId',
          select: 'fullname email phone'
        }
      })
      .populate('verifiedBy', 'fullname email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ShopkeeperKYC.countDocuments(filter);

    return res.status(200).json({
      success: true,
      message: "Shopkeeper KYCs retrieved successfully",
      data: {
        kycs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error("Get all shopkeeper KYCs error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Get Single Shopkeeper KYC Details
module.exports.getShopkeeperKYCDetails = async (req, res) => {
  try {
    const { kycId } = req.params;

    const kyc = await ShopkeeperKYC.findById(kycId)
      .populate({
        path: 'shopkeeperId',
        populate: {
          path: 'userId',
          select: 'fullname email phone'
        }
      })
      .populate('verifiedBy', 'fullname email');

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "KYC not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "KYC details retrieved successfully",
      data: {
        kyc
      }
    });

  } catch (error) {
    console.error("Get shopkeeper KYC details error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Approve Shopkeeper KYC
module.exports.approveShopkeeperKYC = async (req, res) => {
  try {
    const { kycId } = req.params;
    const adminId = req.user._id;

    const kyc = await ShopkeeperKYC.findById(kycId).populate('shopkeeperId');

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "KYC not found"
      });
    }

    if (kyc.kycStatus === 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: "KYC is already approved"
      });
    }

    // Update KYC status
    kyc.kycStatus = 'APPROVED';
    kyc.rejectionReason = null;
    kyc.verifiedBy = adminId;
    kyc.verifiedAt = Date.now();
    await kyc.save();

    // Update user roleDetails to mark shopkeeper as approved
    if (kyc.shopkeeperId && kyc.shopkeeperId.userId) {
      await User.findByIdAndUpdate(kyc.shopkeeperId.userId, {
        'roleDetails.shopkeeper.status': 'approved',
        'roleDetails.shopkeeper.approvedAt': Date.now()
      });
    }

    return res.status(200).json({
      success: true,
      message: "Shopkeeper KYC approved successfully",
      data: {
        kycId: kyc._id,
        status: kyc.kycStatus,
        verifiedAt: kyc.verifiedAt
      }
    });

  } catch (error) {
    console.error("Approve shopkeeper KYC error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Reject Shopkeeper KYC
module.exports.rejectShopkeeperKYC = async (req, res) => {
  try {
    const { kycId } = req.params;
    const { rejectionReason } = req.body;
    const adminId = req.user._id;

    if (!rejectionReason || rejectionReason.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required"
      });
    }

    const kyc = await ShopkeeperKYC.findById(kycId).populate('shopkeeperId');

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "KYC not found"
      });
    }

    // Update KYC status
    kyc.kycStatus = 'REJECTED';
    kyc.rejectionReason = rejectionReason.trim();
    kyc.verifiedBy = adminId;
    kyc.verifiedAt = Date.now();
    await kyc.save();

    // Update user roleDetails to mark shopkeeper as rejected
    if (kyc.shopkeeperId && kyc.shopkeeperId.userId) {
      await User.findByIdAndUpdate(kyc.shopkeeperId.userId, {
        'roleDetails.shopkeeper.status': 'rejected',
        'roleDetails.shopkeeper.rejectReason': rejectionReason.trim()
      });
    }

    return res.status(200).json({
      success: true,
      message: "Shopkeeper KYC rejected",
      data: {
        kycId: kyc._id,
        status: kyc.kycStatus,
        rejectionReason: kyc.rejectionReason,
        verifiedAt: kyc.verifiedAt
      }
    });

  } catch (error) {
    console.error("Reject shopkeeper KYC error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};
