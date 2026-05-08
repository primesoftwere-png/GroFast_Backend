// controllers/shopkeeper/shopkeeperKYC.controller.js
const ShopkeeperKYC = require("../../models/ShopKeeper/ShopkeeperKYC");
const Shopkeeper = require("../../models/ShopKeeper/Shopkeeper");

// ✅ Submit KYC Documents
module.exports.submitKYC = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      ownerNameAsPerID,
      aadhaarNumber,
      aadhaarDocument,
      panNumber,
      panDocument,
      gstNumber,
      gstDocument
    } = req.body;

    // Validation - Required fields
    if (!ownerNameAsPerID || !aadhaarNumber || !aadhaarDocument) {
      return res.status(400).json({
        success: false,
        message: "Owner name, Aadhaar number, and Aadhaar document are required"
      });
    }

    // Validate Aadhaar number (12 digits)
    if (!/^\d{12}$/.test(aadhaarNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Aadhaar number. Must be exactly 12 digits"
      });
    }

    // Validate PAN if provided (format: ABCDE1234F)
    if (panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid PAN number format. Format should be: ABCDE1234F"
      });
    }

    // Validate GST if provided (format: 22AAAAA0000A1Z5)
    if (gstNumber && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/.test(gstNumber.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid GST number format. Format should be: 22AAAAA0000A1Z5"
      });
    }

    // Get shopkeeper profile
    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: "Shopkeeper profile not found. Please complete your profile first."
      });
    }

    // Check if KYC already exists
    let kyc = await ShopkeeperKYC.findOne({ shopkeeperId: shopkeeper._id });

    // If KYC exists and is approved, don't allow resubmission
    if (kyc && kyc.kycStatus === 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: "KYC is already approved. Cannot resubmit."
      });
    }

    const kycData = {
      shopkeeperId: shopkeeper._id,
      ownerNameAsPerID: ownerNameAsPerID.trim(),
      aadhaarNumber: aadhaarNumber.trim(),
      aadhaarDocument,
      panNumber: panNumber ? panNumber.trim().toUpperCase() : '',
      panDocument: panDocument || '',
      gstNumber: gstNumber ? gstNumber.trim().toUpperCase() : '',
      gstDocument: gstDocument || '',
      kycStatus: 'PENDING',
      rejectionReason: null
    };

    if (kyc) {
      // Update existing KYC (if pending or rejected)
      kyc = await ShopkeeperKYC.findOneAndUpdate(
        { shopkeeperId: shopkeeper._id },
        kycData,
        { new: true }
      );
    } else {
      // Create new KYC
      kyc = await ShopkeeperKYC.create(kycData);
    }

    // Update shopkeeper owner name and GST
    await Shopkeeper.findByIdAndUpdate(shopkeeper._id, {
      ownerName: ownerNameAsPerID.trim(),
      gstNumber: gstNumber ? gstNumber.trim().toUpperCase() : ''
    });

    return res.status(201).json({
      success: true,
      message: "KYC documents submitted successfully. Your application is under review.",
      data: {
        kycId: kyc._id,
        status: kyc.kycStatus,
        submittedAt: kyc.createdAt
      }
    });

  } catch (error) {
    console.error("Submit KYC error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "KYC already exists for this shopkeeper"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while submitting KYC",
      error: error.message
    });
  }
};

// ✅ Get KYC Status
module.exports.getKYCStatus = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get shopkeeper profile
    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: "Shopkeeper profile not found"
      });
    }

    const kyc = await ShopkeeperKYC.findOne({ shopkeeperId: shopkeeper._id })
      .populate('verifiedBy', 'fullname email')
      .select('-__v');

    if (!kyc) {
      return res.status(200).json({
        success: true,
        message: "KYC not submitted yet",
        data: {
          status: 'not_submitted',
          kyc: null
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: "KYC status retrieved successfully",
      data: {
        status: kyc.kycStatus,
        kyc: {
          _id: kyc._id,
          ownerNameAsPerID: kyc.ownerNameAsPerID,
          aadhaarNumber: kyc.aadhaarNumber,
          aadhaarDocument: kyc.aadhaarDocument,
          panNumber: kyc.panNumber,
          panDocument: kyc.panDocument,
          gstNumber: kyc.gstNumber,
          gstDocument: kyc.gstDocument,
          kycStatus: kyc.kycStatus,
          rejectionReason: kyc.rejectionReason,
          verifiedBy: kyc.verifiedBy,
          verifiedAt: kyc.verifiedAt,
          createdAt: kyc.createdAt,
          updatedAt: kyc.updatedAt
        }
      }
    });

  } catch (error) {
    console.error("Get KYC status error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching KYC status",
      error: error.message
    });
  }
};

// ✅ Update KYC Documents (only if pending or rejected)
module.exports.updateKYC = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      ownerNameAsPerID,
      aadhaarNumber,
      aadhaarDocument,
      panNumber,
      panDocument,
      gstNumber,
      gstDocument
    } = req.body;

    // Get shopkeeper profile
    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: "Shopkeeper profile not found"
      });
    }

    // Check if KYC exists
    const kyc = await ShopkeeperKYC.findOne({ shopkeeperId: shopkeeper._id });

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "KYC not found. Please submit KYC first."
      });
    }

    // Check if KYC is approved
    if (kyc.kycStatus === 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: "Cannot update approved KYC. Please contact admin for changes."
      });
    }

    // Build update object with only provided fields
    const updateData = {
      kycStatus: 'PENDING',
      rejectionReason: null
    };

    if (ownerNameAsPerID) updateData.ownerNameAsPerID = ownerNameAsPerID.trim();

    if (aadhaarNumber) {
      if (!/^\d{12}$/.test(aadhaarNumber)) {
        return res.status(400).json({
          success: false,
          message: "Invalid Aadhaar number. Must be exactly 12 digits"
        });
      }
      updateData.aadhaarNumber = aadhaarNumber.trim();
    }

    if (aadhaarDocument) updateData.aadhaarDocument = aadhaarDocument;

    if (panNumber) {
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: "Invalid PAN number format. Format should be: ABCDE1234F"
        });
      }
      updateData.panNumber = panNumber.trim().toUpperCase();
    }

    if (panDocument) updateData.panDocument = panDocument;

    if (gstNumber) {
      if (!/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/.test(gstNumber.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: "Invalid GST number format. Format should be: 22AAAAA0000A1Z5"
        });
      }
      updateData.gstNumber = gstNumber.trim().toUpperCase();
    }

    if (gstDocument) updateData.gstDocument = gstDocument;

    // Update KYC
    const updatedKYC = await ShopkeeperKYC.findOneAndUpdate(
      { shopkeeperId: shopkeeper._id },
      updateData,
      { new: true }
    );

    // Update shopkeeper owner name and GST if provided
    if (ownerNameAsPerID || gstNumber) {
      const shopkeeperUpdate = {};
      if (ownerNameAsPerID) shopkeeperUpdate.ownerName = ownerNameAsPerID.trim();
      if (gstNumber) shopkeeperUpdate.gstNumber = gstNumber.trim().toUpperCase();

      await Shopkeeper.findByIdAndUpdate(shopkeeper._id, shopkeeperUpdate);
    }

    return res.status(200).json({
      success: true,
      message: "KYC updated successfully. Your application is under review.",
      data: {
        kycId: updatedKYC._id,
        status: updatedKYC.kycStatus,
        updatedAt: updatedKYC.updatedAt
      }
    });

  } catch (error) {
    console.error("Update KYC error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating KYC",
      error: error.message
    });
  }
};
