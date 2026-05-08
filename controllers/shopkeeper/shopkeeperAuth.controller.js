// controllers/shopkeeper/shopkeeperAuth.controller.js
const User = require('../../models/user.model');
const Shopkeeper = require('../../models/ShopKeeper/Shopkeeper');
const Shop = require('../../models/ShopKeeper/Shop');
const ShopkeeperKYC = require('../../models/ShopKeeper/ShopkeeperKYC');
const ShopkeeperBankDetails = require('../../models/ShopKeeper/ShopkeeperBankDetails');
const ShopkeeperWallet = require('../../models/ShopKeeper/ShopkeeperWallet');

// ✅ STEP 1: Basic Signup (Name, Email, Password/OTP)
module.exports.registerBasic = async (req, res) => {
  try {
    const { fullname, email, phone, password } = req.body;

    // Validation
    if (!fullname || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: fullname, email, phone, password'
      });
    }

    // Email validation
    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Phone validation
    if (!/^\d{10,15}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format (10-15 digits required)'
      });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Check existing user
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase().trim() },
        { phone: phone.trim() }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email or phone'
      });
    }

    // Hash password
    const hashedPassword = await User.hashPassword(password);

    // Create user with admin role (shopkeeper)
    const userData = {
      fullname: fullname.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password: hashedPassword,
      role: 'admin', // Shopkeeper role
      accountStatus: 'pending',
      roleDetails: {
        shopkeeper: {
          status: 'pending'
        }
      }
    };

    const savedUser = await User.create(userData);

    // Generate token
    const token = await savedUser.generateAuthToken();

    // Response
    const userResponse = savedUser.toObject();
    delete userResponse.password;

    return res.status(201).json({
      success: true,
      message: 'Basic registration successful. Please complete your shop profile.',
      data: {
        user: userResponse,
        token: token,
        nextStep: 'complete_profile'
      }
    });

  } catch (error) {
    console.error('Basic registration error:', error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `User already exists with this ${field}`
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
};

// ✅ STEP 2: Complete Shop Profile (Business Details, KYC, Payout Setup)
module.exports.completeProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const {
      // Shop Information
      shopName,
      shopAddress,
      city,
      pincode,
      latitude,
      longitude,
      
      // Business Details
      businessType,
      openingTime,
      closingTime,
      
      // Owner & KYC Details
      ownerNameAsPerID,
      aadhaarNumber,
      aadhaarDocument,
      panNumber,
      panDocument,
      gstNumber,
      gstDocument,
      
      // Bank & Payout Details
      accountHolderName,
      bankAccountNumber,
      ifscCode,
      bankName,
      branchName,
      upiId,
      
      // Media (optional)
      shopImage,
      shopBanner,
      
      // Additional
      description,
      tags
    } = req.body;

    // Validation - Mandatory fields
    if (!shopName || !shopAddress || !city || !pincode) {
      return res.status(400).json({
        success: false,
        message: 'Shop name, address, city, and pincode are required'
      });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Location coordinates (latitude, longitude) are required'
      });
    }

    if (!ownerNameAsPerID || !aadhaarNumber || !aadhaarDocument) {
      return res.status(400).json({
        success: false,
        message: 'Owner name, Aadhaar number, and Aadhaar document are required for KYC'
      });
    }

    if (!accountHolderName || !bankAccountNumber || !ifscCode) {
      return res.status(400).json({
        success: false,
        message: 'Bank details (account holder name, account number, IFSC code) are required'
      });
    }

    // Check if shopkeeper profile already exists
    const existingShopkeeper = await Shopkeeper.findOne({ userId });
    if (existingShopkeeper) {
      return res.status(400).json({
        success: false,
        message: 'Shop profile already exists for this user'
      });
    }

    // Create Shopkeeper profile
    const shopkeeperData = {
      userId: userId,
      shopName: shopName.trim(),
      ownerName: ownerNameAsPerID.trim(),
      shopImage: shopImage || '',
      licenseNumber: '',
      gstNumber: gstNumber || ''
    };

    const savedShopkeeper = await Shopkeeper.create(shopkeeperData);

    // Create Shop
    const shopData = {
      shopkeeperId: savedShopkeeper._id,
      shopName: shopName.trim(),
      shopAddress: shopAddress.trim(),
      city: city.trim(),
      state: 'Unknown', // Can be enhanced with state selection
      pincode: pincode.trim(),
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      businessType: businessType || 'grocery',
      openingTime: openingTime || '09:00',
      closingTime: closingTime || '21:00',
      isOpen: false, // Will be true after admin approval
      shopImage: shopImage || '',
      shopBanner: shopBanner || '',
      commissionRate: 10, // Default 10%
      status: 'INACTIVE',
      isVerified: false,
      description: description || '',
      tags: tags || []
    };

    const savedShop = await Shop.create(shopData);

    // Create KYC record
    const kycData = {
      shopkeeperId: savedShopkeeper._id,
      ownerNameAsPerID: ownerNameAsPerID.trim(),
      aadhaarNumber: aadhaarNumber.trim(),
      aadhaarDocument: aadhaarDocument,
      panNumber: panNumber ? panNumber.trim().toUpperCase() : '',
      panDocument: panDocument || '',
      gstNumber: gstNumber ? gstNumber.trim().toUpperCase() : '',
      gstDocument: gstDocument || '',
      kycStatus: 'PENDING'
    };

    const savedKYC = await ShopkeeperKYC.create(kycData);

    // Create Bank Details
    const bankData = {
      shopkeeperId: savedShopkeeper._id,
      accountHolderName: accountHolderName.trim(),
      bankAccountNumber: bankAccountNumber.trim(),
      ifscCode: ifscCode.trim().toUpperCase(),
      bankName: bankName || '',
      branchName: branchName || '',
      upiId: upiId || '',
      isVerified: false
    };

    const savedBankDetails = await ShopkeeperBankDetails.create(bankData);

    // Create Wallet
    const walletData = {
      shopkeeperId: savedShopkeeper._id,
      balance: 0,
      pendingAmount: 0,
      totalEarnings: 0,
      totalWithdrawn: 0
    };

    const savedWallet = await ShopkeeperWallet.create(walletData);

    // Update user status
    await User.findByIdAndUpdate(userId, {
      'roleDetails.shopkeeper.status': 'pending'
    });

    return res.status(201).json({
      success: true,
      message: 'Shop profile completed successfully. Your application is pending admin approval.',
      data: {
        shopkeeper: savedShopkeeper,
        shop: savedShop,
        kyc: {
          status: savedKYC.kycStatus
        },
        wallet: {
          balance: savedWallet.balance
        },
        status: 'pending_approval'
      }
    });

  } catch (error) {
    console.error('Complete profile error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Shop profile already exists for this user'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error during profile completion',
      error: error.message
    });
  }
};

