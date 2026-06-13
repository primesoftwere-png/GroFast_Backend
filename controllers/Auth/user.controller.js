const userModel = require("../../models/user.model");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

module.exports.register = async (req, res) => {
  try {
    const { fullname, email, password, phone, role, roleDetails } = req.body;

    // Validate required fields
    if (!fullname || !email || !password || !phone) {
      return res.status(400).json({ 
        success: false,
        message: "All fields are required: fullname, email, password, phone" 
      });
    }

    // Password length validation
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: "Password must be at least 6 characters" 
      });
    }

    // Email format validation
    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid email format" 
      });
    }

    // Phone format validation (10-15 digits)
    if (!/^\d{10,15}$/.test(phone)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid phone number format (10-15 digits required)" 
      });
    }

    // Check for existing user by email
    const existingUserByEmail = await userModel.findOne({ email: email.toLowerCase().trim() });
    if (existingUserByEmail) {
      return res.status(400).json({ 
        success: false,
        message: "User already exists with this email" 
      });
    }

    // Check for existing user by phone
    const existingUserByPhone = await userModel.findOne({ phone: phone.trim() });
    if (existingUserByPhone) {
      return res.status(400).json({ 
        success: false,
        message: "User already exists with this phone number" 
      });
    }

    // Validate and set role
    const validRoles = ['user', 'admin', 'deliveryBoy', 'superadmin'];
    const userRole = role || 'user';
    
    if (!validRoles.includes(userRole)) {
      return res.status(400).json({ 
        success: false,
        message: `Invalid role. Allowed roles: ${validRoles.join(', ')}` 
      });
    }

    // Hash password before saving
    const hashedPassword = await userModel.hashPassword(password);

    // Prepare user data
    const userData = {
      fullname: fullname.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password: hashedPassword,
      role: userRole,
      roleDetails: {}
    };

    // Set role-specific defaults and roleDetails
    if (userRole === 'admin') {
      // Shopkeeper role
      userData.accountStatus = 'pending';
      userData.roleDetails = {
        shopkeeper: {
          status: 'pending',
          rejectReason: ''
        },
        admin: roleDetails?.admin || {}
      };
    } else if (userRole === 'deliveryBoy') {
      userData.accountStatus = 'active';
      userData.roleDetails = {
        deliveryBoy: {
          vehicleNumber: roleDetails?.deliveryBoy?.vehicleNumber || '',
          drivingLicense: roleDetails?.deliveryBoy?.drivingLicense || '',
          deliveryBoyAddress: roleDetails?.deliveryBoy?.deliveryBoyAddress || '',
          deliveryBoyPhone: roleDetails?.deliveryBoy?.deliveryBoyPhone || phone,
          deliveryBoyStatus: 'inactive',
          Coordinates: roleDetails?.deliveryBoy?.Coordinates || { lat: 0, lng: 0 }
        }
      };
    } else if (userRole === 'user') {
      userData.accountStatus = 'active';
      userData.roleDetails = {
        user: {
          userAddress: roleDetails?.user?.userAddress || ''
        }
      };
    } else {
      // superadmin
      userData.accountStatus = 'active';
      userData.roleDetails = {};
    }
    
    // Create user
    const savedUser = await userModel.create(userData);
    
    if (!savedUser) {
      return res.status(400).json({ 
        success: false,
        message: "User creation failed" 
      });
    }

    console.log("New user registered:", savedUser._id);

    // Generate auth token
    const token = await savedUser.generateAuthToken();
    
    if (!token) {
      return res.status(400).json({ 
        success: false,
        message: "Token generation failed" 
      });
    }

    // Set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    
    // Exclude sensitive fields from response
    const userResponse = savedUser.toObject();
    delete userResponse.password;
    delete userResponse.resetPasswordToken;
    delete userResponse.resetPasswordExpire;
    delete userResponse.__v;
    
    return res.status(201).json({ 
      success: true,
      message: "User registered successfully", 
      user: userResponse, 
      token 
    });

  } catch (error) {
    console.error("Registration error:", error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        success: false,
        message: `User already exists with this ${field}` 
      });
    }
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false,
        message: "Validation failed", 
        errors: validationErrors 
      });
    }
    
    return res.status(500).json({ 
      success: false,
      message: "Server error during registration", 
      error: error.message 
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await userModel.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Generate token
    const resetToken = crypto.randomBytes(20).toString("hex");

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 mins
    await user.save();

    // Reset link
    const resetUrl = `${process.env.Frontend_URL}/reset-password/${resetToken}`;

    // Send email
    const transporter = nodemailer.createTransporter({
      service: "gmail",
      auth: {
        user: process.env.useremail,
        pass: process.env.passswordemail,
      },
    });

    await transporter.sendMail({
      from: process.env.useremail,
      to: user.email,
      subject: "Password Reset Request",
      html: `<p>You requested a password reset</p>
             <p><a href="${resetUrl}">Click here to reset password</a></p>`,
    });

    res.json({ message: "Password reset link sent to email" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error in forgot password", error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user = await userModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).json({ message: "Invalid or expired token" });

    // Hash the new password
    const hashedPassword = await userModel.hashPassword(password);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error in resetting password", error: error.message });
  }
};

module.exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("email , password : ", email, password);
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }
    console.log("email, password", email, password);
    
    // Login user directly
    const trimmedEmail = email.trim().toLowerCase();
    const result = await userModel.login(trimmedEmail, password);
    
    if (!result || !result.data) {
      return res.status(401).json({ 
        message: "Invalid credentials"
      });
    }

    if (!result.data.token) {
      return res.status(400).json({ message: "Token generation failed" });
    }    

    const userResponse = result.data.user;
    
    res.status(200).json({ 
      message: result.message || "Login successful", 
      user: userResponse, 
      token: result.data.token,
      status: result.data.status || 'active'
    });
  } catch (error) {
    console.error("Login controller error:", error.message || error); // Enhanced logging
    res.status(500).json({ 
      message: error.message || "Server error", 
      error: { name: error.name || 'UnknownError' } // Non-sensitive details
    });
  }
};

