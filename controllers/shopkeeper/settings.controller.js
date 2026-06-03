// controllers/shopkeeper/settings.controller.js
const User = require('../../models/user.model');
const Shopkeeper = require('../../models/ShopKeeper/Shopkeeper');
const Shop = require('../../models/ShopKeeper/Shop');
const ShopkeeperBankDetails = require('../../models/ShopKeeper/ShopkeeperBankDetails');
const ShopkeeperWallet = require('../../models/ShopKeeper/ShopkeeperWallet');

// ✅ Get Settings
module.exports.getSettings = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select('-password');
    const shopkeeper = await Shopkeeper.findOne({ userId });
    const shop = await Shop.findOne({ shopkeeperId: shopkeeper._id });
    const bankDetails = await ShopkeeperBankDetails.findOne({ shopkeeperId: shopkeeper._id });

    return res.status(200).json({
      success: true,
      message: 'Settings retrieved successfully',
      data: {
        user: user,
        shop: {
          shopName: shop?.shopName,
          businessType: shop?.businessType,
          openingTime: shop?.openingTime,
          closingTime: shop?.closingTime,
          isOpen: shop?.isOpen,
          commissionRate: shop?.commissionRate,
          status: shop?.status,
          latitude: shop?.latitude,
          longitude: shop?.longitude
        },
        bankDetails: bankDetails ? {
          accountHolderName: bankDetails.accountHolderName,
          bankAccountNumber: bankDetails.bankAccountNumber.slice(-4).padStart(bankDetails.bankAccountNumber.length, '*'),
          ifscCode: bankDetails.ifscCode,
          bankName: bankDetails.bankName,
          upiId: bankDetails.upiId,
          isVerified: bankDetails.isVerified
        } : null
      }
    });

  } catch (error) {
    console.error('Get settings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ Update Business Hours
module.exports.updateBusinessHours = async (req, res) => {
  try {
    const userId = req.user._id;
    const { openingTime, closingTime } = req.body;

    if (!openingTime || !closingTime) {
      return res.status(400).json({
        success: false,
        message: 'Opening time and closing time are required'
      });
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(openingTime) || !timeRegex.test(closingTime)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid time format. Use HH:MM format (e.g., 09:00)'
      });
    }

    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper profile not found'
      });
    }

    const shop = await Shop.findOneAndUpdate(
      { shopkeeperId: shopkeeper._id },
      { openingTime, closingTime },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Business hours updated successfully',
      data: {
        openingTime: shop.openingTime,
        closingTime: shop.closingTime
      }
    });

  } catch (error) {
    console.error('Update business hours error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ Update Shop Location
module.exports.updateShopLocation = async (req, res) => {
  try {
    const userId = req.user._id;
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper profile not found'
      });
    }

    const shop = await Shop.findOneAndUpdate(
      { shopkeeperId: shopkeeper._id },
      { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
      { new: true }
    );

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Shop location updated successfully',
      data: {
        latitude: shop.latitude,
        longitude: shop.longitude
      }
    });

  } catch (error) {
    console.error('Update shop location error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ Update Bank Details
module.exports.updateBankDetails = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      accountHolderName,
      bankAccountNumber,
      ifscCode,
      bankName,
      branchName,
      upiId
    } = req.body;

    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper profile not found'
      });
    }

    const updateData = {};
    if (accountHolderName) updateData.accountHolderName = accountHolderName.trim();
    if (bankAccountNumber) updateData.bankAccountNumber = bankAccountNumber.trim();
    if (ifscCode) updateData.ifscCode = ifscCode.trim().toUpperCase();
    if (bankName) updateData.bankName = bankName.trim();
    if (branchName) updateData.branchName = branchName.trim();
    if (upiId) updateData.upiId = upiId.trim();

    // If critical details changed, mark as unverified
    if (bankAccountNumber || ifscCode) {
      updateData.isVerified = false;
    }

    const bankDetails = await ShopkeeperBankDetails.findOneAndUpdate(
      { shopkeeperId: shopkeeper._id },
      updateData,
      { new: true, upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Bank details updated successfully',
      data: {
        bankDetails: {
          accountHolderName: bankDetails.accountHolderName,
          bankAccountNumber: bankDetails.bankAccountNumber.slice(-4).padStart(bankDetails.bankAccountNumber.length, '*'),
          ifscCode: bankDetails.ifscCode,
          bankName: bankDetails.bankName,
          upiId: bankDetails.upiId,
          isVerified: bankDetails.isVerified
        }
      }
    });

  } catch (error) {
    console.error('Update bank details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ Change Password
module.exports.changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordMatch = await user.comparePassword(currentPassword);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedPassword = await User.hashPassword(newPassword);
    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ Update Profile
module.exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { fullname, phone, email } = req.body;

    const updateData = {};
    if (fullname) updateData.fullname = fullname.trim();
    if (phone) updateData.phone = phone.trim();
    if (email) updateData.email = email.toLowerCase().trim();

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select('-password');

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: user
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ Get Wallet Details
module.exports.getWalletDetails = async (req, res) => {
  try {
    const userId = req.user._id;

    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper profile not found'
      });
    }

    const wallet = await ShopkeeperWallet.findOne({ shopkeeperId: shopkeeper._id });
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Wallet details retrieved successfully',
      data: {
        wallet: {
          balance: wallet.balance,
          pendingAmount: wallet.pendingAmount,
          totalEarnings: wallet.totalEarnings,
          totalWithdrawn: wallet.totalWithdrawn,
          lastPayoutAt: wallet.lastPayoutAt,
          currency: wallet.currency
        }
      }
    });

  } catch (error) {
    console.error('Get wallet details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ Request Payout
module.exports.requestPayout = async (req, res) => {
  try {
    const userId = req.user._id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper profile not found'
      });
    }

    const wallet = await ShopkeeperWallet.findOne({ shopkeeperId: shopkeeper._id });
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    if (!wallet.canWithdraw(amount)) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₹${wallet.balance}`,
        availableBalance: wallet.balance
      });
    }

    // Check bank details
    const bankDetails = await ShopkeeperBankDetails.findOne({ shopkeeperId: shopkeeper._id });
    if (!bankDetails || !bankDetails.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Bank details not verified. Please update and verify your bank details first.'
      });
    }

    // Process withdrawal
    wallet.processWithdrawal(amount);
    await wallet.save();

    // In production, create a payout request record and notify admin
    console.log(`Payout request: Shopkeeper ${shopkeeper._id}, Amount: ₹${amount}`);

    return res.status(200).json({
      success: true,
      message: 'Payout request submitted successfully. Amount will be transferred within 2-3 business days.',
      data: {
        amount: amount,
        remainingBalance: wallet.balance,
        bankDetails: {
          accountNumber: bankDetails.bankAccountNumber.slice(-4).padStart(bankDetails.bankAccountNumber.length, '*'),
          ifscCode: bankDetails.ifscCode
        }
      }
    });

  } catch (error) {
    console.error('Request payout error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