// ✅ Login Shopkeeper
module.exports.loginShopkeeper = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user
    const user = await User.findOne({ 
      email: email.toLowerCase().trim(),
      role: 'admin' // Shopkeeper role
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check shopkeeper status
    const shopkeeperStatus = user.roleDetails?.shopkeeper?.status || 'pending';
    
    if (shopkeeperStatus === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Your shop registration is pending admin approval. You will be notified once verified.',
        status: 'pending'
      });
    }

    if (shopkeeperStatus === 'blocked') {
      const rejectReason = user.roleDetails?.shopkeeper?.rejectReason || 'Not specified';
      return res.status(403).json({
        success: false,
        message: `Your shop account has been blocked. Reason: ${rejectReason}`,
        status: 'blocked'
      });
    }

    // Get shopkeeper details
    const shopkeeper = await Shopkeeper.findOne({ userId: user._id });
    const shop = shopkeeper ? await Shop.findOne({ shopkeeperId: shopkeeper._id }) : null;

    // Generate token
    const token = await user.generateAuthToken();

    // Update last login
    user.lastLogin = Date.now();
    await user.save();

    // Response
    const userResponse = user.toObject();
    delete userResponse.password;

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        shopkeeper: shopkeeper,
        shop: shop,
        token: token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
    });
  }
};

// ✅ Get Shopkeeper Profile
module.exports.getProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const shopkeeper = await Shopkeeper.findOne({ userId }).populate('userId', '-password');
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper profile not found'
      });
    }

    const shop = await Shop.findOne({ shopkeeperId: shopkeeper._id });
    const kyc = await ShopkeeperKYC.findOne({ shopkeeperId: shopkeeper._id });
    const bankDetails = await ShopkeeperBankDetails.findOne({ shopkeeperId: shopkeeper._id });
    const wallet = await ShopkeeperWallet.findOne({ shopkeeperId: shopkeeper._id });

    return res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        shopkeeper: shopkeeper,
        shop: shop,
        kyc: kyc ? {
          status: kyc.kycStatus,
          rejectionReason: kyc.rejectionReason
        } : null,
        bankDetails: bankDetails ? {
          accountHolderName: bankDetails.accountHolderName,
          bankAccountNumber: bankDetails.bankAccountNumber.slice(-4).padStart(bankDetails.bankAccountNumber.length, '*'),
          ifscCode: bankDetails.ifscCode,
          isVerified: bankDetails.isVerified
        } : null,
        wallet: wallet ? {
          balance: wallet.balance,
          pendingAmount: wallet.pendingAmount,
          totalEarnings: wallet.totalEarnings
        } : null
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ Update Shop Details
module.exports.updateShopDetails = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      shopName,
      shopAddress,
      city,
      pincode,
      businessType,
      openingTime,
      closingTime,
      shopImage,
      shopBanner,
      description,
      tags
    } = req.body;

    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper profile not found'
      });
    }

    const updateData = {};
    if (shopName) updateData.shopName = shopName.trim();
    if (shopAddress) updateData.shopAddress = shopAddress.trim();
    if (city) updateData.city = city.trim();
    if (pincode) updateData.pincode = pincode.trim();
    if (businessType) updateData.businessType = businessType;
    if (openingTime) updateData.openingTime = openingTime;
    if (closingTime) updateData.closingTime = closingTime;
    if (shopImage) updateData.shopImage = shopImage;
    if (shopBanner) updateData.shopBanner = shopBanner;
    if (description) updateData.description = description;
    if (tags) updateData.tags = tags;

    const updatedShop = await Shop.findOneAndUpdate(
      { shopkeeperId: shopkeeper._id },
      updateData,
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Shop details updated successfully',
      data: {
        shop: updatedShop
      }
    });

  } catch (error) {
    console.error('Update shop error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ✅ Toggle Shop Open/Close
module.exports.toggleShopStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { isOpen } = req.body;

    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper profile not found'
      });
    }

    const shop = await Shop.findOne({ shopkeeperId: shopkeeper._id });
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    // Check if shop is verified
    if (!shop.isVerified || shop.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Shop must be verified and active to change status'
      });
    }

    shop.isOpen = isOpen !== undefined ? isOpen : !shop.isOpen;
    await shop.save();

    return res.status(200).json({
      success: true,
      message: `Shop is now ${shop.isOpen ? 'open' : 'closed'}`,
      data: {
        isOpen: shop.isOpen
      }
    });

  } catch (error) {
    console.error('Toggle shop status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
