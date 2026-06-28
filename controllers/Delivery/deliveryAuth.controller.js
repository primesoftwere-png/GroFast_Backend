// controllers/Delivery/deliveryAuth.controller.js
const User = require("../../models/user.model");
const DeliveryBoy = require("../../models/DeliveryBoy/DeliveryBoy");
const DeliveryBoyWallet = require("../../models/DeliveryBoy/DeliveryBoyWallet");
const DeliveryBoyKYC = require("../../models/DeliveryBoy/DeliveryBoyKYC");
const crypto = require("crypto");

// ✅ Register Delivery Boy
module.exports.registerDeliveryBoy = async (req, res) => {
  try {
    const { 
      fullname, 
      email, 
      phone, 
      password,
      firstName,
      lastName,
      vehicleType,
      vehicleNumber
    } = req.body;

    // Validation
    if (!fullname || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: fullname, email, phone, password"
      });
    }

    if (!firstName || !vehicleType || !vehicleNumber) {
      return res.status(400).json({
        success: false,
        message: "Delivery boy details required: firstName, vehicleType, vehicleNumber"
      });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    // Email validation
    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    // Phone validation
    if (!/^\d{10,15}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format (10-15 digits required)"
      });
    }

    // Vehicle type validation
    const validVehicleTypes = ['bike', 'scooter', 'bicycle', 'car'];
    if (!validVehicleTypes.includes(vehicleType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid vehicle type. Allowed: ${validVehicleTypes.join(', ')}`
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
        message: "User already exists with this email or phone"
      });
    }

    // Hash password
    const hashedPassword = await User.hashPassword(password);

    // Create user with deliveryBoy role
    const userData = {
      fullname: fullname.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password: hashedPassword,
      role: 'deliveryBoy',
      accountStatus: 'pending', // Pending until KYC approved
      roleDetails: {
        deliveryBoy: {
          vehicleNumber: vehicleNumber.trim(),
          drivingLicense: '',
          deliveryBoyAddress: '',
          deliveryBoyPhone: phone.trim(),
          deliveryBoyStatus: 'inactive',
          Coordinates: { lat: 0, lng: 0 }
        }
      }
    };

    const savedUser = await User.create(userData);

    if (!savedUser) {
      return res.status(400).json({
        success: false,
        message: "User creation failed"
      });
    }

    // Create delivery boy profile
    const deliveryBoyData = {
      userId: savedUser._id,
      firstName: firstName.trim(),
      lastName: lastName ? lastName.trim() : '',
      vehicleType: vehicleType,
      vehicleNumber: vehicleNumber.trim(),
      isOnline: false,
      isAvailable: false,
      isBlocked: false
    };

    const deliveryBoy = await DeliveryBoy.create(deliveryBoyData);

    // Create wallet
    const wallet = await DeliveryBoyWallet.create({
      deliveryBoyId: savedUser._id,
      balance: 0,
      codLimit: 1000
    });

    // Generate token
    const token = await savedUser.generateAuthToken();

    // Response
    const userResponse = savedUser.toObject();
    delete userResponse.password;

    return res.status(201).json({
      success: true,
      message: "Delivery boy registered successfully. Please complete KYC to activate account.",
      data: {
        user: userResponse,
        deliveryBoy: deliveryBoy,
        wallet: wallet,
        token: token
      }
    });

  } catch (error) {
    console.error("Delivery boy registration error:", error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `User already exists with this ${field}`
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error during registration",
      error: error.message
    });
  }
};

// ✅ Login Delivery Boy
module.exports.loginDeliveryBoy = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("email and password : ",email,password)

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    // Find user
    const user = await User.findOne({ 
      email: email.toLowerCase().trim(),
      role: 'deliveryBoy'
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Check if blocked (but allow login if blocked due to COD limit)
    const deliveryBoy = await DeliveryBoy.findOne({ userId: user._id });
    if (deliveryBoy && deliveryBoy.isBlocked && deliveryBoy.blockReason !== 'COD limit exceeded') {
      return res.status(403).json({
        success: false,
        message: `Your account is blocked. Reason: ${deliveryBoy.blockReason || 'Not specified'}`,
        isBlocked: true
      });
    }

    // Check KYC status (Bypassed for testing)
    const kyc = await DeliveryBoyKYC.findOne({ deliveryBoyId: user._id });
    const kycStatus = (kyc && kyc.status === 'approved') ? 'approved' : 'approved'; // Force 'approved'

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
      message: "Login successful",
      data: {
        user: userResponse,
        deliveryBoy: deliveryBoy,
        kycStatus: kycStatus,
        token: token
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during login",
      error: error.message
    });
  }
};

// ✅ Verify Email (OTP-based)
module.exports.verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validation
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required"
      });
    }

    // Find user
    const user = await User.findOne({ 
      email: email.toLowerCase().trim(),
      role: 'deliveryBoy'
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // In production, verify OTP from database/cache
    // For now, simple validation
    if (otp !== "123456") { // Replace with actual OTP verification
      return res.status(400).json({
        success: false,
        message: "Invalid OTP"
      });
    }

    // Update email verification status
    user.emailVerified = true;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Email verified successfully"
    });

  } catch (error) {
    console.error("Email verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during email verification",
      error: error.message
    });
  }
};

// ✅ Logout Delivery Boy
module.exports.logoutDeliveryBoy = async (req, res) => {
  try {
    // Set delivery boy offline
    if (req.user && req.user._id) {
      await DeliveryBoy.findOneAndUpdate(
        { userId: req.user._id },
        { 
          isOnline: false,
          lastActiveAt: Date.now()
        }
      );
    }

    // Clear cookie
    res.clearCookie("token");

    return res.status(200).json({
      success: true,
      message: "Logout successful"
    });

  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during logout",
      error: error.message
    });
  }
};
