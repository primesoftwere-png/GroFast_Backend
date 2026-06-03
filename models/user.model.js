// models/user.model.js (Unchanged: Logic is Perfected; Issue Was in Service Not Delegating to Model's login())
const dotenv = require("dotenv");
dotenv.config();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    fullname: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "admin", "deliveryBoy", "superadmin"],
      default: "user",
    },
    accountStatus: {
      type: String,
      enum: ["pending", "active", "blocked"],
      default: "active",
    },
    roleDetails: {
      user: {
        userAddress: String,
      },
      admin: {
        shopName: String,
        shopGST: String,
        shopAddress: String,
      },
      deliveryBoy: {
        vehicleNumber: String,
        drivingLicense: String,
        deliveryBoyAddress: String,
        deliveryBoyPhone: String,
        Coordinates: {
          lat: Number,
          lng: Number,
        },
        deliveryBoyStatus: {
          type: String,
          enum: ["active", "inactive"],
          default: "inactive",
        },
      },
      shopkeeper: {
        status: {
          type: String,
          enum: ["pending", "active", "blocked"],
          default: "pending",
        },
        rejectReason: {
          type: String,
          maxlength: 500,
        },
      },
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    address: {
      type: String,
      required: false,
    },
    googleId: { type: String, unique: true, sparse: true },
    otp: { type: String },
    otpExpires: { type: Date }
  },
  { timestamps: true }
);

// Instance method: Direct check for login allowance based on role (no sync needed)
userSchema.methods.isLoginAllowed = function () {
  if (this.role === 'admin') {
    // For shopkeepers (admin role), check shopkeeper status directly
    return this.roleDetails?.shopkeeper?.status === 'active';
  } else if (this.role === 'deliveryBoy') {
    // For delivery boys, check deliveryBoyStatus directly
    return this.roleDetails?.deliveryBoy?.deliveryBoyStatus === 'active';
  }
  // For other roles (user, superadmin), use accountStatus
  return this.accountStatus === 'active';
};

// Generate auth token (updated: include effective status for middleware validation if needed)
userSchema.methods.generateAuthToken = async function () {
  const user = this;
  const effectiveStatus = this.isLoginAllowed() ? 'active' : 'inactive';
  const token = jwt.sign(
    {
      _id: user._id.toString(),
      role: user.role,
      effectiveStatus, // Use effective status instead of raw accountStatus
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  return token;
};

// Compare password (existing)
userSchema.methods.comparePassword = async function (password) {
  const isMatch = await bcrypt.compare(password, this.password);
  return isMatch;
};

// Static: Hash password (existing)
userSchema.statics.hashPassword = async function (password) {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  return hashedPassword;
};

// Static: Verify auth token (existing)
userSchema.statics.verifyAuthToken = async function (token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error("Invalid token");
  }
};

// New Static: General Login Method (Perfected: Role-Specific Status Checks and Contextual Error Messages)
userSchema.statics.login = async function (email, password) {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }
  const trimmedEmail = email.trim().toLowerCase();
  const user = await this.findOne({ email: trimmedEmail });
  if (!user) {
    throw new Error('Invalid credentials');
  }
  const isPasswordMatch = await user.comparePassword(password);
  if (!isPasswordMatch) {
    throw new Error('Invalid credentials');
  }
  // Check login allowance with role-specific logic
  if (!user.isLoginAllowed()) {
    let statusMessage = 'Your account is not active.';
    let currentStatus = user.accountStatus;
    if (user.role === 'admin') {
      // Shopkeeper-specific
      currentStatus = user.roleDetails?.shopkeeper?.status || 'pending';
      if (currentStatus === 'pending') {
        statusMessage = 'Your shop registration is pending superadmin approval. You will be notified once verified.';
      } else if (currentStatus === 'blocked') {
        statusMessage = `Your shop account has been blocked. Reason: ${user.roleDetails?.shopkeeper?.rejectReason || 'Not specified'}. Contact support to appeal.`;
      }
    } else if (user.role === 'deliveryBoy') {
      // Delivery boy-specific
      currentStatus = user.roleDetails?.deliveryBoy?.deliveryBoyStatus || 'inactive';
      if (currentStatus === 'inactive') {
        statusMessage = 'Your delivery boy account is inactive. Await admin activation.';
      }
    } else {
      // Generic for other roles
      if (currentStatus === 'pending') {
        statusMessage = 'Your account is pending approval. You will be notified once verified.';
      } else if (currentStatus === 'blocked') {
        statusMessage = 'Your account has been blocked. Contact support for unblock.';
      }
    }
    throw new Error(`Invalid credentials: ${statusMessage}`);
  }
  // Generate token with effective status
  const token = await user.generateAuthToken();
  // Sanitize user data
  const safeUser = user.toObject();
  delete safeUser.password;
  if (safeUser.passwordHash) delete safeUser.passwordHash;
  return {
    success: true,
    message: 'Login successful',
    data: {
      user: safeUser,
      token,
      status: 'active', // Confirmed active since check passed
    },
  };
};

const userModel = mongoose.models.User || mongoose.model("User", userSchema);
module.exports = userModel;