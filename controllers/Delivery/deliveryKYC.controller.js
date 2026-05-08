// controllers/Delivery/deliveryKYC.controller.js
const DeliveryBoyKYC = require("../../models/DeliveryBoy/DeliveryBoyKYC");
const DeliveryBoy = require("../../models/DeliveryBoy/DeliveryBoy");

// ✅ Submit KYC Documents
module.exports.submitKYC = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const {
      aadharNumber,
      aadharFrontImage,
      aadharBackImage,
      drivingLicenseNumber,
      drivingLicenseFrontImage,
      drivingLicenseBackImage,
      panNumber,
      panImage,
      profilePhoto,
      vehicleType,
      vehicleNumber,
      vehicleRCImage,
      bankAccountNumber,
      bankIFSC,
      bankAccountHolderName
    } = req.body;

    // Validation - Required fields
    if (!aadharNumber || !aadharFrontImage || !aadharBackImage) {
      return res.status(400).json({
        success: false,
        message: "Aadhar number and images (front & back) are required"
      });
    }

    if (!drivingLicenseNumber || !drivingLicenseFrontImage || !drivingLicenseBackImage) {
      return res.status(400).json({
        success: false,
        message: "Driving license number and images (front & back) are required"
      });
    }

    if (!profilePhoto) {
      return res.status(400).json({
        success: false,
        message: "Profile photo is required"
      });
    }

    if (!vehicleType || !vehicleNumber || !vehicleRCImage) {
      return res.status(400).json({
        success: false,
        message: "Vehicle type, number, and RC image are required"
      });
    }

    // Validate Aadhar number (12 digits)
    if (!/^\d{12}$/.test(aadharNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Aadhar number. Must be exactly 12 digits"
      });
    }

    // Validate PAN if provided (format: ABCDE1234F)
    if (panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid PAN number format. Format should be: ABCDE1234F"
      });
    }

    // Validate vehicle type
    const validVehicleTypes = ['bike', 'scooter', 'bicycle', 'car'];
    if (!validVehicleTypes.includes(vehicleType.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid vehicle type. Must be one of: ${validVehicleTypes.join(', ')}`
      });
    }

    // Check if KYC already exists
    let kyc = await DeliveryBoyKYC.findOne({ deliveryBoyId });

    // If KYC exists and is approved, don't allow resubmission
    if (kyc && kyc.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: "KYC is already approved. Cannot resubmit."
      });
    }

    const kycData = {
      deliveryBoyId,
      aadharNumber: aadharNumber.trim(),
      aadharFrontImage,
      aadharBackImage,
      drivingLicenseNumber: drivingLicenseNumber.trim(),
      drivingLicenseFrontImage,
      drivingLicenseBackImage,
      panNumber: panNumber ? panNumber.trim().toUpperCase() : null,
      panImage: panImage || null,
      profilePhoto,
      vehicleType: vehicleType.toLowerCase(),
      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      vehicleRCImage,
      bankAccountNumber: bankAccountNumber ? bankAccountNumber.trim() : null,
      bankIFSC: bankIFSC ? bankIFSC.trim().toUpperCase() : null,
      bankAccountHolderName: bankAccountHolderName ? bankAccountHolderName.trim() : null,
      status: 'pending',
      rejectionReason: null,
      submittedAt: Date.now()
    };

    if (kyc) {
      // Update existing KYC (if pending or rejected)
      kyc = await DeliveryBoyKYC.findOneAndUpdate(
        { deliveryBoyId },
        kycData,
        { new: true }
      );
    } else {
      // Create new KYC
      kyc = await DeliveryBoyKYC.create(kycData);
    }

    // Update delivery boy vehicle details
    await DeliveryBoy.findOneAndUpdate(
      { userId: deliveryBoyId },
      {
        vehicleType: vehicleType.toLowerCase(),
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        profileImage: profilePhoto
      }
    );

    return res.status(201).json({
      success: true,
      message: "KYC documents submitted successfully. Your application is under review.",
      data: {
        kycId: kyc._id,
        status: kyc.status,
        submittedAt: kyc.submittedAt
      }
    });

  } catch (error) {
    console.error("Submit KYC error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "KYC already exists for this delivery boy"
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
    const deliveryBoyId = req.user._id;

    const kyc = await DeliveryBoyKYC.findOne({ deliveryBoyId })
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
        status: kyc.status,
        kyc: {
          _id: kyc._id,
          aadharNumber: kyc.aadharNumber,
          aadharFrontImage: kyc.aadharFrontImage,
          aadharBackImage: kyc.aadharBackImage,
          drivingLicenseNumber: kyc.drivingLicenseNumber,
          drivingLicenseFrontImage: kyc.drivingLicenseFrontImage,
          drivingLicenseBackImage: kyc.drivingLicenseBackImage,
          panNumber: kyc.panNumber,
          panImage: kyc.panImage,
          profilePhoto: kyc.profilePhoto,
          vehicleType: kyc.vehicleType,
          vehicleNumber: kyc.vehicleNumber,
          vehicleRCImage: kyc.vehicleRCImage,
          bankAccountNumber: kyc.bankAccountNumber,
          bankIFSC: kyc.bankIFSC,
          bankAccountHolderName: kyc.bankAccountHolderName,
          status: kyc.status,
          rejectionReason: kyc.rejectionReason,
          verifiedBy: kyc.verifiedBy,
          verifiedAt: kyc.verifiedAt,
          submittedAt: kyc.submittedAt,
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
    const deliveryBoyId = req.user._id;
    const {
      aadharNumber,
      aadharFrontImage,
      aadharBackImage,
      drivingLicenseNumber,
      drivingLicenseFrontImage,
      drivingLicenseBackImage,
      panNumber,
      panImage,
      profilePhoto,
      vehicleType,
      vehicleNumber,
      vehicleRCImage,
      bankAccountNumber,
      bankIFSC,
      bankAccountHolderName
    } = req.body;

    // Check if KYC exists
    const kyc = await DeliveryBoyKYC.findOne({ deliveryBoyId });

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "KYC not found. Please submit KYC first."
      });
    }

    // Check if KYC is approved
    if (kyc.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: "Cannot update approved KYC. Please contact admin for changes."
      });
    }

    // Build update object with only provided fields
    const updateData = {
      status: 'pending',
      rejectionReason: null,
      submittedAt: Date.now()
    };

    if (aadharNumber) {
      if (!/^\d{12}$/.test(aadharNumber)) {
        return res.status(400).json({
          success: false,
          message: "Invalid Aadhar number. Must be exactly 12 digits"
        });
      }
      updateData.aadharNumber = aadharNumber.trim();
    }

    if (aadharFrontImage) updateData.aadharFrontImage = aadharFrontImage;
    if (aadharBackImage) updateData.aadharBackImage = aadharBackImage;
    if (drivingLicenseNumber) updateData.drivingLicenseNumber = drivingLicenseNumber.trim();
    if (drivingLicenseFrontImage) updateData.drivingLicenseFrontImage = drivingLicenseFrontImage;
    if (drivingLicenseBackImage) updateData.drivingLicenseBackImage = drivingLicenseBackImage;
    
    if (panNumber) {
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: "Invalid PAN number format. Format should be: ABCDE1234F"
        });
      }
      updateData.panNumber = panNumber.trim().toUpperCase();
    }
    
    if (panImage) updateData.panImage = panImage;
    if (profilePhoto) updateData.profilePhoto = profilePhoto;
    
    if (vehicleType) {
      const validVehicleTypes = ['bike', 'scooter', 'bicycle', 'car'];
      if (!validVehicleTypes.includes(vehicleType.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: `Invalid vehicle type. Must be one of: ${validVehicleTypes.join(', ')}`
        });
      }
      updateData.vehicleType = vehicleType.toLowerCase();
    }
    
    if (vehicleNumber) updateData.vehicleNumber = vehicleNumber.trim().toUpperCase();
    if (vehicleRCImage) updateData.vehicleRCImage = vehicleRCImage;
    if (bankAccountNumber) updateData.bankAccountNumber = bankAccountNumber.trim();
    if (bankIFSC) updateData.bankIFSC = bankIFSC.trim().toUpperCase();
    if (bankAccountHolderName) updateData.bankAccountHolderName = bankAccountHolderName.trim();

    // Update KYC
    const updatedKYC = await DeliveryBoyKYC.findOneAndUpdate(
      { deliveryBoyId },
      updateData,
      { new: true }
    );

    // Update delivery boy vehicle details if provided
    if (vehicleType || vehicleNumber || profilePhoto) {
      const deliveryBoyUpdate = {};
      if (vehicleType) deliveryBoyUpdate.vehicleType = vehicleType.toLowerCase();
      if (vehicleNumber) deliveryBoyUpdate.vehicleNumber = vehicleNumber.trim().toUpperCase();
      if (profilePhoto) deliveryBoyUpdate.profileImage = profilePhoto;

      await DeliveryBoy.findOneAndUpdate(
        { userId: deliveryBoyId },
        deliveryBoyUpdate
      );
    }

    return res.status(200).json({
      success: true,
      message: "KYC updated successfully. Your application is under review.",
      data: {
        kycId: updatedKYC._id,
        status: updatedKYC.status,
        submittedAt: updatedKYC.submittedAt
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
