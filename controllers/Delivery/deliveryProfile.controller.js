// controllers/Delivery/deliveryProfile.controller.js
const User = require("../../models/user.model");
const DeliveryBoy = require("../../models/DeliveryBoy/DeliveryBoy");
const DeliveryBoyKYC = require("../../models/DeliveryBoy/DeliveryBoyKYC");
const DeliveryBoyWallet = require("../../models/DeliveryBoy/DeliveryBoyWallet");

// ✅ Get Delivery Boy Profile
module.exports.getProfile = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;

    // Get user details
    const user = await User.findById(deliveryBoyId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get delivery boy details
    const deliveryBoy = await DeliveryBoy.findOne({ userId: deliveryBoyId });
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy profile not found"
      });
    }

    // Get KYC status
    const kyc = await DeliveryBoyKYC.findOne({ deliveryBoyId });
    const kycStatus = kyc ? kyc.status : 'not_submitted';

    // Get wallet
    const wallet = await DeliveryBoyWallet.findOne({ deliveryBoyId });

    return res.status(200).json({
      success: true,
      message: "Profile retrieved successfully",
      data: {
        user: user,
        deliveryBoy: deliveryBoy,
        kycStatus: kycStatus,
        wallet: wallet
      }
    });

  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Update Delivery Boy Profile
module.exports.updateProfile = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const {
      fullname,
      phone,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      address,
      emergencyContact,
      profileImage
    } = req.body;

    // Update user details
    const userUpdateData = {};
    if (fullname) userUpdateData.fullname = fullname.trim();
    if (phone) {
      // Validate phone
      if (!/^\d{10,15}$/.test(phone)) {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number format"
        });
      }
      userUpdateData.phone = phone.trim();
    }

    if (Object.keys(userUpdateData).length > 0) {
      await User.findByIdAndUpdate(deliveryBoyId, userUpdateData);
    }

    // Update delivery boy details
    const deliveryBoyUpdateData = {};
    if (firstName) deliveryBoyUpdateData.firstName = firstName.trim();
    if (lastName) deliveryBoyUpdateData.lastName = lastName.trim();
    if (dateOfBirth) deliveryBoyUpdateData.dateOfBirth = dateOfBirth;
    if (gender) {
      if (!['male', 'female', 'other'].includes(gender)) {
        return res.status(400).json({
          success: false,
          message: "Invalid gender value"
        });
      }
      deliveryBoyUpdateData.gender = gender;
    }
    if (address) deliveryBoyUpdateData.address = address;
    if (emergencyContact) deliveryBoyUpdateData.emergencyContact = emergencyContact;
    if (profileImage) deliveryBoyUpdateData.profileImage = profileImage;

    const updatedDeliveryBoy = await DeliveryBoy.findOneAndUpdate(
      { userId: deliveryBoyId },
      deliveryBoyUpdateData,
      { new: true }
    );

    if (!updatedDeliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy profile not found"
      });
    }

    // Get updated user
    const updatedUser = await User.findById(deliveryBoyId).select('-password');

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: updatedUser,
        deliveryBoy: updatedDeliveryBoy
      }
    });

  } catch (error) {
    console.error("Update profile error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Phone number already exists"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Upload KYC Documents
module.exports.uploadKYC = async (req, res) => {
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

    // Validation
    if (!aadharNumber || !aadharFrontImage || !aadharBackImage) {
      return res.status(400).json({
        success: false,
        message: "Aadhar details are required"
      });
    }

    if (!drivingLicenseNumber || !drivingLicenseFrontImage || !drivingLicenseBackImage) {
      return res.status(400).json({
        success: false,
        message: "Driving license details are required"
      });
    }

    if (!profilePhoto || !vehicleType || !vehicleNumber || !vehicleRCImage) {
      return res.status(400).json({
        success: false,
        message: "Profile photo, vehicle details and RC are required"
      });
    }

    // Validate Aadhar number
    if (!/^\d{12}$/.test(aadharNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Aadhar number (must be 12 digits)"
      });
    }

    // Validate PAN if provided
    if (panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid PAN number format"
      });
    }

    // Check if KYC already exists
    let kyc = await DeliveryBoyKYC.findOne({ deliveryBoyId });

    const kycData = {
      deliveryBoyId,
      aadharNumber: aadharNumber.trim(),
      aadharFrontImage,
      aadharBackImage,
      drivingLicenseNumber: drivingLicenseNumber.trim(),
      drivingLicenseFrontImage,
      drivingLicenseBackImage,
      panNumber: panNumber ? panNumber.trim() : null,
      panImage: panImage || null,
      profilePhoto,
      vehicleType,
      vehicleNumber: vehicleNumber.trim(),
      vehicleRCImage,
      bankAccountNumber: bankAccountNumber || null,
      bankIFSC: bankIFSC || null,
      bankAccountHolderName: bankAccountHolderName || null,
      status: 'pending',
      submittedAt: Date.now()
    };

    if (kyc) {
      // Update existing KYC
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
        vehicleType,
        vehicleNumber: vehicleNumber.trim(),
        profileImage: profilePhoto
      }
    );

    return res.status(201).json({
      success: true,
      message: "KYC documents uploaded successfully. Awaiting admin verification.",
      data: kyc
    });

  } catch (error) {
    console.error("Upload KYC error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "KYC already submitted for this delivery boy"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Get KYC Status
module.exports.getKYCStatus = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;

    const kyc = await DeliveryBoyKYC.findOne({ deliveryBoyId });

    if (!kyc) {
      return res.status(200).json({
        success: true,
        message: "KYC not submitted",
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
        kyc: kyc
      }
    });

  } catch (error) {
    console.error("Get KYC status error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};