module.exports.googleLogin = async (req, res) => {
  try {
    const { email, fullname, phone } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: "Email is required for Google login" });
    }

    const trimmedEmail = email.trim().toLowerCase();
    let user = await userModel.findOne({ email: trimmedEmail });

    if (!user) {
      // Generate a random password for Google-authenticated users
      const randomPassword = crypto.randomBytes(8).toString("hex");
      const hashedPassword = await userModel.hashPassword(randomPassword);
      
      // If phone is not provided, generate a dummy 10-digit phone number to satisfy the schema
      // A unique number starting with 9 to appear somewhat realistic
      const dummyPhone = "9" + Math.floor(Math.random() * 1000000000).toString().padStart(9, "0");
      
      const userData = {
        fullname: fullname ? fullname.trim() : email.split("@")[0],
        email: trimmedEmail,
        phone: phone ? phone.trim() : dummyPhone,
        password: hashedPassword,
        role: "user",
        accountStatus: "active",
        roleDetails: {
          user: {
            userAddress: ""
          }
        }
      };
      
      user = await userModel.create(userData);
    } else {
      if (typeof user.isLoginAllowed === 'function' && !user.isLoginAllowed()) {
         return res.status(403).json({ message: "Your account is not active." });
      }
    }

    const token = await user.generateAuthToken();
    
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.resetPasswordToken;
    delete userResponse.resetPasswordExpire;
    
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(200).json({
      success: true,
      message: "Google login successful",
      user: userResponse,
      token,
      status: 'active'
    });
  } catch (error) {
    console.error("Google login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during Google login",
      error: error.message
    });
  }
};

module.exports.profile = async (req, res) => {
  try {
    // req.user only contains decoded JWT data (_id, role, effectiveStatus)
    // We need to fetch the full user from database
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Unauthorized - Invalid token data" });
    }

    const user = await userModel.findById(
      req.user._id,
      "-password -__v -resetPasswordToken -resetPasswordExpire"
    );
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.status(200).json({ 
      success: true,
      user 
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error", 
      error: error.message 
    });
  }
};

module.exports.logout = async (req, res) => {
  try {
    res.clearCookie("token");
    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error", error });
  }
};

module.exports.updateAddress = async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) {
      return res.status(400).json({ message: "Address is required" });
    }
    
    // Update location directly
    const user = await userModel.findByIdAndUpdate(
      req.user._id,
      { address: address },
      { new: true }
    );
    
    console.log("user", user);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ message: "Location updated successfully", user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error", error });
  }
};  