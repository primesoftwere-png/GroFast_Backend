const mongoose = require("mongoose");

const shopkeeperSchema = new mongoose.Schema(
  {
    // 🔹 Basic Shop Info
    shopName: {
      type: String,
      required: true,
      trim: true,
    },
    ownerName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },

    // 🔹 Shop Details
    shopCategory: {
      type: String,
      required: true,
      enum: ["Grocery", "Vegetables", "Fruits", "Dairy", "Bakery", "Other"],
    },
    shopGST: {
      type: String,
      trim: true,
    },
    shopLicenseNo: {
      type: String,
      trim: true,
    },
    shopImage: {
      type: String,
      default: "",
    },

    // 🔹 Address Details
    address: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    pincode: {
      type: String,
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },

    // 🔹 Shop Timings
    openingTime: {
      type: String,
      required: true,
    },
    closingTime: {
      type: String,
      required: true,
    },
    isOpen: {
      type: Boolean,
      default: false,
    },

    // 🔹 Verification / Status
    verified: {
      type: Boolean,
      default: false,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },

    // 🔹 Inventory / Performance Stats
    highestRating: {
      type: Number,
      default: 0,
    },
    totalProducts: {
      type: Number,
      default: 0,
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    totalSold: {
      type: Number,
      default: 0,
    },
    totalUsers: {
      type: Number,
      default: 0,
    },
    totalDelivery: {
      type: Number,
      default: 0,
    },
    profit: {
      type: Number,
      default: 0,
    },
    walletBalance: {
      type: Number,
      default: 0,
    },

    // 🔹 References
    inventory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Inventory",
      },
    ],
  },
  { timestamps: true }
);

// Index for Geo Queries
shopkeeperSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Shopkeeper", shopkeeperSchema);
